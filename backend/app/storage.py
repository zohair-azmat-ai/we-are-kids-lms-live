"""Cloud storage abstraction.

Cloudinary is used when all three env vars are set:
  CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

If they are not set the service silently skips cloud upload and returns None,
which keeps the recording metadata-only flow intact.
"""
import logging
from pathlib import Path
from typing import IO
from urllib.parse import urlparse

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
        normalized_public_id = (
            public_id
            if public_id.startswith(f"{folder}/")
            else f"{folder}/{public_id}"
        )
        cloudinary.uploader.destroy(  # type: ignore[attr-defined]
            normalized_public_id,
            resource_type=resource_type,
            invalidate=True,
        )
    except Exception as exc:
        logger.warning("Cloudinary delete failed for %s: %s", public_id, exc)


def get_cloud_public_id(cloud_url: str | None, fallback_recording_id: str) -> str:
    """Resolve Cloudinary public_id from stored URL; fallback to recording id."""
    folder = "we-are-kids-lms/recordings"
    if not cloud_url:
        return fallback_recording_id

    try:
        parsed = urlparse(cloud_url)
        path = parsed.path
        if "/upload/" not in path:
            return fallback_recording_id

        post_upload = path.split("/upload/", 1)[1]
        parts = [part for part in post_upload.split("/") if part]

        # Strip transformation/version segments like "c_fill" or "v12345".
        while parts and (parts[0].startswith("v") and parts[0][1:].isdigit()):
            parts = parts[1:]

        if not parts:
            return fallback_recording_id

        # Remove file extension from final segment.
        parts[-1] = Path(parts[-1]).stem
        public_id = "/".join(parts)
        if public_id:
            return public_id if public_id.startswith(f"{folder}/") else public_id
    except Exception:
        logger.warning("Unable to parse Cloudinary URL for public_id: %s", cloud_url)

    return fallback_recording_id


def cloud_enabled() -> bool:
    return _ensure_cloudinary()
