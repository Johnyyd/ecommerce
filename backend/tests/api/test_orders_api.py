import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.v1.endpoints.orders import get_order_repository
from app.models.order import Order, OrderItem
from app.core.utils import generate_uuidv7
from unittest.mock import AsyncMock

from app.api.deps import get_current_user
from app.models.user import User

@pytest.fixture
def mock_customer():
    return User(
        id=generate_uuidv7(),
        username="customer",
        email="customer@example.com",
        role="customer",
        is_active=True
    )

@pytest.mark.asyncio
async def test_create_order_api(mock_customer):
    mock_repo = AsyncMock()
    
    mock_order = Order(
        id=generate_uuidv7(),
        user_id=mock_customer.id,
        total_amount=39.98,
        status="COMPLETED",
        address_id=generate_uuidv7(),
        payment_method="COD",
        items=[
            OrderItem(
                id=generate_uuidv7(),
                order_id=generate_uuidv7(),
                product_id=generate_uuidv7(),
                quantity=2,
                unit_price=19.99
            )
        ]
    )
    mock_repo.create_order_with_transaction.return_value = mock_order
    
    app.dependency_overrides[get_order_repository] = lambda: mock_repo
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/v1/orders/", json={
            "items": [
                {
                    "product_id": str(mock_order.items[0].product_id),
                    "quantity": 2
                }
            ],
            "address_id": str(generate_uuidv7()),
            "payment_method": "COD"
        })
        
    assert response.status_code == 201
    data = response.json()
    assert data["total_amount"] == 39.98
    assert data["status"] == "COMPLETED"
    assert len(data["items"]) == 1
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_create_order_insufficient_stock(mock_customer):
    mock_repo = AsyncMock()
    mock_repo.create_order_with_transaction.side_effect = ValueError("Insufficient stock for product Test")
    
    app.dependency_overrides[get_order_repository] = lambda: mock_repo
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/v1/orders/", json={
            "items": [
                {
                    "product_id": str(generate_uuidv7()),
                    "quantity": 9999
                }
            ],
            "address_id": str(generate_uuidv7()),
            "payment_method": "COD"
        })
        
    assert response.status_code == 400
    assert "Insufficient stock" in response.json()["detail"]
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_update_order_payment_method_success(mock_customer):
    mock_repo = AsyncMock()
    order_id = generate_uuidv7()
    updated_order = Order(
        id=order_id,
        user_id=mock_customer.id,
        total_amount=50.0,
        status="PENDING",
        address_id=generate_uuidv7(),
        payment_method="COD",
        items=[]
    )
    mock_repo.update_payment_method.return_value = updated_order

    app.dependency_overrides[get_order_repository] = lambda: mock_repo
    app.dependency_overrides[get_current_user] = lambda: mock_customer

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.patch(f"/api/v1/orders/{order_id}/payment-method", json={
            "payment_method": "COD"
        })

    assert response.status_code == 200
    data = response.json()
    assert data["payment_method"] == "COD"
    assert data["status"] == "PENDING"
    mock_repo.update_payment_method.assert_called_once_with(order_id, mock_customer.id, "COD")

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_update_order_payment_method_not_allowed(mock_customer):
    mock_repo = AsyncMock()
    order_id = generate_uuidv7()
    mock_repo.update_payment_method.side_effect = ValueError("Cannot change payment method for order in COMPLETED state")

    app.dependency_overrides[get_order_repository] = lambda: mock_repo
    app.dependency_overrides[get_current_user] = lambda: mock_customer

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.patch(f"/api/v1/orders/{order_id}/payment-method", json={
            "payment_method": "VNPAY"
        })

    assert response.status_code == 400
    assert "Cannot change payment method" in response.json()["detail"]

    app.dependency_overrides.clear()

