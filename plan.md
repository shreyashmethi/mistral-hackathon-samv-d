# Samvād — Hackathon Build Plan

## Objective
Build a **voice-first AI news companion** that lets users have natural spoken conversations about today's news. Users ask for briefings, ask "who is that?", get context via RAG, and follow up — all through voice. No screen required.

## Tech Stack
| Layer | Tech | Notes |
|-------|------|-------|
| STT | Voxtral (Mistral) | WebSocket, 16kHz PCM streaming, browser fallback |
| LLM | Mistral Large 3 via AWS Bedrock | Streaming tokens, intent classification, $200 credits |
| TTS | ElevenLabs Streaming API | WebSocket, sentence-boundary buffering, browser fallback |
| Backend | FastAPI (Python 3.11) | Async-first, WebSocket-based |
| Frontend | Next.js 14 + TypeScript | Tailwind, Inter font, Figma design system |
| RAG | Wikipedia + Wikidata APIs | Entity context pipeline |
| Deploy | Vercel (frontend) + Railway (backend) | Free tiers |

## Team Split
- **Devashish**: ML/AI pipeline, Mistral integration, RAG, prompts, news ingestion, conversation logic
- **Shreyash**: Backend API structure, frontend voice UI, WebSocket handling, TTS/STT integration, deployment

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                      │
│                                                              │
│  ┌─────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────┐ │
│  │ MicBtn  │  │ Teleprompter │  │ Waveform  │  │Settings │ │
│  │(tap/spc)│  │(curr sentence│  │(pixel grid│  │ Article │ │
│  └────┬────┘  │  + cursor)   │  │ 38×10)    │  │  Mode   │ │
│       │       └──────────────┘  └───────────┘  └─────────┘ │
│       ▼                                                      │
│  ┌─────────┐     ┌──────────┐     ┌──────────┐             │
│  │AudioCapt│────▶│ WSSession│◀───▶│ TTSClient│             │
│  │(16kHz)  │     │ (api.ts) │     │(11Labs)  │             │
│  └─────────┘     └────┬─────┘     └──────────┘             │
└────────────────────────┼────────────────────────────────────┘
                         │ WebSocket
┌────────────────────────┼────────────────────────────────────┐
│              Backend (FastAPI)                               │
│                        ▼                                     │
│  ┌──────────────────────────┐                               │
│  │  WS /api/ws/{session_id} │                               │
│  └────┬────────────┬────────┘                               │
│       ▼            ▼                                         │
│  ┌─────────┐  ┌──────────────┐  ┌──────────┐              │
│  │   STT   │  │ Conversation │  │   News   │              │
│  │(Voxtral)│  │   Manager    │  │ Pipeline │              │
│  └─────────┘  └──────┬───────┘  │(RSS+LLM) │              │
│                       │          └──────────┘              │
│            ┌──────────┴──────────┐                          │
│            ▼                     ▼                          │
│       ┌─────────┐          ┌─────────┐                     │
│       │   LLM   │          │   RAG   │                     │
│       │(Bedrock)│          │(Wiki*)  │                     │
│       └─────────┘          └─────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Design

The UI follows a Figma-based design with three screens:

### Main Conversation Screen
- **Teleprompter display**: Shows only the current sentence being spoken (not full chat history)
- **Ambient background image**: Top half, fetched based on article content, fades to white
- **Pixel waveform**: 38-column mirrored grid with yellow→red color gradient
- **Mic button**: 80px orange circle, tap-to-toggle, centered bottom
- **Voice-only**: No text input field

### Settings Screen (`/settings`)
- Profile section, News Preferences (topics, sources, briefing length), Voice settings (AI voice, speed, auto-listen), About section

### Article Mode (`/article`)
- URL input, article preview card, AI prompt suggestions, smaller mic button

## State Machine
```
idle → listening → thinking → speaking → idle
         ↑                        │
         └────── (interrupt) ─────┘
error ← can occur at any point
```

---

## Status: All Core Features Complete

### Backend ✅
- News pipeline (RSS → dedup → LLM summarization → cache)
- Intent classification (BRIEFING, ENTITY_QUERY, FOLLOW_UP, NAVIGATION, CHITCHAT)
- RAG entity pipeline (Wikidata + Wikipedia parallel fetch)
- Streaming LLM via Bedrock with Mistral API fallback
- Session management with 40-message history cap

### Frontend ✅
- Teleprompter-style voice UI with pixel waveform
- Real-time STT (16kHz PCM streaming to backend)
- Streaming TTS (ElevenLabs WebSocket with sentence-boundary buffering)
- Three screens: Conversation, Settings, Article Mode
- Contextual background images that change per topic

### Remaining
- [ ] Article Mode backend wiring
- [ ] Settings state persistence
- [ ] Production deployment
- [ ] Demo recording

---

## How to Run

### Backend
```bash
cd backend
pip install -r requirements.txt
# Fill in backend/.env with API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
# Fill in frontend/.env with ElevenLabs keys
npm run dev
# Open http://localhost:3000
```

## Critical Rules
1. **Feature freeze at 11 AM Sunday** — only bug fixes after that
2. **Always have a working demo** — deploy after each step, not just at the end
3. **Pre-record demo video by 2 PM Sunday** — live demos can fail
4. **Sleep Saturday night** — Sunday bugs are 10x harder when exhausted
5. **If STT/TTS breaks, use browser APIs** — fallbacks exist for everything
