# Devashish — Task Tracker
**Role**: ML/AI pipeline, Mistral integration, RAG, prompts, news ingestion, conversation logic

---

## PHASE 1 — Prompts ✅ DONE
- [x] `backend/app/prompts/system.py`
  - `SAMVAD_BASE` — core voice-first personality (short sentences, no markdown, spoken English)
  - `BRIEFING_INSTRUCTIONS` — how to introduce stories (First… / Next… / And finally…)
  - `SESSION_MEMORY_INSTRUCTIONS` — entity tracking, story navigation, cross-story connections
  - `ENTITY_INSTRUCTIONS` — 2-3 sentence spoken entity explanation style
  - `CROSS_STORY_INSTRUCTIONS` — when/how to reference prior stories
  - `build_system_prompt(has_briefing, has_entity_context, prior_entities, current_story_title)` — assembles full prompt for each turn
- [x] `backend/app/prompts/intent.py`
  - `INTENT_TOOL_SPEC` — Bedrock Converse API tool definition
  - `INTENT_TOOL_MISTRAL` — Mistral native SDK tool definition
  - `INTENT_SYSTEM_PROMPT` — classification guidance
  - Intents: `BRIEFING | ENTITY_QUERY | FOLLOW_UP | NAVIGATION | CHITCHAT | ARTICLE_MODE`
  - Fields: `intent`, `entity`, `topic`, `navigation_direction`

## PHASE 2 — LLM Service (Step 3) ✅ DONE
- [x] `backend/app/services/llm.py`
  - `LLMClient` — initialises Bedrock + Mistral API on startup; gracefully handles missing creds
  - `complete(messages, system_prompt) -> str` — non-streaming; tries Bedrock, falls back to Mistral API
  - `stream_complete(messages, system_prompt) -> AsyncGenerator[str]` — real token streaming
    - Bedrock: `converse_stream()` in thread executor → async queue → yields tokens
    - Mistral: `chat.stream_async()` native async stream
  - `classify_intent(utterance, history) -> dict` — Mistral function calling
    - Bedrock Converse API with `toolChoice: { tool: "classify_intent" }`
    - Mistral API fallback with `tool_choice="any"`
    - Keyword matching as last-resort fallback (no API needed)
  - `get_client() -> LLMClient` — singleton accessor

## PHASE 3 — News Pipeline (Step 2) ✅ DONE
- [x] `backend/app/services/news.py`
  - RSS feeds: BBC News, BBC Europe, Reuters World, The Guardian, Deutsche Welle, France 24
  - `_fetch_feed(client, feed_meta)` — async httpx fetch → feedparser parse → list of story dicts
  - `_strip_html(text)` — clean HTML from summaries (capped at 800 chars for LLM)
  - `_deduplicate(stories, threshold=82)` — rapidfuzz `token_sort_ratio` dedup (exact match fallback if rapidfuzz missing)
  - `_summarize_story(story)` — calls Mistral to generate 3-4 spoken-optimised sentences
  - `refresh_news_cache()` — fetches all feeds in parallel, deduplicates, picks top 5 by recency, summarizes in parallel, updates global cache
  - `get_briefing()` — returns cached stories (calls refresh if cache older than 30 min)
  - Cache TTL: 30 minutes; cache format: `{ stories: [...], fetched_at: datetime }`

## PHASE 4 — RAG Entity Pipeline (Step 4) ✅ DONE
- [x] `backend/app/services/rag.py`
  - `_search_wikidata(entity, client)` — Wikidata `wbsearchentities` → QID + description + label
  - `_fetch_wikidata_props(qid, client)` — fetches key properties: instance-of (P31), country (P17), occupation (P106), birth/founding year (P569/P571)
  - `_fetch_wikipedia(entity, client)` — Wikipedia REST API `page/summary/{title}` → extract (capped 600 chars)
  - `get_entity_context(entity_name)` — **parallel** Wikidata + Wikipedia fetch via `asyncio.gather()`, global cache
  - `explain_entity(entity_name, article_context, prior_explanation)` — generates 2-3 spoken sentences via Mistral
    - If entity already explained in session: generates one-sentence reminder + new detail
    - Falls back to Wikipedia extract on LLM failure
  - Global entity cache: survives for process lifetime (not per-session)

## PHASE 5 — Conversation Manager (Step 5) ✅ DONE
- [x] `backend/app/services/conversation.py`

  **Session store** (in-memory dict, keyed by session_id):
  ```python
  {
    "history": [],              # {role, content} list, capped at 40 entries (20 turns)
    "entities_explained": {},   # entity_name → explanation[:200] — prevents repeating
    "current_story_index": 0,   # which briefing story user is on
    "briefing_stories": [],     # cached story list for this session
  }
  ```

  **Intent routing** in `handle_message(session_id, message) -> dict`:
  | Intent | Handler | What it does |
  |--------|---------|-------------|
  | `BRIEFING` | `_handle_briefing` | Formats top-3 stories with First/Next/Finally connectors; resets story index to 0 |
  | `ENTITY_QUERY` | `_handle_entity_query` | Calls RAG `explain_entity`; checks session cache first; stores explanation |
  | `NAVIGATION` | `_handle_navigation` | Increments/decrements `current_story_index`; returns story N of M |
  | `CHITCHAT` | `_handle_chitchat` | 1-2 sentence warm reply, gently steers back to news |
  | `FOLLOW_UP` | `_handle_follow_up` | Full LLM call with history + current story context |

  **`stream_handle_message(session_id, message) -> AsyncGenerator[str]`** (for WebSocket):
  - BRIEFING/NAVIGATION/CHITCHAT: yields complete response as one chunk
  - ENTITY_QUERY: yields "Let me look that up…" immediately, then full explanation
  - FOLLOW_UP: streams real tokens from `llm.stream_complete()`

  **History management**:
  - Every turn appended: user message + assistant response
  - Cap: last 40 messages (20 turns); oldest dropped on overflow
  - Prior entities injected into system prompt automatically via `build_system_prompt()`
  - Cross-story connection hint added when history > 4 turns

---

## WHAT STILL NEEDS TESTING / TUNING (priority order)

### High priority (do before deploy)
- [ ] **API keys** — fill in `.env` with real Mistral API key and AWS Bedrock credentials
- [ ] **Smoke test LLM** — run `python -c "import asyncio; from app.services.llm import get_client; print(asyncio.run(get_client().complete([{'role':'user','content':'hello'}])))"` from `backend/`
- [ ] **Smoke test news** — run `python -c "import asyncio; from app.services.news import get_briefing; print(asyncio.run(get_briefing()))"` — verify 5 stories come back with real summaries
- [ ] **Smoke test RAG** — run `python -c "import asyncio; from app.services.rag import explain_entity; print(asyncio.run(explain_entity('Christine Lagarde', 'ECB raised rates')))"` — should get 2-3 spoken sentences
- [ ] **Full conversation test** via HTTP: `curl -X POST http://localhost:8000/api/conversation -H 'Content-Type: application/json' -d '{"session_id":"test1","message":"What is happening in Europe today?"}'`

### Medium priority (tune during demo prep)
- [ ] **Prompt tuning** — if responses sound too long or formal, tighten `SAMVAD_BASE` voice rules
- [ ] **Summarization quality** — check spoken summaries from `get_briefing()` — should be 3-4 natural sentences, not lists
- [ ] **Entity explanation length** — `explain_entity` should return ~2-3 sentences; adjust prompt if too long
- [ ] **Intent accuracy** — test edge cases: "Tell me more about that" (FOLLOW_UP), "Who is Lagarde?" (ENTITY_QUERY), "Next" (NAVIGATION)
- [ ] **Deduplication threshold** — 82% may be too aggressive for some feeds; try 75% if stories are getting dropped

### Low priority (if time)
- [ ] `ARTICLE_MODE` handler — user pastes URL; fetch article text via httpx + summarize
- [ ] Persistent news cache across restarts (Redis or simple JSON file)
- [ ] Wikidata property labels — currently returns QIDs (e.g., "Q30") for P31/P17/P106 values; add label resolution for cleaner facts

---

## Interface Contract (what Shreyash's router calls)

### `handle_message(session_id: str, message: str) -> dict`
Returns:
```python
{
  "response": str,              # Full AI response text
  "intent": str,                # "BRIEFING|ENTITY_QUERY|FOLLOW_UP|NAVIGATION|CHITCHAT"
  "entities": list[str],        # Entity names mentioned (for frontend EntityChips)
  "current_story_index": int,   # Which story index session is on
}
```

### `stream_handle_message(session_id: str, message: str) -> AsyncGenerator[str, None]`
Yields string tokens. WebSocket router calls this and sends each token as `{ type: "llm_token", data: token }`.

### `get_briefing(session_id: str) -> list[dict]`
Returns list of story dicts with keys: `title, summary, source, published, url`.

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| All LLM calls go through `services/llm.py` | Single fallback logic, single retry point |
| News cache is global (not per session) | All sessions see the same news; avoids 6× LLM summarization per user |
| Entity cache in `rag.py` is global | Wikipedia/Wikidata results don't change mid-session |
| Entity explanations stored in session | Per-session memory; different users can discuss same entity differently |
| `stream_handle_message` for WebSocket | Real LLM token streaming; TTS starts on first sentence boundary, not after full response |
| Bedrock via thread executor | boto3 is sync-only; run_in_executor preserves async event loop |
| keyword_intent fallback in llm.py | Zero-latency fallback if both APIs are down |

---

## Run Locally

```bash
cd backend
pip install -r requirements.txt

# Fill in keys first:
# .env: MISTRAL_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

uvicorn app.main:app --reload --port 8000

# Test endpoints:
curl http://localhost:8000/api/health
curl "http://localhost:8000/api/briefing?session_id=test1"
curl -X POST http://localhost:8000/api/conversation \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test1","message":"What is the ECB?"}'
```
