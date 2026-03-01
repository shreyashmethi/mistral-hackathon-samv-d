# Samvād — Hackathon Build Plan (v2 — Enhanced Architecture)

## Objective
Build a **voice-first AI news companion** with a production-grade intelligence backend: automated news ingestion every 30 minutes into a vector database with hotness scoring, a knowledge graph of all entities and their relationships, and a hybrid retrieval pipeline that combines semantic search with graph traversal for accurate, contextual answers.

## Tech Stack
| Layer | Tech | Notes |
|-------|------|-------|
| STT | Pixtral Real-Time (Mistral) | WebSocket, fallback: browser Web Speech API |
| LLM | Mistral Large 3 via AWS Bedrock | $200 credits from API track |
| TTS | ElevenLabs Streaming API | WebSocket, targets special prize |
| Embeddings | Mistral Embed (via Bedrock) | 1024-dim vectors, fallback: `sentence-transformers/all-MiniLM-L6-v2` |
| Vector DB | ChromaDB (in-process) | Zero-infra, persistent mode to disk, metadata filtering |
| Knowledge Graph | Neo4j Aura Free (cloud) | Free tier: 200k nodes, 400k relationships. Fallback: NetworkX in-memory |
| Scheduler | APScheduler (AsyncIOScheduler) | 30-min cron for news ingestion |
| Backend | FastAPI (Python 3.11) | Async-first |
| Frontend | Next.js 14 + TypeScript | Tailwind + shadcn/ui |
| Deploy | Vercel (frontend) + Railway (backend) | Free tiers |

## Team Split
- **Devashish**: ML/AI pipeline, Mistral integration, RAG, prompts, news ingestion, conversation logic, knowledge graph design
- **Shreyash**: Backend API structure, frontend voice UI, WebSocket handling, TTS/STT integration, vector DB setup, scheduler, deployment

---

## Updated Folder Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, lifespan (scheduler start)
│   ├── routers/
│   │   ├── conversation.py        # Main conversation endpoint
│   │   ├── briefing.py            # Briefing endpoint (hot stories)
│   │   ├── health.py              # Health check + pipeline status
│   │   └── debug.py               # (dev only) inspect vector DB / KG state
│   ├── services/
│   │   ├── news_ingestion.py      # RSS fetch + parse + full-text extract
│   │   ├── embedding.py           # Text → vector via Mistral Embed
│   │   ├── vector_store.py        # ChromaDB CRUD + search operations
│   │   ├── hotness.py             # Hotness scoring engine
│   │   ├── entity_extractor.py    # LLM-based NER + relationship extraction
│   │   ├── knowledge_graph.py     # Neo4j client: upsert nodes/edges, query paths
│   │   ├── entity_resolver.py     # Disambiguation + merging ("ECB" = "European Central Bank")
│   │   ├── rag_pipeline.py        # Hybrid retrieval: vector search + KG traversal
│   │   ├── llm.py                 # Mistral via Bedrock client
│   │   └── conversation.py        # Session manager + intent routing
│   ├── pipelines/
│   │   ├── ingest_pipeline.py     # Orchestrator: fetch → embed → store → extract → KG update
│   │   └── scheduler.py           # APScheduler config: 30-min news refresh
│   ├── prompts/
│   │   ├── system.py              # System prompt templates
│   │   ├── intent.py              # Intent classification prompt
│   │   ├── entity_extraction.py   # NER + relationship extraction prompts
│   │   └── hotness.py             # LLM-assisted hotness classification prompt
│   ├── models/
│   │   ├── schemas.py             # Pydantic models for API
│   │   ├── article.py             # Article dataclass with metadata
│   │   ├── entity.py              # Entity + Relationship models
│   │   └── enums.py               # EntityType, RelationType, IntentType enums
│   └── core/
│       ├── config.py              # Settings via pydantic-settings
│       └── logging.py             # Structured logging
├── data/
│   └── chroma_db/                 # Persistent ChromaDB storage
├── requirements.txt
├── .env
└── tests/
    ├── test_ingestion.py
    ├── test_hotness.py
    ├── test_knowledge_graph.py
    └── test_rag_pipeline.py
```

---

## The 10 Steps

---

### Step 1 — Project Scaffold, Infra & Environment (2 hrs)
**Goal**: Both repos running locally. ChromaDB, Neo4j Aura, and all API keys configured and verified.

**1.1 — Repository & Backend Scaffold**
- [ ] Create GitHub repo (monorepo recommended for hackathon speed)
- [ ] Set up FastAPI project with the folder structure above
- [ ] Install core dependencies:
  ```
  fastapi uvicorn[standard] httpx feedparser
  chromadb sentence-transformers
  neo4j apscheduler
  boto3 mistralai
  beautifulsoup4 lxml newspaper3k
  pydantic-settings python-dotenv
  ```
- [ ] Configure `pydantic-settings` based `.env` loader:
  ```env
  AWS_ACCESS_KEY_ID=
  AWS_SECRET_ACCESS_KEY=
  AWS_REGION=us-east-1
  MISTRAL_API_KEY=
  ELEVENLABS_API_KEY=
  NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=
  CHROMA_PERSIST_DIR=./data/chroma_db
  NEWS_REFRESH_INTERVAL_MINUTES=30
  ```

**1.2 — ChromaDB Setup**
- [ ] Initialize persistent ChromaDB client:
  ```python
  import chromadb
  client = chromadb.PersistentClient(path="./data/chroma_db")
  ```
- [ ] Create two collections:
  - `news_articles` — stores article chunks with metadata
  - `entity_contexts` — stores entity explanation chunks from Wikipedia/Wikidata
- [ ] Verify: insert a test document, query it, delete it

**1.3 — Neo4j Aura Setup**
- [ ] Create free Neo4j Aura instance (https://neo4j.com/cloud/aura-free/)
  - Free tier: 200k nodes, 400k rels — more than enough for hackathon
- [ ] Connect via `neo4j` Python driver, verify with a test node
- [ ] Create constraints and indexes:
  ```cypher
  CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;
  CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name);
  CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type);
  CREATE INDEX article_id IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE;
  ```
- [ ] **Fallback plan**: If Neo4j Aura is slow or flaky, switch to NetworkX in-memory graph (implement both behind an interface)

**1.4 — Frontend Scaffold**
- [ ] `npx create-next-app@14` with TypeScript, Tailwind, shadcn/ui
- [ ] Component structure: MicButton, Transcript, Waveform, EntityChips, StatusBar
- [ ] Verify dev server runs

**1.5 — API Key Verification Script**
- [ ] Write `scripts/verify_setup.py` that tests:
  - AWS Bedrock → Mistral Large 3 (simple completion)
  - Mistral Embed → returns a 1024-dim vector
  - Neo4j → CREATE and DELETE a test node
  - ChromaDB → add and query a test document
  - RSS → fetch BBC feed, parse first article
- [ ] Run it. All green before proceeding.

**Done when**: All infra responds to test calls. Backend serves health endpoint. Frontend renders.

---

### Step 2 — News Ingestion Pipeline with Full-Text Extraction (2.5 hrs)
**Goal**: Automated pipeline that fetches RSS feeds, extracts full article text, chunks it, embeds it, and stores in ChromaDB. Runs every 30 minutes.

**2.1 — RSS Fetcher (`news_ingestion.py`)**
- [ ] Fetch from all 10 feeds (with timeout + error handling per feed):
  ```python
  FEEDS = {
      "bbc_world": "http://feeds.bbci.co.uk/news/rss.xml",
      "bbc_europe": "http://feeds.bbci.co.uk/news/world/europe/rss.xml",
      "reuters": "http://feeds.reuters.com/reuters/worldNews",
      "guardian": "https://www.theguardian.com/world/rss",
      "dw": "https://rss.dw.com/rdf/rss-en-all",
      "france24": "https://www.france24.com/en/rss",
      "techcrunch": "https://techcrunch.com/feed/",
      "ars": "http://feeds.arstechnica.com/arstechnica/index",
      "verge": "https://www.theverge.com/rss/index.xml",
      "nature": "http://www.nature.com/nature.rss",
  }
  ```
- [ ] Parse each entry: title, summary, link, published_date, source_name
- [ ] **Full-text extraction**: For each article link, use `newspaper3k`:
  ```python
  from newspaper import Article
  art = Article(url)
  art.download()
  art.parse()
  full_text = art.text
  ```
- [ ] Handle failures gracefully: if full-text fails, fall back to RSS summary
- [ ] Rate limit: max 2 concurrent requests per domain, 1s delay between
- [ ] Timeout: 10s per article fetch, skip on timeout

**2.2 — Article Model (`models/article.py`)**
- [ ] Define the core article dataclass:
  ```python
  @dataclass
  class Article:
      id: str                   # SHA256(url)[:16] — stable, dedup-friendly
      url: str
      title: str
      source: str               # "bbc", "reuters", etc.
      summary: str              # RSS summary
      full_text: str            # Extracted article body
      published_at: datetime
      fetched_at: datetime
      entities: list[str]       # Extracted later in Step 4
      category: str             # "politics", "tech", "science", "economy", etc.
      hotness_score: float      # Calculated in Step 3
      chunk_ids: list[str]      # ChromaDB chunk IDs
  ```

**2.3 — Text Chunking Strategy**
- [ ] Chunk articles for embedding (ChromaDB sweet spot ~512 tokens):
  - Split by paragraph. If paragraph > 400 words, split at sentence boundary
  - Each chunk gets metadata: `article_id`, `source`, `published_at`, `chunk_index`, `hotness_score`
  - First chunk always includes title + first paragraph (highest info density)
- [ ] Implement `chunk_article(article: Article) -> list[Chunk]`

**2.4 — Embedding & ChromaDB Storage**
- [ ] Embed chunks using Mistral Embed via Bedrock:
  ```python
  response = bedrock.invoke_model(
      modelId="mistral.mistral-embed",
      body=json.dumps({"inputs": [chunk.text for chunk in chunks]})
  )
  ```
  - Batch embed: up to 16 chunks per call
  - **Fallback**: `sentence-transformers/all-MiniLM-L6-v2` locally (384-dim, fast)
- [ ] Store in ChromaDB `news_articles` collection:
  ```python
  collection.upsert(
      ids=[chunk.id for chunk in chunks],
      embeddings=[chunk.embedding for chunk in chunks],
      documents=[chunk.text for chunk in chunks],
      metadatas=[{
          "article_id": chunk.article_id,
          "source": chunk.source,
          "published_at": chunk.published_at.isoformat(),
          "hotness_score": chunk.hotness_score,
          "category": chunk.category,
          "title": chunk.title,
          "chunk_index": chunk.chunk_index,
      } for chunk in chunks]
  )
  ```
- [ ] **Deduplication**: Before inserting, check if `article_id` already exists. Skip if yes (or update if `published_at` is newer — handles article edits)

**2.5 — Scheduler (`pipelines/scheduler.py`)**
- [ ] Use APScheduler `AsyncIOScheduler`:
  ```python
  scheduler = AsyncIOScheduler()
  scheduler.add_job(run_ingestion_pipeline, "interval", minutes=30, id="news_ingest")
  ```
- [ ] Start in FastAPI `lifespan`:
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      scheduler.start()
      await run_ingestion_pipeline()  # Run once on startup
      yield
      scheduler.shutdown()
  ```
- [ ] Track pipeline state: `last_run_at`, `articles_fetched`, `articles_new`, `errors`
- [ ] Expose via `GET /api/pipeline/status`

**Scenarios to handle:**
- [ ] Feed is down → log warning, skip that feed, continue with others
- [ ] Article URL returns 403/404 → use RSS summary as fallback text
- [ ] Duplicate article across feeds (same event from Reuters + BBC) → deduplicate by title embedding similarity (cosine > 0.92 = same story)
- [ ] Article updated after initial fetch → upsert with new content, keep same `article_id`
- [ ] Rate limiting from news sites → exponential backoff, respect `Retry-After`
- [ ] ChromaDB disk full → oldest articles auto-expire (see Step 3)

**Done when**: Scheduler runs, fetches 30-60 articles, chunks and embeds into ChromaDB. `/api/pipeline/status` shows success.

---

### Step 3 — Hotness Scoring Engine (2 hrs)
**Goal**: Every article gets a hotness score (0.0–1.0) reflecting how important/trending it is right now. Briefings use this to rank stories.

**3.1 — Hotness Score Formula**

Weighted combination of 5 signals, each outputting 0.0–1.0:

```python
hotness = (
    0.30 * recency_score +        # How recent
    0.25 * cross_source_score +    # Same story in multiple sources
    0.20 * entity_velocity_score + # Entities suddenly spiking across articles
    0.15 * source_authority_score + # BBC > random blog
    0.10 * breaking_keyword_score  # Contains "breaking", "urgent", "just in"
)
```

**3.2 — Implement Each Signal**

- [ ] **Recency Score** — exponential decay:
  ```python
  def recency_score(published_at: datetime) -> float:
      hours_old = (datetime.utcnow() - published_at).total_seconds() / 3600
      return math.exp(-0.1 * hours_old)  # 1.0 at 0h, 0.37 at 10h, 0.05 at 30h
  ```

- [ ] **Cross-Source Score** — same story in multiple feeds:
  ```python
  def cross_source_score(article: Article, all_articles: list[Article]) -> float:
      # Compare article embedding against all from DIFFERENT sources
      # Count sources with a similar article (cosine > 0.85)
      similar_sources = set()
      for other in all_articles:
          if other.source != article.source and cosine_sim(article.emb, other.emb) > 0.85:
              similar_sources.add(other.source)
      return min(len(similar_sources) / 4.0, 1.0)  # 4+ sources = max
  ```

- [ ] **Entity Velocity Score** — entities that suddenly spike:
  ```python
  def entity_velocity_score(article: Article, freq_24h: dict, freq_prev_24h: dict) -> float:
      velocities = []
      for entity in article.entities:
          prev = freq_prev_24h.get(entity, 1)
          curr = freq_24h.get(entity, 0)
          velocities.append(curr / prev)
      if not velocities: return 0.0
      return min((sum(velocities) / len(velocities)) / 5.0, 1.0)  # 5x spike = max
  ```

- [ ] **Source Authority Score** — static weights:
  ```python
  SOURCE_AUTHORITY = {
      "reuters": 1.0, "bbc": 0.95, "guardian": 0.9,
      "france24": 0.85, "dw": 0.85, "nature": 0.95,
      "techcrunch": 0.8, "ars": 0.8, "verge": 0.75,
  }
  ```

- [ ] **Breaking Keyword Score** — pattern match for urgency:
  ```python
  BREAKING_PATTERNS = ["breaking", "just in", "urgent", "developing", "live updates", "exclusive"]
  def breaking_keyword_score(text: str) -> float:
      matches = sum(1 for p in BREAKING_PATTERNS if p in text.lower())
      return min(matches / 2.0, 1.0)
  ```

**3.3 — LLM-Assisted Category Classification**
- [ ] Mistral classifies each article:
  ```
  Classify into one: POLITICS | ECONOMY | TECH | SCIENCE | CONFLICT | CLIMATE | HEALTH | SPORTS | CULTURE
  Article: {title} — {first_200_words}
  Return JSON: {"category": "..."}
  ```
- [ ] Cache category with the article — don't re-classify on re-fetch

**3.4 — Hotness Decay & Article Expiry**
- [ ] Every 30 min (on ingestion run), recalculate hotness for all articles from last 48 hours
- [ ] Articles older than 48h: set hotness to 0, mark `expired`
- [ ] Articles older than 7 days: delete from ChromaDB
- [ ] Maintain `hot_articles` ranked list in memory for instant briefing access

**3.5 — Briefing Generator**
- [ ] `GET /api/briefing?category=all&count=5` → top N articles by hotness
- [ ] Optional category filter: `?category=tech&count=3`
- [ ] For each article, generate spoken summary via Mistral (cached):
  ```
  Summarize in 3-4 short sentences for spoken delivery. Max 20 words/sentence.
  ```
- [ ] Deduplicate: if top 5 has two articles about same event (cosine > 0.88), keep higher-hotness one

**Scenarios to handle:**
- [ ] Cold start (no historical data) → entity velocity defaults to 0, cross-source still works
- [ ] All feeds report same breaking story → cross-source maxes, it dominates briefing
- [ ] Slow news day → scores are all low, still pick top 5
- [ ] Category classification wrong → only for optional filtering, not critical path

**Done when**: Each article has a `hotness_score`. `/api/briefing` returns articles sorted by hotness with spoken summaries.

---

### Step 4 — Entity Extraction & Knowledge Graph Construction (3 hrs)
**Goal**: Every article gets its entities and relationships extracted and stored in Neo4j. Users can query any entity and get accurate, connected information.

**4.1 — Entity & Relationship Models (`models/entity.py`)**
```python
class EntityType(str, Enum):
    PERSON = "person"
    ORGANIZATION = "organization"
    COUNTRY = "country"
    CITY = "city"
    EVENT = "event"
    CONCEPT = "concept"           # "inflation", "AI safety"
    POLICY = "policy"             # "EU AI Act", "rate pause"
    FINANCIAL_INSTRUMENT = "financial"  # "S&P 500", "euro"

class RelationType(str, Enum):
    LEADS = "leads"               # Person → Organization
    MEMBER_OF = "member_of"       # Country → Organization (EU, NATO)
    LOCATED_IN = "located_in"     # City → Country
    CAUSED_BY = "caused_by"       # Event → Event/Policy
    RELATED_TO = "related_to"     # Generic
    PRECEDED_BY = "preceded_by"   # Event → Event (temporal)
    AFFECTS = "affects"           # Policy → Country/Org
    ANNOUNCED_BY = "announced_by" # Policy/Event → Person/Org
    COMPETES_WITH = "competes_with"
    PART_OF = "part_of"           # Concept → broader Concept

@dataclass
class Entity:
    id: str                       # Slugified: "christine-lagarde"
    name: str                     # "Christine Lagarde"
    aliases: list[str]            # ["Lagarde", "ECB President"]
    type: EntityType
    description: str              # 1-line summary
    wikidata_id: str | None
    wikipedia_url: str | None
    first_seen_at: datetime
    article_count: int
    last_mentioned_at: datetime

@dataclass
class Relationship:
    source_id: str
    target_id: str
    type: RelationType
    context: str                  # "Lagarde leads the ECB since 2019"
    article_id: str
    confidence: float             # 0.0–1.0
```

**4.2 — LLM-Based Entity + Relationship Extraction (`entity_extractor.py`)**
- [ ] For each new article, call Mistral with structured extraction:
  ```
  Extract all named entities and relationships from this news article.

  ENTITY TYPES: person, organization, country, city, event, concept, policy, financial
  RELATIONSHIP TYPES: leads, member_of, located_in, caused_by, related_to, preceded_by, affects, announced_by, competes_with, part_of

  Article: {title}
  {full_text}

  Return JSON:
  {
    "entities": [
      {"name": "Christine Lagarde", "type": "person", "description": "President of the ECB", "aliases": ["Lagarde"]},
      {"name": "European Central Bank", "type": "organization", "description": "Central bank for the eurozone", "aliases": ["ECB"]}
    ],
    "relationships": [
      {"source": "Christine Lagarde", "target": "European Central Bank", "type": "leads", "context": "Lagarde has been ECB president since 2019", "confidence": 0.95}
    ]
  }
  ```
- [ ] Parse response, validate against enums, filter low-confidence relationships (< 0.6)
- [ ] Batch: extract from up to 3 short articles per LLM call

**4.3 — Entity Resolution & Deduplication (`entity_resolver.py`)**

Critical — without this, the KG fills with duplicate nodes.

- [ ] **Alias matching**: Before creating a new entity, check existing:
  ```python
  def resolve_entity(name: str, aliases: list[str], existing_entities: dict) -> str | None:
      # 1. Exact match on name or any alias (case-insensitive)
      for existing in existing_entities.values():
          if name.lower() in [a.lower() for a in existing.aliases + [existing.name]]:
              return existing.id
      # 2. Fuzzy match (Levenshtein > 90%)
      for existing in existing_entities.values():
          if fuzz.ratio(name.lower(), existing.name.lower()) > 90:
              return existing.id
      return None
  ```

- [ ] **Disambiguation scenarios to handle**:
  - "Apple" in tech article → Apple Inc. (use article category as signal)
  - "Paris" with no context → default to city (check co-occurring entities)
  - "Bank of England" vs "BoE" → same entity (alias match)
  - "The president" → resolve via article context using co-occurring entities
  - "EU" vs "European Union" → alias match
  - Brand new entity not seen before → create fresh, enrich with Wikipedia

- [ ] **Entity merging**: When two nodes are discovered to be same:
  ```python
  def merge_entities(keep_id: str, remove_id: str):
      # Move all relationships from remove_id → keep_id
      # Merge alias lists
      # Sum article_counts
      # Delete remove_id node
  ```

**4.4 — Knowledge Graph Operations (`knowledge_graph.py`)**

- [ ] **Upsert entity**:
  ```cypher
  MERGE (e:Entity {id: $id})
  SET e.name = $name, e.type = $type, e.description = $description,
      e.aliases = $aliases, e.wikidata_id = $wikidata_id,
      e.article_count = e.article_count + 1,
      e.last_mentioned_at = $now
  ```

- [ ] **Upsert relationship**:
  ```cypher
  MATCH (a:Entity {id: $source_id}), (b:Entity {id: $target_id})
  MERGE (a)-[r:RELATES_TO {type: $rel_type}]->(b)
  SET r.context = $context, r.article_id = $article_id, r.confidence = $confidence
  ```

- [ ] **Link article to entities**:
  ```cypher
  MATCH (a:Article {id: $article_id}), (e:Entity {id: $entity_id})
  MERGE (a)-[:MENTIONS]->(e)
  ```

- [ ] **Query: Get entity with all connections**:
  ```cypher
  MATCH (e:Entity {id: $entity_id})
  OPTIONAL MATCH (e)-[r]-(related:Entity)
  RETURN e, collect({entity: related, relationship: r}) as connections
  ```

- [ ] **Query: Find path between two entities**:
  ```cypher
  MATCH path = shortestPath((a:Entity {id: $id1})-[*..4]-(b:Entity {id: $id2}))
  RETURN path
  ```

- [ ] **Query: Entity neighborhood** (for "tell me more"):
  ```cypher
  MATCH (e:Entity {id: $entity_id})-[r]-(related:Entity)
  RETURN related, r ORDER BY related.article_count DESC LIMIT 10
  ```

**4.5 — Wikipedia/Wikidata Enrichment**
- [ ] For each new entity, fetch background:
  - Wikidata: QID, description, key facts, relationships
  - Wikipedia: 2-paragraph extract
- [ ] Store enrichment on entity node in Neo4j:
  ```cypher
  SET e.wikipedia_extract = $extract, e.wikidata_facts = $facts
  ```
- [ ] Also embed Wikipedia extract → store in ChromaDB `entity_contexts` collection
- [ ] Rate limit: max 5 Wikipedia calls per ingestion run (prioritize by article_count)
- [ ] Cache: don't re-fetch if already enriched (unless > 7 days stale)

**4.6 — Full Ingestion Pipeline Order**
```
1. Fetch RSS feeds → parse articles
2. Deduplicate against existing articles in ChromaDB
3. Extract full text (newspaper3k)
4. Chunk articles → embed → store in ChromaDB
5. Calculate hotness scores (Step 3)
6. Extract entities + relationships via LLM (this step)
7. Resolve entities against existing KG (deduplicate)
8. Upsert entities + relationships into Neo4j
9. Enrich new entities with Wikipedia/Wikidata (async, low priority)
10. Update hot_articles ranking
```

**Scenarios to handle:**
- [ ] Entity not in Wikipedia → store with `wikidata_id=None`, LLM description only
- [ ] LLM extracts garbage entity ("The", "However") → filter: min name length >2 chars, validate type
- [ ] Relationship contradicts existing (new article says "X leads Y" but KG has "Z leads Y") → keep both with timestamps, let LLM resolve when queried
- [ ] Entity in 50+ articles → cap relationship queries, paginate
- [ ] Neo4j rate limits → batch writes, max 50 operations per transaction
- [ ] Neo4j down → fall back to NetworkX (implement `KnowledgeGraphInterface` ABC)
- [ ] Circular relationships (A affects B affects A) → fine in graph, shortestPath handles cycles
- [ ] Same entity, different descriptions across articles → keep most recent, accumulate aliases

**Done when**: After ingestion, Neo4j has entity nodes with relationships. Querying "Who is connected to ECB?" returns Lagarde, eurozone countries, related policies.

---

### Step 5 — Hybrid RAG Retrieval Pipeline (2.5 hrs)
**Goal**: When a user asks anything, the system combines vector semantic search + knowledge graph traversal to assemble the most accurate context for the LLM.

**5.1 — Query Analysis**

Before retrieval, classify what strategy to use:

```python
class RetrievalStrategy(str, Enum):
    VECTOR_ONLY = "vector_only"           # "What's happening in tech?"
    KG_ONLY = "kg_only"                   # "Who leads the ECB?"
    KG_PLUS_VECTOR = "kg_plus_vector"     # "How does ECB affect UK?"
    TEMPORAL = "temporal"                  # "What happened before this?"
    MULTI_HOP = "multi_hop"               # "How are AI regulation and ECB connected?"
```

- [ ] Use Mistral function calling to determine strategy:
  ```
  Given this query and conversation history, determine retrieval strategy.
  Query: {query}
  History: {last_3_turns}

  Return JSON:
  {
    "strategy": "kg_plus_vector",
    "search_queries": ["ECB rate decision UK impact"],
    "graph_queries": {
      "entities": ["european-central-bank", "united-kingdom"],
      "find_path": true,
      "depth": 2
    },
    "time_filter": "last_24h" | "last_week" | null,
    "category_filter": "economy" | null
  }
  ```

**5.2 — Vector Retrieval**
- [ ] Embed user query with same model used for articles
- [ ] Search ChromaDB with metadata filters:
  ```python
  results = collection.query(
      query_embeddings=[query_embedding],
      n_results=8,
      where={
          "$and": [
              {"hotness_score": {"$gte": 0.2}},
              {"published_at": {"$gte": time_filter}},
          ]
      }
  )
  ```
- [ ] Re-rank: `0.6 * semantic_similarity + 0.4 * hotness_score`
- [ ] Deduplicate: if multiple chunks from same article, keep best chunk + merge

**5.3 — Knowledge Graph Retrieval**

- [ ] **Entity lookup**: Fetch entity + all direct relationships + neighbor summaries
- [ ] **Path finding**: For "how does X relate to Y":
  ```python
  async def find_entity_path(entity_a: str, entity_b: str, max_depth=4) -> list:
      # Returns ordered list: ECB → [sets rates for] → eurozone → [trades with] → UK
  ```
- [ ] **Neighborhood expansion**: For "tell me more about X":
  ```python
  async def get_entity_neighborhood(entity_id: str, depth=2) -> dict:
      # All entities within N hops, sorted by article_count
  ```
- [ ] **Temporal chain**: For "what happened before this?":
  ```python
  async def get_temporal_chain(entity_id: str, direction="before") -> list:
      # Follow PRECEDED_BY / CAUSED_BY edges
  ```

**5.4 — Context Assembly**

Combine all results into structured context for the LLM:

```python
def assemble_context(vector_results, kg_entities, kg_paths, session_history, session_entities) -> str:
    context = ""

    # 1. Relevant article chunks (vector search)
    context += "## Relevant News Articles\n"
    for chunk in vector_results[:5]:
        context += f"[{chunk.source} | Hotness: {chunk.hotness:.2f} | {chunk.published_at}]\n"
        context += f"{chunk.text}\n\n"

    # 2. Entity knowledge (KG)
    context += "## Entity Knowledge\n"
    for entity in kg_entities:
        context += f"**{entity.name}** ({entity.type}): {entity.description}\n"
        context += f"Relationships: {entity.relationships_summary}\n"
        if entity.wikipedia_extract:
            context += f"Background: {entity.wikipedia_extract[:300]}\n\n"

    # 3. Entity connections (path finding)
    if kg_paths:
        context += "## How These Are Connected\n"
        for path in kg_paths:
            context += f"{path.readable_summary}\n"

    # 4. Previously discussed (session memory)
    if session_entities:
        context += "## Previously Discussed\n"
        for eid, explanation in session_entities.items():
            context += f"- {eid}: {explanation}\n"

    return context
```

**5.5 — Full Query Pipeline**

```
User query
    ↓
Intent Classification (BRIEFING / ENTITY_QUERY / FOLLOW_UP / etc.)
    ↓
Query Analysis → determine RetrievalStrategy
    ↓
┌──────────────┬───────────────┬─────────────────┐
│ Vector Search │ KG Query      │ Session Context  │  ← asyncio.gather()
└──────────────┴───────────────┴─────────────────┘
    ↓
Context Assembly
    ↓
Mistral Large 3 (streaming generation with assembled context)
    ↓
TTS → Speaker
```

- [ ] Implement `async def query(user_input: str, session_id: str) -> AsyncGenerator[str, None]`
- [ ] Parallelise vector search + KG query with `asyncio.gather()`
- [ ] Stream LLM response tokens

**Scenarios to handle:**
- [ ] Vector search returns nothing (new topic, no articles) → use LLM general knowledge + say "I don't have specific recent articles on that"
- [ ] KG entity not found → fall back to Wikipedia API directly, then add to KG for future queries
- [ ] Path between entities doesn't exist in KG → "I don't see a direct connection" + vector search for articles mentioning both
- [ ] Very recent event (< 30 min, not ingested) → "I'll have updated info soon, here's what I know..."
- [ ] Conflicting info across sources → present both: "BBC reports X, while Reuters says Y"
- [ ] Ambiguous query ("Tell me about Apple") → use session context + category, ask clarification only if truly stuck
- [ ] Entity has 500+ edges (e.g., "United States") → filter by article_count + recency, limit to top 10
- [ ] Compound question ("How does ECB and US Fed relate, and what about euro investments?") → decompose into sub-queries, parallel retrieval

**Done when**: "How does the ECB rate decision affect the UK?" returns KG path (ECB → eurozone → trade → UK) + relevant article chunks, and the LLM gives an accurate answer.

---

### Step 6 — Conversation Manager & Session Memory (1.5 hrs)
**Goal**: Multi-turn conversations that reference prior context, track entities, and maintain coherent state.

- [ ] **Session store**: In-memory dict:
  ```python
  sessions = {
      "session_123": {
          "history": [],                 # (role, content, timestamp) tuples
          "entities_explained": {},      # entity_id → explanation summary
          "entities_mentioned": [],      # Ordered list of entity_ids
          "current_story_index": 0,
          "briefing_stories": [],
          "active_topic": None,          # Current article/topic
          "retrieval_cache": {},         # Cache recent retrieval results
      }
  }
  ```
- [ ] **History management**: Cap at ~20 turns, summarise oldest via LLM when truncating
- [ ] **Entity tracking**: Store explained entities. On re-mention, inject prior explanation into context
- [ ] **Topic tracking**: Track active article — follow-ups use it as primary context
- [ ] **Story navigation**: "Next story" / "Go back" / "Tell me about story 3"
- [ ] **Cross-story connections**: Prompt LLM to reference related stories when KG relationships exist
- [ ] Generate session IDs on frontend, pass with every request

**Done when**: 5+ turn conversation with AI referencing earlier explanations and connecting stories via KG.

---

### Step 7 — Speech-to-Text: Pixtral STT (2 hrs)
**Goal**: User speaks → real-time transcription → text sent to backend.

- [ ] Browser audio capture via `MediaRecorder` / `AudioContext`
- [ ] Pixtral STT WebSocket client: stream audio, receive partial + final transcriptions
- [ ] Push-to-talk mode (primary) + voice-activated mode (stretch)
- [ ] **Fallback**: Browser `SpeechRecognition` API if Pixtral fails
- [ ] Wire transcription → POST to backend

**Done when**: Mic produces accurate text routed to the backend.

---

### Step 8 — Text-to-Speech + Frontend UI (3 hrs)
**Goal**: Natural voice output via ElevenLabs. Mobile-friendly UI with entity chips reflecting KG data.

**8.1 — ElevenLabs TTS (1.5 hrs)**
- [ ] WebSocket client: send text chunks sentence-by-sentence as Mistral streams
- [ ] Audio playback via `AudioContext`, start on first sentence
- [ ] Warm conversational voice selection
- [ ] Filler phrases during RAG: "Let me think about that..." (pre-generated audio)
- [ ] Handle interruptions: stop TTS when user starts speaking
- [ ] Fallback: browser `speechSynthesis`

**8.2 — Frontend Voice UI (1.5 hrs)**
- [ ] Mobile-first layout: top bar, waveform + transcript, entity chips, mic button, status bar
- [ ] Visual states: idle → listening (blue) → thinking → speaking (green) → error (red)
- [ ] **Entity chips**: Tappable pills populated from session's `entities_mentioned`
- [ ] **Entity relationship mini-card** (NEW): On chip tap, show:
  - Entity name + type + 1-line description (from KG)
  - Connected entities as smaller sub-chips (from KG neighborhood)
  - "Ask about this" button
- [ ] Text input fallback
- [ ] Test on real phone browser

**Done when**: Full voice loop working. Entity chips show KG connections.

---

### Step 9 — End-to-End Integration, Testing & Deployment (3 hrs)
**Goal**: Full pipeline on production. Scheduler ingests. KG populates. Voice loop works.

**9.1 — Full Pipeline Integration**
- [ ] Start backend → scheduler triggers first ingestion → ChromaDB + KG populated
- [ ] Verify `/api/pipeline/status` shows success
- [ ] Run demo script (3+ times):
  1. "What's happening in Europe today?" → Briefing from hot articles
  2. "What's the ECB?" → KG entity lookup + Wikipedia
  3. "How does that affect the UK?" → KG path finding + vector search
  4. "Next story" → Navigation
  5. "How are these stories connected?" → Multi-hop KG traversal
  6. (Paste URL) → Article mode (if implemented)

**9.2 — Performance Targets**
- [ ] Ingestion pipeline: < 3 min for full run
- [ ] Vector search: < 200ms
- [ ] KG query: < 300ms
- [ ] Full query → TTS start: < 3s

**9.3 — Edge Cases**
- [ ] Empty ChromaDB (first boot) → "I'm still loading today's news, give me a moment"
- [ ] Neo4j unreachable → fallback to vector-only retrieval
- [ ] All RSS feeds down → serve cached articles from last run
- [ ] Entity not in KG or Wikipedia → LLM general knowledge + "I don't have detailed info yet"
- [ ] Rapid follow-up questions → debounce, queue

**9.4 — Deployment**
- [ ] Backend → Railway: set all env vars including Neo4j Aura URI
- [ ] Verify scheduler runs on Railway (check logs)
- [ ] **ChromaDB persistence on Railway**: Mount a volume (Railway ephemeral FS resets!)
- [ ] Frontend → Vercel: set `NEXT_PUBLIC_API_URL`
- [ ] Test CORS + WebSocket through production

**Done when**: Production deployed. Scheduler runs every 30 min. KG grows. Voice loop works E2E.

---

### Step 10 — Demo Recording, README & Submission (2 hrs)
**Goal**: Ship it.

- [ ] **Demo video** (2-3 min):
  - Full voice conversation flow
  - Highlight: "This answer came from our knowledge graph connecting ECB → eurozone → UK"
  - Show entity chips with graph connections
  - Show briefing powered by hotness scoring
- [ ] **README.md**:
  - Architecture diagram: RSS → ChromaDB → KG → Hybrid RAG → LLM → Voice
  - Tech stack (ChromaDB, Neo4j, APScheduler additions)
  - "How it works": hotness scoring + KG explanation
  - Setup instructions, live demo link
- [ ] **GitHub cleanup**: remove debug code, `.env` in `.gitignore`, add LICENSE
- [ ] **Submission**:
  - Emphasize: "production-grade RAG with knowledge graph" — differentiator
  - Target: ElevenLabs prize (voice-first) + Mistral prize (Large 3 + Embed + Pixtral) + Startup prize
- [ ] Final production test

**Done when**: Submitted with working demo URL, backup video, clean repo.

---

## Updated Timeline (28 hrs across 48 hrs)

| Block | Steps | Hours | When |
|-------|-------|-------|------|
| **Sat Morning** | Step 1 (Scaffold + Infra) | 2h | 10 AM – 12 PM |
| **Sat Early Afternoon** | Step 2 (Ingestion + ChromaDB) | 2.5h | 12 PM – 2:30 PM |
| **Sat Late Afternoon** | Step 3 (Hotness Engine) | 2h | 3 PM – 5 PM |
| **Sat Evening** | Step 4 (Entity Extraction + KG) | 3h | 5:30 PM – 8:30 PM |
| **Sat Night** | Step 5 (Hybrid RAG Pipeline) | 2.5h | 9 PM – 11:30 PM |
| **Sleep** | — | — | 12 AM – 8 AM |
| **Sun Morning** | Step 6 (Session) + Step 7 (STT) | 3.5h | 8 AM – 11:30 AM |
| **Sun Midday** | Step 8 (TTS + Frontend) | 3h | 11:30 AM – 2:30 PM |
| **Sun Afternoon** | Step 9 (Integration + Deploy) | 3h | 2:30 PM – 5:30 PM |
| **Sun Evening** | Step 10 (Demo + Submit) | 2h | 5:30 PM – 7:30 PM |

## Dependency Graph
```
Step 1 (Scaffold + Infra)
  │
  ├── Step 2 (News Ingestion + ChromaDB)
  │     ├── Step 3 (Hotness Scoring)
  │     └── Step 4 (Entity Extraction + KG)  ← depends on articles existing
  │           └── Step 5 (Hybrid RAG)  ← needs both ChromaDB + KG
  │                 └── Step 6 (Session Manager)
  │
  ├── Step 7 (STT) ← can start in parallel after Step 1
  └── Step 8 (TTS + Frontend) ← can start in parallel after Step 1
        │
        └── Step 9 (Integration) ← needs Steps 5, 6, 7, 8 all done
              └── Step 10 (Demo + Submit)
```

**Parallel work split:**
- **Devashish**: Steps 2 → 3 → 4 → 5 (intelligence pipeline)
- **Shreyash**: Steps 1 (shared) → 7 → 8 → then join for 6 + 9

## Critical Rules
1. **Feature freeze at 2 PM Sunday** — only bug fixes after
2. **Always have a working demo** — deploy after each step
3. **Pre-record demo video by 5 PM Sunday**
4. **Sleep Saturday night**
5. **If Neo4j Aura flakes, switch to NetworkX immediately** — max 30 min debugging infra
6. **If embedding is slow, use local sentence-transformers** — don't block on API latency
7. **The ingestion pipeline is the backbone** — Steps 2-4 working = everything else is UI
8. **Hotness scoring can be simplified** — if time is tight, just use `recency * cross_source`
9. **KG path finding is the demo wow-factor** — "How does X relate to Y?" must work beautifully
10. **Implement `KnowledgeGraphInterface` ABC early** — so Neo4j ↔ NetworkX swap is painless