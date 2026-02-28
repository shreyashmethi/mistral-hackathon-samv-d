"""
rag.py — Entity context retrieval via Wikipedia + Wikidata.

For ENTITY_QUERY intent: fetches structured entity data from Wikidata
and a 2-paragraph extract from Wikipedia in parallel, then synthesises
a spoken 2-3 sentence explanation with Mistral.

Global in-memory cache: entity lookups persist for the process lifetime.

Public API:
    context = await get_entity_context(entity_name)  # returns dict
    explanation = await explain_entity(
        entity_name, article_context, prior_entities
    )  # returns spoken string
"""

import asyncio
import logging
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Global entity cache (shared across sessions)
# ─────────────────────────────────────────────────────────────

_entity_cache: dict[str, dict] = {}  # entity_name (lower) → context dict


# ─────────────────────────────────────────────────────────────
# Wikidata lookup
# ─────────────────────────────────────────────────────────────

async def _search_wikidata(entity: str, client: httpx.AsyncClient) -> dict:
    """Search Wikidata for an entity and return structured facts."""
    params = {
        "action": "wbsearchentities",
        "search": entity,
        "language": "en",
        "format": "json",
        "limit": 1,
        "type": "item",
    }
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(params)

    try:
        resp = await client.get(url, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning("Wikidata search failed for '%s': %s", entity, e)
        return {}

    results = data.get("search", [])
    if not results:
        return {}

    match = results[0]
    qid = match.get("id", "")
    label = match.get("label", entity)
    description = match.get("description", "")

    # Fetch a handful of key properties (P31=instance-of, P17=country, P106=occupation, P569/P570=birth/death)
    facts = await _fetch_wikidata_props(qid, client)

    return {
        "qid": qid,
        "label": label,
        "description": description,
        "facts": facts,
    }


async def _fetch_wikidata_props(qid: str, client: httpx.AsyncClient) -> list[str]:
    """Fetch human-readable key facts for a Wikidata entity."""
    if not qid:
        return []

    params = {
        "action": "wbgetentities",
        "ids": qid,
        "format": "json",
        "languages": "en",
        "props": "claims|labels|descriptions",
    }
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(params)

    try:
        resp = await client.get(url, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning("Wikidata props fetch failed for %s: %s", qid, e)
        return []

    entity_data = data.get("entities", {}).get(qid, {})
    claims = entity_data.get("claims", {})
    facts: list[str] = []

    # P31 = instance of
    p31 = _extract_claim_label(claims, "P31")
    if p31:
        facts.append(f"Type: {p31}")

    # P17 = country
    p17 = _extract_claim_label(claims, "P17")
    if p17:
        facts.append(f"Country: {p17}")

    # P106 = occupation
    p106 = _extract_claim_label(claims, "P106")
    if p106:
        facts.append(f"Occupation: {p106}")

    # P571 = inception / P569 = birth date
    for prop, label in [("P569", "Born"), ("P571", "Founded"), ("P577", "Published")]:
        val = _extract_time_claim(claims, prop)
        if val:
            facts.append(f"{label}: {val}")
            break

    return facts[:4]  # cap at 4 facts


def _extract_claim_label(claims: dict, prop: str) -> str:
    """Extract the English label from the first claim of a property."""
    snak = claims.get(prop, [{}])[0].get("mainsnak", {})
    dv = snak.get("datavalue", {})
    val = dv.get("value", {})
    if isinstance(val, dict):
        return val.get("id", "")  # QID — we'd need another lookup for label
    return str(val) if val else ""


def _extract_time_claim(claims: dict, prop: str) -> str:
    """Extract year from a time-valued Wikidata claim."""
    snak = claims.get(prop, [{}])[0].get("mainsnak", {})
    dv = snak.get("datavalue", {})
    val = dv.get("value", {})
    if isinstance(val, dict):
        time_str = val.get("time", "")
        # Format: +1958-10-23T00:00:00Z → 1958
        if time_str and len(time_str) >= 5:
            return time_str[1:5]  # year
    return ""


# ─────────────────────────────────────────────────────────────
# Wikipedia summary fetch
# ─────────────────────────────────────────────────────────────

async def _fetch_wikipedia(entity: str, client: httpx.AsyncClient) -> str:
    """Fetch a 2-paragraph Wikipedia extract for the entity."""
    title = urllib.parse.quote(entity.replace(" ", "_"))
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}"

    try:
        resp = await client.get(url, timeout=5.0, follow_redirects=True)
        if resp.status_code == 404:
            return ""
        resp.raise_for_status()
        data = resp.json()
        return data.get("extract", "")[:600]  # cap at 600 chars
    except Exception as e:
        logger.warning("Wikipedia fetch failed for '%s': %s", entity, e)
        return ""


# ─────────────────────────────────────────────────────────────
# Combined entity context
# ─────────────────────────────────────────────────────────────

async def get_entity_context(entity_name: str) -> dict:
    """
    Fetch Wikidata + Wikipedia in parallel, return combined context dict.
    Results are cached globally for the process lifetime.
    """
    cache_key = entity_name.lower().strip()

    if cache_key in _entity_cache:
        logger.info("Entity cache hit for '%s'", entity_name)
        return _entity_cache[cache_key]

    async with httpx.AsyncClient(headers={"User-Agent": "Samvad-Bot/1.0"}) as client:
        wikidata_result, wikipedia_extract = await asyncio.gather(
            _search_wikidata(entity_name, client),
            _fetch_wikipedia(entity_name, client),
        )

    context = {
        "entity": entity_name,
        "wikidata": wikidata_result,
        "wikipedia": wikipedia_extract,
    }
    _entity_cache[cache_key] = context
    return context


# ─────────────────────────────────────────────────────────────
# Spoken explanation generation
# ─────────────────────────────────────────────────────────────

_ENTITY_SYSTEM = """\
You are explaining a person, organisation, or concept to a listener — spoken aloud, not written. \
Give two to three short sentences. Start with the most news-relevant fact. \
Add one sentence of background. Connect to the current article if possible. \
No markdown, no lists, no jargon. Short sentences only.
"""

_ENTITY_PROMPT = """\
Entity: {entity}
Wikipedia: {wikipedia}
Wikidata description: {description}
Wikidata facts: {facts}
Current article context: {article_context}

Explain this entity in two to three spoken sentences. Focus on why it matters for today's news.
"""


async def explain_entity(
    entity_name: str,
    article_context: str = "",
    prior_explanation: str = "",
) -> str:
    """
    Generate a spoken explanation for an entity.
    If prior_explanation exists, returns a brief reference to it instead of a full repeat.
    """
    from app.services.llm import get_client
    llm = get_client()

    if prior_explanation:
        # Already explained this session — generate a short reference
        prompt = (
            f"Earlier in this conversation you explained {entity_name}: \"{prior_explanation}\". "
            f"The user is asking about it again. Give a one-sentence reminder, then add one new "
            f"detail relevant to: {article_context or 'the current news story'}."
        )
        try:
            return await llm.complete(
                messages=[{"role": "user", "content": prompt}],
                system_prompt=_ENTITY_SYSTEM,
            )
        except Exception as e:
            logger.warning("Entity re-explain failed: %s", e)
            return f"As mentioned earlier, {prior_explanation}"

    context = await get_entity_context(entity_name)
    wikidata = context.get("wikidata", {})
    facts = wikidata.get("facts", [])

    prompt = _ENTITY_PROMPT.format(
        entity=entity_name,
        wikipedia=context.get("wikipedia", "") or "No Wikipedia extract available.",
        description=wikidata.get("description", ""),
        facts=", ".join(facts) if facts else "No structured facts available.",
        article_context=article_context or "General news context.",
    )

    try:
        return await llm.complete(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=_ENTITY_SYSTEM,
        )
    except Exception as e:
        logger.warning("Entity explain failed for '%s': %s", entity_name, e)
        # Fallback to Wikipedia extract
        wiki = context.get("wikipedia", "")
        if wiki:
            return wiki[:250] + ("…" if len(wiki) > 250 else "")
        return f"Sorry, there isn't much information available about {entity_name} right now."
