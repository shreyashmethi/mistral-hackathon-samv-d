# Shreyash — Task Tracker
**Role**: Backend API structure, Frontend voice UI, WebSocket handling, TTS/STT integration, Deployment

---

## PHASE 1 — Project Scaffold (Step 1) ✅ DONE
- [x] `backend/` — FastAPI directory structure + all `__init__.py` files
- [x] `backend/requirements.txt` — all Python deps (fastapi, uvicorn, websockets, boto3, mistralai, feedparser, etc.)
- [x] `backend/.env` — placeholder keys (NOT committed via .gitignore)
- [x] `backend/.gitignore`
- [x] `backend/app/main.py` — FastAPI app + CORS middleware + route registration
- [x] `backend/app/routers/health.py` — `GET /api/health`
- [x] `backend/app/routers/conversation.py` — POST /api/conversation + GET /api/briefing + WS /api/ws/{session_id}
- [x] `backend/app/models/schemas.py` — ConversationRequest/Response, StoryBrief, BriefingResponse, WSMessage/Response, HealthResponse
- [x] `frontend/` — Next.js 14 + TypeScript directory structure
- [x] `frontend/package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `next.config.ts`
- [x] `frontend/.env.local` — placeholder env vars (NOT committed)
- [x] `frontend/.gitignore`
- [x] `frontend/app/globals.css` — Tailwind + custom scrollbar + dark theme vars
- [x] `frontend/app/layout.tsx` — root layout with metadata + mobile viewport

## PHASE 2 — Backend WebSocket & API Structure ✅ DONE
- [x] `/api/ws/{session_id}` — full-duplex WebSocket
  - Receives: `audio_chunk` (base64 binary), `text`, `end_of_turn`, `interrupt`
  - Sends: `transcript_partial`, `transcript_final`, `llm_token`, `state`, `entities`, `error`
  - Streams LLM tokens word-by-word (25ms delay simulated; real streaming hooks in for Devashish)
- [x] `/api/conversation` POST — HTTP fallback for text-in / response-out
- [x] `/api/briefing` GET — returns today's top stories (stub + real service hook via lazy import)
- [x] CORS middleware — reads `CORS_ORIGINS` env var, comma-separated
- [x] `frontend/lib/api.ts` — typed `api.*` client + `WSSession` class + `newSessionId()`

## PHASE 3 — Speech-to-Text (Step 6) ✅ DONE
- [x] `frontend/lib/stt.ts`
  - `PixtralSTT` — WS to Pixtral endpoint; streams 250ms MediaRecorder chunks as binary; onPartial/onFinal callbacks
  - `BrowserSTT` — continuous `SpeechRecognition` with interim results fallback
  - `STTClient` — auto-picks Pixtral if `NEXT_PUBLIC_PIXTRAL_WS_URL` set, auto-falls back on failure
- [x] `frontend/components/MicButton.tsx`
  - Push-to-talk via mouse + touch + Space key
  - Visual states: breathing (idle), pulsing blue (listening), green (speaking), red (error)
  - Outer ping ring animation when actively listening

## PHASE 4 — Text-to-Speech (Step 7) ✅ DONE
- [x] `frontend/lib/tts.ts`
  - `ElevenLabsTTS` — WS to ElevenLabs `stream-input` endpoint (PCM 24kHz)
    - Sentence-boundary buffering: `streamToken()` buffers until `.!?`, then sends sentence
    - `flushStream()` sends remainder + EOS
    - PCM Int16Array → AudioContext buffer → queue-based playback
    - `stop()` drains queue + closes WS + closes AudioContext (instant interrupt)
  - `BrowserTTS` — `speechSynthesis` with same sentence-boundary logic
  - `TTSClient` — auto-picks ElevenLabs if API key + voice ID both set
  - `getFillerPhrase()` — rotating filler strings for RAG latency gap

## PHASE 5 — Frontend Voice UI (Step 8) ✅ DONE
- [x] `frontend/app/page.tsx` — main conversation page
  - State machine: `idle → listening → thinking → speaking → error`
  - WS session callbacks → TTS token streaming + transcript bubbles
  - AudioContext analyser feeds live mic data to Waveform
  - Interrupt on mic-press-while-speaking (TTS.stop + WS.sendInterrupt)
  - Entity chip tap → `"What is X?"` auto-send
  - Text input fallback (Enter to send)
  - Partial turns tracked by index ref (no unnecessary re-renders)
- [x] `frontend/components/Waveform.tsx`
  - Canvas RAF loop: real analyser data when listening/speaking; sine wave animation otherwise
  - Color-coded: blue=listening, purple=thinking, green=speaking, grey=idle
- [x] `frontend/components/Transcript.tsx`
  - Chat bubbles (user right, AI left), auto-scroll, streaming dot indicator, empty state hint
- [x] `frontend/components/EntityChips.tsx`
  - Horizontally scrollable tappable pills; deduped in page.tsx (max 8)
- [x] `frontend/components/StatusBar.tsx`
  - Story progress dots + "Story N / M" counter; animated state indicator dot

## PHASE 6 — Deployment ✅ DONE
- [x] `backend/Procfile` — Railway start command
- [x] `backend/railway.json` — NIXPACKS builder + restart policy
- [x] `frontend/vercel.json` — framework config + Vercel secret references

---

## NEXT STEPS — TO RUN NOW (both people)

### Step 1: Fill in API keys
```
backend/.env            → MISTRAL_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
frontend/.env.local     → NEXT_PUBLIC_ELEVENLABS_API_KEY, NEXT_PUBLIC_ELEVENLABS_VOICE_ID
```

### Step 2: Start backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Verify: curl http://localhost:8000/api/health  →  {"status":"ok","version":"1.0.0"}
```

### Step 3: Smoke test AI pipeline
```bash
# News: should return 5 real summaries
curl "http://localhost:8000/api/briefing?session_id=test1"

# Full conversation: should return routed AI response
curl -X POST http://localhost:8000/api/conversation \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test1","message":"What is happening in Europe today?"}'

# Entity: should return spoken explanation
curl -X POST http://localhost:8000/api/conversation \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test1","message":"Who is Christine Lagarde?"}'
```

### Step 4: Start frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000 — hold mic or type a message
```

### All Devashish's services are now implemented:
- `services/llm.py` — LLM client fully wired ✅
- `services/news.py` — news pipeline fully wired ✅
- `services/rag.py` — RAG pipeline fully wired ✅
- `services/conversation.py` — session manager + intent router fully wired ✅

### To deploy:
```bash
# Backend → Railway
cd backend
railway login && railway up
# Railway dashboard env vars to set:
#   MISTRAL_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
#   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
#   CORS_ORIGINS=https://your-frontend.vercel.app

# Frontend → Vercel
cd frontend
vercel --prod
# Vercel dashboard env vars to set:
#   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
#   NEXT_PUBLIC_WS_URL=wss://your-backend.up.railway.app
#   NEXT_PUBLIC_ELEVENLABS_API_KEY, NEXT_PUBLIC_ELEVENLABS_VOICE_ID
#   NEXT_PUBLIC_PIXTRAL_WS_URL (if using Pixtral)
```

### Production WebSocket note:
Vercel does NOT proxy WebSocket connections. The frontend connects directly to the Railway WS URL.
`NEXT_PUBLIC_WS_URL` must be the Railway URL (e.g. `wss://samvad-backend.up.railway.app`).

---

## File Map
```
mistral hackathon/
├── plan.md                          # Original team plan
├── SHREYASH_TASKS.md                # This file
├── backend/
│   ├── .env                         # 🔑 API keys (not committed)
│   ├── .gitignore
│   ├── Procfile                     # Railway start command
│   ├── railway.json                 # Railway config
│   ├── requirements.txt
│   └── app/
│       ├── main.py                  # FastAPI app entry
│       ├── models/schemas.py        # Pydantic models
│       ├── routers/
│       │   ├── health.py            # GET /api/health
│       │   └── conversation.py      # POST /api/conversation, GET /api/briefing, WS /api/ws/{id}
│       ├── services/                # ← Devashish ✅ all done
│       │   ├── llm.py               # Bedrock + Mistral API, streaming, intent classification
│       │   ├── news.py              # RSS fetch, dedup, spoken summarization, 30-min cache
│       │   ├── rag.py               # Wikidata + Wikipedia parallel fetch, entity cache
│       │   └── conversation.py      # Session store, intent router, handle_message, stream_handle_message
│       └── prompts/                 # ← Devashish ✅ all done
│           ├── system.py            # Voice-first system prompt + build_system_prompt()
│           └── intent.py            # Bedrock + Mistral tool specs, INTENT_SYSTEM_PROMPT
└── frontend/
    ├── .env.local                   # 🔑 API keys (not committed)
    ├── .gitignore
    ├── vercel.json                  # Vercel config
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.ts
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx                 # Main voice UI + state machine
    ├── components/
    │   ├── MicButton.tsx            # Push-to-talk button
    │   ├── Transcript.tsx           # Conversation bubbles
    │   ├── Waveform.tsx             # Audio canvas visualization
    │   ├── EntityChips.tsx          # Tappable entity pills
    │   └── StatusBar.tsx            # State + story indicator
    └── lib/
        ├── api.ts                   # HTTP client + WSSession
        ├── stt.ts                   # Pixtral STT + browser fallback
        └── tts.ts                   # ElevenLabs TTS + browser fallback
```
