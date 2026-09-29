import logging
import mimetypes
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile


STATIC_DIR = os.path.join(os.path.dirname(__file__), "static", "uploads")
DEFAULT_MAX_UPLOAD_SIZE = 5 * 1024 * 1024
IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ATTACHMENT_CONTENT_TYPES = IMAGE_CONTENT_TYPES | {"application/pdf"}
LOCAL_FOLDER_MAP = {
    "campace/profiles": "avatars",
    "campace/ids": "id_cards",
    "campace/chat": "attachments",
}
logger = logging.getLogger("app.storage")


def _cloudinary_configured() -> bool:
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if not all((cloud_name, api_key, api_secret)):
        return False

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )
    return True


def _upload_metadata(file: UploadFile, content_types: set[str]) -> tuple[str, str, str, int]:
    filename = os.path.basename(file.filename or "upload")
    content_type = (file.content_type or mimetypes.guess_type(filename)[0] or "").split(";", 1)[0].strip().lower()
    if content_type not in content_types:
        raise HTTPException(status_code=400, detail="Unsupported upload content type.")

    stem = Path(filename).stem
    safe_stem = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_-_") or "upload"
    extension = Path(filename).suffix.lower() or mimetypes.guess_extension(content_type) or ""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    public_id = f"{timestamp}_{uuid.uuid4().hex[:8]}_{safe_stem[:48]}"

    try:
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)
    except (OSError, AttributeError) as error:
        raise HTTPException(status_code=400, detail="Unable to read uploaded file.") from error

    return content_type, extension, public_id, file_size


def _save_upload(
    file: UploadFile,
    folder: str,
    *,
    content_types: set[str],
    max_size_bytes: Optional[int],
    resource_type: str,
) -> str:
    content_type, extension, public_id, file_size = _upload_metadata(file, content_types)
    max_size = max_size_bytes if max_size_bytes is not None else DEFAULT_MAX_UPLOAD_SIZE
    if file_size > max_size:
        raise HTTPException(status_code=400, detail="Uploaded file exceeds the maximum allowed size.")

    if _cloudinary_configured():
        try:
            file.file.seek(0)
            upload_result = cloudinary.uploader.upload(
                file.file,
                public_id=public_id,
                folder=folder,
                resource_type=resource_type,
            )
            secure_url = upload_result.get("secure_url")
            if not secure_url:
                raise ValueError("Cloudinary response did not include a secure URL")
            return str(secure_url)
        except Exception as error:
            logger.error("Cloudinary upload failed for folder %s (%s).", folder, type(error).__name__)
            raise HTTPException(
                status_code=502,
                detail="Image storage service failed. Please try again later.",
            ) from error

    local_folder = LOCAL_FOLDER_MAP.get(folder, "")
    destination_dir = os.path.join(STATIC_DIR, local_folder) if local_folder else STATIC_DIR
    os.makedirs(destination_dir, exist_ok=True)
    local_filename = f"{public_id}{extension}"
    destination = os.path.join(destination_dir, local_filename)
    try:
        file.file.seek(0)
        with open(destination, "wb") as output_file:
            shutil.copyfileobj(file.file, output_file)
    except OSError as error:
        logger.error("Local upload save failed for folder %s (%s).", folder, type(error).__name__)
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.") from error

    relative_path = "/".join(part for part in (local_folder, local_filename) if part)
    return f"http://127.0.0.1:8000/static/uploads/{relative_path}"


def save_upload(
    file: UploadFile,
    folder: str,
    *,
    max_size_bytes: Optional[int] = None,
) -> str:
    """Persist a JPEG, PNG, or WebP upload and return its durable URL."""
    return _save_upload(
        file,
        folder,
        content_types=IMAGE_CONTENT_TYPES,
        max_size_bytes=max_size_bytes,
        resource_type="image",
    )


def save_attachment(
    file: UploadFile,
    folder: str,
    *,
    max_size_bytes: Optional[int] = None,
) -> str:
    """Persist supported chat/support media using Cloudinary's matching resource type."""
    content_type = (file.content_type or mimetypes.guess_type(file.filename or "")[0] or "").split(";", 1)[0].strip().lower()
    is_media = content_type.startswith(("image/", "audio/", "video/"))
    if content_type != "application/pdf" and not is_media:
        raise HTTPException(status_code=400, detail="Unsupported attachment content type.")
    content_types = ATTACHMENT_CONTENT_TYPES | {content_type}
    resource_type = "raw" if content_type == "application/pdf" else "video" if content_type.startswith(("audio/", "video/")) else "image"
    return _save_upload(
        file,
        folder,
        content_types=content_types,
        max_size_bytes=max_size_bytes,
        resource_type=resource_type,
    )