"""
hotness.py — Hotness scoring engine.

Every story gets a float 0.0–1.0 reflecting how important/trending it is.
Formula (weighted combination of 5 signals):
    hotness = 0.30 * recency
            + 0.25 * cross_source
            + 0.20 * entity_velocity   (0 if no prior history)
            + 0.15 * source_authority
            + 0.10 * breaking_keyword

Public API:
    score_stories(stories: list[dict]) -> list[dict]   # adds hotness_score in-place
"""

import math
import logging
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Signal weights
# ─────────────────────────────────────────────────────────────

WEIGHTS = {
    "recency": 0.30,
    "cross_source": 0.25,
    "entity_velocity": 0.20,
    "source_authority": 0.15,
    "breaking_keyword": 0.10,
}

SOURCE_AUTHORITY: dict[str, float] = {
    "reuters": 1.0,
    "bbc": 0.95,
    "bbc news": 0.95,
    "bbc europe": 0.93,
    "the guardian": 0.90,
    "guardian": 0.90,
    "france 24": 0.85,
    "deutsche welle": 0.85,
    "dw": 0.85,
    "npr": 0.80,
    "npr news": 0.80,
    "techcrunch": 0.80,
    "ars technica": 0.80,
    "the verge": 0.75,
    "nature": 0.95,
}

BREAKING_PATTERNS = re.compile(
    r"\b(breaking|just in|urgent|developing|live updates|exclusive|alert)\b",
    re.IGNORECASE,
)


# ─────────────────────────────────────────────────────────────
# Individual signals
# ─────────────────────────────────────────────────────────────

def _recency_score(published_dt: datetime) -> float:
    """Exponential decay: 1.0 at 0 h, ~0.37 at 10 h, ~0.05 at 30 h."""
    try:
        now = datetime.now(tz=timezone.utc)
        if published_dt.tzinfo is None:
            published_dt = published_dt.replace(tzinfo=timezone.utc)
        hours_old = (now - published_dt).total_seconds() / 3600
        return math.exp(-0.1 * max(hours_old, 0))
    except Exception:
        return 0.5  # unknown age → neutral


def _source_authority_score(source: str) -> float:
    key = source.lower().strip()
    return SOURCE_AUTHORITY.get(key, 0.6)


def _breaking_keyword_score(title: str, summary: str) -> float:
    text = f"{title} {summary}"
    matches = len(BREAKING_PATTERNS.findall(text))
    return min(matches / 2.0, 1.0)


def _cross_source_score(story: dict, all_stories: list[dict]) -> float:
    """Count how many OTHER sources cover a similar story (by title word overlap)."""
    try:
        from rapidfuzz import fuzz
        title = story["title"]
        other_sources: set[str] = set()
        for other in all_stories:
            if other is story:
                continue
            if other.get("source", "") == story.get("source", ""):
                continue
            if fuzz.token_sort_ratio(title, other["title"]) >= 75:
                other_sources.add(other.get("source", "unknown"))
        # 4+ independent sources → max score
        return min(len(other_sources) / 4.0, 1.0)
    except ImportError:
        return 0.0


def _entity_velocity_score(story: dict, entity_freq: dict[str, int]) -> float:
    """Higher score when entities in this story are spiking (mentioned frequently)."""
    if not entity_freq:
        return 0.0
    entities = story.get("entities", [])
    if not entities:
        return 0.0
    scores = [min(entity_freq.get(e.lower(), 0) / 5.0, 1.0) for e in entities]
    return sum(scores) / len(scores)


# ─────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────

def score_stories(stories: list[dict], entity_freq: dict[str, int] | None = None) -> list[dict]:
    """
    Compute hotness_score for each story dict in-place.
    Returns the same list sorted by hotness_score descending.
    """
    if entity_freq is None:
        entity_freq = {}

    for story in stories:
        pub_dt = story.get("published_dt") or datetime.now(tz=timezone.utc)
        recency      = _recency_score(pub_dt)
        cross        = _cross_source_score(story, stories)
        authority    = _source_authority_score(story.get("source", ""))
        breaking     = _breaking_keyword_score(
            story.get("title", ""),
            story.get("raw_summary", story.get("summary", "")),
        )
        velocity     = _entity_velocity_score(story, entity_freq)

        hotness = (
            WEIGHTS["recency"]           * recency
            + WEIGHTS["cross_source"]    * cross
            + WEIGHTS["entity_velocity"] * velocity
            + WEIGHTS["source_authority"] * authority
            + WEIGHTS["breaking_keyword"] * breaking
        )
        story["hotness_score"] = round(hotness, 4)

        logger.debug(
            "hotness=%.3f (rec=%.2f cs=%.2f vel=%.2f auth=%.2f brk=%.2f) — %s",
            hotness, recency, cross, velocity, authority, breaking, story.get("title", "")[:60],
        )

    stories.sort(key=lambda s: s.get("hotness_score", 0), reverse=True)
    return stories
