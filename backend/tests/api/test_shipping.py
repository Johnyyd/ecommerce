import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone
from app.main import app
from app.core.db import get_db_session
from app.api.deps import get_current_user, get_current_staff
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.review import Review
from app.core.utils import generate_uuidv7

@pytest.fixture
def admin_user():
    return User(
        id=generate_uuidv7(),
        username="admin_boss",
        email="admin@test.com",
        role="admin",
        is_active=True
    )

@pytest.fixture
def customer_user():
    return User(
        id=generate_uuidv7(),
        username="normal_customer",
        email="customer@test.com",
        role="customer",
        is_active=True
    )

@pytest.mark.asyncio
async def test_calculate_shipping_fee():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/shipping/calculate-fee",
            json={"to_district_id": 1444, "to_ward_code": "20308", "weight_grams": 1000}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "GHN"
    assert "fee_vnd" in data
    assert "fee_usd" in data
    assert data["fee_usd"] > 0

@pytest.mark.asyncio
async def test_fulfill_order_shipping_as_admin(admin_user):
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    user_id = generate_uuidv7()
    address_id = generate_uuidv7()

    mock_order = Order(
        id=order_id,
        user_id=user_id,
        address_id=address_id,
        total_amount=150.0,
        status="PROCESSING",
        payment_method="COD",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    mock_order.items = []
    mock_order.payment = None
    mock_order.address = None

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = mock_order
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db_session] = lambda: mock_session
    app.dependency_overrides[get_current_staff] = lambda: admin_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            f"/api/v1/shipping/orders/{order_id}/fulfill"
        )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SHIPPED"
    assert data["shipping_provider"] == "GHN"
    assert data["tracking_code"] is not None
    assert data["tracking_code"].startswith("GHN")
    assert data["shipping_status"] == "READY_TO_PICK"

@pytest.mark.asyncio
async def test_fulfill_order_shipping_forbidden_for_customer(customer_user):
    order_id = generate_uuidv7()
    app.dependency_overrides[get_current_user] = lambda: customer_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            f"/api/v1/shipping/orders/{order_id}/fulfill"
        )

    app.dependency_overrides.clear()
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_get_tracking_timeline_by_code():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = None
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db_session] = lambda: mock_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/shipping/tracking/GHN88492041")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["tracking_code"] == "GHN88492041"
    assert data["carrier_code"] == "GHN"
    assert len(data["timeline"]) == 5
    assert data["timeline"][0]["status_code"] == "READY_TO_PICK"

@pytest.mark.asyncio
async def test_admin_all_reviews_endpoint(admin_user):
    mock_session = AsyncMock()
    mock_review = Review(
        id=generate_uuidv7(),
        product_id=generate_uuidv7(),
        user_id=generate_uuidv7(),
        order_id=generate_uuidv7(),
        rating=5,
        comment="Great material!",
        is_verified_purchase=True,
        created_at=datetime.now(timezone.utc)
    )
    mock_review.product = Product(
        id=mock_review.product_id,
        name="Test T-Shirt",
        price=35.0,
        stock_quantity=100
    )
    mock_review.user = User(
        id=mock_review.user_id,
        username="buyer_test",
        email="buyer@test.com",
        role="customer",
        is_active=True
    )

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [mock_review]
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db_session] = lambda: mock_session
    app.dependency_overrides[get_current_staff] = lambda: admin_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/reviews/admin/all")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["product_name"] == "Test T-Shirt"
    assert data[0]["username"] == "buyer_test"
    assert data[0]["rating"] == 5

@pytest.mark.asyncio
async def test_order_tracking_bola_idor_protection(customer_user):
    # Customer tries to track an order owned by someone else
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    other_user_id = generate_uuidv7()

    mock_order = Order(
        id=order_id,
        user_id=other_user_id, # Belongs to someone else!
        total_amount=99.0,
        status="SHIPPED",
        payment_method="COD",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    mock_order.items = []
    mock_order.payment = None
    mock_order.tracking_code = "GHN99887766"

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = mock_order
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db_session] = lambda: mock_session
    app.dependency_overrides[get_current_user] = lambda: customer_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(f"/api/v1/shipping/orders/{order_id}/tracking")

    app.dependency_overrides.clear()
    assert response.status_code == 403
    assert response.json()["detail"] == "Access denied"

@pytest.mark.asyncio
async def test_order_tracking_own_order_success(customer_user):
    # Customer tracks their own order
    mock_session = AsyncMock()
    order_id = generate_uuidv7()

    mock_order = Order(
        id=order_id,
        user_id=customer_user.id, # Customer's own order
        total_amount=99.0,
        status="SHIPPED",
        payment_method="COD",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    mock_order.items = []
    mock_order.payment = None
    mock_order.tracking_code = "GHN12345678"

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = mock_order
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db_session] = lambda: mock_session
    app.dependency_overrides[get_current_user] = lambda: customer_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(f"/api/v1/shipping/orders/{order_id}/tracking")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["tracking_code"] == "GHN12345678"
    assert len(data["timeline"]) == 5

