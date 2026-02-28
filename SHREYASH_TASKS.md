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
- [x] `frontend/package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `next.config.mjs`
- [x] `frontend/.env` — placeholder env vars (NOT committed)
- [x] `frontend/.gitignore`
- [x] `frontend/app/globals.css` — Tailwind + custom animations + theme vars
- [x] `frontend/app/layout.tsx` — root layout with Inter font, mobile viewport, centered 430px container

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
  - `AudioCapture` — captures mic with echo cancellation + noise suppression
  - Resamples native sample rate → 16kHz PCM (Voxtral API requirement)
  - Float32 → Int16 (s16le) → base64 chunks streamed via `ws.sendAudioChunk()`
- [x] `frontend/components/MicButton.tsx`
  - Tap-to-toggle mic (not hold-to-talk)
  - 80px orange circle with Lucide Mic icon
  - Visual states: ring glow (listening), disabled (thinking)
  - Spacebar support for push-to-talk
  - `size` prop: `lg` (80px, main screen) / `md` (64px, article mode)

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

## PHASE 5 — Frontend Voice UI (Step 8) ✅ DONE (Redesigned)
- [x] `frontend/app/page.tsx` — main conversation screen
  - Figma-based redesign: teleprompter display, not chat bubbles
  - State machine: `idle → listening → thinking → speaking → error`
  - **Teleprompter**: shows only the current sentence being spoken (AI) or transcribed (user)
  - **Ambient background image**: top half of screen, fades to white; appears when AI starts speaking
  - **Pixel waveform**: 38-column mirrored grid, yellow→red gradient, 40ms updates
  - **Mic button**: 80px orange circle, tap-to-toggle, centered at bottom
  - WS session callbacks → TTS token streaming
  - AudioContext analyser feeds live mic data to Waveform
  - Interrupt on mic-tap-while-speaking (TTS.stop + WS.sendInterrupt)
  - No text input (voice-only design)
- [x] `frontend/components/Waveform.tsx`
  - DOM-based pixel grid (not canvas): 38 columns × 10 rows (5 mirrored)
  - Color gradient: yellow (#FFE000) at tips → amber (#FF8800) at center → red (#CC0000) at tips
  - Responds to real audio data (listening/speaking) or animated patterns (idle/thinking)
  - 40ms update interval with 0.6 easing interpolation
- [x] `frontend/components/Transcript.tsx` (now Teleprompter)
  - Shows only current sentence (extracted from latest turn via sentence-boundary splitting)
  - User speech in orange, AI speech in dark text
  - Pulsing orange cursor while streaming
  - Empty state: "Tap the mic and ask about today's news"
- [x] `frontend/components/EntityChips.tsx`
  - Restyled: uppercase, tracking-wide, 10px font, subtle border
  - Used in ArticleMode screen (removed from main conversation screen)
- [x] `frontend/components/MicButton.tsx`
  - 80px rounded orange button with white Lucide Mic icon
  - Tap-to-toggle (not hold-to-talk)
  - "Tap to speak" / "Listening..." label below
  - Supports `lg` and `md` size variants
- [x] ~~`frontend/components/StatusBar.tsx`~~ — **Removed** (no longer in design)

## PHASE 5.5 — New Screens ✅ DONE
- [x] `frontend/app/settings/page.tsx` — Settings screen
  - Profile card (avatar, name, email)
  - News Preferences: Topics, Sources, Briefing Length (segmented control)
  - Voice: AI Voice, Speech Speed (slider), Auto-listen (toggle)
  - About: How Samvād Works, Send Feedback
  - Version text at bottom
  - Static/placeholder (no state persistence yet)
- [x] `frontend/app/article/page.tsx` — Article Mode screen
  - URL input with "Go" button
  - Article preview card with entity chips
  - 3 AI prompt suggestions with orange left-border accent
  - Smaller mic button at bottom
  - Static/placeholder (no backend wiring yet)

## PHASE 6 — Deployment ✅ DONE
- [x] `backend/Procfile` — Railway start command
- [x] `backend/railway.json` — NIXPACKS builder + restart policy
- [x] `frontend/vercel.json` — framework config + Vercel secret references

---

## NEXT STEPS — TO RUN NOW (both people)

### Step 1: Fill in API keys
```
backend/.env            → MISTRAL_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
frontend/.env           → NEXT_PUBLIC_ELEVENLABS_API_KEY, NEXT_PUBLIC_ELEVENLABS_VOICE_ID
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
# Open http://localhost:3000 — tap mic button to speak
```

### To deploy:
```bash
# Backend → Railway
cd backend
railway login && railway up
# Railway dashboard env vars to set:
#   MISTRAL_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
#   CORS_ORIGINS=https://your-frontend.vercel.app

# Frontend → Vercel
cd frontend
vercel --prod
# Vercel dashboard env vars to set:
#   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
#   NEXT_PUBLIC_WS_URL=wss://your-backend.up.railway.app
#   NEXT_PUBLIC_ELEVENLABS_API_KEY, NEXT_PUBLIC_ELEVENLABS_VOICE_ID
```

### Production WebSocket note:
Vercel does NOT proxy WebSocket connections. The frontend connects directly to the Railway WS URL.
`NEXT_PUBLIC_WS_URL` must be the Railway URL (e.g. `wss://samvad-backend.up.railway.app`).

---

## File Map
```
Samavad/
├── plan.md                          # Original team plan
├── SHREYASH_TASKS.md                # This file
├── DEVASHISH_TASKS.md               # ML/AI pipeline tasks
├── mistral-design-guidelines.md     # Mistral design system reference
├── figma-src/                       # Figma design source files
│   ├── app/pages/                   # Screen designs (Conversation, Article, Settings)
│   ├── app/components/ui/           # shadcn/ui component library
│   └── styles/                      # Theme CSS + design tokens
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
│       ├── services/
│       │   ├── llm.py               # Bedrock + Mistral API, streaming, intent classification
│       │   ├── news.py              # RSS fetch, dedup, spoken summarization, 30-min cache
│       │   ├── rag.py               # Wikidata + Wikipedia parallel fetch, entity cache
│       │   ├── stt.py               # Speech-to-text service
│       │   └── conversation.py      # Session store, intent router, handle_message
│       └── prompts/
│           ├── system.py            # Voice-first system prompt + build_system_prompt()
│           └── intent.py            # Intent classification prompt + tool specs
└── frontend/
    ├── .env                         # 🔑 API keys (not committed)
    ├── .gitignore
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts           # Mistral color palette + design tokens
    ├── next.config.mjs
    ├── public/
    │   └── news-bg.jpg              # Default background image
    ├── app/
    │   ├── globals.css              # Tailwind + animations (cursor-pulse, fade-in)
    │   ├── layout.tsx               # Inter font, 430px container, dark outer bg
    │   ├── page.tsx                 # Main conversation screen (teleprompter + waveform)
    │   ├── settings/page.tsx        # Settings screen
    │   └── article/page.tsx         # Article mode screen
    ├── components/
    │   ├── MicButton.tsx            # Tap-to-toggle orange mic button
    │   ├── Transcript.tsx           # Teleprompter (current sentence only)
    │   ├── Waveform.tsx             # Pixel grid audio visualizer (38×10)
    │   └── EntityChips.tsx          # Styled entity pills (article mode)
    └── lib/
        ├── api.ts                   # HTTP client + WSSession + types
        ├── stt.ts                   # AudioCapture (16kHz PCM resampling)
        └── tts.ts                   # ElevenLabs TTS + browser fallback
```
