"""
llm.py — LLM client: Mistral Large 3 via AWS Bedrock (primary) with direct Mistral API fallback.

Public API:
    client = get_client()
    text   = await client.complete(messages, system_prompt)
    async for token in client.stream_complete(messages, system_prompt):
        ...
    intent = await client.classify_intent(utterance, history)
"""

import asyncio
import json
import logging
import os
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

_MODEL_BEDROCK = os.getenv("BEDROCK_MODEL_ID", "mistral.mistral-large-2402-v1:0")
_MODEL_MISTRAL = "mistral-large-latest"
_MAX_TOKENS = 1024
_TEMPERATURE = 0.7


# ─────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────

def _to_bedrock_messages(messages: list[dict]) -> list[dict]:
    """Convert OpenAI-style {role, content} list to Bedrock Converse format."""
    out = []
    for m in messages:
        role = m["role"]
        if role == "system":
            continue  # system is passed separately
        content_text = m.get("content", "")
        out.append({"role": role, "content": [{"text": content_text}]})
    return out


def _extract_bedrock_tool_result(response: dict) -> dict | None:
    """Pull tool-use result from a Bedrock Converse response."""
    for block in response.get("output", {}).get("message", {}).get("content", []):
        if "toolUse" in block and block["toolUse"].get("name") == "classify_intent":
            return block["toolUse"].get("input", {})
    return None


# ─────────────────────────────────────────────────────────────
# LLMClient
# ─────────────────────────────────────────────────────────────

class LLMClient:
    def __init__(self) -> None:
        self._bedrock = None
        self._mistral = None
        self._use_bedrock = True
        self._init_clients()

    def _init_clients(self) -> None:
        # Try Bedrock
        try:
            import boto3
            self._bedrock = boto3.client(
                "bedrock-runtime",
                region_name=os.getenv("AWS_REGION", "us-east-1"),
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
            logger.info("Bedrock client initialised")
        except Exception as e:
            logger.warning("Bedrock init failed: %s — will use Mistral API only", e)
            self._use_bedrock = False

        # Always init Mistral as fallback
        try:
            from mistralai import Mistral
            self._mistral = Mistral(api_key=os.getenv("MISTRAL_API_KEY", ""))
            logger.info("Mistral API client initialised")
        except Exception as e:
            logger.warning("Mistral API init failed: %s", e)

    # ── Non-streaming complete ────────────────────────────────

    async def complete(self, messages: list[dict], system_prompt: str = "") -> str:
        if self._use_bedrock and self._bedrock:
            try:
                return await self._bedrock_complete(messages, system_prompt)
            except Exception as e:
                logger.warning("Bedrock complete failed (%s) — falling back to Mistral API", e)

        if self._mistral:
            return await self._mistral_complete(messages, system_prompt)

        raise RuntimeError("No LLM client available")

    async def _bedrock_complete(self, messages: list[dict], system_prompt: str) -> str:
        bedrock_msgs = _to_bedrock_messages(messages)
        kwargs: dict = {
            "modelId": _MODEL_BEDROCK,
            "messages": bedrock_msgs,
            "inferenceConfig": {"maxTokens": _MAX_TOKENS, "temperature": _TEMPERATURE},
        }
        if system_prompt:
            kwargs["system"] = [{"text": system_prompt}]

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, lambda: self._bedrock.converse(**kwargs)
        )
        content = response["output"]["message"]["content"]
        return "".join(block.get("text", "") for block in content)

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
        if self._use_bedrock and self._bedrock:
            try:
                async for token in self._bedrock_stream(messages, system_prompt):
                    yield token
                return
            except Exception as e:
                logger.warning("Bedrock stream failed (%s) — falling back to Mistral API", e)

        if self._mistral:
            async for token in self._mistral_stream(messages, system_prompt):
                yield token
        else:
            raise RuntimeError("No LLM client available")

    async def _bedrock_stream(
        self, messages: list[dict], system_prompt: str
    ) -> AsyncGenerator[str, None]:
        bedrock_msgs = _to_bedrock_messages(messages)
        kwargs: dict = {
            "modelId": _MODEL_BEDROCK,
            "messages": bedrock_msgs,
            "inferenceConfig": {"maxTokens": _MAX_TOKENS, "temperature": _TEMPERATURE},
        }
        if system_prompt:
            kwargs["system"] = [{"text": system_prompt}]

        loop = asyncio.get_event_loop()
        # boto3 streaming is synchronous; run in executor and yield chunks
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        def _stream_worker():
            try:
                resp = self._bedrock.converse_stream(**kwargs)
                for event in resp["stream"]:
                    if "contentBlockDelta" in event:
                        delta = event["contentBlockDelta"].get("delta", {})
                        text = delta.get("text", "")
                        if text:
                            loop.call_soon_threadsafe(queue.put_nowait, text)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, f"\n[ERROR: {exc}]")
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

        loop.run_in_executor(None, _stream_worker)

        while True:
            token = await queue.get()
            if token is None:
                break
            yield token

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
            INTENT_TOOL_SPEC,
            INTENT_TOOL_MISTRAL,
            INTENT_SYSTEM_PROMPT,
        )

        # Build minimal history context (last 6 messages max)
        ctx = history[-6:] if len(history) > 6 else history
        ctx_text = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in ctx
        )
        user_msg = f"Conversation so far:\n{ctx_text}\n\nNew utterance: {utterance}"

        if self._use_bedrock and self._bedrock:
            try:
                return await self._bedrock_classify(user_msg, INTENT_TOOL_SPEC, INTENT_SYSTEM_PROMPT)
            except Exception as e:
                logger.warning("Bedrock classify failed (%s) — falling back to Mistral", e)

        if self._mistral:
            return await self._mistral_classify(user_msg, INTENT_TOOL_MISTRAL, INTENT_SYSTEM_PROMPT)

        # Hard fallback: simple keyword matching
        return _keyword_intent(utterance)

    async def _bedrock_classify(
        self, user_msg: str, tool_spec: dict, system_prompt: str
    ) -> dict:
        kwargs = {
            "modelId": _MODEL_BEDROCK,
            "messages": [{"role": "user", "content": [{"text": user_msg}]}],
            "system": [{"text": system_prompt}],
            "toolConfig": {
                "tools": [tool_spec],
                "toolChoice": {"tool": {"name": "classify_intent"}},
            },
            "inferenceConfig": {"maxTokens": 256, "temperature": 0.0},
        }
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, lambda: self._bedrock.converse(**kwargs)
        )
        result = _extract_bedrock_tool_result(response)
        if result:
            return result
        raise ValueError("No tool result in Bedrock response")

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
