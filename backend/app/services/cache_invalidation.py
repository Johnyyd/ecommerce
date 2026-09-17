import logging
from typing import Iterable
from uuid import UUID
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)

async def invalidate_product_caches(product_ids: Iterable[UUID]) -> None:
    """
    Invalidate Redis caches for specified products and general product listings.
    Cleans up:
    - product:{product_id}
    - products:list:*
    """
    try:
        redis = get_redis_client()
        keys_to_delete = [f"product:{pid}" for pid in product_ids]
        
        # Scan and add all paginated/filtered list cache keys
        async for key in redis.scan_iter(match="products:list:*"):
            keys_to_delete.append(key)
            
        if keys_to_delete:
            await redis.delete(*keys_to_delete)
            logger.info("Invalidated %d Redis product cache keys", len(keys_to_delete))
            
        await redis.aclose()
    except Exception as e:
        # Cache invalidation failure should not fail the business transaction, but be logged
        logger.warning("Failed to invalidate product caches in Redis: %s", e)
