import json
import logging
import hashlib
from uuid import UUID
from typing import Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
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
    PayOSWebhookPayload,
)
from app.services.payment import PaymentService
from app.core.rate_limiter import limiter

router = APIRouter()
payment_service = PaymentService()
logger = logging.getLogger(__name__)


def get_order_code_for_uuid(order_id: UUID) -> int:
    """Generate a deterministic 8-digit orderCode from order UUID using SHA256 for collision resistance."""
    # Use SHA256 hash of the UUID string, take first 8 bytes as integer
    hash_bytes = hashlib.sha256(str(order_id).encode()).digest()
    return int.from_bytes(hash_bytes[:8], byteorder='big') % 100000000


@router.post("/create", response_model=PaymentCreateResponse)
async def create_payment_link(
    req: PaymentCreateRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Creates dynamic VietQR / PayOS payment link.
    Generates standard NAPAS 247 dynamic QR code with transfer memo and amount.
    """
    try:
        # Build frontend URLs
        base_url = request.headers.get("origin", settings.FRONTEND_URL)
        return_url = f"{base_url}/payment/success"
        cancel_url = f"{base_url}/payment/cancel"

        result = await payment_service.create_payment(
            session=session,
            order_id=req.order_id,
            return_url=return_url,
            cancel_url=cancel_url,
            provider=req.provider,
        )

        return PaymentCreateResponse(
            order_id=result["order_id"],
            order_code=result["order_code"],
            amount=result["amount"],
            currency=result["currency"],
            qr_code_url=result["qr_code_url"],
            account_number=result["account_number"],
            account_name=result["account_name"],
            bank_name=result["bank_name"],
            description=result["description"],
            payment_url=result["payment_url"],
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating payment link: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create payment link")


@router.post("/webhook")
@limiter.limit("100/minute")
async def payment_webhook(
    request: Request,
    payload: Optional[PayOSWebhookPayload] = None,
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Real-world Payment Webhook Receiver (PayOS / VietQR & VNPay):
    1. Cryptographic HMAC-SHA256 Signature Verification (OWASP A04/A07).
    2. Idempotency Key deduplication (Prevents duplicate processing).
    3. Anti-Tampering Amount Verification.
    4. Atomic status transition to PROCESSING / PAID.
    """
    # Only accept production PayOS / VietQR Payload with HMAC Signature
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

        try:
            result = await payment_service.process_webhook(
                session=session,
                data=data,
                signature=received_signature,
            )
            return result
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error processing PayOS webhook: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Webhook processing failed")

    # Reject any other payload format
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Missing or invalid webhook payload. Expected PayOS/VietQR webhook format."
    )


@router.get("/{order_id}/status", response_model=PaymentStatusResponse)
async def get_payment_status(
    order_id: UUID,
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Real-time status inquiry endpoint: Polled by frontend VietQRModal
    to track payment completion and trigger seamless page transitions.
    """
    try:
        result = await payment_service.get_payment_status(session, order_id)
        return PaymentStatusResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/auto-cancel")
async def trigger_auto_cancel(
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Trigger auto-cancel for expired pending orders (older than 15 minutes).
    This endpoint can be called by a cron job or scheduled task.
    """
    try:
        cancelled_count = await payment_service.auto_cancel_expired_orders(session)
        return {
            "message": f"Auto-cancelled {cancelled_count} expired orders",
            "cancelled_count": cancelled_count,
        }
    except Exception as e:
        logger.error(f"Error in auto-cancel: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Auto-cancel failed")


@router.post("/{order_id}/refund")
async def refund_payment(
    order_id: UUID,
    reason: str = "Customer requested refund",
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Process a refund for a paid order.
    """
    try:
        result = await payment_service.refund_payment(session, order_id, reason)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing refund: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Refund failed")