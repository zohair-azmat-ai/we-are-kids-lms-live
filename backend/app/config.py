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


ENV = os.getenv("ENV", "development")
PORT = int(os.getenv("PORT", "8000"))
UPLOAD_DIR = _resolve_upload_dir()


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


CORS_ORIGINS = _parse_cors_origins()
