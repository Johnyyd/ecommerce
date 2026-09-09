import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.v1.endpoints.orders import get_order_repository
from app.api.v1.endpoints.users import get_user_service
from app.api.deps import get_current_admin
from app.models.user import User
from app.models.order import Order
from app.core.utils import generate_uuidv7
from unittest.mock import AsyncMock
from datetime import datetime, timezone

@pytest.fixture
def mock_admin():
    return User(
        id=generate_uuidv7(),
        username="superadmin",
        email="admin@example.com",
        role="admin",
        is_active=True
    )

@pytest.mark.asyncio
async def test_admin_list_orders(mock_admin):
    mock_repo = AsyncMock()
    order_id = generate_uuidv7()
    user_id = generate_uuidv7()
    address_id = generate_uuidv7()
    
    mock_order = Order(
        id=order_id,
        user_id=user_id,
        address_id=address_id,
        total_amount=99.99,
        status="PENDING",
        payment_method="COD",
        items=[],
        payment=None
    )
    mock_repo.get_all_orders.return_value = [mock_order]
    
    app.dependency_overrides[get_current_admin] = lambda: mock_admin
    app.dependency_overrides[get_order_repository] = lambda: mock_repo
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/orders/admin")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["id"] == str(order_id)
        assert data[0]["status"] == "PENDING"
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_admin_update_order_status(mock_admin):
    mock_repo = AsyncMock()
    order_id = generate_uuidv7()
    
    mock_order = Order(
        id=order_id,
        user_id=generate_uuidv7(),
        address_id=generate_uuidv7(),
        total_amount=50.0,
        status="PROCESSING",
        payment_method="COD",
        items=[],
        payment=None
    )
    mock_repo.admin_update_status.return_value = mock_order
    
    app.dependency_overrides[get_current_admin] = lambda: mock_admin
    app.dependency_overrides[get_order_repository] = lambda: mock_repo
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.patch(f"/api/v1/orders/{order_id}/status", json={"status": "PROCESSING"})
        assert res.status_code == 200
        assert res.json()["status"] == "PROCESSING"
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_admin_list_users(mock_admin):
    mock_service = AsyncMock()
    now = datetime.now(timezone.utc)
    mock_user = User(
        id=generate_uuidv7(),
        username="customer1",
        email="customer1@example.com",
        role="customer",
        is_active=True,
        hashed_password="hash",
        created_at=now,
        updated_at=now
    )
    mock_service.get_users.return_value = [mock_user]
    
    app.dependency_overrides[get_current_admin] = lambda: mock_admin
    app.dependency_overrides[get_user_service] = lambda: mock_service
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/users/")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["username"] == "customer1"
        assert data[0]["role"] == "customer"
    
    app.dependency_overrides.clear()
