import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.v1.endpoints.orders import get_order_repository
from app.api.v1.endpoints.users import get_user_service
from app.api.v1.endpoints.brands import get_brand_repo
from app.api.v1.endpoints.vouchers import get_voucher_repo
from app.api.deps import get_current_admin, get_current_staff
from app.models.user import User
from app.models.order import Order
from app.models.brand import Brand
from app.models.voucher import Voucher
from app.schemas.voucher import VoucherValidateResponse
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

@pytest.fixture
def mock_manager():
    return User(
        id=generate_uuidv7(),
        username="manager1",
        email="manager1@example.com",
        role="manager",
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
    
    app.dependency_overrides[get_current_staff] = lambda: mock_admin
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
    
    app.dependency_overrides[get_current_staff] = lambda: mock_admin
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
    
    app.dependency_overrides[get_current_staff] = lambda: mock_admin
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

@pytest.mark.asyncio
async def test_manager_cannot_modify_users(mock_manager):
    """Manager MUST be forbidden from modifying user roles or active status."""
    user_id = generate_uuidv7()
    # Note: get_current_admin checks user.role == 'admin'. Since mock_manager is 'manager', it must raise 403.
    # We do NOT override get_current_admin so it naturally verifies mock_manager permissions.
    from app.api.deps import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_manager

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.patch(f"/api/v1/users/{user_id}", json={"is_active": False})
        assert res.status_code == 403
        assert "privileges" in res.json()["detail"].lower()

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_manager_cannot_trigger_backup(mock_manager):
    """Manager MUST be forbidden from triggering database backup."""
    from app.api.deps import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_manager

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/admin/backups/create")
        assert res.status_code == 403

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_manager_can_create_brand(mock_manager):
    """Manager CAN manage brands."""
    mock_repo = AsyncMock()
    mock_brand = Brand(
        id=generate_uuidv7(),
        name="Nike",
        slug="nike",
        logo_url=None,
        description="Just Do It",
        website=None
    )
    mock_repo.get_by_slug.return_value = None
    mock_repo.create.return_value = mock_brand

    app.dependency_overrides[get_current_staff] = lambda: mock_manager
    app.dependency_overrides[get_brand_repo] = lambda: mock_repo

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/brands/", json={"name": "Nike", "slug": "nike"})
        assert res.status_code == 201
        assert res.json()["name"] == "Nike"

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_voucher_validation():
    """Test voucher validation endpoint."""
    mock_repo = AsyncMock()
    mock_repo.validate_voucher.return_value = VoucherValidateResponse(
        is_valid=True,
        message="Áp dụng mã thành công",
        discount_amount=10.0,
        final_amount=90.0,
        code="SAVE10"
    )
    app.dependency_overrides[get_voucher_repo] = lambda: mock_repo

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/vouchers/validate", json={"code": "SAVE10", "order_amount": 100.0})
        assert res.status_code == 200
        assert res.json()["is_valid"] is True
        assert res.json()["discount_amount"] == 10.0
        assert res.json()["final_amount"] == 90.0

    app.dependency_overrides.clear()
