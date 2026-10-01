"""
Initial Backfill Script for Meilisearch & pgvector.

Scans the PostgreSQL `products` table in batches, indexes them into Meilisearch,
and tracks progress in `backfill_jobs` table so it can be safely paused and resumed.

Usage:
    python backend/scripts/backfill_search.py --dry-run
    python backend/scripts/backfill_search.py --batch-size 50
    python backend/scripts/backfill_search.py --resume
"""

import sys
import os
import asyncio
import argparse
import logging
from typing import Dict, Any

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, func, text
from app.core.db import AsyncSessionLocal
from app.models.product import Product
from app.services.search_service import SearchService
from app.services.sync_service import (
    get_or_create_backfill_job,
    update_backfill_progress,
    record_failed_sync
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_search")


async def backfill(
    dry_run: bool = False,
    batch_size: int = 50,
    resume: bool = True,
    delay_sec: float = 0.1
) -> Dict[str, Any]:
    search_service = SearchService()
    await search_service.ensure_index_initialized()

    job_name = "initial_search_backfill"
    stats = {
        "total": 0,
        "processed": 0,
        "failed": 0,
        "status": "running"
    }

    try:
        # Count total products
        async with AsyncSessionLocal() as session:
            count_res = await session.execute(select(func.count(Product.id)))
            total_count = count_res.scalar_one() or 0
            stats["total"] = total_count

        logger.info(f"Total products to backfill: {total_count}")

        if dry_run:
            logger.info("Dry-run mode: verified database connection and product count. No documents pushed.")
            stats["status"] = "dry_run_completed"
            return stats

        job = await get_or_create_backfill_job(job_name, total_items=total_count)
        processed_offset = job.processed_items if (resume and job.status != "completed") else 0

        logger.info(f"Starting backfill from offset {processed_offset} (batch size {batch_size})...")

        offset = processed_offset
        while offset < total_count:
            async with AsyncSessionLocal() as session:
                stmt = select(Product).order_by(Product.created_at.asc()).offset(offset).limit(batch_size)
                result = await session.execute(stmt)
                batch = result.scalars().all()

            if not batch:
                break

            try:
                await search_service.sync_products_to_meilisearch(batch)
                stats["processed"] += len(batch)
                offset += len(batch)
                await update_backfill_progress(
                    job_id=job.id,
                    processed=offset,
                    failed=stats["failed"],
                    status="running"
                )
                logger.info(f"Backfill progress: {offset}/{total_count} products synced.")
            except Exception as e:
                logger.error(f"Failed to sync batch starting at offset {offset}: {e}")
                stats["failed"] += len(batch)
                offset += len(batch)
                for p in batch:
                    await record_failed_sync(
                        product_id=p.id,
                        error=str(e),
                        error_type="backfill_batch_failure"
                    )

            if delay_sec > 0:
                await asyncio.sleep(delay_sec)

        # Mark job completed
        stats["status"] = "completed" if stats["failed"] == 0 else "completed_with_errors"
        await update_backfill_progress(
            job_id=job.id,
            processed=offset,
            failed=stats["failed"],
            status=stats["status"]
        )

        # Optional: Reindex pgvector embedding index
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("REINDEX INDEX CONCURRENTLY idx_products_embedding;"))
                logger.info("Executed REINDEX INDEX idx_products_embedding successfully.")
        except Exception:
            # Reindex concurrently may fail if table doesn't have populated vectors or on transaction block
            pass

        await search_service.close()

    except Exception as e:
        logger.error(f"Backfill encountered fatal error: {e}")
        stats["error"] = str(e)
        stats["status"] = "failed"

    logger.info(f"Backfill finished: {stats}")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Backfill products to Meilisearch search index.")
    parser.add_argument("--dry-run", action="store_true", help="Count products and test configuration without syncing")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size for indexing")
    parser.add_argument("--no-resume", dest="resume", action="store_false", help="Restart backfill from beginning")
    args = parser.parse_args()

    results = asyncio.run(backfill(dry_run=args.dry_run, batch_size=args.batch_size, resume=args.resume))
    print("\n--- Backfill Report ---")
    for k, v in results.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
