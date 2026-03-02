"""
scheduler.py — APScheduler-based 30-minute news ingestion pipeline.

Runs on FastAPI startup and every 30 minutes thereafter:
  1. Fetch RSS feeds → parse articles
  2. Score hotness
  3. Store in ChromaDB (vector store)
  4. Extract entities → update knowledge graph

Public API:
    start_scheduler()   # call from FastAPI lifespan
    stop_scheduler()    # call on shutdown
    get_pipeline_status() -> dict
"""

import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler(timezone="UTC")
_status: dict = {
    "last_run_at": None,
    "articles_fetched": 0,
    "articles_new": 0,
    "errors": [],
    "running": False,
}


async def run_ingestion_pipeline() -> None:
    """Full ingestion: fetch → hotness → embed → store → extract entities."""
    if _status["running"]:
        logger.info("Pipeline already running, skipping this cycle")
        return

    _status["running"] = True
    _status["errors"] = []
    logger.info("=== Ingestion pipeline starting ===")

    try:
        # 1. Fetch and score news
        from app.services.news import refresh_news_cache
        stories = await refresh_news_cache()
        _status["articles_fetched"] = len(stories)
        logger.info("Fetched %d stories", len(stories))

        # 2. Store in vector store
        try:
            from app.services.vector_store import upsert_stories
            new_count = await upsert_stories(stories)
            _status["articles_new"] = new_count
            logger.info("Upserted %d new stories into vector store", new_count)
        except Exception as e:
            logger.warning("Vector store upsert failed: %s", e)
            _status["errors"].append(f"vector_store: {e}")

        # 3. Extract entities and update knowledge graph
        try:
            from app.services.entity_extractor import extract_entities_batch
            from app.services.knowledge_graph import get_graph
            kg = get_graph()
            await extract_entities_batch(stories, kg)
            logger.info("Entity extraction complete")
        except Exception as e:
            logger.warning("Entity extraction failed: %s", e)
            _status["errors"].append(f"entity_extraction: {e}")

        _status["last_run_at"] = datetime.now(tz=timezone.utc).isoformat()
        logger.info("=== Ingestion pipeline complete ===")

    except Exception as e:
        logger.error("Ingestion pipeline failed: %s", e)
        _status["errors"].append(f"pipeline: {e}")
    finally:
        _status["running"] = False


def start_scheduler() -> None:
    """Start the APScheduler and run an immediate ingestion cycle."""
    _scheduler.add_job(
        run_ingestion_pipeline,
        "interval",
        minutes=30,
        id="news_ingest",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started — news refresh every 30 minutes")

    # Fire first run immediately (non-blocking)
    asyncio.get_event_loop().create_task(run_ingestion_pipeline())


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_pipeline_status() -> dict:
    return {**_status, "scheduler_running": _scheduler.running}
