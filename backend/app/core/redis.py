import redis.asyncio as aioredis
from app.core.config import settings

# Global connection pool for Redis
_redis_pool: aioredis.ConnectionPool | None = None


def get_redis_pool() -> aioredis.ConnectionPool:
    """Get or create Redis connection pool."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.ConnectionPool.from_url(
            f"redis://:{settings.REDIS_PASSWORD}@{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
            max_connections=50,  # Support 100 concurrent users
            decode_responses=True,
            socket_timeout=5.0,
            socket_connect_timeout=5.0,
            retry_on_timeout=True,
        )
    return _redis_pool


def get_redis_client() -> aioredis.Redis:
    """Get Redis client with connection pooling."""
    return aioredis.Redis(connection_pool=get_redis_pool())


async def close_redis_pool() -> None:
    """Close Redis connection pool."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.disconnect()
        _redis_pool = None
