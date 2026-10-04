import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.db import get_db_session
from app.models.order import Order, Payment
from app.core.utils import generate_uuidv7
from app.core.security_crypto import generate_payos_signature
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.config import settings

@pytest.mark.asyncio
async def test_payos_webhook_valid_hmac():
    """Test PayOS webhook with valid HMAC signature."""
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    order_code = 12345678

    # Create a mock order that matches the order_code
    mock_order = MagicMock(spec=Order)
    mock_order.id = order_id
    mock_order.status = "PENDING"
    mock_order.total_amount = 100000
    mock_order.payment = None

    # Mock get_order_code_for_uuid to return our test order_code
    with patch('app.services.payment.PaymentService.get_order_code_for_uuid', return_value=order_code):

        # Mock for idempotency check (first call) - no existing transaction
        mock_idem_result = MagicMock()
        mock_idem_result.scalars.return_value.first.return_value = None

        # Mock for order lookup (second call) - return our order
        mock_order_result = MagicMock()
        mock_order_result.scalars.return_value.all.return_value = [mock_order]

        mock_session.execute.side_effect = [mock_idem_result, mock_order_result]

        app.dependency_overrides[get_db_session] = lambda: mock_session

        # Create valid PayOS webhook payload
        webhook_data = {
            "orderCode": order_code,
            "amount": 100000,
            "description": f"DH{order_code}",
            "accountNumber": "0987654321",
            "reference": "PAYOS_12345678_1234567890",
            "transactionDateTime": "2024-01-15 10:30:00",
            "currency": "VND",
            "paymentLinkId": "plink_12345678",
            "code": "00",
            "desc": "Success"
        }

        # Generate valid HMAC signature
        signature = generate_payos_signature(webhook_data, settings.PAYOS_CHECKSUM_KEY)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/v1/payments/webhook",
                json={
                    "code": "00",
                    "desc": "Success",
                    "data": webhook_data,
                    "signature": signature
                }
            )

        print(f"Response: {response.status_code} - {response.json()}")
        # Should process successfully (amount matches)
        assert response.status_code == 200

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_payos_webhook_invalid_hmac():
    """Test PayOS webhook with invalid HMAC signature is rejected."""
    mock_session = AsyncMock()
    order_id = generate_uuidv7()

    app.dependency_overrides[get_db_session] = lambda: mock_session

    webhook_data = {
        "orderCode": 12345678,
        "amount": 100000,
        "description": "DH12345678",
        "accountNumber": "0987654321",
        "reference": "PAYOS_12345678_1234567890",
        "transactionDateTime": "2024-01-15 10:30:00",
        "currency": "VND",
        "paymentLinkId": "plink_12345678",
        "code": "00",
        "desc": "Success"
    }

    # Invalid signature
    invalid_signature = "invalid_signature_12345"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/payments/webhook",
            json={
                "code": "00",
                "desc": "Success",
                "data": webhook_data,
                "signature": invalid_signature
            }
        )

    assert response.status_code == 403
    assert "Invalid cryptographic HMAC-SHA256 signature" in response.json()["detail"]

    mock_session.execute.assert_not_called()
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_payos_webhook_idempotency():
    """Test PayOS webhook idempotency - duplicate webhooks are rejected."""
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    order_code = 12345678

    # Create a mock order that matches the order_code
    mock_order = MagicMock(spec=Order)
    mock_order.id = order_id
    mock_order.status = "PENDING"
    mock_order.total_amount = 100000
    mock_order.payment = None

    with patch('app.services.payment.PaymentService.get_order_code_for_uuid', return_value=order_code):
        # Mock for idempotency check (first call) - return existing transaction
        from app.models.payment_transaction import PaymentTransaction
        mock_tx = MagicMock(spec=PaymentTransaction)
        mock_idem_result = MagicMock()
        mock_idem_result.scalars.return_value.first.return_value = mock_tx

        # Mock for order lookup (second call) - return our order
        mock_order_result = MagicMock()
        mock_order_result.scalars.return_value.all.return_value = [mock_order]

        mock_session.execute.side_effect = [mock_idem_result, mock_order_result]

        app.dependency_overrides[get_db_session] = lambda: mock_session

        webhook_data = {
            "orderCode": order_code,
            "amount": 100000,
            "description": f"DH{order_code}",
            "accountNumber": "0987654321",
            "reference": "PAYOS_12345678_1234567890",
            "transactionDateTime": "2024-01-15 10:30:00",
            "currency": "VND",
            "paymentLinkId": "plink_12345678",
            "code": "00",
            "desc": "Success"
        }

        signature = generate_payos_signature(webhook_data, settings.PAYOS_CHECKSUM_KEY)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/v1/payments/webhook",
                json={
                    "code": "00",
                    "desc": "Success",
                    "data": webhook_data,
                    "signature": signature
                }
            )

        assert response.status_code == 200
        result = response.json()
        assert result.get("status") == "ALREADY_PROCESSED"
        assert "Webhook already processed" in result.get("message", "")

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_payos_webhook_amount_mismatch():
    """Test PayOS webhook with tampered amount is rejected."""
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    order_code = 12345678

    # Create a mock order with different amount
    mock_order = MagicMock(spec=Order)
    mock_order.id = order_id
    mock_order.status = "PENDING"
    mock_order.total_amount = 100000  # 100,000 VND
    mock_order.payment = None

    with patch('app.services.payment.PaymentService.get_order_code_for_uuid', return_value=order_code):
        # Mock for idempotency check (first call) - no existing transaction
        mock_idem_result = MagicMock()
        mock_idem_result.scalars.return_value.first.return_value = None

        # Mock for order lookup (second call) - return our order
        mock_order_result = MagicMock()
        mock_order_result.scalars.return_value.all.return_value = [mock_order]

        # Configure side_effect to return different mocks for each call
        mock_session.execute.side_effect = [mock_idem_result, mock_order_result]

        app.dependency_overrides[get_db_session] = lambda: mock_session

        # Webhook with different amount (tampered)
        webhook_data = {
            "orderCode": order_code,
            "amount": 50000,  # Different from order total!
            "description": f"DH{order_code}",
            "accountNumber": "0987654321",
            "reference": "PAYOS_12345678_1234567890",
            "transactionDateTime": "2024-01-15 10:30:00",
            "currency": "VND",
            "paymentLinkId": "plink_12345678",
            "code": "00",
            "desc": "Success"
        }

        signature = generate_payos_signature(webhook_data, settings.PAYOS_CHECKSUM_KEY)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/v1/payments/webhook",
                json={
                    "code": "00",
                    "desc": "Success",
                    "data": webhook_data,
                    "signature": signature
                }
            )

        # Should fail with 400 due to amount mismatch
        assert response.status_code == 400
        assert "Amount mismatch" in response.json()["detail"]

    app.dependency_overrides.clear()