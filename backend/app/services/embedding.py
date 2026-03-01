"""
embedding.py — Text → vector embeddings.

Primary: sentence-transformers/all-MiniLM-L6-v2 (local, 384-dim, fast).
Swap to Mistral Embed by setting MISTRAL_EMBED=true in .env.

Public API:
    embed(texts: list[str]) -> list[list[float]]
    embed_one(text: str) -> list[float]
"""

import logging
import os
from functools import lru_cache

logger = logging.getLogger(__name__)

_USE_MISTRAL = os.getenv("MISTRAL_EMBED", "false").lower() == "true"

# Prevent tokenizer fork-deadlocks and force CPU to avoid MPS segfaults on Apple Silicon
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")


@lru_cache(maxsize=1)
def _get_st_model():
    """Lazy-load SentenceTransformer model on CPU (avoids MPS segfaults on Apple Silicon)."""
    from sentence_transformers import SentenceTransformer
    logger.info("Loading sentence-transformer model all-MiniLM-L6-v2 (cpu)…")
    model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
    logger.info("Embedding model loaded (384-dim, cpu)")
    return model


async def embed(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of texts.
    Returns list of float vectors (384-dim with sentence-transformers).
    Runs the CPU-bound encode() in a threadpool to keep the event loop free.
    """
    if not texts:
        return []

    if _USE_MISTRAL:
        return await _embed_mistral(texts)

    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _embed_local, texts)


async def embed_one(text: str) -> list[float]:
    results = await embed([text])
    return results[0] if results else []


# ─────────────────────────────────────────────────────────────
# Local (sentence-transformers)
# ─────────────────────────────────────────────────────────────

def _embed_local(texts: list[str]) -> list[list[float]]:
    model = _get_st_model()
    # encode() is CPU-bound; run synchronously — caller wraps in thread if needed.
    # convert_to_numpy=True is default; convert to plain Python lists for ChromaDB.
    vectors = model.encode(
        texts,
        batch_size=16,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    return [v.tolist() for v in vectors]


# ─────────────────────────────────────────────────────────────
# Mistral Embed (optional, set MISTRAL_EMBED=true)
# ─────────────────────────────────────────────────────────────

async def _embed_mistral(texts: list[str]) -> list[list[float]]:
    """Batch embed using Mistral Embed API (1024-dim)."""
    from app.services.llm import get_client
    client = get_client()
    results: list[list[float]] = []
    # Batch in groups of 16
    for i in range(0, len(texts), 16):
        batch = texts[i : i + 16]
        try:
            resp = client._client.embeddings.create(
                model="mistral-embed",
                inputs=batch,
            )
            results.extend([d.embedding for d in resp.data])
        except Exception as e:
            logger.warning("Mistral embed failed for batch %d: %s — falling back to local", i, e)
            results.extend(_embed_local(batch))
    return results
