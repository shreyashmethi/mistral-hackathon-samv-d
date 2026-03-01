"""
vector_store.py — ChromaDB persistent vector store for news articles.

Two collections:
  - news_articles   : chunked article text with metadata
  - entity_contexts : entity explanation snippets (Wikipedia etc.)

Public API:
    upsert_stories(stories: list[dict]) -> int          # returns # new articles added
    search_articles(query: str, n=5, filters=None) -> list[dict]
    upsert_entity_context(entity: str, text: str) -> None
    search_entity_contexts(query: str, n=3) -> list[dict]
"""

import hashlib
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

# Disable chromadb telemetry. The env var must be set AND posthog.capture must be
# patched because chromadb 0.5.x calls posthog with a signature that newer posthog
# versions no longer accept, producing noisy "Failed to send telemetry" stderr spam.
os.environ["ANONYMIZED_TELEMETRY"] = "false"
try:
    import posthog as _posthog
    _posthog.capture = lambda *a, **kw: None  # type: ignore[attr-defined]
except ImportError:
    pass

logger = logging.getLogger(__name__)

CHROMA_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma_db")

_client = None
_articles_col = None
_entity_col = None


def _get_client():
    global _client
    if _client is None:
        import chromadb
        from chromadb.config import Settings
        os.makedirs(CHROMA_DIR, exist_ok=True)
        _client = chromadb.PersistentClient(
            path=CHROMA_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
        logger.info("ChromaDB client initialised at %s", CHROMA_DIR)
    return _client


def _get_ef():
    """Return chromadb's ONNX-based embedding function (no PyTorch, no segfaults)."""
    from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
    return DefaultEmbeddingFunction()


def _get_articles_col():
    global _articles_col
    if _articles_col is None:
        _articles_col = _get_client().get_or_create_collection(
            name="news_articles",
            embedding_function=_get_ef(),
            metadata={"hnsw:space": "cosine"},
        )
    return _articles_col


def _get_entity_col():
    global _entity_col
    if _entity_col is None:
        _entity_col = _get_client().get_or_create_collection(
            name="entity_contexts",
            embedding_function=_get_ef(),
            metadata={"hnsw:space": "cosine"},
        )
    return _entity_col


# ─────────────────────────────────────────────────────────────
# Chunking
# ─────────────────────────────────────────────────────────────

def _chunk_text(text: str, max_words: int = 200) -> list[str]:
    """Split text into chunks by paragraph, capping at max_words each."""
    paragraphs = [p.strip() for p in re.split(r"\n{2,}|\r\n\r\n", text) if p.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for para in paragraphs:
        words = len(para.split())
        if current_words + words > max_words and current:
            chunks.append(" ".join(current))
            current = [para]
            current_words = words
        else:
            current.append(para)
            current_words += words

    if current:
        chunks.append(" ".join(current))

    return chunks or [text[:800]]


def _story_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _chunk_id(article_id: str, idx: int) -> str:
    return f"{article_id}_c{idx}"


# ─────────────────────────────────────────────────────────────
# Upsert stories
# ─────────────────────────────────────────────────────────────

async def upsert_stories(stories: list[dict]) -> int:
    """Chunk articles and upsert into ChromaDB. Embedding handled by ONNX DefaultEmbeddingFunction."""
    import asyncio

    col = _get_articles_col()
    new_count = 0

    for story in stories:
        article_id = _story_id(story.get("url", story["title"]))

        # Build full text: title + summary/raw_summary
        text_body = story.get("raw_summary") or story.get("summary", "")
        full_text = f"{story['title']}. {text_body}"

        chunks = _chunk_text(full_text)

        # Check for existing chunks — skip if already stored
        existing_ids = [_chunk_id(article_id, i) for i in range(len(chunks))]
        try:
            existing = col.get(ids=existing_ids[:1])
            if existing["ids"]:
                logger.debug("Article %s already in vector store, skipping", article_id)
                continue
        except Exception:
            pass

        published_str = ""
        pub_dt = story.get("published_dt")
        if pub_dt:
            published_str = pub_dt.isoformat() if isinstance(pub_dt, datetime) else str(pub_dt)

        metadatas = [
            {
                "article_id": article_id,
                "chunk_index": i,
                "title": story["title"][:200],
                "source": story.get("source", ""),
                "published_at": published_str,
                "hotness_score": float(story.get("hotness_score", 0.5)),
                "url": story.get("url", ""),
            }
            for i in range(len(chunks))
        ]

        try:
            # Pass documents only — collection's embedding_function handles the rest
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: col.upsert(
                    ids=[_chunk_id(article_id, i) for i in range(len(chunks))],
                    documents=chunks,
                    metadatas=metadatas,
                ),
            )
            new_count += 1
        except Exception as e:
            logger.warning("Upsert failed for article %s: %s", article_id, e)

    logger.info("Vector store: %d new articles upserted", new_count)
    return new_count


# ─────────────────────────────────────────────────────────────
# Search
# ─────────────────────────────────────────────────────────────

async def search_articles(
    query: str,
    n: int = 5,
    min_hotness: float = 0.0,
) -> list[dict]:
    """
    Semantic search over news_articles collection via ONNX embedding.
    Returns list of dicts with keys: text, title, source, published_at, hotness_score, url, distance.
    Re-ranks by 0.6 * semantic_similarity + 0.4 * hotness.
    """
    import asyncio

    col = _get_articles_col()

    try:
        where: dict[str, Any] = {"hotness_score": {"$gte": min_hotness}} if min_hotness > 0 else {}

        results = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: col.query(
                query_texts=[query],           # collection embeds via ONNX — no PyTorch
                n_results=min(n * 2, 20),
                where=where if where else None,
                include=["documents", "metadatas", "distances"],
            ),
        )
    except Exception as e:
        logger.warning("Vector search failed: %s", e)
        return []

    docs = results["documents"][0]
    metas = results["metadatas"][0]
    dists = results["distances"][0]

    # Deduplicate by article_id (keep best chunk per article)
    seen_articles: dict[str, dict] = {}
    for doc, meta, dist in zip(docs, metas, dists):
        art_id = meta.get("article_id", "")
        semantic_sim = 1.0 - dist  # cosine distance → similarity
        hotness = float(meta.get("hotness_score", 0.5))
        score = 0.6 * semantic_sim + 0.4 * hotness

        if art_id not in seen_articles or score > seen_articles[art_id]["_score"]:
            seen_articles[art_id] = {
                "text": doc,
                "title": meta.get("title", ""),
                "source": meta.get("source", ""),
                "published_at": meta.get("published_at", ""),
                "hotness_score": hotness,
                "url": meta.get("url", ""),
                "distance": dist,
                "_score": score,
            }

    ranked = sorted(seen_articles.values(), key=lambda x: x["_score"], reverse=True)
    for r in ranked:
        del r["_score"]

    return ranked[:n]


# ─────────────────────────────────────────────────────────────
# Entity contexts
# ─────────────────────────────────────────────────────────────

async def upsert_entity_context(entity_name: str, text: str) -> None:
    """Store a Wikipedia/Wikidata extract for an entity (embedded via ONNX)."""
    import asyncio

    col = _get_entity_col()
    entity_id = hashlib.sha256(entity_name.lower().encode()).hexdigest()[:16]

    try:
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: col.upsert(
                ids=[entity_id],
                documents=[text],
                metadatas=[{"entity": entity_name}],
            ),
        )
    except Exception as e:
        logger.warning("Entity context upsert failed for %s: %s", entity_name, e)


async def search_entity_contexts(query: str, n: int = 3) -> list[dict]:
    """Semantic search over entity Wikipedia/Wikidata extracts (via ONNX)."""
    import asyncio

    col = _get_entity_col()
    try:
        results = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: col.query(
                query_texts=[query],
                n_results=n,
                include=["documents", "metadatas", "distances"],
            ),
        )
        out = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            out.append({"text": doc, "entity": meta.get("entity", ""), "distance": dist})
        return out
    except Exception as e:
        logger.warning("Entity context search failed: %s", e)
        return []
