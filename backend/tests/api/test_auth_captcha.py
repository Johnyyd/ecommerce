import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone
from app.main import app
from app.api.v1.endpoints.auth import get_user_service
from app.models.user import User
from app.core.utils import generate_uuidv7
from app.services.captcha import generate_captcha, verify_captcha, _memory_captcha_store

@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_get_captcha_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/auth/captcha")
    
    assert response.status_code == 200
    data = response.json()
    assert "captcha_id" in data
    assert "captcha_svg" in data
    assert "<svg" in data["captcha_svg"]
    assert data["expires_in_seconds"] == 300

@pytest.mark.asyncio
async def test_register_with_captcha_success():
    captcha = await generate_captcha()
    captcha_id = captcha["captcha_id"]
    # Ensure memory store has known code for test
    _memory_captcha_store[captcha_id] = "abc12"

    mock_service = AsyncMock()
    now = datetime.now(timezone.utc)
    mock_created = User(
        id=generate_uuidv7(),
        username="secure_user",
        email="secure@example.com",
        role="customer",
        is_active=True,
        created_at=now,
        updated_at=now
    )
    mock_service.create_user.return_value = mock_created
    app.dependency_overrides[get_user_service] = lambda: mock_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/v1/auth/register", json={
            "username": "secure_user",
            "email": "secure@example.com",
            "password": "StrongPassword123!",
            "captcha_id": captcha_id,
            "captcha_code": "ABC12"  # case-insensitive check
        })

    assert response.status_code == 201
    res_data = response.json()
    assert res_data["email"] == "secure@example.com"
    assert res_data["username"] == "secure_user"

@pytest.mark.asyncio
async def test_register_with_invalid_captcha_fails():
    captcha = await generate_captcha()
    _memory_captcha_store[captcha["captcha_id"]] = "abc12"

    mock_service = AsyncMock()
    app.dependency_overrides[get_user_service] = lambda: mock_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/v1/auth/register", json={
            "username": "attacker",
            "email": "attacker@example.com",
            "password": "StrongPassword123!",
            "captcha_id": captcha["captcha_id"],
            "captcha_code": "WRONG_CODE"
        })

    assert response.status_code == 400
    assert "captcha" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_register_password_complexity_failure():
    # Passwords without required complexity should fail at schema validation (422)
    weak_passwords = [
        "short1!",              # too short (<8)
        "alllowercase123!",     # missing uppercase
        "ALLUPPERCASE123!",     # missing lowercase
        "NoDigitsHere!abc",     # missing digit
        "NoSpecialChars123",    # missing special char
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for weak_pwd in weak_passwords:
            response = await ac.post("/api/v1/auth/register", json={
                "username": "weak_tester",
                "email": "weaktgt@example.com",
                "password": weak_pwd,
                "captcha_id": "dummy",
                "captcha_code": "dummy"
            })
            assert response.status_code == 422, f"Expected 422 for password {weak_pwd}, got {response.status_code}"
