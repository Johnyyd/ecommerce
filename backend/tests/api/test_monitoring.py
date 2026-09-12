import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_metrics_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Generate some traffic first
        health_res = await client.get("/api/health")
        assert health_res.status_code == 200

        # Scrape metrics
        metrics_res = await client.get("/metrics")
        assert metrics_res.status_code == 200
        content = metrics_res.text

        # Verify key Prometheus metrics exist
        assert "http_requests_total" in content
        assert "http_request_duration_seconds" in content
        assert "python_gc_objects_collected_total" in content
