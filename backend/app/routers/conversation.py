import asyncio
import base64
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.models.schemas import ConversationRequest, ConversationResponse, BriefingResponse, StoryBrief

logger = logging.getLogger(__name__)
router = APIRouter()

active_connections: dict[str, WebSocket] = {}


# ─────────────────────────────────────────────────────────────
# HTTP: POST /api/conversation
# ─────────────────────────────────────────────────────────────

@router.post("/conversation", response_model=ConversationResponse)
async def conversation(req: ConversationRequest):
    """
    POST /api/conversation
    Receives a text message + session_id, returns the full AI response (non-streaming).
    For streaming, use the WebSocket endpoint.
    """
    from app.services.conversation import handle_message

    result = await handle_message(req.session_id, req.message)
    return ConversationResponse(
        session_id=req.session_id,
        response=result.get("response", ""),
        intent=result.get("intent"),
        entities=result.get("entities", []),
        current_story_index=result.get("current_story_index"),
    )


# ─────────────────────────────────────────────────────────────
# HTTP: GET /api/briefing
# ─────────────────────────────────────────────────────────────

@router.get("/briefing", response_model=BriefingResponse)
async def get_briefing_endpoint(session_id: str):
    """
    GET /api/briefing?session_id=...
    Returns today's top news stories as spoken summaries.
    """
    from app.services.conversation import get_briefing

    stories = await get_briefing(session_id)
    return BriefingResponse(
        session_id=session_id,
        stories=[
            StoryBrief(
                title=s.get("title", ""),
                summary=s.get("summary", ""),
                source=s.get("source", ""),
                published=s.get("published"),
                url=s.get("url"),
            )
            for s in stories
        ],
    )


# ─────────────────────────────────────────────────────────────
# WebSocket: /api/ws/{session_id}
# ─────────────────────────────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket /ws/{session_id} — full-duplex voice session.

    Client → Server messages:
      { type: "audio_chunk",  data: "<base64 binary audio>" }
      { type: "text",         data: "<transcribed or typed text>" }
      { type: "end_of_turn" }
      { type: "interrupt" }

    Server → Client messages:
      { type: "transcript_partial", data: "..." }
      { type: "transcript_final",   data: "..." }
      { type: "llm_token",          data: "..." }   ← real-time LLM tokens
      { type: "state",              data: "idle|listening|thinking|speaking|error" }
      { type: "entities",           extra: { entities: [...] } }
      { type: "error",              data: "..." }
    """
    await websocket.accept()
    active_connections[session_id] = websocket
    logger.info("WebSocket connected: %s", session_id)

    # Task that streams LLM output for the current turn; cancelled on interrupt
    stream_task: asyncio.Task | None = None

    async def _send(payload: dict) -> None:
        try:
            await websocket.send_text(json.dumps(payload))
        except Exception:
            pass  # websocket may be closing

    async def _stream_response(user_text: str) -> None:
        """Stream LLM tokens over the WebSocket for a given user utterance."""
        from app.services.conversation import stream_handle_message, handle_message

        await _send({"type": "state", "data": "thinking"})
        entities_sent = False

        try:
            async for token in stream_handle_message(session_id, user_text):
                await _send({"type": "llm_token", "data": token})
                await asyncio.sleep(0)  # yield to event loop

            # After streaming, pull entities from the session to surface in UI
            from app.services.conversation import sessions
            session = sessions.get(session_id, {})
            entities = list(session.get("entities_explained", {}).keys())[-5:]
            if entities:
                await _send({"type": "entities", "extra": {"entities": entities}})

            await _send({"type": "state", "data": "speaking"})

        except asyncio.CancelledError:
            logger.info("Stream cancelled for %s (interrupt)", session_id)
            raise
        except Exception as e:
            logger.error("Stream error for %s: %s", session_id, e)
            await _send({"type": "error", "data": str(e)})
            await _send({"type": "state", "data": "idle"})

    try:
        audio_buffer = bytearray()

        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            # ── Audio chunk: accumulate for STT ──────────────
            if msg_type == "audio_chunk":
                chunk_b64 = msg.get("data", "")
                if chunk_b64:
                    audio_buffer.extend(base64.b64decode(chunk_b64))

            # ── End of turn: audio is complete ───────────────
            elif msg_type == "end_of_turn":
                # Backend-side STT is not implemented here — STT runs on the
                # frontend (lib/stt.ts) and sends the final transcript as "text".
                # This message can be used in future if server-side Pixtral STT
                # is routed through the backend.
                audio_buffer = bytearray()
                await _send({"type": "state", "data": "thinking"})

            # ── Text: transcribed speech or typed message ─────
            elif msg_type == "text":
                user_text = msg.get("data", "").strip()
                if not user_text:
                    await _send({
                        "type": "state",
                        "data": "idle",
                    })
                    continue

                # Echo transcript back so UI confirms what was heard
                await _send({"type": "transcript_final", "data": user_text})

                # Cancel any in-progress stream
                if stream_task and not stream_task.done():
                    stream_task.cancel()
                    try:
                        await stream_task
                    except asyncio.CancelledError:
                        pass

                stream_task = asyncio.create_task(_stream_response(user_text))

            # ── Interrupt: user spoke while AI was talking ────
            elif msg_type == "interrupt":
                if stream_task and not stream_task.done():
                    stream_task.cancel()
                    try:
                        await stream_task
                    except asyncio.CancelledError:
                        pass
                await _send({"type": "state", "data": "listening"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", session_id)
    except Exception as e:
        logger.error("WebSocket error for %s: %s", session_id, e)
        await _send({"type": "error", "data": str(e)})
    finally:
        if stream_task and not stream_task.done():
            stream_task.cancel()
        active_connections.pop(session_id, None)
