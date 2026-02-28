# Samvād — Voice-First AI News Companion

A voice-first AI news companion that lets you have natural spoken conversations about today's news. Ask for briefings, ask "who is that?", get context via RAG, and follow up — all through voice.

## Features

- **Voice-first UI** — Tap the mic and talk. No typing required.
- **Teleprompter display** — Shows only the current sentence being spoken, not walls of text.
- **Live news briefings** — Fetches and summarizes top stories from BBC, Reuters, Guardian, DW, France 24.
- **Entity context (RAG)** — Ask "Who is Christine Lagarde?" and get a concise spoken explanation via Wikipedia + Wikidata.
- **Multi-turn memory** — The AI remembers what you've discussed and connects stories.
- **Streaming TTS** — ElevenLabs WebSocket TTS with sentence-boundary buffering for low-latency speech.
- **Pixel waveform** — Animated 38-column mirrored grid with yellow→red gradient.

## Tech Stack

| Layer | Tech |
|-------|------|
| STT | Voxtral (Mistral) — 16kHz PCM streaming |
| LLM | Mistral Large 3 via AWS Bedrock |
| TTS | ElevenLabs Streaming API |
| Backend | FastAPI (Python 3.11) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| RAG | Wikipedia + Wikidata APIs |
| Design | Figma → Inter font, Mistral orange palette |

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Fill in API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env  # Fill in ElevenLabs keys
npm run dev
# Open http://localhost:3000
```

### Required Environment Variables

**Backend (`backend/.env`)**:
```
MISTRAL_API_KEY=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**Frontend (`frontend/.env`)**:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_ELEVENLABS_API_KEY=...
NEXT_PUBLIC_ELEVENLABS_VOICE_ID=...
```

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Conversation | `/` | Main voice interface with teleprompter, waveform, mic button |
| Settings | `/settings` | Preferences for news topics, voice, briefing length |
| Article Mode | `/article` | Paste a URL and discuss an article |

## Architecture

```
User speaks → AudioCapture (16kHz PCM) → WebSocket → Backend STT
→ Intent Classification → LLM/RAG → Streaming Tokens → WebSocket
→ Frontend Teleprompter + ElevenLabs TTS → User hears response
```

## Team
- **Devashish** — ML/AI pipeline, Mistral integration, RAG, prompts, news ingestion
- **Shreyash** — Backend API, frontend voice UI, WebSocket handling, TTS/STT, deployment
