import pytest
import json
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.v1.endpoints.products import get_product_service, get_redis_client
from app.models.product import Product
from app.core.utils import generate_uuidv7
from unittest.mock import AsyncMock
from datetime import datetime, timezone

from app.api.deps import get_current_admin
from app.models.user import User

@pytest.fixture
def mock_redis():
    mock = AsyncMock()
    # By default, pretend cache is empty
    mock.get.return_value = None
    return mock

@pytest.fixture
def mock_admin_user():
    return User(
        id=generate_uuidv7(),
        username="admin",
        email="admin@example.com",
        role="admin",
        is_active=True
    )

@pytest.mark.asyncio
async def test_create_product_api(mock_redis, mock_admin_user):
    mock_service = AsyncMock()
    
    mock_product = Product(
        id=generate_uuidv7(),
        name="Test Product",
        description="A great product",
        price=19.99,
        stock_quantity=100,
        version=1
    )
    mock_service.create_product.return_value = mock_product
    
    app.dependency_overrides[get_product_service] = lambda: mock_service
    app.dependency_overrides[get_redis_client] = lambda: mock_redis
    app.dependency_overrides[get_current_admin] = lambda: mock_admin_user
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/v1/products/", json={
            "name": "Test Product",
            "description": "A great product",
            "price": 19.99,
            "stock_quantity": 100
        })
        
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Product"
    assert data["price"] == 19.99
    assert "id" in data
    
    # Assert cache invalidation was called
    mock_redis.delete.assert_called_with("products:list:0:100")
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_list_products_api(mock_redis):
    mock_service = AsyncMock()
    
    mock_product = Product(
        id=generate_uuidv7(),
        name="Test Product",
        description="A great product",
        price=19.99,
        stock_quantity=100,
        version=1
    )
    mock_service.get_products.return_value = [mock_product]
    mock_service.get_products_count.return_value = 1
    
    app.dependency_overrides[get_product_service] = lambda: mock_service
    app.dependency_overrides[get_redis_client] = lambda: mock_redis
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/products/")
        
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == "Test Product"
    assert data["total"] == 1
    
    mock_redis.get.assert_called_with("products:list:0:100")
    mock_redis.setex.assert_called_once()
    
    app.dependency_overrides.clear()
