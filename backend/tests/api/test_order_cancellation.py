import pytest
import asyncio
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
async def test_concurrent_order_cancellation(mock_customer):
    mock_order_repo = AsyncMock()
    
    order_id = generate_uuidv7()
    
    # Simulate DB pessimistic lock: first call succeeds, second call fails
    # because the order status would have been changed by the first transaction.
    call_count = 0
    
    async def fake_cancel_order(order_id: str, user_id: str):
        nonlocal call_count
        call_count += 1
        my_call = call_count
        # To simulate a lock, we pretend a delay for the first one
        await asyncio.sleep(0.1)
        if my_call > 1:
            raise ValueError("Order cannot be cancelled")
        
        return Order(
            id=order_id,
            user_id=mock_customer.id,
            address_id=generate_uuidv7(),
            total_amount=20.0,
            status="CANCELLED",
            payment_method="COD",
            items=[
                OrderItem(
                    id=generate_uuidv7(),
                    order_id=order_id,
                    product_id=generate_uuidv7(),
                    quantity=2,
                    unit_price=10.0
                )
            ]
        )
    
    mock_order_repo.cancel_order.side_effect = fake_cancel_order
    
    app.dependency_overrides[get_order_repository] = lambda: mock_order_repo
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        req1 = ac.post(f"/api/v1/orders/{order_id}/cancel")
        req2 = ac.post(f"/api/v1/orders/{order_id}/cancel")
        
        results = await asyncio.gather(req1, req2, return_exceptions=True)
        
    status_codes = [r.status_code for r in results]
    assert 200 in status_codes
    assert 400 in status_codes
    
    assert mock_order_repo.cancel_order.call_count == 2
    
    app.dependency_overrides.clear()
