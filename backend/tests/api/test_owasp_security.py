import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from datetime import datetime, timezone
import io

from app.main import app
from app.api.deps import get_current_user, get_current_admin, get_current_staff
from app.core.db import get_db_session
from app.core.config import settings
from app.core.utils import generate_uuidv7
from app.models.user import User
from app.models.order import Order
from app.models.address import Address
from app.models.review import Review
from app.crud.order import OrderRepository
from app.crud.review import ReviewRepository

@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def mock_customer():
    now = datetime.now(timezone.utc)
    return User(
        id=generate_uuidv7(),
        username="customer_alice",
        email="alice@example.com",
        role="customer",
        is_active=True,
        created_at=now,
        updated_at=now
    )

@pytest.fixture
def mock_other_customer():
    now = datetime.now(timezone.utc)
    return User(
        id=generate_uuidv7(),
        username="customer_bob",
        email="bob@example.com",
        role="customer",
        is_active=True,
        created_at=now,
        updated_at=now
    )

@pytest.fixture
def mock_admin_user():
    now = datetime.now(timezone.utc)
    return User(
        id=generate_uuidv7(),
        username="admin_root",
        email="admin@example.com",
        role="admin",
        is_active=True,
        created_at=now,
        updated_at=now
    )

# --------------------------------------------------------------------------
# OWASP A01: Broken Access Control (Privilege Escalation & BOLA / IDOR)
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_customer_cannot_access_admin_orders(mock_customer):
    """Customer role must be blocked (403) from accessing admin orders endpoint."""
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/orders/admin")
    assert res.status_code == 403
    assert "privileges required" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_customer_cannot_update_order_status(mock_customer):
    """Customer role must be blocked (403) from administrative order status updates."""
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    order_id = generate_uuidv7()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.patch(f"/api/v1/orders/{order_id}/status", json={"status": "PROCESSING"})
    assert res.status_code == 403
    assert "privileges required" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_customer_cannot_list_users(mock_customer):
    """Customer role must be blocked (403) from listing all registered users."""
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/users/")
    assert res.status_code == 403

@pytest.mark.asyncio
async def test_customer_cannot_modify_user_role(mock_customer):
    """Customer role must be blocked (403) from escalating role or deactivating users."""
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    target_id = generate_uuidv7()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.patch(f"/api/v1/users/{target_id}", json={"role": "admin"})
    assert res.status_code == 403

@pytest.mark.asyncio
async def test_customer_cannot_list_or_create_backups(mock_customer):
    """Customer role must be blocked (403) from listing or creating database backups."""
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res_list = await ac.get("/api/v1/admin/backups/")
        res_create = await ac.post("/api/v1/admin/backups/create")
    assert res_list.status_code == 403
    assert res_create.status_code == 403

@pytest.mark.asyncio
async def test_customer_cannot_access_worker_queue_or_email_outbox(mock_customer):
    """Customer role must be blocked (403) from internal worker metrics and email logs."""
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res_queue = await ac.get("/api/v1/admin/queue/status")
        res_outbox = await ac.get("/api/v1/admin/emails/outbox")
        res_test_email = await ac.post("/api/v1/admin/emails/test", json={"recipient": "x@x.com", "template": "welcome"})
    assert res_queue.status_code == 403
    assert res_outbox.status_code == 403
    assert res_test_email.status_code == 403

@pytest.mark.asyncio
async def test_customer_idor_cancel_another_users_order(mock_customer, mock_other_customer):
    """IDOR Check: Customer Alice cannot cancel Customer Bob's order."""
    mock_session = AsyncMock()
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    app.dependency_overrides[get_db_session] = lambda: mock_session

    empty_result = MagicMock()
    empty_scalars = MagicMock()
    empty_scalars.first.return_value = None
    empty_result.scalars.return_value = empty_scalars
    mock_session.execute.return_value = empty_result

    bob_order_id = generate_uuidv7()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(f"/api/v1/orders/{bob_order_id}/cancel")

    assert res.status_code == 400
    assert "Order not found" in res.json()["detail"]
    mock_session.commit.assert_not_called()

@pytest.mark.asyncio
async def test_customer_idor_update_payment_method_another_users_order(mock_customer):
    """IDOR Check: Customer Alice cannot change payment method on Customer Bob's order."""
    mock_session = AsyncMock()
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    app.dependency_overrides[get_db_session] = lambda: mock_session

    empty_result = MagicMock()
    empty_scalars = MagicMock()
    empty_scalars.first.return_value = None
    empty_result.scalars.return_value = empty_scalars
    mock_session.execute.return_value = empty_result

    bob_order_id = generate_uuidv7()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.patch(f"/api/v1/orders/{bob_order_id}/payment-method", json={"payment_method": "VIETQR"})

    assert res.status_code == 400
    assert "Order not found" in res.json()["detail"]
    mock_session.commit.assert_not_called()

@pytest.mark.asyncio
async def test_customer_idor_delete_another_users_review(mock_customer, mock_other_customer):
    """IDOR Check: Alice cannot delete Bob's review."""
    mock_session = AsyncMock()
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    app.dependency_overrides[get_db_session] = lambda: mock_session

    review_id = generate_uuidv7()
    bobs_review = Review(
        id=review_id,
        user_id=mock_other_customer.id,
        product_id=generate_uuidv7(),
        order_id=generate_uuidv7(),
        rating=5,
        comment="Great product",
        is_verified_purchase=True,
        created_at=datetime.now(timezone.utc),
        deleted_at=None
    )

    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = bobs_review
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.delete(f"/api/v1/reviews/{review_id}")

    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]

@pytest.mark.asyncio
async def test_customer_idor_update_or_delete_another_users_address(mock_customer):
    """IDOR Check: Alice cannot update or delete Bob's address."""
    mock_session = AsyncMock()
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    app.dependency_overrides[get_db_session] = lambda: mock_session

    empty_result = MagicMock()
    empty_scalars = MagicMock()
    empty_scalars.first.return_value = None
    empty_result.scalars.return_value = empty_scalars
    mock_session.execute.return_value = empty_result

    bob_address_id = generate_uuidv7()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res_put = await ac.put(f"/api/v1/addresses/{bob_address_id}", json={
            "recipient_name": "Alice Hacked Bob",
            "phone_number": "0912345678",
            "street_address": "123 Street",
            "ward": "Ward 1",
            "district": "District 1",
            "city": "HCM"
        })
        res_del = await ac.delete(f"/api/v1/addresses/{bob_address_id}")

    assert res_put.status_code == 404
    assert res_del.status_code == 404
    mock_session.commit.assert_not_called()

# --------------------------------------------------------------------------
# OWASP A02: Security Misconfiguration / Path Traversal Defense
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_backup_restore_path_traversal_rejected(mock_admin_user):
    """Admin endpoint rejects path traversal sequences (e.g. ../../etc/passwd or .sh files)."""
    app.dependency_overrides[get_current_admin] = lambda: mock_admin_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res1 = await ac.post("/api/v1/admin/backups/restore", json={"filename": "../../etc/passwd"})
        res2 = await ac.post("/api/v1/admin/backups/restore", json={"filename": "malicious_script.sh"})
        res3 = await ac.post("/api/v1/admin/backups/restore", json={"filename": "dump;rm -rf /;.dump"})

    assert res1.status_code == 400
    assert "Invalid backup filename format" in res1.json()["detail"]
    assert res2.status_code == 400
    assert "Invalid backup filename format" in res2.json()["detail"]
    assert res3.status_code == 400
    assert "Invalid backup filename format" in res3.json()["detail"]

# --------------------------------------------------------------------------
# OWASP A05: Injection & File Upload Security
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_media_upload_rejects_fake_and_executable_files(mock_customer):
    """Media upload rejects non-image executables and fake MIME types."""
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Fake MIME with script payload
        fake_file = io.BytesIO(b"<?php echo 'malicious shell'; ?>")
        res1 = await ac.post(
            "/api/v1/media/upload",
            files={"file": ("exploit.php", fake_file, "image/jpeg")}
        )
        assert res1.status_code == 400
        assert "Security violation" in res1.json()["detail"]

        # 2. Too small / corrupted header
        tiny_file = io.BytesIO(b"abc")
        res2 = await ac.post(
            "/api/v1/media/upload",
            files={"file": ("tiny.jpg", tiny_file, "image/jpeg")}
        )
        assert res2.status_code == 400
        assert "Security violation" in res2.json()["detail"]

# --------------------------------------------------------------------------
# OWASP A07: Authentication & Session Token Handling
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unauthenticated_request_rejected():
    """Unauthenticated requests to protected endpoints return 401 Unauthorized."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert "not authenticated" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_invalid_bearer_token_rejected():
    """Forged or tampered JWT returns 401 Unauthorized."""
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered_payload.fake_sig"}
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401
    assert "Could not validate credentials" in res.json()["detail"]
