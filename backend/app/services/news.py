"""
news.py — RSS news ingestion pipeline.

Fetches from 6 European/global RSS feeds, deduplicates by title similarity,
picks the top 5 most recent stories, and uses Mistral to generate
spoken-optimised summaries (3-4 short sentences each).

Cache is global (shared across all sessions) and refreshes every 30 minutes.

Public API:
    stories = await get_briefing()    # returns list[StoryBrief]
    await refresh_news_cache()        # force refresh
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import feedparser
import httpx

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Feed list
# ─────────────────────────────────────────────────────────────

RSS_FEEDS = [
    {"url": "http://feeds.bbci.co.uk/news/rss.xml", "source": "BBC News"},
    {"url": "http://feeds.bbci.co.uk/news/world/europe/rss.xml", "source": "BBC Europe"},
    {"url": "https://feeds.reuters.com/reuters/worldNews", "source": "Reuters"},
    {"url": "https://www.theguardian.com/world/rss", "source": "The Guardian"},
    {"url": "https://rss.dw.com/rdf/rss-en-all", "source": "Deutsche Welle"},
    {"url": "https://www.france24.com/en/rss", "source": "France 24"},
]

CACHE_TTL_SECONDS = 1800  # 30 minutes

_cache: dict[str, Any] = {
    "stories": [],
    "fetched_at": None,
}


# ─────────────────────────────────────────────────────────────
# Fetch helpers
# ─────────────────────────────────────────────────────────────

async def _fetch_feed(client: httpx.AsyncClient, feed_meta: dict) -> list[dict]:
    """Fetch one RSS feed and return a list of raw story dicts."""
    try:
        resp = await client.get(feed_meta["url"], timeout=8.0, follow_redirects=True)
        resp.raise_for_status()
        parsed = feedparser.parse(resp.text)
    except Exception as e:
        logger.warning("Failed to fetch feed %s: %s", feed_meta["url"], e)
        return []

    stories = []
    for entry in parsed.entries[:10]:  # cap per feed
        title = getattr(entry, "title", "").strip()
        summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
        link = getattr(entry, "link", "")
        published_parsed = getattr(entry, "published_parsed", None)

        if not title or not link:
            continue

        # Convert published_parsed (struct_time) → datetime
        if published_parsed:
            try:
                import time
                pub_dt = datetime.fromtimestamp(time.mktime(published_parsed), tz=timezone.utc)
            except Exception:
                pub_dt = datetime.now(tz=timezone.utc)
        else:
            pub_dt = datetime.now(tz=timezone.utc)

        stories.append({
            "title": title,
            "raw_summary": _strip_html(summary),
            "url": link,
            "source": feed_meta["source"],
            "published_dt": pub_dt,
            "published": pub_dt.strftime("%Y-%m-%d %H:%M UTC"),
        })

    return stories


def _strip_html(text: str) -> str:
    """Remove HTML tags from text for clean summarization."""
    import re
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()[:800]  # cap for LLM input


# ─────────────────────────────────────────────────────────────
# Deduplication
# ─────────────────────────────────────────────────────────────

def _deduplicate(stories: list[dict], threshold: int = 82) -> list[dict]:
    """Remove near-duplicate stories using fuzzy title matching."""
    try:
        from rapidfuzz import fuzz
    except ImportError:
        # Fallback: exact title match only
        logger.warning("rapidfuzz not installed — using exact deduplication")
        seen: set[str] = set()
        unique = []
        for s in stories:
            if s["title"] not in seen:
                seen.add(s["title"])
                unique.append(s)
        return unique

    seen_titles: list[str] = []
    unique: list[dict] = []
    for story in stories:
        title = story["title"]
        is_dup = any(
            fuzz.token_sort_ratio(title, seen) >= threshold
            for seen in seen_titles
        )
        if not is_dup:
            seen_titles.append(title)
            unique.append(story)
    return unique


# ─────────────────────────────────────────────────────────────
# Summarization
# ─────────────────────────────────────────────────────────────

_SUMMARIZE_SYSTEM = """\
You are writing spoken summaries for a voice news app. \
The summary will be read aloud, so write naturally — no bullet points, no markdown, no symbols. \
Three to four short sentences maximum. Use simple words. Avoid jargon. \
Write numbers as words. Start with the most important fact.
"""

_SUMMARIZE_PROMPT = """\
Summarise this news story in three to four spoken sentences. \
Be concise and natural — this will be read aloud.

Title: {title}
Source: {source}
Published: {published}
Content: {content}
"""


async def _summarize_story(story: dict) -> str:
    """Call Mistral to generate a spoken summary for one story."""
    from app.services.llm import get_client
    llm = get_client()

    prompt = _SUMMARIZE_PROMPT.format(
        title=story["title"],
        source=story["source"],
        published=story["published"],
        content=story["raw_summary"] or story["title"],
    )

    try:
        return await llm.complete(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=_SUMMARIZE_SYSTEM,
        )
    except Exception as e:
        logger.warning("Summarization failed for '%s': %s", story["title"], e)
        # Fallback: return cleaned raw summary
        raw = story["raw_summary"]
        return raw[:300] + "…" if len(raw) > 300 else raw or story["title"]


# ─────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────

async def refresh_news_cache() -> list[dict]:
    """Fetch all feeds, dedup, pick top 5, summarize, update cache."""
    logger.info("Refreshing news cache…")

    async with httpx.AsyncClient(headers={"User-Agent": "Samvad-Bot/1.0"}) as client:
        results = await asyncio.gather(
            *[_fetch_feed(client, feed) for feed in RSS_FEEDS],
            return_exceptions=True,
        )

    all_stories: list[dict] = []
    for r in results:
        if isinstance(r, list):
            all_stories.extend(r)

    # Sort by recency
    all_stories.sort(key=lambda s: s["published_dt"], reverse=True)

    # Deduplicate
    unique = _deduplicate(all_stories)

    # Take top 5
    top5 = unique[:5]
    logger.info("Selected %d stories after dedup (from %d raw)", len(top5), len(all_stories))

    # Summarize in parallel (up to 5 concurrent LLM calls)
    summaries = await asyncio.gather(
        *[_summarize_story(s) for s in top5],
        return_exceptions=True,
    )

    processed = []
    for story, summary in zip(top5, summaries):
        processed.append({
            "title": story["title"],
            "summary": summary if isinstance(summary, str) else story["raw_summary"][:300],
            "source": story["source"],
            "published": story["published"],
            "url": story["url"],
        })

    _cache["stories"] = processed
    _cache["fetched_at"] = datetime.now(tz=timezone.utc)
    logger.info("News cache refreshed with %d stories", len(processed))
    return processed


def _is_cache_fresh() -> bool:
    if not _cache["fetched_at"] or not _cache["stories"]:
        return False
    age = (datetime.now(tz=timezone.utc) - _cache["fetched_at"]).total_seconds()
    return age < CACHE_TTL_SECONDS


async def get_briefing() -> list[dict]:
    """Return cached stories (refreshing if stale)."""
    if not _is_cache_fresh():
        return await refresh_news_cache()
    return _cache["stories"]
