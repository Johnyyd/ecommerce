"""Rate Limiter Configuration Module.

This module provides the rate limiter instance to avoid circular imports.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings


def get_storage_uri() -> str:
    """Get storage URI for rate limiter. Falls back to memory:// if Redis unavailable."""
    # In test environment, use in-memory storage to avoid Redis dependency
    if settings.ENVIRONMENT == "test":
        return "memory://"
    return settings.REDIS_URL


# Initialize Rate Limiter - will be configured with Redis in main.py
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT] if settings.RATE_LIMIT_ENABLED else [],
    storage_uri=get_storage_uri(),
)