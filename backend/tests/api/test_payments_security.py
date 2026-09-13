import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock
from app.main import app
from app.core.db import get_db_session
from app.core.config import settings
from app.core.security_crypto import generate_payos_signature
from app.models.order import Order, Payment
from app.models.payment_transaction import PaymentTransaction
from app.core.utils import generate_uuidv7
from app.api.v1.endpoints.payments import get_order_code_for_uuid

@pytest.mark.asyncio
async def test_create_vietqr_payment_link():
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    
    mock_order = Order(
        id=order_id,
        user_id=generate_uuidv7(),
        address_id=generate_uuidv7(),
        total_amount=250000.0,
        status="PENDING",
        payment_method="VIETQR"
    )
    mock_order.payment = Payment(
        id=generate_uuidv7(),
        order_id=order_id,
        status="PENDING",
        provider="VIETQR"
    )

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = mock_order
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result
    
    app.dependency_overrides[get_db_session] = lambda: mock_session
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/payments/create", json={
            "order_id": str(order_id),
            "provider": "VIETQR"
        })
        
    assert res.status_code == 200
    data = res.json()
    assert data["order_id"] == str(order_id)
    assert "img.vietqr.io" in data["qr_code_url"]
    assert data["amount"] == 250000.0
    assert data["currency"] == "VND"
    assert "DH" in data["description"]
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_payos_webhook_valid_hmac_signature():
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    order_code = get_order_code_for_uuid(order_id)
    
    mock_order = Order(
        id=order_id,
        user_id=generate_uuidv7(),
        address_id=generate_uuidv7(),
        total_amount=500000.0,
        status="PENDING",
        payment_method="PAYOS"
    )
    mock_order.payment = Payment(
        id=generate_uuidv7(),
        order_id=order_id,
        status="PENDING",
        provider="PAYOS"
    )

    # First call: idempotency check returns None (not processed yet)
    idem_result = MagicMock()
    idem_scalars = MagicMock()
    idem_scalars.first.return_value = None
    idem_result.scalars.return_value = idem_scalars

    # Second call: returns list of pending orders
    orders_result = MagicMock()
    orders_scalars = MagicMock()
    orders_scalars.all.return_value = [mock_order]
    orders_result.scalars.return_value = orders_scalars

    mock_session.execute.side_effect = [idem_result, orders_result]
    
    app.dependency_overrides[get_db_session] = lambda: mock_session
    
    webhook_data = {
        "orderCode": order_code,
        "amount": 500000,
        "description": f"DH{order_code}",
        "reference": "TXN_REAL_987654",
        "currency": "VND"
    }
    signature = generate_payos_signature(webhook_data, settings.PAYOS_CHECKSUM_KEY)
    
    payload = {
        "code": "00",
        "desc": "success",
        "data": webhook_data,
        "signature": signature
    }
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/payments/webhook", json=payload)
        
    assert res.status_code == 200
    assert res.json()["status"] == "PROCESSING"
    assert mock_order.status == "PROCESSING"
    assert mock_order.payment.status == "PAID"
    assert mock_order.payment.transaction_id == "TXN_REAL_987654"
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_payos_webhook_invalid_hmac_signature_rejected():
    mock_session = AsyncMock()
    app.dependency_overrides[get_db_session] = lambda: mock_session
    
    webhook_data = {
        "orderCode": 12345678,
        "amount": 500000,
        "description": "DH12345678",
        "reference": "TXN_FAKE_111"
    }
    
    payload = {
        "code": "00",
        "desc": "success",
        "data": webhook_data,
        "signature": "tampered_fake_signature_hex_123456"
    }
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/payments/webhook", json=payload)
        
    # Must reject with 403 Forbidden under OWASP A04/A07 Cryptographic Integrity
    assert res.status_code == 403
    assert "Invalid cryptographic HMAC-SHA256 signature" in res.json()["detail"]
    mock_session.execute.assert_not_called()
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_payos_webhook_idempotency_prevents_duplicate_processing():
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    order_code = get_order_code_for_uuid(order_id)
    
    # Existing transaction found
    existing_tx = PaymentTransaction(
        id=generate_uuidv7(),
        order_id=order_id,
        idempotency_key=f"PAYOS_{order_code}_TXN_DUP_001",
        provider="PAYOS",
        amount=300000.0,
        status="SUCCESS"
    )

    idem_result = MagicMock()
    idem_scalars = MagicMock()
    idem_scalars.first.return_value = existing_tx
    idem_result.scalars.return_value = idem_scalars
    mock_session.execute.return_value = idem_result

    app.dependency_overrides[get_db_session] = lambda: mock_session
    
    webhook_data = {
        "orderCode": order_code,
        "amount": 300000,
        "description": f"DH{order_code}",
        "reference": "TXN_DUP_001"
    }
    signature = generate_payos_signature(webhook_data, settings.PAYOS_CHECKSUM_KEY)
    
    payload = {
        "code": "00",
        "desc": "success",
        "data": webhook_data,
        "signature": signature
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/payments/webhook", json=payload)

    assert res.status_code == 200
    assert res.json()["status"] == "ALREADY_PROCESSED"
    # Ensure commit was not called again
    mock_session.commit.assert_not_called()

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_payos_webhook_amount_tampering_rejected():
    mock_session = AsyncMock()
    order_id = generate_uuidv7()
    order_code = get_order_code_for_uuid(order_id)
    
    mock_order = Order(
        id=order_id,
        user_id=generate_uuidv7(),
        address_id=generate_uuidv7(),
        total_amount=1000000.0,  # Expected 1,000,000 VND
        status="PENDING",
        payment_method="PAYOS"
    )
    mock_order.payment = Payment(
        id=generate_uuidv7(),
        order_id=order_id,
        status="PENDING",
        provider="PAYOS"
    )

    idem_result = MagicMock()
    idem_scalars = MagicMock()
    idem_scalars.first.return_value = None
    idem_result.scalars.return_value = idem_scalars

    orders_result = MagicMock()
    orders_scalars = MagicMock()
    orders_scalars.all.return_value = [mock_order]
    orders_result.scalars.return_value = orders_scalars

    mock_session.execute.side_effect = [idem_result, orders_result]
    app.dependency_overrides[get_db_session] = lambda: mock_session

    # Attacker pays only 10,000 VND instead of 1,000,000 VND
    webhook_data = {
        "orderCode": order_code,
        "amount": 10000,
        "description": f"DH{order_code}",
        "reference": "TXN_TAMPERED"
    }
    signature = generate_payos_signature(webhook_data, settings.PAYOS_CHECKSUM_KEY)
    
    payload = {
        "code": "00",
        "desc": "success",
        "data": webhook_data,
        "signature": signature
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/payments/webhook", json=payload)

    # Must reject with 400 Bad Request
    assert res.status_code == 400
    assert "Amount mismatch security check failed" in res.json()["detail"]
    assert mock_order.status == "PENDING"

    app.dependency_overrides.clear()
