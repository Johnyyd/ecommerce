"""
ARQ Worker tasks for embedding generation and Meilisearch synchronization.

These tasks handle:
1. Generating embeddings for products without them using the Free LLM API
2. Synchronizing products (with embeddings) to Meilisearch index
3. Incremental sync based on product version/updated_at

Follows the same patterns as existing worker tasks: ctx parameter, logging,
error handling, and returning result dictionaries.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.core.queue import get_redis_settings
from app.crud.product import ProductRepository
from app.services.embedding_service import get_embedding_service
from app.services.search_service import SearchService
from app.core.db import get_db_session
from app.models.product import Product
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


async def generate_embeddings_task(ctx: Any, batch_size: int = 50) -> Dict[str, Any]:
    """
    ARQ Task for generating embeddings for products that don't have them.

    Args:
        ctx: ARQ context (contains Redis connection, etc.)
        batch_size: Number of products to process in each batch

    Returns:
        Dict with processing statistics
    """
    logger.info(f"Starting embeddings generation task with batch_size={batch_size}")

    stats = {
        "processed": 0,
        "embedded": 0,
        "failed": 0,
        "skipped": 0
    }

    try:
        # Get database session
        async for session in get_db_session():
            repo = ProductRepository(session)
            embedding_service = get_embedding_service()

            # Get products without embeddings
            # Using raw SQL for efficiency since we need to check for NULL embedding
            from sqlalchemy import select
            stmt = select(Product).where(Product.embedding.is_(None)).limit(batch_size)
            result = await session.execute(stmt)
            products = result.scalars().all()

            if not products:
                logger.info("No products found without embeddings")
                return stats

            logger.info(f"Found {len(products)} products without embeddings")

            # Process in batches
            for i in range(0, len(products), batch_size):
                batch = products[i:i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (len(products) + batch_size - 1) // batch_size

                logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} products)")

                # Extract text for embedding (name + description)
                texts = []
                product_map = {}  # Map index to product

                for idx, product in enumerate(batch):
                    # Combine name and description for embedding
                    text_parts = [product.name or ""]
                    if product.description:
                        text_parts.append(product.description)
                    text = " ".join(text_parts).strip()

                    if text:  # Only process if we have text to embed
                        texts.append(text)
                        product_map[len(texts) - 1] = product
                    else:
                        stats["skipped"] += 1
                        logger.warning(f"Product {product.id} has no text for embedding")

                if not texts:
                    logger.warning("No valid texts found in batch for embedding")
                    continue

                # Generate embeddings for the batch
                try:
                    embeddings = await embedding_service.get_embeddings(texts)

                    # Update products with embeddings
                    for text_idx, embedding in enumerate(embeddings):
                        if embedding is not None and text_idx in product_map:
                            product = product_map[text_idx]
                            product.embedding = embedding
                            session.add(product)
                            stats["embedded"] += 1
                            logger.debug(f"Generated embedding for product {product.id}")
                        elif text_idx in product_map:
                            stats["failed"] += 1
                            logger.warning(f"Failed to generate embedding for product {product_map[text_idx].id}")

                    # Commit the batch
                    await session.commit()
                    stats["processed"] += len(batch)

                    # Small delay between batches to avoid overwhelming the API
                    if i + batch_size < len(products):
                        await asyncio.sleep(0.5)  # 500ms delay

                except Exception as e:
                    logger.error(f"Error processing batch {batch_num}: {e}")
                    stats["failed"] += len(batch)
                    await session.rollback()

            await embedding_service.close()
            break  # Exit the async generator loop

    except Exception as e:
        logger.error(f"Error in embeddings generation task: {e}")
        stats["error"] = str(e)

    logger.info(f"Embeddings generation task completed: {stats}")
    return stats


async def sync_to_meilisearch_task(ctx: Any, batch_size: int = 100) -> Dict[str, Any]:
    """
    ARQ Task for synchronizing products with embeddings to Meilisearch.

    Args:
        ctx: ARQ context
        batch_size: Number of products to sync in each batch

    Returns:
        Dict with synchronization statistics
    """
    logger.info(f"Starting Meilisearch sync task with batch_size={batch_size}")

    stats = {
        "processed": 0,
        "synced": 0,
        "failed": 0,
        "skipped": 0
    }

    try:
        # Get database session
        async for session in get_db_session():
            repo = ProductRepository(session)
            search_service = SearchService()

            # Get products that have embeddings but may not be synced
            # We'll check for products with embeddings that need syncing
            from sqlalchemy import select
            stmt = select(Product).where(Product.embedding.is_not(None)).limit(batch_size)
            result = await session.execute(stmt)
            products = result.scalars().all()

            if not products:
                logger.info("No products with embeddings found for sync")
                return stats

            logger.info(f"Found {len(products)} products with embeddings to sync")

            # Process in batches
            for i in range(0, len(products), batch_size):
                batch = products[i:i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (len(products) + batch_size - 1) // batch_size

                logger.info(f"Syncing batch {batch_num}/{total_batches} ({len(batch)} products)")

                # Prepare documents for Meilisearch
                documents = []
                product_ids = []

                for product in batch:
                    # Only sync products that have embeddings
                    if product.embedding is not None:
                        doc = {
                            "id": str(product.id),
                            "name": product.name,
                            "description": product.description or "",
                            "price": float(product.price) if product.price else 0.0,
                            "brand": product.brand or "",
                            "category_id": str(product.category_id) if product.category_id else "",
                            "search_vector": product.search_vector or "",
                            "embedding": product.embedding,
                            "updated_at": product.updated_at.isoformat() if product.updated_at else "",
                        }
                        documents.append(doc)
                        product_ids.append(str(product.id))
                    else:
                        stats["skipped"] += 1

                if not documents:
                    logger.warning("No valid documents found in batch for sync")
                    continue

                # Sync to Meilisearch
                try:
                    result = await search_service.sync_products_to_meilisearch(documents)

                    if result.get("status") == "succeeded":
                        stats["synced"] += len(documents)
                        logger.info(f"Successfully synced batch {batch_num} to Meilisearch")
                    else:
                        stats["failed"] += len(documents)
                        logger.warning(f"Meilisearch sync returned unexpected result: {result}")

                    stats["processed"] += len(batch)

                except Exception as e:
                    logger.error(f"Error syncing batch {batch_num} to Meilisearch: {e}")
                    stats["failed"] += len(batch)

                # Small delay between batches
                if i + batch_size < len(products):
                    await asyncio.sleep(0.2)  # 200ms delay

            await search_service.close()
            break  # Exit the async generator loop

    except Exception as e:
        logger.error(f"Error in Meilisearch sync task: {e}")
        stats["error"] = str(e)

    logger.info(f"Meilisearch sync task completed: {stats}")
    return stats


async def incremental_sync_task(ctx: Any) -> Dict[str, Any]:
    """
    ARQ Task for incremental synchronization based on product version or updated_at.

    This task should be run frequently (e.g., every 5 minutes) to keep
    Meilisearch in sync with recent product changes.

    Args:
        ctx: ARQ context

    Returns:
        Dict with synchronization statistics
    """
    logger.info("Starting incremental sync task")

    stats = {
        "processed": 0,
        "updated": 0,
        "failed": 0
    }

    try:
        # Get database session
        async for session in get_db_session():
            repo = ProductRepository(session)
            search_service = SearchService()

            # TODO: Implement incremental sync based on version or updated_at
            # For now, we'll sync products updated in the last hour
            # This requires checking against a "last sync" timestamp stored somewhere
            # For simplicity, we'll sync a small batch of recently updated products

            from sqlalchemy import select, desc
            stmt = select(Product).order_by(desc(Product.updated_at)).limit(50)
            result = await session.execute(stmt)
            products = result.scalars().all()

            if not products:
                logger.info("No recently updated products found")
                return stats

            logger.info(f"Found {len(products)} recently updated products")

            # Prepare documents for sync
            documents = []
            for product in products:
                if product.embedding is not None:  # Only sync products with embeddings
                    doc = {
                        "id": str(product.id),
                        "name": product.name,
                        "description": product.description or "",
                        "price": float(product.price) if product.price else 0.0,
                        "brand": product.brand or "",
                        "category_id": str(product.category_id) if product.category_id else "",
                        "search_vector": product.search_vector or "",
                        "embedding": product.embedding,
                        "updated_at": product.updated_at.isoformat() if product.updated_at else "",
                    }
                    documents.append(doc)

            if documents:
                try:
                    result = await search_service.sync_products_to_meilisearch(documents)

                    if result.get("status") == "succeeded":
                        stats["updated"] = len(documents)
                        logger.info(f"Incrementally synced {len(documents)} products to Meilisearch")
                    else:
                        stats["failed"] = len(documents)
                        logger.warning(f"Incremental sync returned unexpected result: {result}")

                    stats["processed"] = len(products)

                except Exception as e:
                    logger.error(f"Error in incremental sync: {e}")
                    stats["failed"] = len(products)

            await search_service.close()
            break  # Exit the async generator loop

    except Exception as e:
        logger.error(f"Error in incremental sync task: {e}")
        stats["error"] = str(e)

    logger.info(f"Incremental sync task completed: {stats}")
    return stats


async def startup(ctx: Any):
    logger.info("=== Enterprise ARQ Worker initializing background jobs ===")
    logger.info("Registered tasks: send_email_task, optimize_image_task, generate_sales_report_task, generate_embeddings_task, sync_to_meilisearch_task, incremental_sync_task")

async def shutdown(ctx: Any):
    logger.info("=== Enterprise ARQ Worker shutting down gracefully ===")

class WorkerSettings:
    """Configuration class consumed by `arq app.worker.WorkerSettings`."""
    functions = [
        send_email_task,
        optimize_image_task,
        generate_sales_report_task,
        generate_embeddings_task,
        sync_to_meilisearch_task,
        incremental_sync_task,
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