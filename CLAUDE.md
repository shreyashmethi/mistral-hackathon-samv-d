# CLAUDE.md — Samvād Project Guide

## What is this project?
Samvād is a voice-first AI news companion. Users speak to get news briefings, ask about entities ("Who is Christine Lagarde?"), and have multi-turn conversations — all through voice. Built for Mistral AI hackathon.

## Monorepo structure
```
Samavad/
├── backend/          # FastAPI (Python 3.11)
├── frontend/         # Next.js 14 (TypeScript)
├── figma-src/        # Figma design reference (read-only)
└── *.md              # Documentation
```

## How to run

### Backend
```bash
cd backend
pip install -r requirements.txt
# Requires backend/.env with: MISTRAL_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
# Requires frontend/.env with: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_ELEVENLABS_API_KEY, NEXT_PUBLIC_ELEVENLABS_VOICE_ID
npm run dev
# Serves on http://localhost:3000
```

## Backend architecture

### Key files
- `app/main.py` — FastAPI app, CORS, route registration
- `app/routers/conversation.py` — WebSocket `/api/ws/{session_id}`, POST `/api/conversation`, GET `/api/briefing`
- `app/services/llm.py` — Mistral LLM client (streaming + intent classification)
- `app/services/conversation.py` — Session manager, intent router (BRIEFING, ENTITY_QUERY, FOLLOW_UP, NAVIGATION, CHITCHAT)
- `app/services/news.py` — RSS feed aggregation (6 sources), dedup, LLM summarization, 30-min cache
- `app/services/rag.py` — Entity context via Wikidata + Wikipedia (parallel fetch)
- `app/services/stt.py` — Voxtral STT (16kHz PCM streaming)
- `app/prompts/system.py` — Voice-first system prompt templates
- `app/prompts/intent.py` — Intent classification tool specs

### API endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/briefing?session_id=X` | Top 5 news stories |
| POST | `/api/conversation` | Text message → AI response |
| WS | `/api/ws/{session_id}` | Full-duplex voice session |

### WebSocket message types
**Client → Server**: `audio_chunk`, `text`, `end_of_turn`, `interrupt`
**Server → Client**: `transcript_partial`, `transcript_final`, `llm_token`, `state`, `entities`, `error`

## Frontend architecture

### Key files
- `app/page.tsx` — Main conversation screen (teleprompter + waveform + mic)
- `app/settings/page.tsx` — Settings screen (static/placeholder)
- `app/article/page.tsx` — Article mode screen (static/placeholder)
- `app/layout.tsx` — Root layout: Inter font, 430px max-width container, dark outer bg
- `app/globals.css` — Theme vars, animations (cursor-pulse, fade-in)
- `components/Waveform.tsx` — Pixel grid visualizer (38 cols × 10 rows, yellow→red)
- `components/MicButton.tsx` — Tap-to-toggle mic button (80px orange circle)
- `components/Transcript.tsx` — Teleprompter (shows current sentence only)
- `components/EntityChips.tsx` — Styled entity pills
- `lib/api.ts` — HTTP client + WSSession class + types
- `lib/stt.ts` — AudioCapture (mic → 16kHz PCM → base64 → WebSocket)
- `lib/tts.ts` — ElevenLabs streaming TTS + browser fallback
- `tailwind.config.ts` — Mistral color palette, Inter font, border-radius tokens

### State machine
```
idle → listening → thinking → speaking → idle
         ↑                        │
         └────── (interrupt) ─────┘
```

### Design system
- **Font**: Inter (via next/font/google)
- **Container**: 430px max-width, centered, shadow-2xl on dark bg
- **Colors**: Orange `#FF8205` (accent), `#FFFAEB` (cream bg for settings/article), white (main screen bg)
- **Waveform colors**: `#FFE000` (yellow tip) → `#FF8800` (amber center) → `#CC0000` (red tip)
- **Border radius**: sm=6px, md=8px, lg=10px, xl=14px

## Conventions

### Code style
- Frontend: TypeScript strict mode, React functional components with hooks
- Backend: Python async/await, Pydantic models, type hints
- Styling: Tailwind utility classes, inline styles for dynamic values, no CSS modules
- Icons: Lucide React (`lucide-react`)

### Important patterns
- All LLM responses are optimized for spoken word (short sentences, no markdown)
- WebSocket is the primary communication channel (not HTTP)
- TTS uses sentence-boundary buffering (flush on `. ! ?`)
- Audio is captured at native rate, resampled to 16kHz PCM s16le mono
- Session state is in-memory (not persisted across restarts)
- News cache is global (30-min TTL), entity cache is global (process lifetime)
- Entity explanations are per-session (prevents repeating)

### Things to avoid
- Don't add text input to the main conversation screen (voice-only design)
- Don't use chat bubbles (teleprompter style: shows only current sentence)
- Don't use canvas for the waveform (DOM-based pixel grid)
- Don't use `StatusBar` component (deleted, not part of current design)
- Don't commit `.env` files
- Don't use gradients in the Mistral design system (flat colors only)

### Testing
```bash
# Backend health check
curl http://localhost:8000/api/health

# News briefing
curl "http://localhost:8000/api/briefing?session_id=test1"

# Conversation
curl -X POST http://localhost:8000/api/conversation \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test1","message":"What is happening in Europe today?"}'

# Frontend build check
cd frontend && npm run build
```
