import pytest
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.pool import NullPool
from app.core.db import engine
from app.core.redis import get_redis_client
import redis.asyncio as aioredis

def test_db_engine_configuration():
    assert isinstance(engine, AsyncEngine)
    # Mandated config for PgBouncer in transaction mode
    assert isinstance(engine.pool, NullPool)
    # Ensure pool_pre_ping is set (even with NullPool it's good practice or explicitly requested)
    assert engine.pool._pre_ping is True

@pytest.mark.asyncio
async def test_redis_client_configuration():
    client = get_redis_client()
    assert isinstance(client, aioredis.Redis)
