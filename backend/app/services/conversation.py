"""
conversation.py — Session manager and intent router.

Owns the in-memory session store, routes intents to the right service,
manages conversation history (capped at 20 turns), and tracks entities
explained per session so the LLM can reference them without repeating.

Public API (called by routers/conversation.py):
    handle_message(session_id, message) -> dict
    stream_handle_message(session_id, message) -> AsyncGenerator[str, None]
    get_briefing(session_id) -> list[StoryBrief-compatible dicts]
"""

import asyncio
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Session store
# ─────────────────────────────────────────────────────────────

sessions: dict[str, dict] = {}

HISTORY_CAP = 40  # 20 turns × 2 messages each


def _get_or_create_session(session_id: str) -> dict:
    if session_id not in sessions:
        sessions[session_id] = {
            "history": [],
            "entities_explained": {},  # entity_name → explanation string
            "current_story_index": 0,
            "briefing_stories": [],    # list of story dicts from news service
        }
    return sessions[session_id]


def _append_history(session: dict, role: str, content: str) -> None:
    session["history"].append({"role": role, "content": content})
    if len(session["history"]) > HISTORY_CAP:
        # Drop oldest turns but keep at least 2 messages
        session["history"] = session["history"][-HISTORY_CAP:]


def _current_story(session: dict) -> dict | None:
    stories = session["briefing_stories"]
    idx = session["current_story_index"]
    if stories and 0 <= idx < len(stories):
        return stories[idx]
    return None


def _build_stories_context(session: dict) -> str:
    """Build a context block listing all briefing stories with the current one marked."""
    stories = session["briefing_stories"]
    if not stories:
        return ""
    idx = session["current_story_index"]
    lines = ["\n\n## All Available News Stories"]
    for i, s in enumerate(stories):
        marker = " [CURRENTLY DISCUSSING]" if i == idx else ""
        lines.append(f"Story {i + 1}{marker}: {s['title']}\n{s['summary']}")
    return "\n\n".join(lines)


# ─────────────────────────────────────────────────────────────
# Briefing (Step 2)
# ─────────────────────────────────────────────────────────────

async def get_briefing(session_id: str) -> list[dict]:
    """Return today's top stories, caching them in the session."""
    from app.services.news import get_briefing as _fetch_briefing
    session = _get_or_create_session(session_id)

    if not session["briefing_stories"]:
        stories = await _fetch_briefing()
        session["briefing_stories"] = stories
        session["current_story_index"] = 0

    return session["briefing_stories"]


# ─────────────────────────────────────────────────────────────
# Response generators per intent
# ─────────────────────────────────────────────────────────────

async def _handle_briefing(session: dict) -> tuple[str, list[str]]:
    """Generate a spoken briefing from the cached stories."""
    from app.services.news import get_briefing as _fetch_briefing
    from app.services.llm import get_client
    from app.prompts.system import build_system_prompt

    if not session["briefing_stories"]:
        stories = await _fetch_briefing()
        session["briefing_stories"] = stories
        session["current_story_index"] = 0

    stories = session["briefing_stories"]
    if not stories:
        return "Sorry, there's a problem fetching today's news. Please try again in a moment.", []

    # Build spoken briefing text
    story_lines = []
    connectors = ["Here's the first story.", "Next up.", "And finally."]
    for i, story in enumerate(stories[:3]):
        connector = connectors[i] if i < len(connectors) else "Also."
        story_lines.append(f"{connector} {story['summary']}")

    briefing_text = " ".join(story_lines)
    if len(stories) > 3:
        briefing_text += f" There are {len(stories) - 3} more stories. Just say 'next' to continue."
    else:
        briefing_text += " Want to dive deeper into any of these? Just ask."

    # Reset to first story
    session["current_story_index"] = 0

    # Entity extraction from briefing text (surface-level, from titles)
    entities = [s["title"].split(":")[0].strip() for s in stories[:3] if ":" in s["title"]]
    return briefing_text, entities


async def _handle_entity_query(
    session: dict, entity: str, message: str
) -> tuple[str, list[str]]:
    """Fetch entity context (KG + Wikipedia/Wikidata) and generate a spoken explanation."""
    from app.services.rag import explain_entity, get_entity_path_description

    current = _current_story(session)
    article_context = current["summary"] if current else ""

    # Check if already explained this session
    prior = session["entities_explained"].get(entity.lower())

    # Check if the user is asking about a connection between two entities
    path_desc = ""
    last_entities = list(session["entities_explained"].keys())
    if last_entities and not prior:
        # Try to find a path from last explained entity to this one
        try:
            path_desc = await get_entity_path_description(last_entities[-1], entity)
        except Exception:
            pass

    explanation = await explain_entity(
        entity_name=entity,
        article_context=article_context,
        prior_explanation=prior or "",
    )

    if path_desc:
        explanation = f"{explanation} {path_desc}"

    # Store explanation for future reference
    session["entities_explained"][entity.lower()] = explanation[:200]  # trim for storage

    return explanation, [entity]


async def _handle_follow_up(session: dict, message: str) -> tuple[str, list[str]]:
    """Answer a follow-up question using hybrid RAG (vector search + KG) + LLM."""
    from app.services.llm import get_client
    from app.prompts.system import build_system_prompt
    from app.services.rag import retrieve_context

    llm = get_client()
    current = _current_story(session)

    # Hybrid RAG retrieval — pass current story so it's prioritised over vector similarity
    rag_context = ""
    try:
        rag_context = await retrieve_context(
            query=message,
            session_entities=session["entities_explained"],
            current_story=current,
            n_articles=4,
        )
    except Exception as e:
        logger.warning("RAG retrieval failed, proceeding without: %s", e)

    system_prompt = build_system_prompt(
        has_entity_context=bool(rag_context),
        prior_entities=session["entities_explained"],
        current_story_title=current["title"] if current else None,
    )

    if rag_context:
        system_prompt += f"\n\n{rag_context}"

    # Inject all stories so the LLM knows which one the user is on
    system_prompt += _build_stories_context(session)

    messages = list(session["history"]) + [{"role": "user", "content": message}]

    response = await llm.complete(messages=messages, system_prompt=system_prompt)
    return response, []


async def _handle_navigation(
    session: dict, direction: str, message: str
) -> tuple[str, list[str]]:
    """Navigate between briefing stories."""
    import re

    stories = session["briefing_stories"]
    if not stories:
        return "There are no stories loaded yet. Say 'what's happening' to get today's briefing.", []

    idx = session["current_story_index"]
    n = len(stories)

    if direction in ("next", ""):
        idx = min(idx + 1, n - 1)
    elif direction == "previous":
        idx = max(idx - 1, 0)
    elif direction == "first":
        idx = 0
    elif direction == "last":
        idx = n - 1
    elif direction == "specific":
        # Parse a story number from the message (e.g. "story 5", "the fifth one")
        num_match = re.search(r'\b(\d+)\b', message)
        ordinals = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
                    "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10}
        word_match = re.search(r'\b(' + '|'.join(ordinals) + r')\b', message.lower())
        if num_match:
            target = int(num_match.group(1)) - 1
            if 0 <= target < n:
                idx = target
        elif word_match:
            target = ordinals[word_match.group(1)] - 1
            if 0 <= target < n:
                idx = target

    session["current_story_index"] = idx
    story = stories[idx]

    response = (
        f"Here's story {idx + 1} of {n}. {story['summary']} "
        f"Want to know more, or shall we move on?"
    )
    return response, []


async def _handle_chitchat(session: dict, message: str) -> tuple[str, list[str]]:
    """Brief, warm, off-topic reply."""
    from app.services.llm import get_client
    from app.prompts.system import SAMVAD_BASE

    llm = get_client()
    system = SAMVAD_BASE + (
        "\nKeep this reply to one or two sentences. Be friendly and warm. "
        "Gently steer back to news if appropriate."
    )
    messages = [{"role": "user", "content": message}]
    response = await llm.complete(messages=messages, system_prompt=system)
    return response, []


# ─────────────────────────────────────────────────────────────
# Main handle_message (HTTP endpoint)
# ─────────────────────────────────────────────────────────────

async def handle_message(session_id: str, message: str) -> dict:
    """
    Route a user message to the correct handler based on Mistral intent classification.
    Returns: { response, intent, entities, current_story_index }
    """
    from app.services.llm import get_client

    if not message.strip():
        return {
            "response": "Sorry, there's no audio there. Could you repeat that?",
            "intent": "CHITCHAT",
            "entities": [],
            "current_story_index": 0,
        }

    session = _get_or_create_session(session_id)
    llm = get_client()

    # Classify intent
    try:
        intent_result = await llm.classify_intent(message, session["history"])
    except Exception as e:
        logger.warning("Intent classification failed: %s — defaulting to FOLLOW_UP", e)
        intent_result = {"intent": "FOLLOW_UP", "topic": message}

    intent = intent_result.get("intent", "FOLLOW_UP")
    entity = intent_result.get("entity", "")
    nav_direction = intent_result.get("navigation_direction", "next")

    logger.info("[%s] intent=%s entity=%r", session_id, intent, entity)

    # Route
    try:
        if intent == "BRIEFING":
            response, entities = await _handle_briefing(session)
        elif intent == "ENTITY_QUERY" and entity:
            response, entities = await _handle_entity_query(session, entity, message)
        elif intent == "NAVIGATION":
            response, entities = await _handle_navigation(session, nav_direction, message)
        elif intent == "CHITCHAT":
            response, entities = await _handle_chitchat(session, message)
        else:
            # FOLLOW_UP, ARTICLE_MODE, or unknown
            response, entities = await _handle_follow_up(session, message)
    except Exception as e:
        logger.error("Handler failed for intent %s: %s", intent, e)
        response = "Something went wrong on my end. Could you try asking that again?"
        entities = []

    # Update history
    _append_history(session, "user", message)
    _append_history(session, "assistant", response)

    return {
        "response": response,
        "intent": intent,
        "entities": entities,
        "current_story_index": session["current_story_index"],
    }


# ─────────────────────────────────────────────────────────────
# stream_handle_message (WebSocket endpoint)
# ─────────────────────────────────────────────────────────────

async def stream_handle_message(
    session_id: str, message: str
) -> AsyncGenerator[str, None]:
    """
    Streaming version of handle_message. Yields LLM tokens as they arrive.
    Used by the WebSocket endpoint so TTS can start before the full response is ready.

    For non-LLM intents (BRIEFING, NAVIGATION) that return canned responses,
    yields the complete response as a single chunk.
    """
    from app.services.llm import get_client
    from app.prompts.system import build_system_prompt

    if not message.strip():
        yield "Sorry, there's no audio there. Could you repeat that?"
        return

    session = _get_or_create_session(session_id)
    llm = get_client()

    # Classify intent
    try:
        intent_result = await llm.classify_intent(message, session["history"])
    except Exception as e:
        logger.warning("Intent classification failed: %s", e)
        intent_result = {"intent": "FOLLOW_UP"}

    intent = intent_result.get("intent", "FOLLOW_UP")
    entity = intent_result.get("entity", "")
    nav_direction = intent_result.get("navigation_direction", "next")

    collected = []

    if intent == "BRIEFING":
        response, _ = await _handle_briefing(session)
        yield response
        collected.append(response)

    elif intent == "ENTITY_QUERY" and entity:
        # Play filler immediately, then stream entity explanation
        yield "Let me look that up… "
        explanation, _ = await _handle_entity_query(session, entity, message)
        yield explanation
        collected.append(explanation)

    elif intent == "NAVIGATION":
        response, _ = await _handle_navigation(session, nav_direction, message)
        yield response
        collected.append(response)

    elif intent == "CHITCHAT":
        response, _ = await _handle_chitchat(session, message)
        yield response
        collected.append(response)

    else:
        # FOLLOW_UP — hybrid RAG then stream tokens from LLM
        from app.services.rag import retrieve_context

        current = _current_story(session)

        # Hybrid RAG retrieval — pass current story so it's prioritised over vector similarity
        rag_context = ""
        try:
            rag_context = await retrieve_context(
                query=message,
                session_entities=session["entities_explained"],
                current_story=current,
                n_articles=4,
            )
        except Exception as e:
            logger.warning("Streaming RAG retrieval failed: %s", e)

        system_prompt = build_system_prompt(
            has_entity_context=bool(rag_context),
            prior_entities=session["entities_explained"],
            current_story_title=current["title"] if current else None,
        )
        if rag_context:
            system_prompt += f"\n\n{rag_context}"

        # Inject all stories so the LLM knows which one the user is on
        system_prompt += _build_stories_context(session)

        messages = list(session["history"]) + [{"role": "user", "content": message}]

        async for token in llm.stream_complete(messages=messages, system_prompt=system_prompt):
            yield token
            collected.append(token)

    # Update history with full response
    full_response = "".join(collected)
    _append_history(session, "user", message)
    _append_history(session, "assistant", full_response)
