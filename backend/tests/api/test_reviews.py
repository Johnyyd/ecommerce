import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock
from app.main import app
from app.core.db import get_db_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.review import Review
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.core.utils import generate_uuidv7

@pytest.fixture
def test_user():
    return User(
        id=generate_uuidv7(),
        username="buyer_one",
        email="buyer@test.com",
        role="customer",
        is_active=True
    )

@pytest.fixture
def other_user():
    return User(
        id=generate_uuidv7(),
        username="hacker_two",
        email="hacker@test.com",
        role="customer",
        is_active=True
    )

@pytest.mark.asyncio
async def test_get_product_reviews_public():
    mock_session = AsyncMock()
    product_id = generate_uuidv7()
    
    from datetime import datetime, timezone
    mock_review = Review(
        id=generate_uuidv7(),
        product_id=product_id,
        user_id=generate_uuidv7(),
        order_id=generate_uuidv7(),
        rating=5,
        comment="Incredible craftsmanship and texture!",
        is_verified_purchase=True,
        created_at=datetime.now(timezone.utc)
    )
    mock_review.user = User(id=mock_review.user_id, username="alice", email="a@test.com", role="customer", is_active=True)

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [mock_review]
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db_session] = lambda: mock_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/reviews/product/{product_id}")

    assert res.status_code == 200
    data = res.json()
    assert data["total_reviews"] == 1
    assert data["average_rating"] == 5.0
    assert data["reviews"][0]["comment"] == "Incredible craftsmanship and texture!"
    assert data["reviews"][0]["is_verified_purchase"] is True
    assert data["reviews"][0]["username"] == "alice"

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_create_review_unverified_order_rejected(test_user):
    mock_session = AsyncMock()
    product_id = generate_uuidv7()
    order_id = generate_uuidv7()

    # Order exists but order status is PENDING (not delivered)
    mock_order = Order(
        id=order_id,
        user_id=test_user.id,
        address_id=generate_uuidv7(),
        total_amount=100.0,
        status="PENDING",
        payment_method="COD"
    )
    mock_order.items = [
        OrderItem(id=generate_uuidv7(), order_id=order_id, product_id=product_id, quantity=1, unit_price=100.0)
    ]

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = mock_order
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db_session] = lambda: mock_session
    app.dependency_overrides[get_current_user] = lambda: test_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/reviews/", json={
            "product_id": str(product_id),
            "order_id": str(order_id),
            "rating": 5,
            "comment": "Nice product"
        })

    # Must reject because order is still PENDING
    assert res.status_code == 400
    assert "Reviews can only be submitted for completed orders" in res.json()["detail"]

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_create_review_product_not_in_order_rejected(test_user):
    mock_session = AsyncMock()
    product_id = generate_uuidv7()
    other_product_id = generate_uuidv7()
    order_id = generate_uuidv7()

    # Order is DELIVERED, but purchased other_product_id, not product_id
    mock_order = Order(
        id=order_id,
        user_id=test_user.id,
        address_id=generate_uuidv7(),
        total_amount=100.0,
        status="DELIVERED",
        payment_method="COD"
    )
    mock_order.items = [
        OrderItem(id=generate_uuidv7(), order_id=order_id, product_id=other_product_id, quantity=1, unit_price=100.0)
    ]

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = mock_order
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db_session] = lambda: mock_session
    app.dependency_overrides[get_current_user] = lambda: test_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/reviews/", json={
            "product_id": str(product_id),
            "order_id": str(order_id),
            "rating": 5,
            "comment": "Did not buy this"
        })

    assert res.status_code == 400
    assert "Specified product was not purchased in this order" in res.json()["detail"]

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_create_review_verified_purchase_success(test_user):
    mock_session = AsyncMock()
    product_id = generate_uuidv7()
    order_id = generate_uuidv7()

    mock_order = Order(
        id=order_id,
        user_id=test_user.id,
        address_id=generate_uuidv7(),
        total_amount=150.0,
        status="DELIVERED",
        payment_method="COD"
    )
    mock_order.items = [
        OrderItem(id=generate_uuidv7(), order_id=order_id, product_id=product_id, quantity=1, unit_price=150.0)
    ]

    # Order lookup
    order_res = MagicMock()
    order_scalars = MagicMock()
    order_scalars.first.return_value = mock_order
    order_res.scalars.return_value = order_scalars

    # Existing review lookup returns None
    review_res = MagicMock()
    review_scalars = MagicMock()
    review_scalars.first.return_value = None
    review_res.scalars.return_value = review_scalars

    # Avg rating query
    avg_res = MagicMock()
    avg_res.scalar.return_value = 5.0

    # Product query
    prod_res = MagicMock()
    prod_scalars = MagicMock()
    prod_scalars.first.return_value = Product(id=product_id, name="Cashmere Cardigan", price=150.0, rating=0.0)
    prod_res.scalars.return_value = prod_scalars

    mock_session.execute.side_effect = [order_res, review_res, avg_res, prod_res]

    app.dependency_overrides[get_db_session] = lambda: mock_session
    app.dependency_overrides[get_current_user] = lambda: test_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/reviews/", json={
            "product_id": str(product_id),
            "order_id": str(order_id),
            "rating": 5,
            "comment": "Verified and perfect fit!"
        })

    assert res.status_code == 201
    data = res.json()
    assert data["product_id"] == str(product_id)
    assert data["rating"] == 5
    assert data["comment"] == "Verified and perfect fit!"
    assert data["is_verified_purchase"] is True
    assert data["username"] == "buyer_one"

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_delete_review_bola_idor_protection(test_user, other_user):
    mock_session = AsyncMock()
    review_id = generate_uuidv7()

    # Review belongs to test_user
    mock_review = Review(
        id=review_id,
        product_id=generate_uuidv7(),
        user_id=test_user.id,
        order_id=generate_uuidv7(),
        rating=5,
        comment="Alice review",
        is_verified_purchase=True
    )

    review_res = MagicMock()
    review_scalars = MagicMock()
    review_scalars.first.return_value = mock_review
    review_res.scalars.return_value = review_scalars
    mock_session.execute.return_value = review_res

    app.dependency_overrides[get_db_session] = lambda: mock_session
    # Hacker / other_user tries to delete test_user's review
    app.dependency_overrides[get_current_user] = lambda: other_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.delete(f"/api/v1/reviews/{review_id}")

    # Must reject with 403 Forbidden under OWASP A01 BOLA/IDOR
    assert res.status_code == 403
    assert "Access denied: You cannot delete another user's review" in res.json()["detail"]

    app.dependency_overrides.clear()
