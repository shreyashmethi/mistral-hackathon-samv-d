# Samvād — Hackathon Build Plan

## Objective
Build a **voice-first AI news companion** that lets users have natural spoken conversations about today's news. Users ask for briefings, ask "who is that?", get context via RAG, and follow up — all through voice. No screen required.

## Tech Stack
| Layer | Tech | Notes |
|-------|------|-------|
| STT | Pixtral Real-Time (Mistral) | WebSocket, fallback: browser Web Speech API |
| LLM | Mistral Large 3 via AWS Bedrock | $200 credits from API track |
| TTS | ElevenLabs Streaming API | WebSocket, targets special prize |
| Backend | FastAPI (Python 3.11) | Async-first |
| Frontend | Next.js 14 + TypeScript | Tailwind + shadcn/ui |
| RAG | Wikipedia + Wikidata APIs | Entity context pipeline |
| Deploy | Vercel (frontend) + Railway (backend) | Free tiers |

## Team Split
- **Devashish**: ML/AI pipeline, Mistral integration, RAG, prompts, news ingestion, conversation logic
- **Shreyash**: Backend API structure, frontend voice UI, WebSocket handling, TTS/STT integration, deployment

---

## The 10 Steps

### Step 1 — Project Scaffold & Environment (1.5 hrs)
**Goal**: Both repos running locally with all API keys configured.

- [ ] Create GitHub repo (monorepo or two repos: `samvad-backend`, `samvad-frontend`)
- [ ] **Backend**: `fastapi` project with `uvicorn`, folder structure:
  ```
  backend/
  ├── app/
  │   ├── main.py              # FastAPI app, CORS, routes
  │   ├── routers/
  │   │   ├── conversation.py  # Main conversation endpoint
  │   │   └── health.py        # Health check
  │   ├── services/
  │   │   ├── news.py          # RSS fetcher + summarizer
  │   │   ├── rag.py           # Wikipedia/Wikidata retrieval
  │   │   ├── llm.py           # Mistral via Bedrock client
  │   │   └── conversation.py  # Session manager + intent routing
  │   ├── prompts/
  │   │   ├── system.py        # System prompt templates
  │   │   └── intent.py        # Intent classification prompt
  │   └── models/
  │       └── schemas.py       # Pydantic models
  ├── requirements.txt
  └── .env
  ```
- [ ] **Frontend**: `npx create-next-app@14` with TypeScript, Tailwind, shadcn/ui
  ```
  frontend/
  ├── app/
  │   ├── page.tsx             # Main conversation UI
  │   └── layout.tsx
  ├── components/
  │   ├── MicButton.tsx        # Push-to-talk mic
  │   ├── Transcript.tsx       # Live transcript display
  │   ├── Waveform.tsx         # Audio waveform viz
  │   ├── EntityChips.tsx      # Tappable entity cards
  │   └── StatusBar.tsx        # Connection/state indicator
  ├── lib/
  │   ├── stt.ts               # Pixtral STT WebSocket client
  │   ├── tts.ts               # ElevenLabs TTS WebSocket client
  │   └── api.ts               # Backend API client
  └── .env.local
  ```
- [ ] Claim & configure: AWS Bedrock credits, Mistral API key, ElevenLabs API key
- [ ] Verify all API connections with simple test scripts

**Done when**: `uvicorn` serves a health endpoint, Next.js renders a blank page, all 3 API keys return valid responses.

---

### Step 2 — News Ingestion Pipeline (2 hrs)
**Goal**: Backend fetches, parses, and summarizes top European news stories.

- [ ] Build RSS fetcher (`feedparser`) for these feeds:
  - BBC News, BBC Europe, Reuters World, The Guardian, Deutsche Welle, France 24
  - TechCrunch, Ars Technica, The Verge, Nature (optional/stretch)
- [ ] Parse each feed: extract title, summary, full text link, published date, source
- [ ] Deduplicate by title similarity (simple fuzzy match or embedding cosine)
- [ ] Rank by recency → pick top 5 stories
- [ ] For each story, call Mistral Large 3 to generate a **spoken-optimized summary** (3-4 sentences, short words, no jargon)
- [ ] Cache summaries in-memory dict keyed by session — pre-fetch on app load
- [ ] Expose endpoint: `GET /api/briefing` → returns list of story summaries

**Done when**: Hitting `/api/briefing` returns 3-5 clean, spoken-style news summaries.

---

### Step 3 — Mistral LLM Integration via Bedrock (1.5 hrs)
**Goal**: Reliable LLM calls with streaming, intent classification, and the Samvād system prompt.

- [ ] Set up `boto3` Bedrock client for Mistral Large 3
- [ ] Implement streaming response handler (yields tokens as they arrive)
- [ ] Wire up the **system prompt** from the proposal (personality, voice optimization, session memory rules)
- [ ] Implement **intent classification** as a Mistral function call:
  - Input: user utterance + conversation history
  - Output: `{"intent": "BRIEFING|ENTITY_QUERY|FOLLOW_UP|ARTICLE_MODE|NAVIGATION|CHITCHAT", "entity": "...", "topic": "..."}`
- [ ] Build the intent router in `conversation.py`:
  - `BRIEFING` → return cached briefing
  - `ENTITY_QUERY` → trigger RAG pipeline (Step 4)
  - `FOLLOW_UP` → send to LLM with full conversation context
  - `NAVIGATION` → move to next/prev story
  - `CHITCHAT` → short friendly reply
- [ ] Add fallback: if Bedrock fails, fall back to Mistral API directly (`mistralai` SDK, $15 free credits)

**Done when**: You can POST a text message and get a streamed, contextual response routed by intent.

---

### Step 4 — RAG Entity Context Pipeline (2 hrs)
**Goal**: When user asks "Who is X?", retrieve real-world context and generate a spoken explanation.

- [ ] **Entity extraction**: Use Mistral function calling to extract entity name from user utterance
- [ ] **Session check**: If entity was already explained in this session, reference prior explanation
- [ ] **Wikidata lookup** (`wikidata.org/w/api.php`):
  - Search entity → get QID
  - Fetch: description, notable facts, dates, relationships
- [ ] **Wikipedia extract** (`en.wikipedia.org/api/rest_v1/page/summary/{title}`):
  - Fetch 2-paragraph extract for background
- [ ] **Parallel fetch**: Use `asyncio.gather()` to hit Wikidata + Wikipedia simultaneously
- [ ] **Context assembly**: Combine article context + Wikidata facts + Wikipedia extract + conversation history
- [ ] **LLM generation**: Feed assembled context to Mistral with entity context prompt → 2-3 sentence spoken explanation
- [ ] **Entity cache**: Cache lookups in-memory for session duration (instant on repeat queries)
- [ ] Expose through the conversation endpoint (intent router calls this for `ENTITY_QUERY`)

**Done when**: Asking "Who is Christine Lagarde?" returns a concise, spoken-friendly explanation with news-relevant context.

---

### Step 5 — Conversation Manager & Session Memory (1.5 hrs)
**Goal**: Multi-turn conversations that reference prior context and connect stories.

- [ ] **Session store**: In-memory dict keyed by session ID
  ```python
  sessions = {
      "session_123": {
          "history": [],           # Full message history
          "entities_explained": {}, # entity_name → explanation
          "current_story_index": 0, # Which briefing story we're on
          "briefing_stories": [],   # Cached story summaries
      }
  }
  ```
- [ ] **History management**: Append each user/assistant turn, cap at ~20 turns (truncate oldest)
- [ ] **Entity tracking**: When an entity is explained, store it. On future mentions, inject "Previously discussed: {entity} — {summary}" into context
- [ ] **Story navigation**: Track which story the user is on. "Next story" increments index. "Go back" decrements.
- [ ] **Cross-story connections**: When the LLM generates a response, include instruction to reference related prior stories if relevant
- [ ] Generate session IDs on frontend connection, pass with every request

**Done when**: You can have a 5+ turn conversation where the AI references earlier explanations and navigates between stories.

---

### Step 6 — Speech-to-Text (Pixtral STT) (2 hrs)
**Goal**: User speaks into mic → real-time transcription → text sent to backend.

- [ ] **Frontend**: Implement browser audio capture via `MediaRecorder` or `AudioContext`
- [ ] **Pixtral STT WebSocket client** (`lib/stt.ts`):
  - Connect to Pixtral Real-Time WebSocket endpoint
  - Stream audio chunks as user speaks
  - Receive partial + final transcriptions
  - Display live transcript in UI
- [ ] **Push-to-talk mode**: Hold mic button to record, release to send
- [ ] **Voice-activated mode** (stretch): Detect speech start/end with VAD (Voice Activity Detection)
- [ ] **Fallback**: If Pixtral fails, switch to browser `webkitSpeechRecognition` / `SpeechRecognition` API
  - This is free, works offline, zero setup
  - Lower quality but functional for demo
- [ ] Wire transcription output → POST to backend conversation endpoint

**Done when**: Speaking into the mic produces accurate text that gets sent to the backend.

---

### Step 7 — Text-to-Speech (ElevenLabs Streaming) (2 hrs)
**Goal**: LLM response streams directly to ElevenLabs → user hears natural voice with minimal latency.

- [ ] **ElevenLabs WebSocket client** (`lib/tts.ts`):
  - Connect to ElevenLabs streaming TTS WebSocket
  - Send text chunks as they arrive from Mistral (token-by-token or sentence-by-sentence)
  - Receive audio chunks → play immediately via `AudioContext`
- [ ] **Voice selection**: Pick a warm, conversational voice from ElevenLabs library
- [ ] **Latency optimization**:
  - Start speaking as soon as first sentence is complete (don't wait for full response)
  - Buffer strategy: collect tokens until sentence boundary, then send to TTS
- [ ] **Filler phrases**: While RAG fetches data (1-2s), play: "Let me think about that..." or "Good question..."
  - Pre-generate these as audio clips at startup
- [ ] **Audio state management**: Handle interruptions (user speaks while AI is talking → stop TTS, listen)
- [ ] **Fallback**: If ElevenLabs credits run out, switch to browser `speechSynthesis` API

**Done when**: AI responses play as natural-sounding speech with <2s perceived latency.

---

### Step 8 — Frontend Voice UI (2.5 hrs)
**Goal**: Mobile-friendly, minimal UI where voice is the primary interface.

- [ ] **Layout** (mobile-first):
  - Top bar: "Samvād" logo + current story indicator + settings icon
  - Main area: Waveform animation + scrolling transcript
  - Entity chips: Horizontal scroll of mentioned entities (tap to ask)
  - Bottom: Large mic button + text input fallback
  - Status bar: "Listening..." / "Thinking..." / "Speaking..."
- [ ] **Visual states**:
  - `idle`: Subtle breathing animation on mic button
  - `listening`: Blue waveform, pulsing mic, live transcript appearing
  - `thinking`: Paused waveform, loading animation, entity chips updating
  - `speaking`: Green waveform, AI transcript appearing
  - `error`: Red pulse, brief error message
- [ ] **Waveform component**: Use `AudioContext` analyser node → canvas/SVG visualization
- [ ] **Entity chips**: Render as tappable pills. On tap → send "What is {entity}?" to backend
- [ ] **Text fallback**: Input field for typing when voice isn't available
- [ ] **Responsive**: Test on actual phone browser (not just devtools)

**Done when**: A user on a phone can tap the mic, talk, see their transcript, hear the AI respond, and tap entity chips.

---

### Step 9 — End-to-End Integration, Testing & Deployment (3 hrs)
**Goal**: Full voice loop working on production URLs. All edge cases handled.

- [ ] **Full loop test**: Mic → STT → Backend (intent → LLM/RAG) → TTS → Speaker
- [ ] **Test the demo script** (run through 3+ times):
  1. "What's happening in Europe today?" → Briefing mode
  2. (After ECB story) "What's the ECB?" → Entity RAG
  3. "How does that affect the UK?" → Follow-up with session memory
  4. "Next story" → Navigation
  5. (If time) Paste article URL → Article mode
- [ ] **Edge cases to handle**:
  - Empty/silent audio input → "I didn't catch that, could you repeat?"
  - Unknown entity (no Wikipedia result) → "I don't have much info on that"
  - Network timeout → Retry with exponential backoff, show error state
  - Very long user utterance → Truncate gracefully
- [ ] **Deploy**:
  - Backend → Railway: `railway up`, set env vars, verify health endpoint
  - Frontend → Vercel: `vercel --prod`, set `NEXT_PUBLIC_API_URL` to Railway URL
  - Test CORS between Vercel frontend and Railway backend
  - Test WebSocket connections through production (sometimes proxies block WS)
- [ ] **Performance check**: Measure end-to-end latency (target: <3s from user stops speaking to AI starts speaking)

**Done when**: Someone with just the Vercel URL can open it on their phone and have a full voice conversation about today's news.

---

### Step 10 — Demo Recording, README & Submission (2 hrs)
**Goal**: Submitted on the hackathon platform with all deliverables.

- [ ] **Record backup demo video** (2-3 min):
  - Screen + audio recording of the demo script conversation
  - Show all modes: briefing, entity query, follow-up, navigation
  - Record on actual phone if possible for authenticity
  - Upload to YouTube/Loom as unlisted
- [ ] **Write README.md**:
  - One-line description + screenshot/GIF
  - Architecture diagram (use the ASCII one from proposal or make a clean image)
  - Tech stack table
  - Setup instructions (local dev)
  - Live demo link
  - Team info
- [ ] **GitHub cleanup**:
  - Remove debug logs, commented-out code, test files
  - Ensure `.env` is in `.gitignore`
  - Add LICENSE (MIT)
- [ ] **Hackathon submission**:
  - Project title: "Samvād — Your AI News Companion That Speaks Your Language"
  - Description: emphasize voice-first, Mistral ecosystem (Large 3 + Pixtral), ElevenLabs integration
  - Tags: target ElevenLabs prize + Mistral prize + Startup prize
  - Links: GitHub repo, live demo URL, demo video
- [ ] **Final production test**: One complete conversation on the live URL after submission

**Done when**: Submission is live on the hackathon platform with working demo URL, video backup, and clean repo.

---

## Timeline Map (24 hrs of work across 48 hrs)

| Block | Steps | Hours | When |
|-------|-------|-------|------|
| **Sat Morning** | Step 1 (Scaffold) + Step 2 (News) | 3.5h | 10 AM – 1:30 PM |
| **Sat Afternoon** | Step 3 (LLM) + Step 4 (RAG) | 3.5h | 2:30 PM – 6 PM |
| **Sat Evening** | Step 5 (Session) + Step 6 (STT) | 3.5h | 7 PM – 10:30 PM |
| **Sat Night** | Step 7 (TTS) | 2h | 10:30 PM – 12:30 AM |
| **Sleep** | — | — | 12:30 AM – 8 AM |
| **Sun Morning** | Step 8 (Frontend UI) | 2.5h | 8 AM – 10:30 AM |
| **Sun Midday** | Step 9 (Integration + Deploy) | 3h | 10:30 AM – 1:30 PM |
| **Sun Afternoon** | Step 10 (Demo + Submit) | 2h | 2 PM – 4 PM |

## Critical Rules
1. **Feature freeze at 11 AM Sunday** — only bug fixes after that
2. **Always have a working demo** — deploy after each step, not just at the end
3. **Pre-record demo video by 2 PM Sunday** — live demos can fail
4. **Sleep Saturday night** — Sunday bugs are 10x harder when exhausted
5. **If STT/TTS breaks, use browser APIs** — fallbacks exist for everything
