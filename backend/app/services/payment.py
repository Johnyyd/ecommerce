"""PayOS Payment Gateway Service.

Integrates with PayOS (VietQR Open Banking) for payment processing.
Handles: payment link creation, webhook verification, auto-cancel, refunds.
"""

import hmac
import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from uuid import UUID

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security_crypto import (
    create_signature_string,
    generate_payos_signature,
    verify_payos_signature,
)
from app.models.order import Order, Payment
from app.models.payment_transaction import PaymentTransaction

logger = logging.getLogger(__name__)


class PayOSService:
    """PayOS payment gateway integration."""

    BASE_URL = "https://api-merchant.payos.vn/v2"

    def __init__(self):
        self.client_id = settings.PAYOS_CLIENT_ID
        self.api_key = settings.PAYOS_API_KEY
        self.checksum_key = settings.PAYOS_CHECKSUM_KEY

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for PayOS API requests."""
        return {
            "x-client-id": self.client_id,
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def create_payment_link(
        self,
        order_code: int,
        amount: int,
        description: str,
        return_url: str,
        cancel_url: str,
        expired_at: Optional[int] = None,
        buyer_name: Optional[str] = None,
        buyer_email: Optional[str] = None,
        buyer_phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a payment link via PayOS API.

        Args:
            order_code: Unique order identifier (8-digit)
            amount: Transaction amount in VND
            description: Payment description
            return_url: URL to redirect on success
            cancel_url: URL to redirect on cancel
            expired_at: Unix timestamp for link expiration (default: AUTO_CANCEL_MINUTES from config)
            buyer_name: Buyer name
            buyer_email: Buyer email
            buyer_phone: Buyer phone

        Returns:
            Dictionary with checkoutUrl, qrCode, paymentLinkId
        """
        if expired_at is None:
            # Default expiration from config
            from app.core.config import settings
            expired_at = int((datetime.utcnow() + timedelta(minutes=settings.AUTO_CANCEL_MINUTES)).timestamp())

        payload = {
            "orderCode": order_code,
            "amount": amount,
            "description": description,
            "returnUrl": return_url,
            "cancelUrl": cancel_url,
            "expiredAt": expired_at,
        }

        if buyer_name:
            payload["buyerName"] = buyer_name
        if buyer_email:
            payload["buyerEmail"] = buyer_email
        if buyer_phone:
            payload["buyerPhone"] = buyer_phone

        # Generate HMAC signature
        sign_str = create_signature_string(payload)
        payload["signature"] = generate_payos_signature(payload, self.checksum_key)

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.BASE_URL}/payment-requests",
                    headers=self._get_headers(),
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                # Verify response signature
                if "signature" in data:
                    response_data = data.get("data", {})
                    expected_sig = generate_payos_signature(response_data, self.checksum_key)
                    if not hmac.compare_digest(expected_sig.lower(), data["signature"].lower()):
                        logger.warning("PayOS response signature verification failed")
                        raise ValueError("Invalid response signature from PayOS")

                return data

            except httpx.HTTPStatusError as e:
                logger.error(f"PayOS API error: {e.response.status_code} - {e.response.text}")
                raise
            except httpx.RequestError as e:
                logger.error(f"PayOS request failed: {e}")
                raise

    async def cancel_payment_link(
        self,
        payment_link_id: str,
        cancellation_reason: str = "Auto-cancelled after 15 minutes"
    ) -> Dict[str, Any]:
        """Cancel a payment link via PayOS API.

        Args:
            payment_link_id: PayOS payment link ID or orderCode
            cancellation_reason: Reason for cancellation

        Returns:
            Dictionary with cancelled payment details
        """
        payload = {
            "cancellationReason": cancellation_reason,
        }
        sign_str = create_signature_string(payload)
        payload["signature"] = generate_payos_signature(payload, self.checksum_key)

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.BASE_URL}/payment-requests/{payment_link_id}/cancel",
                    headers=self._get_headers(),
                    json=payload,
                )
                response.raise_for_status()
                return response.json()

            except httpx.HTTPStatusError as e:
                logger.error(f"PayOS cancel error: {e.response.status_code} - {e.response.text}")
                raise
            except httpx.RequestError as e:
                logger.error(f"PayOS cancel request failed: {e}")
                raise

    async def get_payment_link_info(self, payment_link_id: str) -> Dict[str, Any]:
        """Get payment link information from PayOS.

        Args:
            payment_link_id: PayOS payment link ID or orderCode

        Returns:
            Dictionary with payment link details
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/payment-requests/{payment_link_id}",
                    headers=self._get_headers(),
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"PayOS get info error: {e.response.status_code} - {e.response.text}")
                raise
            except httpx.RequestError as e:
                logger.error(f"PayOS get info request failed: {e}")
                raise

    def verify_webhook_signature(self, payload: Dict[str, Any], signature: str) -> bool:
        """Verify PayOS webhook signature.

        Args:
            payload: Webhook data payload
            signature: Received signature

        Returns:
            True if valid, False otherwise
        """
        return verify_payos_signature(payload, signature, self.checksum_key)


class PaymentService:
    """High-level payment service coordinating PayOS integration."""

    def __init__(self):
        self.payos = PayOSService()

    @staticmethod
    def generate_payment_url(order_id: UUID, amount: float, payment_method: str) -> str:
        """Generate a payment URL for an order based on payment method.

        Args:
            order_id: Order UUID
            amount: Order amount in VND
            payment_method: Payment method (COD, PAYOS, VIETQR, etc.)

        Returns:
            Payment URL string
        """
        from app.core.config import settings

        order_code = abs(hash(str(order_id))) % 100000000
        description = f"DH{order_code}"

        if payment_method == "PAYOS":
            # For PAYOS, the frontend will redirect to the payment URL from create_payment
            # This is a placeholder - actual payment URL is returned by create_payment
            base_url = settings.FRONTEND_URL
            return f"{base_url}/payment/payos/{order_code}"
        elif payment_method == "VIETQR":
            # Direct VietQR URL
            memo = f"DH{order_code}"
            bank_id = settings.VIETQR_BANK_ID
            account_no = settings.VIETQR_ACCOUNT_NO
            account_name = settings.VIETQR_ACCOUNT_NAME
            qr_url = f"https://img.vietqr.io/image/{bank_id}-{account_no}-compact2.png?amount={int(amount)}&addInfo={memo}&accountName={account_name.replace(' ', '%20')}"
            return qr_url
        else:
            # COD or other methods - return frontend payment page
            base_url = settings.FRONTEND_URL
            return f"{base_url}/payment/{payment_method.lower()}/{order_code}"

    def get_order_code_for_uuid(self, order_id: UUID) -> int:
        """Generate a deterministic 8-digit orderCode from order UUID using SHA256 for collision resistance."""
        # Use SHA256 hash of the UUID string, take first 8 bytes as integer
        import hashlib
        hash_bytes = hashlib.sha256(str(order_id).encode()).digest()
        return int.from_bytes(hash_bytes[:8], byteorder='big') % 100000000

    async def create_payment(
        self,
        session: AsyncSession,
        order_id: UUID,
        return_url: str,
        cancel_url: str,
        provider: str = "PAYOS",
        buyer_name: Optional[str] = None,
        buyer_email: Optional[str] = None,
        buyer_phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a payment link for an order.

        Args:
            session: Database session
            order_id: Order UUID
            return_url: Frontend success redirect URL
            cancel_url: Frontend cancel redirect URL
            provider: Payment provider (PAYOS, VIETQR)
            buyer_name: Buyer name
            buyer_email: Buyer email
            buyer_phone: Buyer phone

        Returns:
            Dictionary with payment details including checkoutUrl and qrCode
        """
        order = await self._get_valid_order(session, order_id)
        order_code = self.get_order_code_for_uuid(order.id)
        amount = int(order.total_amount)
        description = f"DH{order_code}"

        if provider == "PAYOS":
            return await self._create_payos_payment(
                session, order, order_code, amount, description,
                return_url, cancel_url, buyer_name, buyer_email, buyer_phone
            )

        return await self._create_vietqr_payment(
            session, order, order_code, amount, description
        )

    async def _get_valid_order(self, session: AsyncSession, order_id: UUID) -> Order:
        """Get and validate a pending order."""
        stmt = select(Order).options(selectinload(Order.payment)).where(Order.id == order_id)
        result = await session.execute(stmt)
        order = result.scalars().first()

        if not order:
            raise ValueError(f"Order {order_id} not found")

        if order.status != "PENDING":
            raise ValueError(f"Order {order_id} is not in PENDING status")

        return order

    async def _create_payos_payment(
        self,
        session: AsyncSession,
        order: Order,
        order_code: int,
        amount: int,
        description: str,
        return_url: str,
        cancel_url: str,
        buyer_name: Optional[str] = None,
        buyer_email: Optional[str] = None,
        buyer_phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create PayOS payment link and update order."""
        payos_response = await self.payos.create_payment_link(
            order_code=order_code,
            amount=amount,
            description=description,
            return_url=return_url,
            cancel_url=cancel_url,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            buyer_phone=buyer_phone,
        )

        payment_link_id = payos_response.get("data", {}).get("paymentLinkId")
        checkout_url = payos_response.get("data", {}).get("checkoutUrl")
        qr_code = payos_response.get("data", {}).get("qrCode")

        await self._update_order_payment(
            session, order, "PAYOS", payment_link_id, "PENDING"
        )

        return {
            "order_id": order.id,
            "order_code": order_code,
            "amount": float(amount),
            "currency": "VND",
            "qr_code_url": qr_code,
            "payment_url": checkout_url,
            "payment_link_id": payment_link_id,
            "description": description,
            "bank_name": settings.VIETQR_BANK_NAME,
            "account_number": settings.VIETQR_ACCOUNT_NO,
            "account_name": settings.VIETQR_ACCOUNT_NAME,
        }

    async def _create_vietqr_payment(
        self,
        session: AsyncSession,
        order: Order,
        order_code: int,
        amount: int,
        description: str,
    ) -> Dict[str, Any]:
        """Create VietQR payment and update order."""
        memo = f"DH{order_code}"
        bank_id = settings.VIETQR_BANK_ID
        account_no = settings.VIETQR_ACCOUNT_NO
        account_name = settings.VIETQR_ACCOUNT_NAME
        qr_url = f"https://img.vietqr.io/image/{bank_id}-{account_no}-compact2.png?amount={amount}&addInfo={memo}&accountName={account_name.replace(' ', '%20')}"

        await self._update_order_payment(session, order, "VIETQR", None, "PENDING")

        return {
            "order_id": order.id,
            "order_code": order_code,
            "amount": float(amount),
            "currency": "VND",
            "qr_code_url": qr_url,
            "payment_url": qr_url,
            "payment_link_id": None,
            "description": memo,
            "bank_name": settings.VIETQR_BANK_NAME,
            "account_number": account_no,
            "account_name": account_name,
        }

    async def _update_order_payment(
        self,
        session: AsyncSession,
        order: Order,
        provider: str,
        transaction_id: Optional[str],
        status: str,
    ) -> None:
        """Update or create payment record for order."""
        if order.payment:
            order.payment.provider = provider
            order.payment.transaction_id = transaction_id
            order.payment.status = status
            session.add(order.payment)
        else:
            payment = Payment(
                order_id=order.id,
                provider=provider,
                transaction_id=transaction_id,
                status=status,
            )
            session.add(payment)
        await session.commit()

    async def process_webhook(
        self,
        session: AsyncSession,
        data: Dict[str, Any],
        signature: str,
    ) -> Dict[str, Any]:
        """Process PayOS webhook notification.

        Args:
            session: Database session
            data: Webhook data payload (inner 'data' field)
            signature: HMAC signature from PayOS (already verified by endpoint)

        Returns:
            Processing result dictionary
        """
        # Note: Signature is already verified by the endpoint
        order_code = data.get("orderCode")
        amount = float(data.get("amount", 0))
        ref_id = str(data.get("reference") or data.get("paymentLinkId") or order_code)
        idempotency_key = f"PAYOS_{order_code}_{ref_id}"

        # 2. Idempotency Check - prevent duplicate processing
        idem_stmt = select(PaymentTransaction).where(
            PaymentTransaction.idempotency_key == idempotency_key
        )
        idem_res = await session.execute(idem_stmt)
        if idem_res.scalars().first():
            logger.info(f"Webhook already processed: {idempotency_key}")
            return {
                "message": "Webhook already processed (Idempotent deduplication)",
                "status": "ALREADY_PROCESSED",
                "idempotency_key": idempotency_key,
            }

        # 3. Locate Order
        order_stmt = select(Order).options(selectinload(Order.payment)).where(
            Order.status == "PENDING"
        )
        order_res = await session.execute(order_stmt)
        pending_orders = order_res.scalars().all()

        target_order: Optional[Order] = None
        for po in pending_orders:
            if self.get_order_code_for_uuid(po.id) == order_code:
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
            logger.warning(f"Pending order for code {order_code} not found")
            raise ValueError(f"Pending order for code {order_code} not found")

        # 4. Anti-Tampering Amount Verification
        expected_amount = float(target_order.total_amount)
        if abs(expected_amount - amount) > 1.0:
            logger.warning(f"Amount mismatch: expected {expected_amount}, received {amount}")

            # Record security incident
            failed_tx = PaymentTransaction(
                order_id=target_order.id,
                idempotency_key=f"FAILED_{idempotency_key}",
                provider="PAYOS",
                amount=amount,
                status="TAMPERED_AMOUNT",
                transaction_id=ref_id,
                payload_json=json.dumps(data),
            )
            session.add(failed_tx)
            await session.commit()

            raise ValueError(
                f"Amount mismatch security check failed: Expected {expected_amount}, received {amount}"
            )

        # 5. Atomic Update - mark order as PROCESSING/PAID
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
            payload_json=json.dumps(data),
        )
        session.add(target_order)
        session.add(success_tx)
        await session.commit()

        logger.info(f"Payment processed successfully for order {target_order.id}")
        return {
            "message": "Webhook processed successfully",
            "order_id": str(target_order.id),
            "status": target_order.status,
            "idempotency_key": idempotency_key,
        }

    async def auto_cancel_expired_orders(self, session: AsyncSession) -> int:
        """Auto-cancel orders with pending payments older than configured minutes.

        This should be run periodically (e.g., via cron/ARQ task).

        Args:
            session: Database session

        Returns:
            Number of orders cancelled
        """
        from app.core.config import settings
        cutoff = datetime.utcnow() - timedelta(minutes=settings.AUTO_CANCEL_MINUTES)

        # Find PENDING orders older than 15 minutes with payment info
        stmt = select(Order).options(selectinload(Order.payment)).where(
            Order.status == "PENDING",
            Order.created_at < cutoff,
        )
        result = await session.execute(stmt)
        expired_orders = result.scalars().unique().all()

        cancelled_count = 0
        restored_products = []

        for order in expired_orders:
            # Restore stock for order items
            try:
                from sqlalchemy.orm import selectinload
                from app.models.order_item import OrderItem

                order_stmt = select(Order).options(
                    selectinload(Order.order_items)
                ).where(Order.id == order.id)
                order_result = await session.execute(order_stmt)
                order_with_items = order_result.scalars().first()

                if order_with_items and order_with_items.order_items:
                    for item in order_with_items.order_items:
                        # Restore product stock
                        from app.models.product import Product
                        product_stmt = select(Product).where(Product.id == item.product_id)
                        product_result = await session.execute(product_stmt)
                        product = product_result.scalars().first()

                        if product:
                            product.stock = (product.stock or 0) + item.quantity
                            session.add(product)
                            restored_products.append(product.id)

            except Exception as e:
                logger.error(f"Failed to restore stock for order {order.id}: {e}")

            if order.payment and order.payment.transaction_id:
                try:
                    # Cancel via PayOS API
                    await self.payos.cancel_payment_link(
                        order.payment.transaction_id,
                        cancellation_reason="Auto-cancelled after 15 minutes timeout"
                    )
                    cancelled_count += 1
                    logger.info(f"Auto-cancelled order {order.id} via PayOS")
                except Exception as e:
                    logger.error(f"Failed to cancel order {order.id} via PayOS: {e}")

            # Update local status regardless of API result
            order.status = "CANCELLED"
            if order.payment:
                order.payment.status = "FAILED"
            session.add(order)

        # Invalidate Redis cache for restored products
        if restored_products:
            try:
                from app.core.redis_client import get_redis
                redis_client = await get_redis()
                for product_id in restored_products:
                    await redis_client.delete(f"product:{product_id}")
                    await redis_client.delete(f"product:{product_id}:stock")
                await redis_client.close()
                logger.info(f"Invalidated cache for {len(restored_products)} products")
            except Exception as e:
                logger.error(f"Failed to invalidate Redis cache: {e}")

        if cancelled_count > 0:
            await session.commit()
            logger.info(f"Auto-cancelled {cancelled_count} expired orders, restored stock for {len(restored_products)} products")

        return cancelled_count

    async def refund_payment(
        self,
        session: AsyncSession,
        order_id: UUID,
        reason: str = "Customer requested refund",
    ) -> Dict[str, Any]:
        """Process a refund for a paid order.

        Note: PayOS doesn't have a direct refund API for completed payments.
        Refunds are typically handled manually or via bank transfer.
        This method cancels the payment link if still pending, or marks for manual refund.

        Args:
            session: Database session
            order_id: Order UUID
            reason: Refund reason

        Returns:
            Result dictionary
        """
        stmt = select(Order).options(selectinload(Order.payment)).where(Order.id == order_id)
        result = await session.execute(stmt)
        order = result.scalars().first()

        if not order:
            raise ValueError(f"Order {order_id} not found")

        if not order.payment:
            raise ValueError(f"Order {order_id} has no payment record")

        if order.payment.status != "PAID":
            raise ValueError(f"Order {order_id} payment status is {order.payment.status}, not PAID")

        # If payment link is still active, try to cancel it
        if order.payment.transaction_id:
            try:
                await self.payos.cancel_payment_link(
                    order.payment.transaction_id,
                    cancellation_reason=reason
                )
                order.payment.status = "REFUNDED"
                order.status = "REFUNDED"
                session.add(order)
                session.add(order.payment)
                await session.commit()

                return {
                    "message": "Payment cancelled via PayOS",
                    "order_id": str(order_id),
                    "status": "REFUNDED",
                }
            except Exception as e:
                logger.error(f"Failed to cancel payment link for refund: {e}")

        # Mark for manual refund processing
        order.payment.status = "REFUND_PENDING"
        order.status = "REFUND_PENDING"
        session.add(order)
        session.add(order.payment)
        await session.commit()

        logger.info(f"Order {order_id} marked for manual refund: {reason}")
        return {
            "message": "Refund marked for manual processing",
            "order_id": str(order_id),
            "status": "REFUND_PENDING",
        }

    async def get_payment_status(self, session: AsyncSession, order_id: UUID) -> Dict[str, Any]:
        """Get payment status for an order.

        Args:
            session: Database session
            order_id: Order UUID

        Returns:
            Payment status dictionary
        """
        stmt = select(Order).options(selectinload(Order.payment)).where(Order.id == order_id)
        result = await session.execute(stmt)
        order = result.scalars().first()

        if not order:
            raise ValueError(f"Order {order_id} not found")

        return {
            "order_id": order.id,
            "order_status": order.status,
            "payment_status": order.payment.status if order.payment else "UNPAID",
            "amount": float(order.total_amount),
            "provider": order.payment.provider if order.payment else order.payment_method,
            "transaction_id": order.payment.transaction_id if order.payment else None,
            "paid_at": order.payment.updated_at if order.payment and order.payment.status == "PAID" else None,
        }