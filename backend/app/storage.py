"""Cloud storage abstraction.

Cloudinary is used when all three env vars are set:
  CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

If they are not set the service silently skips cloud upload and returns None,
which keeps the recording metadata-only flow intact.
"""
import logging
from pathlib import Path
from typing import IO

logger = logging.getLogger(__name__)

try:
    import cloudinary
    import cloudinary.uploader
    _CLOUDINARY_AVAILABLE = True
except ImportError:
    _CLOUDINARY_AVAILABLE = False

from app.config import (
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME,
)

_cloudinary_configured = False


def _ensure_cloudinary() -> bool:
    global _cloudinary_configured
    if not _CLOUDINARY_AVAILABLE:
        return False
    if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
        return False
    if not _cloudinary_configured:
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True,
        )
        _cloudinary_configured = True
    return True


def upload_recording_to_cloud(
    file_data: bytes | IO[bytes],
    public_id: str,
    resource_type: str = "video",
) -> str | None:
    """Upload a recording file to Cloudinary.

    Returns the secure URL on success, or None if Cloudinary is not configured
    or the upload fails (so the caller can fall back to local/metadata-only storage).
    """
    if not _ensure_cloudinary():
        return None

    try:
        folder = "we-are-kids-lms/recordings"
        result = cloudinary.uploader.upload(  # type: ignore[attr-defined]
            file_data,
            public_id=f"{folder}/{public_id}",
            resource_type=resource_type,
            overwrite=True,
            invalidate=True,
        )
        url: str = result.get("secure_url", "")
        if url:
            logger.info("Cloudinary upload succeeded for %s: %s", public_id, url)
        return url or None
    except Exception as exc:
        logger.error("Cloudinary upload failed for %s: %s", public_id, exc)
        return None


def delete_recording_from_cloud(public_id: str, resource_type: str = "video") -> None:
    """Delete a recording from Cloudinary. Failures are logged but not raised."""
    if not _ensure_cloudinary():
        return
    try:
        folder = "we-are-kids-lms/recordings"
        cloudinary.uploader.destroy(  # type: ignore[attr-defined]
            f"{folder}/{public_id}",
            resource_type=resource_type,
            invalidate=True,
        )
    except Exception as exc:
        logger.warning("Cloudinary delete failed for %s: %s", public_id, exc)


def cloud_enabled() -> bool:
    return _ensure_cloudinary()
