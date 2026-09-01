import uuid
import redis.asyncio as redis
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

class TokenService:
    async def create_family(self) -> str:
        return str(uuid.uuid4())
        
    async def set_active_rt(self, family_id: str, jti: str, expires_in_days: int = 7):
        await redis_client.setex(f"active_rt:{family_id}", expires_in_days * 24 * 3600, jti)

    async def revoke_family(self, family_id: str):
        await redis_client.setex(f"revoked_family:{family_id}", 7 * 24 * 3600, "1")
        await redis_client.delete(f"active_rt:{family_id}")
        
    async def rotate_token(self, family_id: str, old_jti: str, generate_tokens_cb) -> tuple[str, str] | None:
        # Check if revoked
        if await redis_client.get(f"revoked_family:{family_id}"):
            return None
            
        # Check grace period (idempotency)
        cached_new_tokens_str = await redis_client.get(f"rotated:{old_jti}")
        if cached_new_tokens_str:
            # Replayed within 30s, return the exact same new tokens
            # Format: "access_token:refresh_token"
            parts = cached_new_tokens_str.split(":", 1)
            if len(parts) == 2:
                return parts[0], parts[1]
                
        # Check active RT
        active_jti = await redis_client.get(f"active_rt:{family_id}")
        if not active_jti or active_jti != old_jti:
            # Token reuse detected outside grace period!
            await self.revoke_family(family_id)
            return None
            
        # Valid rotation
        new_jti = str(uuid.uuid4())
        new_at, new_rt = generate_tokens_cb(family_id, new_jti)
        
        # Save active
        await self.set_active_rt(family_id, new_jti)
        
        # Save idempotency cache (30s)
        await redis_client.setex(f"rotated:{old_jti}", 30, f"{new_at}:{new_rt}")
        
        return new_at, new_rt
