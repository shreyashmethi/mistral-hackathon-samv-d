from pydantic import BaseModel
from typing import Optional, List


class ConversationRequest(BaseModel):
    session_id: str
    message: str
    story_index: Optional[int] = None


class ConversationResponse(BaseModel):
    session_id: str
    response: str
    intent: Optional[str] = None
    entities: Optional[List[str]] = []
    current_story_index: Optional[int] = None


class StoryBrief(BaseModel):
    title: str
    summary: str
    source: str
    published: Optional[str] = None
    url: Optional[str] = None


class BriefingResponse(BaseModel):
    session_id: str
    stories: List[StoryBrief]


class HealthResponse(BaseModel):
    status: str
    version: str


class WSMessage(BaseModel):
    type: str  # "audio_chunk" | "text" | "end_of_turn" | "interrupt"
    data: Optional[str] = None  # base64 audio or text
    session_id: Optional[str] = None


class WSResponse(BaseModel):
    type: str  # "transcript_partial" | "transcript_final" | "llm_token" | "tts_audio" | "error" | "state"
    data: Optional[str] = None
    session_id: Optional[str] = None
    extra: Optional[dict] = None
