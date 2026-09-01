import redis.asyncio as aioredis
from app.core.config import settings

def get_redis_client() -> aioredis.Redis:
    redis_url = f"redis://:{settings.REDIS_PASSWORD}@{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
    return aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
