import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


def _resolve_upload_dir() -> Path:
    raw_upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    candidate = Path(raw_upload_dir)

    if candidate.is_absolute():
        return candidate

    return BACKEND_ROOT / candidate


def _resolve_database_url() -> str:
    raw_database_url = os.getenv("DATABASE_URL", "").strip()

    if not raw_database_url:
        return f"sqlite:///{BACKEND_ROOT / 'school_lms.db'}"

    if raw_database_url.startswith("postgresql://"):
        return raw_database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return raw_database_url


def _parse_cors_origins() -> list[str]:
    raw_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    ]


ENV = os.getenv("ENV", "development")
PORT = int(os.getenv("PORT", "8000"))
UPLOAD_DIR = _resolve_upload_dir()
DATABASE_URL = _resolve_database_url()
CORS_ORIGINS = _parse_cors_origins()
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "").strip()
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "").strip()
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "").strip()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
STRIPE_PRICE_STARTER = os.getenv("STRIPE_PRICE_STARTER", "").strip()
STRIPE_PRICE_STANDARD = os.getenv("STRIPE_PRICE_STANDARD", "").strip()
STRIPE_PRICE_PREMIUM = os.getenv("STRIPE_PRICE_PREMIUM", "").strip()
