"""
entity_extractor.py — LLM-based named entity + relationship extraction.

Calls Mistral with a structured JSON prompt to pull:
  - entities: name, type, description, aliases
  - relationships: source → target, type, context, confidence

Filters noise (min length, confidence threshold) and resolves duplicates
via fuzzy alias matching before writing to the knowledge graph.

Public API:
    extract_entities_batch(stories: list[dict], kg) -> None
"""

import json
import logging
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.knowledge_graph import KnowledgeGraph

logger = logging.getLogger(__name__)

ENTITY_TYPES = ["person", "organization", "country", "city", "event", "concept", "policy", "financial"]
RELATION_TYPES = ["leads", "member_of", "located_in", "caused_by", "related_to",
                  "preceded_by", "affects", "announced_by", "competes_with", "part_of"]

_EXTRACT_SYSTEM = """\
You extract named entities and relationships from news articles for a knowledge graph.
Return ONLY valid JSON — no markdown, no prose, no code fences.

Entity types: person, organization, country, city, event, concept, policy, financial
Relationship types: leads, member_of, located_in, caused_by, related_to, preceded_by,
                    affects, announced_by, competes_with, part_of

JSON schema:
{
  "entities": [
    {"name": "string", "type": "entity_type", "description": "1-line", "aliases": ["string"]}
  ],
  "relationships": [
    {"source": "entity name", "target": "entity name", "type": "relation_type",
     "context": "brief quote or reason", "confidence": 0.0-1.0}
  ]
}

Rules:
- Skip entities with name shorter than 3 characters.
- Skip generic words ("The", "However", "Government" without context).
- Only include relationships with confidence >= 0.6.
- Return at most 8 entities and 6 relationships per article.
"""

_EXTRACT_PROMPT = """\
Extract entities and relationships from this news article.

Title: {title}
Content: {content}
"""


async def _extract_from_story(story: dict) -> dict | None:
    """Call Mistral once for a single story. Returns raw parsed JSON or None."""
    from app.services.llm import get_client
    llm = get_client()

    content = story.get("raw_summary") or story.get("summary", "")
    prompt = _EXTRACT_PROMPT.format(
        title=story["title"],
        content=content[:1000],
    )

    try:
        raw = await llm.complete(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=_EXTRACT_SYSTEM,
        )
        # Strip markdown fences if present
        raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("Entity extraction JSON parse error for '%s': %s", story["title"][:50], e)
        return None
    except Exception as e:
        logger.warning("Entity extraction LLM call failed: %s", e)
        return None


def _is_valid_entity(entity: dict) -> bool:
    name = entity.get("name", "")
    etype = entity.get("type", "")
    return (
        len(name) >= 3
        and etype in ENTITY_TYPES
        and name.lower() not in {"the", "a", "an", "it", "he", "she", "they"}
    )


def _is_valid_relationship(rel: dict, entity_names: set[str]) -> bool:
    return (
        rel.get("type", "") in RELATION_TYPES
        and float(rel.get("confidence", 0)) >= 0.6
        and rel.get("source", "") in entity_names
        and rel.get("target", "") in entity_names
    )


async def extract_entities_batch(stories: list[dict], kg: "KnowledgeGraph") -> None:
    """
    Extract entities + relationships for all stories and write to the knowledge graph.
    Processes stories sequentially to avoid overwhelming the LLM API.
    """
    import asyncio

    total_entities = 0
    total_rels = 0

    for story in stories:
        try:
            result = await _extract_from_story(story)
            if not result:
                continue

            raw_entities: list[dict] = result.get("entities", [])
            raw_rels: list[dict] = result.get("relationships", [])

            # Filter and validate
            valid_entities = [e for e in raw_entities if _is_valid_entity(e)]
            entity_names = {e["name"] for e in valid_entities}
            valid_rels = [r for r in raw_rels if _is_valid_relationship(r, entity_names)]

            # Upsert entities into KG
            for entity in valid_entities:
                kg.upsert_entity(
                    name=entity["name"],
                    entity_type=entity.get("type", "concept"),
                    description=entity.get("description", ""),
                    aliases=entity.get("aliases", []),
                    article_title=story["title"],
                )

            # Upsert relationships
            for rel in valid_rels:
                kg.upsert_relationship(
                    source_name=rel["source"],
                    target_name=rel["target"],
                    rel_type=rel["type"],
                    context=rel.get("context", ""),
                    confidence=float(rel.get("confidence", 0.7)),
                    article_title=story["title"],
                )

            total_entities += len(valid_entities)
            total_rels += len(valid_rels)

            # Small delay between LLM calls
            await asyncio.sleep(0.3)

        except Exception as e:
            logger.warning("Failed to process story '%s': %s", story.get("title", "")[:50], e)

    logger.info(
        "Entity extraction done: %d entities, %d relationships across %d stories",
        total_entities, total_rels, len(stories),
    )
