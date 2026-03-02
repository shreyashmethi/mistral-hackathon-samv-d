# Samvād — Voice-First AI News Companion

> *Samvād* (संवाद) — Sanskrit for "conversation"

A voice-first AI news companion. Speak to get live news briefings, ask "Who is that?", dive deeper into any story, and have natural multi-turn conversations — entirely through voice. Built for the Mistral AI Hackathon.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [WebSocket Protocol](#websocket-protocol)
- [Team](#team)

---

## Features

- **Voice-only interface** — Tap the mic and talk. No keyboard, no text input.
- **Live news briefings** — Fetches and summarizes top stories from BBC, NPR, The Guardian, Deutsche Welle, and France 24 every 30 minutes.
- **Entity context via RAG** — Ask "Who is Christine Lagarde?" or "What is NATO?" and get a concise spoken explanation grounded in Wikipedia + Wikidata + a live Knowledge Graph.
- **Story-aware follow-ups** — Switch between stories, ask why something happened, get background — the AI always answers in context of the story you're on.
- **Teleprompter display** — Sentences appear and scroll in sync with the voice, highlighted as they're spoken.
- **Streaming TTS** — ElevenLabs WebSocket TTS with sentence-boundary buffering for sub-second speech latency.
- **Streaming STT** — Voxtral real-time speech recognition over WebSocket with browser fallback.
- **Animated waveform** — 38-column mirrored pixel grid visualizer, yellow→red gradient.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User                                  │
│           speaks ──────────────────► hears                  │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
     AudioCapture                   ElevenLabs
     (16kHz PCM)                   Streaming TTS
            │                             ▲
            ▼                             │
     WebSocket /api/ws/{id}   ◄── llm_token stream
            │                             │
     ┌──────▼──────────────────────────────────────┐
     │                  Backend                     │
     │                                              │
     │  STT (Voxtral)                               │
     │     └─► Intent Classification (Mistral)      │
     │              └─► Router                      │
     │                    ├─ BRIEFING  ──► RSS + LLM │
     │                    ├─ ENTITY   ──► RAG + KG  │
     │                    ├─ FOLLOW_UP ──► RAG + LLM │
     │                    ├─ NAVIGATION ──► session  │
     │                    └─ CHITCHAT  ──► LLM       │
     └──────────────────────────────────────────────┘
```

**State machine (frontend)**

```
idle ──► listening ──► thinking ──► speaking ──► idle
              ▲                         │
              └───────── interrupt ─────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | Mistral Large 3 via AWS Bedrock (primary) · Mistral API (fallback) |
| **STT** | Voxtral real-time WebSocket · Browser SpeechRecognition (fallback) |
| **TTS** | ElevenLabs Streaming WebSocket · Browser speechSynthesis (fallback) |
| **RAG** | Wikipedia REST API · Wikidata API · ChromaDB vector store · Custom Knowledge Graph |
| **News** | RSS aggregation — BBC, NPR, The Guardian, Deutsche Welle, France 24 |
| **Backend** | FastAPI · Python 3.11 · uvicorn · httpx · feedparser · boto3 |
| **Frontend** | Next.js 14 · TypeScript · Tailwind CSS · Framer Motion |

---

## Project Structure

```
Samvad/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, route registration
│   │   ├── routers/
│   │   │   └── conversation.py      # WebSocket + HTTP endpoints
│   │   ├── services/
│   │   │   ├── conversation.py      # Session manager, intent router
│   │   │   ├── llm.py               # Mistral LLM client (streaming + intent)
│   │   │   ├── news.py              # RSS pipeline, dedup, summarisation, 30-min cache
│   │   │   ├── rag.py               # Wikipedia + Wikidata + vector + KG retrieval
│   │   │   ├── stt.py               # Voxtral STT (16kHz PCM streaming)
│   │   │   ├── vector_store.py      # ChromaDB article embeddings
│   │   │   └── knowledge_graph.py   # In-memory entity relationship graph
│   │   ├── prompts/
│   │   │   ├── system.py            # Voice-first system prompt templates
│   │   │   └── intent.py            # Intent classification tool specs
│   │   └── models/
│   │       └── schemas.py           # Pydantic request/response models
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Main conversation screen
│   │   ├── settings/page.tsx        # Settings screen
│   │   └── article/page.tsx         # Article mode screen
│   ├── components/
│   │   ├── Waveform.tsx             # Pixel grid audio visualizer
│   │   ├── MicButton.tsx            # Tap-to-toggle microphone button
│   │   ├── Transcript.tsx           # Teleprompter component
│   │   └── EntityChips.tsx          # Tappable entity pills
│   └── lib/
│       ├── api.ts                   # HTTP client, WSSession, types
│       ├── stt.ts                   # AudioCapture — mic → 16kHz PCM → WebSocket
│       └── tts.ts                   # ElevenLabs streaming TTS + browser fallback
│
└── CLAUDE.md                        # Dev guide
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- AWS account with Bedrock access (us-east-1, Mistral Large 3 model enabled)
- Mistral API key (fallback)
- ElevenLabs API key + voice ID

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # then fill in your keys
uvicorn app.main:app --reload --port 8000
```

Verify it's running:

```bash
curl http://localhost:8000/api/health
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # then fill in your keys
npm run dev
# Open http://localhost:3000
```

---

## Environment Variables

### Backend — `backend/.env`

| Variable | Description |
|---|---|
| `MISTRAL_API_KEY` | Mistral API key (used as LLM fallback) |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Bedrock |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for Bedrock |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |

### Frontend — `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend HTTP base URL (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_URL` | Backend WebSocket base URL (e.g. `ws://localhost:8000`) |
| `NEXT_PUBLIC_ELEVENLABS_API_KEY` | ElevenLabs API key |
| `NEXT_PUBLIC_ELEVENLABS_VOICE_ID` | ElevenLabs voice ID |

> **Note for deployment:** Vercel does not proxy WebSockets. Set `NEXT_PUBLIC_WS_URL` to the full Railway WebSocket URL directly (e.g. `wss://your-app.railway.app`). Also add your Vercel URL to `CORS_ORIGINS` in your Railway environment.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/briefing?session_id=<id>` | Fetch top 5 news stories for a session |
| `POST` | `/api/conversation` | Send a text message, receive AI response |
| `WS` | `/api/ws/<session_id>` | Full-duplex voice session |

### POST `/api/conversation`

```json
{
  "session_id": "sess_abc123",
  "message": "What is happening in Europe today?"
}
```

Response:

```json
{
  "response": "...",
  "intent": "FOLLOW_UP",
  "entities": ["ECB", "Eurozone"],
  "current_story_index": 2
}
```

---

## WebSocket Protocol

### Client → Server

| Type | Payload | Description |
|---|---|---|
| `audio_chunk` | `{ data: "<base64 PCM>" }` | Raw 16kHz s16le mono audio |
| `text` | `{ text: "..." }` | Text message (bypass STT) |
| `end_of_turn` | — | Signal end of user speech |
| `interrupt` | — | Cancel in-progress response |

### Server → Client

| Type | Payload | Description |
|---|---|---|
| `transcript_partial` | `{ text: "..." }` | Live STT partial result |
| `transcript_final` | `{ text: "..." }` | Final recognised utterance |
| `llm_token` | `{ token: "..." }` | Streaming LLM output token |
| `state` | `{ state: "thinking"\|"speaking"\|"idle" }` | App state change |
| `entities` | `{ entities: [...] }` | Named entities in the response |
| `error` | `{ message: "..." }` | Error notification |

---

## Team

| Name | Role |
|---|---|
| **Devashish** | ML/AI pipeline · Mistral integration · RAG · Knowledge Graph · Prompts · News ingestion |
| **Shreyash** | Backend API · WebSocket transport · STT/TTS · Frontend voice UI · Deployment |
