import logging
import json
from typing import Any, Optional, Dict
from uuid import uuid4
from datetime import datetime, timezone
from arq.connections import create_pool, RedisSettings, ArqRedis
from arq.jobs import Job, JobStatus
from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)

_pool: Optional[ArqRedis] = None

def get_redis_settings() -> RedisSettings:
    return RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD or None,
        database=0
    )

async def get_queue_pool() -> ArqRedis:
    """Obtain or initialize the singleton ARQ Redis connection pool."""
    global _pool
    if _pool is None:
        try:
            _pool = await create_pool(get_redis_settings())
        except Exception as e:
            logger.warning(f"Could not connect to ARQ Redis pool: {e}. Worker queue might be unavailable.")
            raise
    return _pool

async def close_queue_pool():
    """Gracefully close the ARQ Redis connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None

async def enqueue_email_job(recipient: str, subject: str, template: str, context: Dict[str, Any]) -> str:
    """Enqueue transactional email sending task."""
    try:
        pool = await get_queue_pool()
        job = await pool.enqueue_job("send_email_task", recipient, subject, template, context)
        return job.job_id if job else str(uuid4())
    except Exception as e:
        logger.error(f"Failed to enqueue email job: {e}")
        # Fallback to direct synchronous execution or sandbox logging
        from app.services.email import record_sandbox_email
        await record_sandbox_email(recipient, subject, template, context)
        return f"sandbox_{uuid4()}"

async def enqueue_image_optimization_job(original_path: str, filename: str) -> str:
    """Enqueue image WebP conversion and multi-size thumbnail generation."""
    try:
        pool = await get_queue_pool()
        job = await pool.enqueue_job("optimize_image_task", original_path, filename)
        return job.job_id if job else str(uuid4())
    except Exception as e:
        logger.error(f"Failed to enqueue image optimization job: {e}")
        # Run synchronous fallback so image is never lost
        from app.services.media import process_image_sync
        process_image_sync(original_path, filename)
        return f"sync_{uuid4()}"

async def enqueue_report_job(
    report_type: str,
    date_from: Optional[str],
    date_to: Optional[str],
    format_type: str,
    user_id: str
) -> str:
    """Enqueue asynchronous sales/revenue report generation."""
    job_id = f"report_{uuid4().hex[:12]}"
    redis = get_redis_client()
    
    # Store initial pending state in Redis for immediate UI response
    meta = {
        "job_id": job_id,
        "report_type": report_type,
        "format": format_type,
        "date_from": date_from,
        "date_to": date_to,
        "user_id": user_id,
        "status": "PENDING",
        "progress": 5,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "download_url": None,
        "error": None
    }
    await redis.set(f"reports:meta:{job_id}", json.dumps(meta), ex=86400) # 24hr TTL
    
    try:
        pool = await get_queue_pool()
        await pool.enqueue_job(
            "generate_sales_report_task",
            job_id,
            report_type,
            date_from,
            date_to,
            format_type,
            user_id,
            _job_id=job_id
        )
    except Exception as e:
        logger.warning(f"Could not enqueue report via ARQ worker: {e}. Executing inline.")
        from app.services.reports import generate_report_inline
        # Async inline execution
        import asyncio
        asyncio.create_task(generate_report_inline(job_id, report_type, date_from, date_to, format_type, user_id))
        
    return job_id

async def get_job_status(job_id: str) -> Dict[str, Any]:
    """Retrieve the status and metadata of a background job."""
    redis = get_redis_client()
    
    # Check custom reports metadata first
    meta_raw = await redis.get(f"reports:meta:{job_id}")
    if meta_raw:
        return json.loads(meta_raw)
        
    try:
        pool = await get_queue_pool()
        job = Job(job_id, pool)
        status = await job.status()
        info = await job.info()
        return {
            "job_id": job_id,
            "status": status.value if status else "UNKNOWN",
            "enqueue_time": str(info.enqueue_time) if info and info.enqueue_time else None,
            "score": info.score if info else None
        }
    except Exception:
        return {"job_id": job_id, "status": "UNKNOWN"}

async def get_queue_metrics() -> Dict[str, Any]:
    """Get high-level statistics of the task queue for admin monitoring."""
    redis = get_redis_client()
    try:
        # ARQ default queue name is 'arq:queue'
        queued_count = await redis.zcard("arq:queue")

        # Use non-blocking scan iteration to avoid Redis event-loop stalls in production
        active_jobs_count = 0
        if hasattr(redis, "scan_iter"):
            async for _ in redis.scan_iter(match="arq:job:*", count=100):
                active_jobs_count += 1
                if active_jobs_count >= 500:
                    break
        else:
            active_keys = await redis.keys("arq:job:*")
            active_jobs_count = len(active_keys) if active_keys else 0

        total_reports = 0
        if hasattr(redis, "scan_iter"):
            async for _ in redis.scan_iter(match="reports:meta:*", count=100):
                total_reports += 1
                if total_reports >= 500:
                    break
        else:
            rep_keys = await redis.keys("reports:meta:*")
            total_reports = len(rep_keys) if rep_keys else 0
        
        # Ping redis
        ping_ok = await redis.ping()
        
        return {
            "worker_status": "HEALTHY" if ping_ok else "DISCONNECTED",
            "queued_jobs": queued_count or 0,
            "active_or_cached_jobs": active_jobs_count,
            "total_reports_generated": total_reports,
            "redis_connected": bool(ping_ok),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "worker_status": "DEGRADED",
            "error": str(e),
            "queued_jobs": 0,
            "active_or_cached_jobs": 0,
            "redis_connected": False,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
