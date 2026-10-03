"""
Reconciliation Script for Meilisearch ↔ PostgreSQL Synchronization.

Detects and repairs inconsistencies between PostgreSQL (source of truth)
and Meilisearch (search index).

Usage:
    python backend/scripts/reconcile_search.py --dry-run
    python backend/scripts/reconcile_search.py --fix
"""

import sys
import os
import asyncio
import argparse
import logging
from typing import Dict, Any, List

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.db import AsyncSessionLocal
from app.models.product import Product
from app.services.search_service import SearchService
from app.services.sync_service import record_failed_sync

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("reconcile_search")


async def reconcile(dry_run: bool = True, batch_size: int = 100) -> Dict[str, Any]:
    try:
        search_service = SearchService()
        await search_service.ensure_index_initialized()
    except Exception as e:
        logger.error(f"Failed to initialize search service: {e}")
        return {
            "error": str(e),
            "postgres_total": 0,
            "meilisearch_total": 0,
            "missing_in_search": 0,
            "stale_in_search": 0,
            "repaired": 0,
            "failed": 0
        }

    stats = {
        "postgres_total": 0,
        "meilisearch_total": 0,
        "missing_in_search": 0,
        "stale_in_search": 0,
        "repaired": 0,
        "failed": 0
    }

    try:
        # 1. Fetch Meilisearch stats
        try:
            ms_stats = await search_service.meilisearch.get_stats()
            stats["meilisearch_total"] = ms_stats.get("numberOfDocuments", 0)
        except Exception as e:
            logger.warning(f"Could not retrieve Meilisearch stats: {e}")

        # 2. Fetch all products from PostgreSQL
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Product))
            products = result.scalars().all()
            stats["postgres_total"] = len(products)

        logger.info(f"Checking {len(products)} products against Meilisearch...")

        missing_products = []
        stale_products = []

        # Check each product against Meilisearch
        for product in products:
            pid = str(product.id)
            try:
                doc = await search_service.meilisearch.get_document(
                    search_service.meilisearch.index_name, pid
                )
                if not doc:
                    missing_products.append(product)
                else:
                    # Compare updated_at
                    doc_updated = doc.get("updated_at")
                    if product.updated_at and doc_updated:
                        if product.updated_at.isoformat() > doc_updated:
                            stale_products.append(product)
                    elif product.updated_at and not doc_updated:
                        stale_products.append(product)
            except Exception:
                missing_products.append(product)

        stats["missing_in_search"] = len(missing_products)
        stats["stale_in_search"] = len(stale_products)

        logger.info(f"Discrepancies found: {len(missing_products)} missing, {len(stale_products)} stale.")

        to_repair = missing_products + stale_products

        if dry_run:
            logger.info("Dry-run mode: no changes applied. Run with --fix to reconcile.")
            return stats

        # Repair discrepancies
        if to_repair:
            logger.info(f"Repairing {len(to_repair)} products...")
            for i in range(0, len(to_repair), batch_size):
                batch = to_repair[i:i + batch_size]
                try:
                    await search_service.sync_products_to_meilisearch(batch)
                    stats["repaired"] += len(batch)
                    logger.info(f"Repaired batch of {len(batch)} products.")
                except Exception as e:
                    logger.error(f"Error repairing batch: {e}")
                    stats["failed"] += len(batch)
                    for p in batch:
                        await record_failed_sync(
                            product_id=p.id,
                            error=str(e),
                            error_type="reconciliation_repair_failure"
                        )

        await search_service.close()

    except Exception as e:
        logger.error(f"Reconciliation error: {e}")
        stats["error"] = str(e)

    logger.info(f"Reconciliation completed: {stats}")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Reconcile PostgreSQL and Meilisearch search index.")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Scan and report discrepancies without fixing")
    parser.add_argument("--fix", dest="dry_run", action="store_false", help="Repair detected discrepancies")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for repairs")
    args = parser.parse_args()

    results = asyncio.run(reconcile(dry_run=args.dry_run, batch_size=args.batch_size))
    print("\n--- Reconciliation Report ---")
    for k, v in results.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
