import pytest
import json
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.v1.endpoints.products import get_product_service, get_redis_client
from app.models.product import Product
from app.core.utils import generate_uuidv7
from unittest.mock import AsyncMock
from datetime import datetime, timezone

@pytest.fixture
def mock_redis():
    mock = AsyncMock()
    # By default, pretend cache is empty
    mock.get.return_value = None
    return mock

@pytest.mark.asyncio
async def test_create_product_api(mock_redis):
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
    
    app.dependency_overrides[get_product_service] = lambda: mock_service
    app.dependency_overrides[get_redis_client] = lambda: mock_redis
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/products/")
        
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test Product"
    
    mock_redis.get.assert_called_with("products:list:0:100")
    mock_redis.setex.assert_called_once()
    
    app.dependency_overrides.clear()
