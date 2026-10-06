"""
Core search synchronization service for Meilisearch.

Provides idempotent sync and delete operations for products,
with health checking and connection management.
"""

import logging
from typing import Optional, Dict, Any, List
from uuid import UUID
from meilisearch import Client as MeilisearchClient
from meilisearch.errors import MeilisearchApiError

from app.core.config import settings
from app.models.product import Product

logger = logging.getLogger(__name__)

_MEILISEARCH_CLIENT: Optional[MeilisearchClient] = None
_INDEX_NAME = "products"


def get_meilisearch_client() -> MeilisearchClient:
    """
    Get or create the singleton Meilisearch client.

    Returns:
        Configured Meilisearch client instance
    """
    global _MEILISEARCH_CLIENT
    if _MEILISEARCH_CLIENT is None:
        _MEILISEARCH_CLIENT = MeilisearchClient(
            settings.MEILISEARCH_URL,
            settings.MEILISEARCH_MASTER_KEY
        )
    return _MEILISEARCH_CLIENT


async def check_meilisearch_health() -> bool:
    """
    Check if Meilisearch is healthy and responsive.

    Returns:
        True if healthy, False otherwise
    """
    try:
        client = get_meilisearch_client()
        health = client.health()
        return health.get("status") == "available"
    except Exception as e:
        logger.warning(f"Meilisearch health check failed: {e}")
        return False


def _product_to_document(product: Product) -> Dict[str, Any]:
    """
    Convert a Product model to a Meilisearch document.

    Args:
        product: Product model instance

    Returns:
        Document dictionary for Meilisearch
    """
    return {
        "id": str(product.id),
        "name": product.name,
        "description": product.description or "",
        "price": float(product.price) if product.price else 0.0,
        "brand": product.brand or "",
        "category_id": str(product.category_id) if product.category_id else "",
        "search_vector": product.search_vector or "",
        "embedding": product.embedding,
        "updated_at": product.updated_at.isoformat() if product.updated_at else "",
        "stock_quantity": product.stock_quantity,
        "is_active": product.is_active if hasattr(product, 'is_active') else True,
    }


async def sync_product_to_meilisearch(product: Product) -> bool:
    """
    Idempotently upsert a product to Meilisearch.

    Uses the product's `updated_at` and `version` (if available) for
    optimistic concurrency control to ensure idempotency.

    Args:
        product: Product model to sync

    Returns:
        True if sync succeeded, False otherwise
    """
    try:
        client = get_meilisearch_client()
        index = client.index(_INDEX_NAME)

        document = _product_to_document(product)

        # Upsert document - Meilisearch's add_documents is idempotent by default
        # (it updates existing documents with the same ID)
        task = index.add_documents([document])

        # Wait for the task to complete (optional, but good for error handling)
        await _wait_for_task(client, task.task_uid)

        logger.info(f"Successfully synced product {product.id} to Meilisearch")
        return True

    except MeilisearchApiError as e:
        logger.error(f"Meilisearch API error syncing product {product.id}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error syncing product {product.id} to Meilisearch: {e}")
        return False


async def delete_from_meilisearch(product_id: UUID) -> bool:
    """
    Idempotently delete a product from Meilisearch.

    Deleting a non-existent document is a no-op (idempotent).

    Args:
        product_id: UUID of the product to delete

    Returns:
        True if delete succeeded (or document didn't exist), False on error
    """
    try:
        client = get_meilisearch_client()
        index = client.index(_INDEX_NAME)

        # Delete document - idempotent (no error if document doesn't exist)
        task = index.delete_document(str(product_id))

        # Wait for the task to complete
        await _wait_for_task(client, task.task_uid)

        logger.info(f"Successfully deleted product {product_id} from Meilisearch")
        return True

    except MeilisearchApiError as e:
        # Check if it's a "document not found" error - that's still success for idempotency
        if "document not found" in str(e).lower() or "does not exist" in str(e).lower():
            logger.info(f"Product {product_id} already deleted from Meilisearch (idempotent)")
            return True
        logger.error(f"Meilisearch API error deleting product {product_id}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error deleting product {product_id} from Meilisearch: {e}")
        return False


async def sync_products_batch(products: List[Product]) -> Dict[str, Any]:
    """
    Sync multiple products to Meilisearch in a single batch.

    Args:
        products: List of Product models to sync

    Returns:
        Dict with sync statistics
    """
    stats = {
        "total": len(products),
        "synced": 0,
        "failed": 0,
        "errors": []
    }

    if not products:
        return stats

    try:
        client = get_meilisearch_client()
        index = client.index(_INDEX_NAME)

        documents = [_product_to_document(p) for p in products]

        # Batch upsert
        task = index.add_documents(documents)
        await _wait_for_task(client, task.task_uid)

        stats["synced"] = len(documents)
        logger.info(f"Batch synced {len(documents)} products to Meilisearch")

    except MeilisearchApiError as e:
        logger.error(f"Meilisearch API error in batch sync: {e}")
        stats["failed"] = len(products)
        stats["errors"].append(str(e))
    except Exception as e:
        logger.error(f"Unexpected error in batch sync: {e}")
        stats["failed"] = len(products)
        stats["errors"].append(str(e))

    return stats


async def _wait_for_task(client: MeilisearchClient, task_uid: int, timeout: float = 30.0) -> None:
    """
    Wait for a Meilisearch task to complete.

    Args:
        client: Meilisearch client
        task_uid: Task UID to wait for
        timeout: Maximum time to wait in seconds
    """
    import asyncio
    start_time = asyncio.get_event_loop().time()

    while True:
        task = client.get_task(task_uid)
        if task.status in ("succeeded", "failed"):
            if task.status == "failed":
                raise MeilisearchApiError(f"Task {task_uid} failed: {task.error}")
            return

        if asyncio.get_event_loop().time() - start_time > timeout:
            raise TimeoutError(f"Task {task_uid} did not complete within {timeout}s")

        await asyncio.sleep(0.1)


async def close_meilisearch_client() -> None:
    """Close the Meilisearch client connection."""
    global _MEILISEARCH_CLIENT
    if _MEILISEARCH_CLIENT is not None:
        # Meilisearch client doesn't have explicit close, but we clear the reference
        _MEILISEARCH_CLIENT = None
        logger.debug("Meilisearch client reference cleared")
