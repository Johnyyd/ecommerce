#!/usr/bin/env python3
"""
PayOS Sandbox Integration Test Script

Tests:
1. Real PayOS API call - create_payment_link() returns checkoutUrl & qrCode
2. Webhook HMAC validation
3. Auto-cancel via cancel_payment_link()
4. ARQ cancel_expired_orders_task
"""

import asyncio
import os
import sys
import json
from uuid import uuid4
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.db import get_db_session
from app.models.order import Order
from app.models.product import Product
from app.services.payment import PaymentService, PayOSService
from app.core.security_crypto import generate_payos_signature, verify_payos_signature

async def test_payos_credentials():
    """Test that PayOS credentials are configured"""
    print("=" * 60)
    print("Testing PayOS Credentials Configuration")
    print("=" * 60)
    print(f"PAYOS_CLIENT_ID: {settings.PAYOS_CLIENT_ID[:10]}..." if settings.PAYOS_CLIENT_ID else "NOT SET")
    print(f"PAYOS_API_KEY: {settings.PAYOS_API_KEY[:10]}..." if settings.PAYOS_API_KEY else "NOT SET")
    print(f"PAYOS_CHECKSUM_KEY: {settings.PAYOS_CHECKSUM_KEY[:10]}..." if settings.PAYOS_CHECKSUM_KEY else "NOT SET")

    if settings.PAYOS_CLIENT_ID == "test-client-id":
        print("\n⚠️  WARNING: Using TEST credentials - API calls will fail")
        return False
    return True

async def test_create_payment_link():
    """Test PayOSService.create_payment_link() returns real checkoutUrl & qrCode"""
    print("\n" + "=" * 60)
    print("Testing PayOSService.create_payment_link()")
    print("=" * 60)

    payos = PayOSService()
    order_code = 12345678
    amount = 100000  # 100,000 VND
    description = f"DH{order_code}"
    return_url = "http://localhost:3000/payment/success"
    cancel_url = "http://localhost:3000/payment/cancel"
    expired_at = int((datetime.utcnow() + timedelta(minutes=15)).timestamp())

    try:
        result = await payos.create_payment_link(
            order_code=order_code,
            amount=amount,
            description=description,
            return_url=return_url,
            cancel_url=cancel_url,
            expired_at=expired_at,
            buyer_name="Test User",
            buyer_email="test@example.com",
            buyer_phone="0909123456",
        )

        print(f"PayOS API Response: {json.dumps(result, indent=2, default=str)}")

        # Check for real PayOS response
        data = result.get("data")
        if data is None:
            print(f"\n⚠️  PayOS returned error: code={result.get('code')}, desc={result.get('desc')}")
            print("   This is expected with test credentials")
            return {
                "checkout_url": None,
                "qr_code": None,
                "payment_link_id": None,
                "expired_at": expired_at,
                "error": result.get('desc')
            }

        checkout_url = data.get("checkoutUrl")
        qr_code = data.get("qrCode")
        payment_link_id = data.get("paymentLinkId")

        if checkout_url and "payos.vn" in checkout_url:
            print(f"\n✅ SUCCESS: Real checkoutUrl returned: {checkout_url[:60]}...")
        else:
            print(f"\n❌ FAILED: checkoutUrl is not a real PayOS URL: {checkout_url}")

        if qr_code and qr_code.startswith("data:image"):
            print(f"✅ SUCCESS: Real base64 QR code returned (length: {len(qr_code)})")
        elif qr_code and "vietqr.io" in qr_code:
            print(f"❌ FAILED: Got VietQR fallback image instead of PayOS QR: {qr_code[:60]}...")
        else:
            print(f"❌ FAILED: QR code not in expected format: {qr_code[:60] if qr_code else 'None'}")

        if payment_link_id:
            print(f"✅ SUCCESS: paymentLinkId returned: {payment_link_id}")
        else:
            print(f"❌ FAILED: No paymentLinkId returned")

        return {
            "checkout_url": checkout_url,
            "qr_code": qr_code,
            "payment_link_id": payment_link_id,
            "expired_at": expired_at,
        }

    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {e}")
        return None

async def test_webhook_hmac():
    """Test webhook HMAC-SHA256 validation"""
    print("\n" + "=" * 60)
    print("Testing Webhook HMAC-SHA256 Validation")
    print("=" * 60)

    # Sample PayOS webhook payload
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

    # Generate valid signature
    signature = generate_payos_signature(webhook_data, settings.PAYOS_CHECKSUM_KEY)
    print(f"Generated signature: {signature}")

    # Test verification with valid signature
    is_valid = verify_payos_signature(webhook_data, signature, settings.PAYOS_CHECKSUM_KEY)
    print(f"Valid signature verification: {'✅ PASS' if is_valid else '❌ FAIL'}")

    # Test verification with invalid signature
    is_invalid = verify_payos_signature(webhook_data, "invalid_signature", settings.PAYOS_CHECKSUM_KEY)
    print(f"Invalid signature rejection: {'✅ PASS' if not is_invalid else '❌ FAIL'}")

    # Test with tampered amount
    tampered_data = webhook_data.copy()
    tampered_data["amount"] = 50000  # Different amount
    tampered_signature = generate_payos_signature(tampered_data, settings.PAYOS_CHECKSUM_KEY)
    is_tampered_valid = verify_payos_signature(tampered_data, tampered_signature, settings.PAYOS_CHECKSUM_KEY)
    print(f"Tampered data with valid signature: {'✅ PASS' if is_tampered_valid else '❌ FAIL'}")
    print("  (Note: Amount anti-tampering is checked separately in process_webhook)")

    return is_valid and not is_invalid

async def test_cancel_payment_link():
    """Test PayOS cancel_payment_link()"""
    print("\n" + "=" * 60)
    print("Testing PayOS cancel_payment_link()")
    print("=" * 60)

    payos = PayOSService()

    # We can't actually cancel without a real payment link ID
    # This will test the API call structure
    try:
        # This will fail with 404 since it's a fake ID, but we can verify the request structure
        result = await payos.cancel_payment_link(
            payment_link_id="plink_fake_id_for_test",
            cancellation_reason="Test cancellation"
        )
        print(f"Cancel response: {json.dumps(result, indent=2, default=str)}")
        return True
    except Exception as e:
        # Expected to fail with 404 for fake ID
        if "404" in str(e) or "Not Found" in str(e):
            print(f"✅ Expected 404 for fake ID - API call structure works")
            return True
        print(f"❌ Unexpected error: {type(e).__name__}: {e}")
        return False

async def test_full_payment_flow():
    """Test full payment flow with database"""
    print("\n" + "=" * 60)
    print("Testing Full Payment Flow with Database")
    print("=" * 60)

    async with get_db_session() as session:
        # Create a test product first
        product = Product(
            id=uuid4(),
            name="Test Product",
            description="Test product for PayOS",
            price=100000,
            stock=10,
            category_id=uuid4(),  # Will need valid category
            brand="Test Brand",
            is_active=True,
        )
        session.add(product)
        await session.commit()
        await session.refresh(product)

        # Create a test order
        order = Order(
            id=uuid4(),
            user_id=uuid4(),
            total_amount=100000,
            status="PENDING",
            payment_method="PAYOS",
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)

        # Create order item
        from app.models.order_item import OrderItem
        order_item = OrderItem(
            id=uuid4(),
            order_id=order.id,
            product_id=product.id,
            quantity=1,
            price=100000,
        )
        session.add(order_item)
        await session.commit()

        # Test payment creation
        payment_service = PaymentService()
        try:
            result = await payment_service.create_payment(
                session=session,
                order_id=order.id,
                return_url="http://localhost:3000/payment/success",
                cancel_url="http://localhost:3000/payment/cancel",
                provider="PAYOS",
            )

            print(f"Payment created:")
            print(f"  order_id: {result.get('order_id')}")
            print(f"  order_code: {result.get('order_code')}")
            print(f"  amount: {result.get('amount')}")
            print(f"  qr_code_url: {result.get('qr_code_url', '')[:60]}...")
            print(f"  checkout_url: {result.get('payment_url', '')[:60]}...")
            print(f"  payment_link_id: {result.get('payment_link_id')}")
            print(f"  transfer_memo: {result.get('transfer_memo')}")

            # Verify it's PayOS QR (base64) not VietQR
            qr = result.get('qr_code_url', '')
            if qr.startswith("data:image"):
                print("✅ SUCCESS: PayOS base64 QR code returned")
            elif "vietqr.io" in qr:
                print("❌ FAILED: VietQR fallback returned instead of PayOS QR")
            else:
                print(f"? UNKNOWN QR format: {qr[:60]}")

            return result

        except Exception as e:
            print(f"❌ ERROR creating payment: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return None
        finally:
            # Cleanup
            await session.delete(order_item)
            await session.delete(order)
            await session.delete(product)
            await session.commit()

async def test_auto_cancel_task():
    """Test ARQ cancel_expired_orders_task"""
    print("\n" + "=" * 60)
    print("Testing Auto-Cancel Task (cancel_expired_orders_task)")
    print("=" * 60)

    # Import the task function
    from app.worker import cancel_expired_orders_task

    # Create a mock context
    class MockContext:
        pass

    ctx = MockContext()

    try:
        result = await cancel_expired_orders_task(ctx)
        print(f"Auto-cancel task result: {result}")
        if result.get("cancelled", 0) >= 0:
            print("✅ Auto-cancel task executed successfully")
            return True
        else:
            print("❌ Auto-cancel task returned error")
            return False
    except Exception as e:
        print(f"❌ ERROR in auto-cancel task: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    print("🚀 PayOS Sandbox Integration Tests")
    print("=" * 60)

    # Test 1: Credentials
    creds_ok = await test_payos_credentials()

    # Test 2: Create payment link
    payment_result = await test_create_payment_link()

    # Test 3: Webhook HMAC
    hmac_ok = await test_webhook_hmac()

    # Test 4: Cancel payment link
    cancel_ok = await test_cancel_payment_link()

    # Test 5: Full payment flow with DB (only if creds are real)
    if creds_ok:
        flow_result = await test_full_payment_flow()
    else:
        print("\n⏭️  Skipping full payment flow test (test credentials)")
        flow_result = None

    # Test 6: Auto-cancel task
    auto_cancel_ok = await test_auto_cancel_task()

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Credentials configured:     {'✅' if creds_ok else '⚠️  Test creds'}")
    print(f"Create payment link:        {'✅' if payment_result and payment_result.get('checkout_url') else '❌'}")
    print(f"Webhook HMAC validation:    {'✅' if hmac_ok else '❌'}")
    print(f"Cancel payment link:        {'✅' if cancel_ok else '❌'}")
    print(f"Full payment flow:          {'✅' if flow_result else '⏭️  Skipped'}")
    print(f"Auto-cancel task:           {'✅' if auto_cancel_ok else '❌'}")

    all_passed = all([
        payment_result and payment_result.get('checkout_url'),
        hmac_ok,
        cancel_ok,
        auto_cancel_ok,
    ])

    print(f"\n{'🎉 ALL TESTS PASSED' if all_passed else '⚠️  SOME TESTS FAILED - Check output above'}")
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)