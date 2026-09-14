import os
import io
import logging
from typing import Dict, Any, Tuple
from pathlib import Path
from PIL import Image, ImageOps
from app.core.config import settings
from app.core.utils import generate_uuidv7

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

def get_media_dir() -> Path:
    """Ensure media storage directory exists and return Path object."""
    media_path = Path(settings.MEDIA_DIR)
    try:
        media_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        logger.warning("Could not create media directory: %s", e)
    return media_path

def validate_image_security(data: bytes, content_type: str) -> Tuple[bool, str]:
    """
    OWASP A03/A05: Strict MIME & Magic Bytes Validation + Pillow structural integrity check.
    Prevents executable file uploads disguised as images, SVG script execution, and zip bombs.
    """
    if len(data) > MAX_FILE_SIZE_BYTES:
        return False, "File exceeds maximum permitted size of 10MB."

    if len(data) < 12:
        return False, "Security violation: File too small or corrupted."

    # Validate Magic Bytes
    is_valid_magic = False
    if data.startswith(b"\xff\xd8\xff"):
        is_valid_magic = True
    elif data.startswith(b"\x89PNG\r\n\x1a\n"):
        is_valid_magic = True
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        is_valid_magic = True

    if not is_valid_magic:
        return False, "Security violation: File header does not match authorized image formats (JPEG, PNG, WEBP)."

    # Verify structural integrity with Pillow
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()
    except Exception as e:
        return False, f"Corrupted or invalid image structure: {str(e)}"

    return True, "Valid"

def process_image_sync(source_path: str, filename_base: str) -> Dict[str, Any]:
    """
    Converts source image to modern WebP and produces 3 responsive sizes:
    1. Thumbnail (150x150, center-cropped)
    2. Medium (600x600, proportional)
    3. Full (1200x1200, high-res web optimized)
    """
    media_dir = get_media_dir()
    src = Path(source_path)
    
    if not src.exists():
        raise FileNotFoundError(f"Source file {source_path} not found")

    original_size = src.stat().st_size

    with Image.open(src) as img:
        # Convert paletted or non-RGB/RGBA modes
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "transparency" in img.info else "RGB")

        orig_w, orig_h = img.size

        # 1. Thumbnail: 150x150 square fit
        thumb_filename = f"{filename_base}_thumb.webp"
        thumb_path = media_dir / thumb_filename
        thumb_img = ImageOps.fit(img, (150, 150), method=Image.Resampling.LANCZOS)
        thumb_img.save(thumb_path, "WEBP", quality=80, method=6)

        # 2. Medium: 600x600 bounding box
        med_filename = f"{filename_base}_medium.webp"
        med_path = media_dir / med_filename
        med_img = img.copy()
        med_img.thumbnail((600, 600), Image.Resampling.LANCZOS)
        med_img.save(med_path, "WEBP", quality=82, method=6)

        # 3. Full: 1200x1200 max resolution
        full_filename = f"{filename_base}_full.webp"
        full_path = media_dir / full_filename
        full_img = img.copy()
        full_img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        full_img.save(full_path, "WEBP", quality=85, method=6)

    full_size = full_path.stat().st_size
    savings_pct = max(0, round(((original_size - full_size) / original_size) * 100, 1)) if original_size > 0 else 0

    return {
        "filename_base": filename_base,
        "original_dimensions": [orig_w, orig_h],
        "original_size_bytes": original_size,
        "full_size_bytes": full_size,
        "savings_percentage": savings_pct,
        "variants": {
            "thumb": f"/media/{thumb_filename}",
            "medium": f"/media/{med_filename}",
            "full": f"/media/{full_filename}"
        }
    }

async def optimize_image_task(ctx: Any, original_path: str, filename: str) -> Dict[str, Any]:
    """ARQ background worker task for non-blocking image optimization."""
    logger.info(f"Starting background image optimization: {filename}")
    res = process_image_sync(original_path, filename)
    logger.info(f"Completed image optimization: {filename} (saved {res['savings_percentage']}%)")
    return res
