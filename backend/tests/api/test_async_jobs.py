import pytest
import asyncio
import io
from uuid import uuid4
from unittest.mock import AsyncMock
from PIL import Image
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.utils import generate_uuidv7
from app.api.deps import get_current_staff, get_current_user
from app.models.user import User

class InMemoryRedis:
    def __init__(self):
        self._data = {}
        self._lists = {}

    async def get(self, key):
        return self._data.get(key)

    async def set(self, key, value, ex=None):
        self._data[key] = value
        return True

    async def ping(self):
        return True

    async def zcard(self, key):
        return 0

    async def keys(self, pattern="*"):
        import fnmatch
        return [k for k in self._data if fnmatch.fnmatch(k, pattern)]

    async def lpush(self, key, value):
        if key not in self._lists:
            self._lists[key] = []
        self._lists[key].insert(0, value)
        return len(self._lists[key])

    async def lrange(self, key, start, end):
        items = self._lists.get(key, [])
        if end == -1:
            return items[start:]
        return items[start:end + 1]

    async def ltrim(self, key, start, end):
        if key in self._lists:
            if end == -1:
                self._lists[key] = self._lists[key][start:]
            else:
                self._lists[key] = self._lists[key][start:end + 1]
        return True

class MockArqPool:
    async def enqueue_job(self, function, *args, **kwargs):
        class MockJob:
            job_id = kwargs.get("_job_id", f"mock_job_{uuid4().hex[:8]}")
        return MockJob()

@pytest.fixture(autouse=True)
def mock_redis_and_queue(monkeypatch):
    fake_redis = InMemoryRedis()
    monkeypatch.setattr("app.core.redis.get_redis_client", lambda: fake_redis)
    monkeypatch.setattr("app.services.reports.get_redis_client", lambda: fake_redis)
    monkeypatch.setattr("app.services.email.get_redis_client", lambda: fake_redis)
    monkeypatch.setattr("app.core.queue.get_redis_client", lambda: fake_redis)
    monkeypatch.setattr("app.api.v1.endpoints.async_jobs.get_redis_client", lambda: fake_redis)
    monkeypatch.setattr("app.core.queue.get_queue_pool", AsyncMock(return_value=MockArqPool()))

@pytest.fixture
def mock_staff():
    return User(
        id=generate_uuidv7(),
        username="admin_staff",
        email="admin@example.com",
        role="admin",
        is_active=True
    )

@pytest.fixture
def mock_customer():
    return User(
        id=generate_uuidv7(),
        username="john_doe",
        email="john@example.com",
        role="customer",
        is_active=True
    )

@pytest.mark.asyncio
async def test_get_worker_queue_status(mock_staff):
    app.dependency_overrides[get_current_staff] = lambda: mock_staff

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/admin/queue/status")

    assert res.status_code == 200
    data = res.json()
    assert "worker_status" in data
    assert "redis_connected" in data
    assert "queued_jobs" in data

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_trigger_report_export_and_polling(mock_staff):
    app.dependency_overrides[get_current_staff] = lambda: mock_staff

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Trigger export
        export_res = await ac.post("/api/v1/reports/export", json={
            "report_type": "sales",
            "format": "xlsx"
        })
        assert export_res.status_code == 200
        data = export_res.json()
        job_id = data["job_id"]
        assert data["status"] in ["PENDING", "PROCESSING", "COMPLETED"]

        # 2. Check status polling
        status_res = await ac.get(f"/api/v1/reports/{job_id}/status")
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["job_id"] == job_id

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_trigger_report_export_invalid_format(mock_staff):
    app.dependency_overrides[get_current_staff] = lambda: mock_staff

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/reports/export", json={
            "report_type": "sales",
            "format": "invalid_ext"
        })
    assert res.status_code == 400
    assert "Invalid format" in res.json()["detail"]

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_media_upload_and_webp_optimization(mock_customer):
    app.dependency_overrides[get_current_user] = lambda: mock_customer

    # Create a real PNG test image in memory
    img = Image.new("RGB", (300, 300), color="blue")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_bytes.seek(0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/media/upload",
            files={"file": ("test_banner.png", img_bytes.getvalue(), "image/png")}
        )

    assert res.status_code == 200
    data = res.json()
    assert "file_id" in data
    assert "variants" in data
    assert "thumb" in data["variants"]
    assert "medium" in data["variants"]
    assert "full" in data["variants"]
    assert data["variants"]["thumb"].endswith(".webp")

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_media_upload_security_blocks_malicious_file(mock_customer):
    app.dependency_overrides[get_current_user] = lambda: mock_customer

    # Upload fake image containing shell script / HTML injection
    fake_script = b"<script>alert('xss')</script>"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/media/upload",
            files={"file": ("malicious.png", fake_script, "image/png")}
        )

    assert res.status_code == 400
    assert "Security violation" in res.json()["detail"]

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_admin_email_outbox_and_test_dispatch(mock_staff):
    app.dependency_overrides[get_current_staff] = lambda: mock_staff

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Trigger test email
        dispatch_res = await ac.post("/api/v1/admin/emails/test", json={
            "recipient": "customer@example.com",
            "template": "order_invoice"
        })
        assert dispatch_res.status_code == 200
        assert "job_id" in dispatch_res.json()

        # 2. Record email in sandbox outbox & inspect
        from app.services.email import record_sandbox_email
        await record_sandbox_email("customer@example.com", "[TEST] Invoice", "order_invoice", {})
        outbox_res = await ac.get("/api/v1/admin/emails/outbox?limit=10")
        assert outbox_res.status_code == 200
        outbox = outbox_res.json()

        assert isinstance(outbox, list)
        assert len(outbox) > 0
        assert any(item.get("recipient") == "customer@example.com" for item in outbox)

    app.dependency_overrides.clear()
