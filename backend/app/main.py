from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import api_router, get_public_recording_by_id
from app.config import (
    AGORA_APP_ID,
    CORS_ORIGINS,
    ENV,
    OPENAI_API_KEY,
    PORT,
    STRIPE_SECRET_KEY,
    UPLOAD_DIR,
)
from app.db import SessionLocal, engine
from app.models import Base
from app.schemas import RecordingItem
from app.seed import seed_demo_data
from app.services import cleanup_expired_recordings


app = FastAPI(
    title="School LMS Live API",
    version="1.0.0",
    description="Backend service for the School LMS Live MVP.",
)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["root"])
def read_root() -> dict:
    return {
        "name": "School LMS Live API",
        "status": "running",
        "environment": ENV,
        "port": PORT,
        "docs": "/docs",
        "health": "/health",
        "agora_configured": bool(AGORA_APP_ID),
        "billing_configured": bool(STRIPE_SECRET_KEY),
        "ai_configured": bool(OPENAI_API_KEY),
    }


@app.get("/health", tags=["health"])
def read_health() -> dict:
    return {
        "status": "healthy",
        "service": "backend",
        "version": "1.0.0",
        "environment": ENV,
        "port": PORT,
        "agora_configured": bool(AGORA_APP_ID),
        "billing_configured": bool(STRIPE_SECRET_KEY),
        "ai_configured": bool(OPENAI_API_KEY),
    }


@app.get("/public/recordings/{recording_id}", response_model=RecordingItem, tags=["public"])
def get_public_recording_alias(recording_id: str) -> RecordingItem:
    return get_public_recording_by_id(recording_id)


app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def handle_startup() -> None:
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        seed_demo_data(db)

    cleanup_expired_recordings()
