import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import health, conversation

load_dotenv()

app = FastAPI(
    title="Samvād API",
    description="Voice-first AI news companion backend",
    version="1.0.0",
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
