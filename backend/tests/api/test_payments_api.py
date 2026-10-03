import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.db import get_db_session
from app.models.order import Order, Payment
from app.core.utils import generate_uuidv7
from unittest.mock import AsyncMock, MagicMock

@pytest.mark.asyncio
async def test_payment_webhook_mock_removed():
    """Test that the mock webhook endpoint has been removed for security."""
    # The mock webhook was removed for security reasons (hardcoded secret)
    # This test verifies that the old mock webhook format is rejected
    mock_session = AsyncMock()
    order_id = generate_uuidv7()

    app.dependency_overrides[get_db_session] = lambda: mock_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Old mock webhook format should now return 400 (invalid payload)
        response = await ac.post(f"/api/v1/payments/webhook?order_id={order_id}&status=SUCCESS&mock_secret=mock_secret_123")

    assert response.status_code == 400
    assert "Missing or invalid webhook payload" in response.json()["detail"]

    mock_session.execute.assert_not_called()
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_payment_webhook_invalid_payload():
    """Test that invalid webhook payloads are rejected."""
    mock_session = AsyncMock()
    order_id = generate_uuidv7()

    app.dependency_overrides[get_db_session] = lambda: mock_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/payments/webhook?order_id={order_id}&status=SUCCESS&mock_secret=wrong_secret")

    assert response.status_code == 400

    mock_session.execute.assert_not_called()
    app.dependency_overrides.clear()
