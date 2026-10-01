import logging
from typing import Any, Dict, Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.db import AsyncSessionLocal
from app.models.search_sync import FailedSyncTask, BackfillJob

logger = logging.getLogger(__name__)


async def record_failed_sync(
    product_id: UUID,
    error: str,
    error_type: str = "meilisearch_sync_error",
    details: Optional[Dict[str, Any]] = None,
    attempt: int = 1,
    max_attempts: int = 3
) -> Optional[FailedSyncTask]:
    """Record a failed synchronization task to the Dead Letter Queue (DLQ)."""
    try:
        async with AsyncSessionLocal() as session:
            task = FailedSyncTask(
                product_id=product_id,
                attempt=attempt,
                max_attempts=max_attempts,
                error=error[:1000] if error else "Unknown error",
                error_type=error_type[:100],
                details=details
            )
            session.add(task)
            await session.commit()
            await session.refresh(task)
            return task
    except Exception as e:
        logger.error(f"Failed to record sync failure to DLQ for product {product_id}: {e}")
        return None


async def resolve_failed_sync(task_id: int, resolved_by: str = "reconciliation") -> bool:
    """Mark a DLQ task as resolved."""
    try:
        async with AsyncSessionLocal() as session:
            task = await session.get(FailedSyncTask, task_id)
            if task:
                task.resolved_at = datetime.now(timezone.utc)
                task.resolved_by = resolved_by
                await session.commit()
                return True
            return False
    except Exception as e:
        logger.error(f"Failed to resolve DLQ task {task_id}: {e}")
        return False


async def get_or_create_backfill_job(job_name: str, total_items: Optional[int] = None) -> BackfillJob:
    """Get or create a backfill progress job."""
    async with AsyncSessionLocal() as session:
        stmt = select(BackfillJob).where(BackfillJob.job_name == job_name)
        result = await session.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            job = BackfillJob(
                job_name=job_name,
                status="running",
                total_items=total_items,
                processed_items=0,
                failed_items=0
            )
            session.add(job)
            await session.commit()
            await session.refresh(job)
        return job


async def update_backfill_progress(
    job_id: int,
    processed: int,
    failed: int = 0,
    status: Optional[str] = None
) -> None:
    """Update progress of a backfill job."""
    try:
        async with AsyncSessionLocal() as session:
            job = await session.get(BackfillJob, job_id)
            if job:
                job.processed_items = processed
                job.failed_items = failed
                if status:
                    job.status = status
                    if status in ("completed", "failed"):
                        job.completed_at = datetime.now(timezone.utc)
                await session.commit()
    except Exception as e:
        logger.error(f"Failed to update backfill job {job_id}: {e}")
