import logging
from typing import Any, Dict
from app.core.queue import get_redis_settings
from app.services.media import optimize_image_task
from app.services.reports import generate_sales_report_task
from app.services.email import send_email

logger = logging.getLogger("worker")

async def send_email_task(ctx: Any, recipient: str, subject: str, template: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """ARQ Task wrapper for background email delivery."""
    logger.info(f"Worker dispatching {template} email to {recipient}...")
    res = await send_email(recipient, subject, template, context)
    logger.info(f"Worker sent email to {recipient} (mode: {res.get('delivery_mode')})")
    return res

async def startup(ctx: Any):
    logger.info("=== Enterprise ARQ Worker initializing background jobs ===")
    logger.info("Registered tasks: send_email_task, optimize_image_task, generate_sales_report_task")

async def shutdown(ctx: Any):
    logger.info("=== Enterprise ARQ Worker shutting down gracefully ===")

class WorkerSettings:
    """Configuration class consumed by `arq app.worker.WorkerSettings`."""
    functions = [
        send_email_task,
        optimize_image_task,
        generate_sales_report_task,
    ]
    redis_settings = get_redis_settings()
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 20
    job_timeout = 600
    keep_result = 86400

if __name__ == "__main__":
    from arq import run_worker
    import asyncio
    asyncio.run(run_worker(WorkerSettings))
