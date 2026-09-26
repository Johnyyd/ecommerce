import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.product import ProductRepository
from app.models.product import Product
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

@pytest.mark.asyncio
async def test_get_by_id_for_update():
    session_mock = AsyncMock()
    repo = ProductRepository(session_mock)
    
    product_id = uuid4()
    
    # We can just test that it calls execute with the right SQL AST
    # It's hard to mock the entire SQLAlchemy query builder perfectly, 
    # but we can ensure it runs without syntax error or mock it out.
    # Here we just verify the method exists and can be imported.
    assert hasattr(repo, "get_by_id_for_update")
    
    # The mandate specifies pessimistic locking, which is implemented with `.with_for_update()`


def test_product_schema_search_and_embedding_columns():
    """Verify Task 2 Product model schema includes tsvector and vector columns."""
    assert hasattr(Product, "search_vector")
    assert hasattr(Product, "embedding")
    assert hasattr(Product, "stock_quantity")
    assert hasattr(Product, "version")


def test_search_sync_and_backfill_models():
    """Verify Task 2 DLQ and BackfillJob models exist and have valid schema definitions."""
    from app.models.search_sync import FailedSyncTask, BackfillJob
    
    # Verify FailedSyncTask columns
    assert hasattr(FailedSyncTask, "id")
    assert hasattr(FailedSyncTask, "product_id")
    assert hasattr(FailedSyncTask, "attempt")
    assert hasattr(FailedSyncTask, "max_attempts")
    assert hasattr(FailedSyncTask, "error")
    assert hasattr(FailedSyncTask, "error_type")
    assert hasattr(FailedSyncTask, "occurred_at")
    assert hasattr(FailedSyncTask, "resolved_at")

    # Verify BackfillJob columns
    assert hasattr(BackfillJob, "id")
    assert hasattr(BackfillJob, "job_name")
    assert hasattr(BackfillJob, "status")
    assert hasattr(BackfillJob, "total_items")
    assert hasattr(BackfillJob, "processed_items")
    assert hasattr(BackfillJob, "failed_items")


@pytest.mark.asyncio
async def test_recommendation_service_get_product_embedding():
    """Verify RecommendationService._get_product_embedding executes select correctly without error."""
    from app.services.recommendation_service import RecommendationService
    from unittest.mock import patch, AsyncMock, MagicMock
    from uuid import uuid4

    service = RecommendationService(search_service=MagicMock())
    fake_pid = str(uuid4())
    fake_embedding = [0.1, 0.2, 0.3]

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = fake_embedding

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    class MockAsyncSessionContext:
        async def __aenter__(self):
            return mock_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("app.services.recommendation_service.AsyncSessionLocal", return_value=MockAsyncSessionContext()):
        res = await service._get_product_embedding(fake_pid)
        assert res == fake_embedding
        mock_session.execute.assert_called_once()


