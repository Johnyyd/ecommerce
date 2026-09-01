import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.v1.endpoints.users import get_user_service
from app.schemas.user import UserCreate
from app.models.user import User
from app.core.utils import generate_uuidv7
from unittest.mock import AsyncMock
from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_create_user_api():
    # Mock the UserService
    mock_service = AsyncMock()
    
    mock_user = User(
        id=generate_uuidv7(),
        username="testapiuser",
        email="api@example.com",
        is_active=True,
        deleted_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    mock_service.create_user.return_value = mock_user
    
    # Override dependency
    app.dependency_overrides[get_user_service] = lambda: mock_service
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/v1/users/", json={
            "username": "testapiuser",
            "email": "api@example.com",
            "password": "StrongPassword123!"
        })
        
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "api@example.com"
    assert data["username"] == "testapiuser"
    assert "id" in data
    
    # Clean up override
    app.dependency_overrides.clear()
