"""
llm.py — LLM client: Mistral Large via direct Mistral API.

Public API:
    client = get_client()
    text   = await client.complete(messages, system_prompt)
    async for token in client.stream_complete(messages, system_prompt):
        ...
    intent = await client.classify_intent(utterance, history)
"""

import json
import logging
import os
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

_MODEL_MISTRAL = "mistral-large-latest"
_MAX_TOKENS = 1024
_TEMPERATURE = 0.7


# ─────────────────────────────────────────────────────────────
# LLMClient
# ─────────────────────────────────────────────────────────────

class LLMClient:
    def __init__(self) -> None:
        self._mistral = None
        self._init_clients()

    def _init_clients(self) -> None:
        try:
            from mistralai import Mistral
            self._mistral = Mistral(api_key=os.getenv("MISTRAL_API_KEY", ""))
            logger.info("Mistral API client initialised")
        except Exception as e:
            logger.warning("Mistral API init failed: %s", e)

    # ── Non-streaming complete ────────────────────────────────

    async def complete(self, messages: list[dict], system_prompt: str = "") -> str:
        if self._mistral:
            return await self._mistral_complete(messages, system_prompt)
        raise RuntimeError("No LLM client available")

    async def _mistral_complete(self, messages: list[dict], system_prompt: str) -> str:
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})
        all_messages.extend(messages)

        response = await self._mistral.chat.complete_async(
            model=_MODEL_MISTRAL,
            messages=all_messages,
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
        )
        return response.choices[0].message.content or ""

    # ── Streaming complete ────────────────────────────────────

    async def stream_complete(
        self, messages: list[dict], system_prompt: str = ""
    ) -> AsyncGenerator[str, None]:
        if self._mistral:
            async for token in self._mistral_stream(messages, system_prompt):
                yield token
        else:
            raise RuntimeError("No LLM client available")

    async def _mistral_stream(
        self, messages: list[dict], system_prompt: str
    ) -> AsyncGenerator[str, None]:
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})
        all_messages.extend(messages)

        async with self._mistral.chat.stream_async(
            model=_MODEL_MISTRAL,
            messages=all_messages,
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
        ) as stream:
            async for chunk in stream:
                delta = chunk.data.choices[0].delta.content
                if delta:
                    yield delta

    # ── Intent classification ─────────────────────────────────

    async def classify_intent(
        self, utterance: str, history: list[dict]
    ) -> dict:
        """
        Use Mistral function calling to classify the user's intent.
        Returns dict: { intent, entity?, topic?, navigation_direction? }
        """
        from app.prompts.intent import (
            INTENT_TOOL_MISTRAL,
            INTENT_SYSTEM_PROMPT,
        )

        # Build minimal history context (last 6 messages max)
        ctx = history[-6:] if len(history) > 6 else history
        ctx_text = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in ctx
        )
        user_msg = f"Conversation so far:\n{ctx_text}\n\nNew utterance: {utterance}"

        if self._mistral:
            return await self._mistral_classify(user_msg, INTENT_TOOL_MISTRAL, INTENT_SYSTEM_PROMPT)

        # Hard fallback: simple keyword matching
        return _keyword_intent(utterance)

    async def _mistral_classify(
        self, user_msg: str, tool: dict, system_prompt: str
    ) -> dict:
        response = await self._mistral.chat.complete_async(
            model=_MODEL_MISTRAL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            tools=[tool],
            tool_choice="any",
            max_tokens=256,
            temperature=0.0,
        )
        msg = response.choices[0].message
        if msg.tool_calls:
            return json.loads(msg.tool_calls[0].function.arguments)
        # Fallback: try to parse JSON from content
        try:
            return json.loads(msg.content or "{}")
        except json.JSONDecodeError:
            return _keyword_intent(user_msg)


# ─────────────────────────────────────────────────────────────
# Keyword-based intent fallback (no API required)
# ─────────────────────────────────────────────────────────────

_BRIEFING_KW = {"news", "briefing", "happening", "today", "headlines", "tell me", "catch me up", "what's going on"}
_NAVIGATION_KW = {"next", "skip", "previous", "go back", "next story", "back", "first", "last"}
_CHITCHAT_KW = {"hello", "hi", "thanks", "thank you", "bye", "great", "awesome", "good"}


def _keyword_intent(text: str) -> dict:
    lower = text.lower()
    if any(kw in lower for kw in _NAVIGATION_KW):
        direction = "next" if "next" in lower or "skip" in lower else "previous"
        return {"intent": "NAVIGATION", "navigation_direction": direction}
    if any(kw in lower for kw in _BRIEFING_KW):
        return {"intent": "BRIEFING"}
    if any(kw in lower for kw in _CHITCHAT_KW):
        return {"intent": "CHITCHAT"}
    # Default: treat as follow-up
    return {"intent": "FOLLOW_UP", "topic": text}


# ─────────────────────────────────────────────────────────────
# Singleton
# ─────────────────────────────────────────────────────────────

_client: LLMClient | None = None


def get_client() -> LLMClient:
    global _client
    if _client is None:
        _client = LLMClient()
    return _client
