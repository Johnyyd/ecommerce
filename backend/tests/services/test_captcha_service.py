import pytest
from app.services.captcha import generate_captcha, verify_captcha, _memory_captcha_store

@pytest.mark.asyncio
async def test_generate_and_verify_captcha():
    # 1. Generate challenge
    captcha = await generate_captcha()
    assert "captcha_id" in captcha
    assert "captcha_svg" in captcha
    assert "<svg" in captcha["captcha_svg"]
    assert "</svg>" in captcha["captcha_svg"]

    captcha_id = captcha["captcha_id"]

    # 2. Test invalid code rejection
    invalid_result = await verify_captcha(captcha_id, "WRONG")
    assert invalid_result is False

    # 3. Generate a new challenge and verify with correct code
    captcha2 = await generate_captcha()
    captcha2_id = captcha2["captcha_id"]
    
    # Check stored code in memory fallback or redis
    code = _memory_captcha_store.get(captcha2_id)
    if not code:
        from app.core.redis import get_redis_client
        redis = get_redis_client()
        code = await redis.get(f"captcha:{captcha2_id}")

    assert code is not None
    # Case-insensitive verification
    assert await verify_captcha(captcha2_id, code.upper()) is True

    # 4. Verify single-use property (replay protection)
    # Re-using the same captcha_id should now return False
    assert await verify_captcha(captcha2_id, code) is False
