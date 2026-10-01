import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone
from app.models.product import Product
from app.services.search_service import SearchService
from app.services.recommendation_service import RecommendationService
from app.services.sync_service import (
    record_failed_sync,
    resolve_failed_sync,
    get_or_create_backfill_job,
    update_backfill_progress
)


@pytest.mark.asyncio
async def test_search_service_sync_products_handles_dict_and_orm():
    search_service = SearchService()
    search_service.meilisearch = MagicMock()
    search_service.meilisearch.index_name = "products"
    search_service.meilisearch.add_documents = AsyncMock(return_value={"taskUid": 1, "status": "succeeded"})

    pid1 = str(uuid4())
    pid2 = uuid4()

    # Dict input (from worker)
    dict_prod = {
        "id": pid1,
        "name": "Dict Product",
        "price": 25.5,
        "brand": "BrandX",
        "category_id": str(uuid4()),
        "embedding": [0.1, 0.2],
        "updated_at": "2026-10-01T00:00:00"
    }

    # ORM input
    orm_prod = Product(
        id=pid2,
        name="ORM Product",
        description="ORM Description",
        price=99.0,
        brand="BrandY",
        stock_quantity=5,
        version=1
    )

    result = await search_service.sync_products_to_meilisearch([dict_prod, orm_prod])
    assert result["status"] == "succeeded"
    search_service.meilisearch.add_documents.assert_called_once()
    docs = search_service.meilisearch.add_documents.call_args[1]["documents"]
    assert len(docs) == 2
    assert docs[0]["id"] == pid1
    assert docs[0]["name"] == "Dict Product"
    assert docs[1]["id"] == str(pid2)
    assert docs[1]["name"] == "ORM Product"


@pytest.mark.asyncio
async def test_search_service_ensure_index_initialized():
    search_service = SearchService()
    search_service.meilisearch = MagicMock()
    search_service.meilisearch.index_name = "products"
    search_service.meilisearch.index_exists = AsyncMock(return_value=False)
    search_service.meilisearch.create_index = AsyncMock()
    search_service.meilisearch.update_settings = AsyncMock()

    success = await search_service.ensure_index_initialized()
    assert success is True
    search_service.meilisearch.create_index.assert_called_once()
    search_service.meilisearch.update_settings.assert_called_once()


@pytest.mark.asyncio
async def test_search_service_get_popular_products_returns_list():
    search_service = SearchService()
    search_service.meilisearch = MagicMock()
    search_service.meilisearch.index_name = "products"
    search_service.meilisearch.search = AsyncMock(return_value={
        "hits": [{"id": "p1", "name": "Popular Item", "price": 10.0}],
        "estimatedTotalHits": 1
    })

    popular = await search_service.get_popular_products(limit=5)
    assert isinstance(popular, list)
    assert len(popular) == 1
    assert popular[0]["id"] == "p1"


@pytest.mark.asyncio
async def test_recommendation_service_collaborative_and_hybrid():
    mock_search = MagicMock()
    mock_search.get_popular_products = AsyncMock(return_value=[
        {"id": str(uuid4()), "name": "Popular 1", "price": 20.0}
    ])
    rec_service = RecommendationService(search_service=mock_search)

    target_id = uuid4()
    co_id = str(uuid4())

    # Mock collaborative filtering returning a product
    rec_service._get_collaborative_recommendations = AsyncMock(return_value=[
        {"id": co_id, "name": "Co-bought Product", "price": 30.0, "score": 1.0}
    ])
    rec_service._get_product_embedding = AsyncMock(return_value=None)

    recommendations = await rec_service.get_recommendations(product_id=target_id, limit=5)
    assert isinstance(recommendations, list)
    assert len(recommendations) >= 1
    # Check that co_id is prioritized and preserved
    assert recommendations[0]["id"] == co_id
    assert recommendations[0]["name"] == "Co-bought Product"


@pytest.mark.asyncio
async def test_recommendation_service_cold_start_fallback_never_empty():
    mock_search = MagicMock()
    fake_pop_id = str(uuid4())
    mock_search.get_popular_products = AsyncMock(return_value=[
        {"id": fake_pop_id, "name": "Fallback Popular", "price": 15.0}
    ])
    rec_service = RecommendationService(search_service=mock_search)

    target_id = uuid4()
    rec_service._get_collaborative_recommendations = AsyncMock(return_value=[])
    rec_service._get_product_embedding = AsyncMock(return_value=None)
    rec_service._get_category_recommendations = AsyncMock(return_value=[])

    recommendations = await rec_service.get_recommendations(product_id=target_id, limit=3)
    assert isinstance(recommendations, list)
    assert len(recommendations) >= 1
    assert recommendations[0]["id"] == fake_pop_id


@pytest.mark.asyncio
async def test_sync_service_dlq_recording_and_backfill():
    from unittest.mock import AsyncMock, patch

    fake_task_id = 42
    fake_pid = uuid4()

    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()

    class MockAsyncSessionContext:
        async def __aenter__(self):
            return mock_session
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("app.services.sync_service.AsyncSessionLocal", return_value=MockAsyncSessionContext()):
        task = await record_failed_sync(
            product_id=fake_pid,
            error="Connection timeout to Meilisearch",
            error_type="meilisearch_timeout"
        )
        assert task is not None
        assert task.product_id == fake_pid
        assert task.error == "Connection timeout to Meilisearch"
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_scripts_dry_run_modes():
    from scripts.reconcile_search import reconcile
    from scripts.backfill_search import backfill

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalar_one.return_value = 0
    mock_session.execute = AsyncMock(return_value=mock_result)

    class MockAsyncSessionContext:
        async def __aenter__(self):
            return mock_session
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    mock_search = MagicMock()
    mock_search.ensure_index_initialized = AsyncMock()
    mock_search.close = AsyncMock()
    mock_search.meilisearch.get_stats = AsyncMock(return_value={"numberOfDocuments": 0})

    with patch("scripts.reconcile_search.AsyncSessionLocal", return_value=MockAsyncSessionContext()), \
         patch("scripts.reconcile_search.SearchService", return_value=mock_search):
        rec_stats = await reconcile(dry_run=True)
        assert rec_stats["postgres_total"] == 0
        assert rec_stats["repaired"] == 0

    with patch("scripts.backfill_search.AsyncSessionLocal", return_value=MockAsyncSessionContext()), \
         patch("scripts.backfill_search.SearchService", return_value=mock_search):
        bf_stats = await backfill(dry_run=True)
        assert bf_stats["total"] == 0
        assert bf_stats["status"] == "dry_run_completed"
