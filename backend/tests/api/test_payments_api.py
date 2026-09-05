import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.db import get_db_session
from app.models.order import Order, Payment
from app.core.utils import generate_uuidv7
from unittest.mock import AsyncMock, MagicMock

@pytest.mark.asyncio
async def test_payment_webhook_success():
    mock_session = AsyncMock()
    
    order_id = generate_uuidv7()
    
    mock_order = Order(
        id=order_id,
        user_id=generate_uuidv7(),
        address_id=generate_uuidv7(),
        total_amount=100.0,
        status="PENDING",
        payment_method="VNPAY"
    )
    mock_payment = Payment(
        id=generate_uuidv7(),
        order_id=order_id,
        status="PENDING",
        provider="VNPAY"
    )
    mock_order.payment = mock_payment
    
    # Mock session.execute().scalars().first()
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = mock_order
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result
    
    app.dependency_overrides[get_db_session] = lambda: mock_session
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/payments/webhook?order_id={order_id}&status=SUCCESS&mock_secret=mock_secret_123")
        
    assert response.status_code == 200
    assert response.json()["status"] == "PROCESSING"
    
    # Ensure order status is updated
    assert mock_order.status == "PROCESSING"
    assert mock_payment.status == "PAID"
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_payment_webhook_invalid_secret():
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    
    app.dependency_overrides[get_db_session] = lambda: mock_session
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/payments/webhook?order_id={order_id}&status=SUCCESS&mock_secret=wrong_secret")
        
    assert response.status_code == 403
    
    mock_session.execute.assert_not_called()
    
    app.dependency_overrides.clear()
