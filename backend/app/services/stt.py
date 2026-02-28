"""
stt.py — Speech-to-Text via Mistral Voxtral Realtime API.

Accepts an async stream of PCM audio chunks (s16le, 16 kHz, mono)
and yields transcription text deltas as they arrive.
"""

import asyncio
import logging
import os
from typing import AsyncIterator

from mistralai import Mistral
from mistralai.extra.realtime import (
    AudioFormat,
    RealtimeTranscriptionSessionCreated,
)
from mistralai.models import TranscriptionStreamTextDelta, TranscriptionStreamDone

logger = logging.getLogger(__name__)

_MODEL = "voxtral-mini-transcribe-realtime-2602"


class VoxtralSTTSession:
    """
    Manages a single Voxtral realtime transcription session.

    Usage:
        session = VoxtralSTTSession()
        session.feed(audio_bytes)        # call repeatedly with PCM chunks
        async for text in session.run():  # yields partial transcripts
            ...
        transcript = session.finish()    # signal end, get final text
    """

    def __init__(self) -> None:
        self._queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._full_transcript = ""
        self._running = False

    def feed(self, chunk: bytes) -> None:
        """Feed a PCM audio chunk into the session."""
        if self._running:
            self._queue.put_nowait(chunk)

    def stop(self) -> None:
        """Signal end of audio stream."""
        self._queue.put_nowait(None)

    async def _audio_stream(self) -> AsyncIterator[bytes]:
        """Async iterator that yields audio chunks from the queue."""
        while True:
            chunk = await self._queue.get()
            if chunk is None:
                break
            yield chunk

    async def run(self) -> AsyncIterator[str]:
        """
        Start the Voxtral realtime transcription.
        Yields text deltas as they arrive.
        """
        api_key = os.getenv("MISTRAL_API_KEY", "")
        if not api_key:
            raise RuntimeError("MISTRAL_API_KEY not set")

        client = Mistral(api_key=api_key)
        audio_format = AudioFormat(encoding="pcm_s16le", sample_rate=16000)

        self._running = True

        try:
            async for event in client.audio.realtime.transcribe_stream(
                audio_stream=self._audio_stream(),
                model=_MODEL,
                audio_format=audio_format,
                target_streaming_delay_ms=240,
            ):
                if isinstance(event, RealtimeTranscriptionSessionCreated):
                    logger.info("Voxtral STT session created")
                elif isinstance(event, TranscriptionStreamTextDelta):
                    self._full_transcript += event.text
                    yield event.text
                elif isinstance(event, TranscriptionStreamDone):
                    logger.info("Voxtral STT session done")
                    break
        except Exception as e:
            logger.error("Voxtral STT error: %s", e)
            raise
        finally:
            self._running = False

    @property
    def transcript(self) -> str:
        """The full accumulated transcript."""
        return self._full_transcript.strip()
