import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import health, conversation

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch news ingestion scheduler
    from app.pipelines.scheduler import start_scheduler
    start_scheduler()
    yield
    # Shutdown
    from app.pipelines.scheduler import stop_scheduler
    stop_scheduler()


app = FastAPI(
    title="Samvād API",
    description="Voice-first AI news companion backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend origins (Vercel + local dev)
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(conversation.router, prefix="/api", tags=["conversation"])


@app.get("/")
async def root():
    return {"message": "Samvād API is running. See /docs for API reference."}


@app.get("/api/pipeline/status")
async def pipeline_status():
    from app.pipelines.scheduler import get_pipeline_status
    status = get_pipeline_status()
    try:
        from app.services.knowledge_graph import get_graph
        status["knowledge_graph"] = get_graph().stats
    except Exception:
        status["knowledge_graph"] = {"nodes": 0, "edges": 0}
    return status
