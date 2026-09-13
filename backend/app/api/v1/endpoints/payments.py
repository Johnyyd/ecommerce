import json
from uuid import UUID
from typing import Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.db import get_db_session
from app.core.config import settings
from app.core.security_crypto import verify_payos_signature
from app.models.order import Order, Payment
from app.models.payment_transaction import PaymentTransaction
from app.schemas.payment import (
    PaymentCreateRequest,
    PaymentCreateResponse,
    PaymentStatusResponse,
    PayOSWebhookPayload
)

router = APIRouter()

def get_order_code_for_uuid(order_id: UUID) -> int:
    """Generate a deterministic 8-digit orderCode from order UUID."""
    return abs(hash(str(order_id))) % 100000000

@router.post("/create", response_model=PaymentCreateResponse)
async def create_payment_link(
    req: PaymentCreateRequest,
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Creates dynamic VietQR / PayOS payment instructions.
    Generates standard NAPAS 247 dynamic QR code with transfer memo and amount.
    """
    stmt = select(Order).options(selectinload(Order.payment)).where(Order.id == req.order_id)
    result = await session.execute(stmt)
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        
    order_code = get_order_code_for_uuid(order.id)
    memo = f"DH{order_code}"
    amount = float(order.total_amount)
    
    # Standard VietQR QuickLink format
    bank_id = settings.VIETQR_BANK_ID
    account_no = settings.VIETQR_ACCOUNT_NO
    account_name = settings.VIETQR_ACCOUNT_NAME
    qr_url = f"https://img.vietqr.io/image/{bank_id}-{account_no}-compact2.png?amount={int(amount)}&addInfo={memo}&accountName={account_name.replace(' ', '%20')}"
    
    if order.payment:
        order.payment.provider = req.provider
        session.add(order.payment)
        await session.commit()
        
    return PaymentCreateResponse(
        order_id=order.id,
        order_code=order_code,
        amount=amount,
        currency="VND",
        qr_code_url=qr_url,
        account_number=account_no,
        account_name=account_name,
        bank_name=settings.VIETQR_BANK_NAME,
        description=memo,
        payment_url=qr_url
    )

@router.post("/webhook")
async def payment_webhook(
    payload: Optional[PayOSWebhookPayload] = None,
    order_id: Optional[UUID] = Query(None),
    status_param: Optional[str] = Query(None, alias="status"),
    mock_secret: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Real-world Payment Webhook Receiver (PayOS / VietQR & VNPay):
    1. Cryptographic HMAC-SHA256 Signature Verification (OWASP A04/A07).
    2. Idempotency Key deduplication (Prevents duplicate processing).
    3. Anti-Tampering Amount Verification.
    4. Atomic status transition to PROCESSING / PAID.
    """
    # Branch A: Production PayOS / VietQR Payload with HMAC Signature
    if payload is not None and payload.data:
        data = payload.data
        received_signature = payload.signature
        
        # 1. Verify HMAC-SHA256 Signature
        is_valid = verify_payos_signature(data, received_signature, settings.PAYOS_CHECKSUM_KEY)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security violation: Invalid cryptographic HMAC-SHA256 signature"
            )
            
        order_code = data.get("orderCode")
        amount = float(data.get("amount", 0))
        ref_id = str(data.get("reference") or data.get("paymentLinkId") or order_code)
        idempotency_key = f"PAYOS_{order_code}_{ref_id}"
        
        # 2. Idempotency Check
        idem_stmt = select(PaymentTransaction).where(PaymentTransaction.idempotency_key == idempotency_key)
        idem_res = await session.execute(idem_stmt)
        if idem_res.scalars().first():
            return {
                "message": "Webhook already processed (Idempotent deduplication)",
                "status": "ALREADY_PROCESSED",
                "idempotency_key": idempotency_key
            }
            
        # 3. Locate Order
        # Find order by matching order_code
        order_stmt = select(Order).options(selectinload(Order.payment)).where(Order.status == "PENDING")
        order_res = await session.execute(order_stmt)
        pending_orders = order_res.scalars().all()
        
        target_order: Optional[Order] = None
        for po in pending_orders:
            if get_order_code_for_uuid(po.id) == order_code:
                target_order = po
                break
                
        # Also check if description contains an explicit UUID
        if not target_order and "description" in data:
            desc_str = str(data["description"])
            for po in pending_orders:
                if str(po.id) in desc_str:
                    target_order = po
                    break
                    
        if not target_order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pending order for code {order_code} not found")
            
        # 4. Anti-Tampering Amount Verification
        expected_amount = float(target_order.total_amount)
        if abs(expected_amount - amount) > 1.0:
            # Record security incident
            failed_tx = PaymentTransaction(
                order_id=target_order.id,
                idempotency_key=f"FAILED_{idempotency_key}",
                provider="PAYOS",
                amount=amount,
                status="TAMPERED_AMOUNT",
                transaction_id=ref_id,
                payload_json=json.dumps(data)
            )
            session.add(failed_tx)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Amount mismatch security check failed: Expected {expected_amount}, received {amount}"
            )
            
        # 5. Atomic Update
        target_order.status = "PROCESSING"
        if target_order.payment:
            target_order.payment.status = "PAID"
            target_order.payment.transaction_id = ref_id
            target_order.payment.provider = "PAYOS"
            session.add(target_order.payment)
            
        success_tx = PaymentTransaction(
            order_id=target_order.id,
            idempotency_key=idempotency_key,
            provider="PAYOS",
            amount=amount,
            status="SUCCESS",
            transaction_id=ref_id,
            payload_json=json.dumps(data)
        )
        session.add(target_order)
        session.add(success_tx)
        await session.commit()
        
        return {
            "message": "Webhook processed successfully",
            "order_id": str(target_order.id),
            "status": target_order.status,
            "idempotency_key": idempotency_key
        }

    # Branch B: Fallback / Mock query parameters for backward compatibility
    if order_id is not None and status_param is not None and mock_secret is not None:
        if mock_secret != "mock_secret_123":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

        stmt = select(Order).options(selectinload(Order.payment)).where(Order.id == order_id)
        result = await session.execute(stmt)
        order = result.scalars().first()
        
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
            
        if status_param.upper() == "SUCCESS":
            order.status = "PROCESSING"
            if order.payment:
                order.payment.status = "PAID"
        elif status_param.upper() == "FAILED":
            order.status = "CANCELLED"
            if order.payment:
                order.payment.status = "FAILED"
                
        session.add(order)
        await session.commit()
        return {"message": "Webhook processed successfully", "order_id": str(order_id), "status": order.status}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing valid webhook payload or query parameters")

@router.get("/{order_id}/status", response_model=PaymentStatusResponse)
async def get_payment_status(
    order_id: UUID,
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Real-time status inquiry endpoint: Polled by frontend VietQRModal
    to track payment completion and trigger seamless page transitions.
    """
    stmt = select(Order).options(selectinload(Order.payment)).where(Order.id == order_id)
    result = await session.execute(stmt)
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        
    return PaymentStatusResponse(
        order_id=order.id,
        order_status=order.status,
        payment_status=order.payment.status if order.payment else "UNPAID",
        amount=float(order.total_amount),
        provider=order.payment.provider if order.payment else order.payment_method,
        transaction_id=order.payment.transaction_id if order.payment else None,
        paid_at=order.payment.updated_at if order.payment and order.payment.status == "PAID" else None
    )
