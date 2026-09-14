import os
import base64
from pathlib import Path
from typing import Any, Optional, Dict, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status, Response
from fastapi.responses import FileResponse

from app.api.deps import get_current_user, get_current_staff
from app.models.user import User
from app.core.config import settings
from app.core.redis import get_redis_client
from app.core.utils import generate_uuidv7
from app.core.queue import (
    enqueue_report_job,
    enqueue_image_optimization_job,
    enqueue_email_job,
    get_job_status,
    get_queue_metrics
)
from app.services.media import validate_image_security, get_media_dir, process_image_sync
from app.services.email import get_sandbox_outbox

router = APIRouter()

class ReportExportRequest(BaseModel):
    report_type: str = Field(default="sales", description="Type of report, e.g., sales, revenue, orders")
    date_from: Optional[str] = Field(default=None, description="ISO datetime start filter")
    date_to: Optional[str] = Field(default=None, description="ISO datetime end filter")
    format: str = Field(default="xlsx", description="File format: xlsx or csv")

class TestEmailRequest(BaseModel):
    recipient: str
    template: str = Field(default="welcome", description="welcome, order_invoice, or password_reset")

# ----------------- REPORTS ENDPOINTS -----------------

@router.post("/reports/export")
async def trigger_report_export(
    req: ReportExportRequest,
    current_staff: User = Depends(get_current_staff)
) -> Any:
    """
    Trigger non-blocking background generation of sales & revenue reports.
    Returns immediate job_id for polling status and download.
    """
    if req.format.lower() not in ["xlsx", "csv"]:
        raise HTTPException(status_code=400, detail="Invalid format. Supported formats: xlsx, csv")

    job_id = await enqueue_report_job(
        report_type=req.report_type,
        date_from=req.date_from,
        date_to=req.date_to,
        format_type=req.format,
        user_id=str(current_staff.id)
    )
    return {
        "job_id": job_id,
        "status": "PENDING",
        "message": f"{req.format.upper()} report generation dispatched to background worker",
        "check_status_url": f"/api/v1/reports/{job_id}/status"
    }

@router.get("/reports/{job_id}/status")
async def get_report_job_status(
    job_id: str,
    current_staff: User = Depends(get_current_staff)
) -> Any:
    """Check live status of an asynchronous report generation job."""
    info = await get_job_status(job_id)
    return info

@router.get("/reports/{job_id}/download")
async def download_report_file(
    job_id: str,
    current_staff: User = Depends(get_current_staff)
) -> Any:
    """Download the completed Excel or CSV report."""
    info = await get_job_status(job_id)
    if not info or info.get("status") != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail=f"Report is not ready yet. Current status: {info.get('status', 'NOT_FOUND')}"
        )

    file_path = info.get("file_path")
    filename = info.get("file_name", f"{job_id}.xlsx")
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if filename.endswith(".xlsx") else "text/csv"

    if file_path and os.path.exists(file_path):
        return FileResponse(file_path, filename=filename, media_type=media_type)

    # Distributed cluster fallback: retrieve report artifact from Redis
    redis = get_redis_client()
    raw_b64 = await redis.get(f"reports:data:{job_id}")
    if raw_b64:
        content_bytes = base64.b64decode(raw_b64)
        return Response(
            content=content_bytes,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    raise HTTPException(status_code=404, detail="Generated report file not found on server")

# ----------------- MEDIA OPTIMIZATION ENDPOINTS -----------------

@router.post("/media/upload")
async def upload_and_optimize_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Secure media upload with OWASP defense:
    1. Validates magic bytes (JPEG, PNG, WebP only).
    2. Enforces size limit (10MB).
    3. Triggers background WebP optimization and responsive thumbnails generation.
    """
    content = await file.read()
    is_valid, reason = validate_image_security(content, file.content_type or "")
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    media_dir = get_media_dir()
    file_id = f"img_{generate_uuidv7().hex[:12]}"
    ext = os.path.splitext(file.filename or "image.jpg")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".jpg"

    raw_filename = f"{file_id}_raw{ext}"
    raw_path = media_dir / raw_filename

    with open(raw_path, "wb") as f:
        f.write(content)

    # Trigger async WebP generation
    job_id = await enqueue_image_optimization_job(str(raw_path), file_id)
    
    # Also run immediate sync fallback variant generation so image is immediately previewable
    try:
        variants_info = process_image_sync(str(raw_path), file_id)
    except Exception:
        variants_info = {
            "variants": {
                "thumb": f"/media/{raw_filename}",
                "medium": f"/media/{raw_filename}",
                "full": f"/media/{raw_filename}"
            }
        }

    return {
        "file_id": file_id,
        "job_id": job_id,
        "original_url": f"/media/{raw_filename}",
        "variants": variants_info.get("variants"),
        "savings_percentage": variants_info.get("savings_percentage", 0),
        "message": "Media uploaded and responsive WebP variants generated"
    }

# ----------------- QUEUE & EMAIL MONITORING ENDPOINTS -----------------

@router.get("/admin/queue/status")
async def get_worker_queue_status(
    current_staff: User = Depends(get_current_staff)
) -> Any:
    """Real-time observability endpoint for background task queue and worker pods."""
    return await get_queue_metrics()

@router.get("/admin/emails/outbox")
async def get_admin_email_outbox(
    limit: int = Query(default=50, ge=1, le=100),
    current_staff: User = Depends(get_current_staff)
) -> Any:
    """Inspect recent transactional emails dispatched by background workers."""
    return await get_sandbox_outbox(limit=limit)

@router.post("/admin/emails/test")
async def trigger_test_email(
    req: TestEmailRequest,
    current_staff: User = Depends(get_current_staff)
) -> Any:
    """Manually dispatch a test email via background worker."""
    context: Dict[str, Any] = {
        "username": current_staff.username,
        "order_id": str(generate_uuidv7()),
        "total_amount": 129.99,
        "payment_method": "VIETQR",
        "token": "TEST_OTP_123456",
        "items": [
            {"name": "Apple Studio Display 27-inch 5K", "quantity": 1, "unit_price": 129.99}
        ]
    }
    subject = f"[TEST] Notification: {req.template.replace('_', ' ').title()}"
    job_id = await enqueue_email_job(req.recipient, subject, req.template, context)
    return {
        "message": f"Test {req.template} email enqueued for {req.recipient}",
        "job_id": job_id
    }
