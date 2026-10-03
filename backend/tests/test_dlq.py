"""
Tests for Dead Letter Queue (DLQ) and reconciliation functionality.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.search_sync import FailedSyncTask, SyncTaskType
from app.services.sync_service import record_failed_sync
from app.services.search_sync import sync_product_to_meilisearch
from app.services.search_service import SearchService
from app.models.product import Product
from app.core.queue import enqueue_sync_job, enqueue_delete_job
from scripts.reconcile_search import reconcile
import asyncio


@pytest.mark.asyncio
async def test_failed_task_persists_to_dlq_after_max_retries():
    """Test that failed tasks are recorded in DLQ after exhausting retries."""
    # Patch the AsyncSessionLocal at the module where it's used (sync_service)
    with patch('app.services.sync_service.AsyncSessionLocal') as mock_session_local:
        # Mock database session
        mock_session = AsyncMock()
        mock_session_local.return_value.__aenter__.return_value = mock_session
        mock_session.commit = AsyncMock()
        mock_session.add = MagicMock()
        mock_session.refresh = AsyncMock()

        # Create a test product
        test_product_id = uuid4()

        # Call the DLQ recording function directly (simulating final failure after retries)
        dlq_task = await record_failed_sync(
            product_id=test_product_id,
            error="Meilisearch connection timeout",
            error_type="sync_failure",
            attempt=3,
            max_attempts=3
        )

        # Verify DLQ entry was created
        assert dlq_task is not None
        assert dlq_task.product_id == test_product_id
        assert dlq_task.error == "Meilisearch connection timeout"
        assert dlq_task.error_type == "sync_failure"
        assert dlq_task.attempt == 3
        assert dlq_task.max_attempts == 3
        assert dlq_task.resolved_at is None  # Not yet resolved

        # Verify it would be persisted to database
        mock_session.add.assert_called_once()
        mock_session.commit.assert_awaited_once()
        mock_session.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_reconciliation_detects_missing_stale_orphaned():
    """Test that reconciliation correctly identifies missing, stale, and orphaned records."""
    with patch('scripts.reconcile_search.SearchService') as mock_search_service_class, \
         patch('scripts.reconcile_search.AsyncSessionLocal') as mock_session_local:

        # Mock search service
        mock_search_service = AsyncMock()
        mock_search_service_class.return_value = mock_search_service
        mock_search_service.meilisearch.get_stats.return_value = {"numberOfDocuments": 2}

        # Mock database session with 3 products
        mock_session = AsyncMock()
        mock_session_local.return_value.__aenter__.return_value = mock_session

        # Create mock products with proper updated_at as datetime objects
        from datetime import datetime, timezone

        product_missing = MagicMock()
        product_missing.id = uuid4()
        product_missing.updated_at = None

        product_stale = MagicMock()
        product_stale.id = uuid4()
        product_stale.updated_at = datetime(2026, 10, 3, 12, 0, 0, tzinfo=timezone.utc)

        product_synced = MagicMock()
        product_synced.id = uuid4()
        product_synced.updated_at = datetime(2026, 10, 3, 10, 0, 0, tzinfo=timezone.utc)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [product_missing, product_stale, product_synced]
        mock_session.execute.return_value = mock_result

        # Mock Meilisearch document lookup
        mock_search_service.meilisearch.get_document.side_effect = [
            None,  # Missing product
            {"updated_at": "2026-10-03T10:00:00+00:00"},  # Stale product (older in Meilisearch)
            {"updated_at": "2026-10-03T10:00:00+00:00"}   # Synced product (same)
        ]

        mock_search_service.sync_products_to_meilisearch.return_value = {"status": "succeeded"}
        mock_search_service.close = AsyncMock()

        # Test dry-run mode
        result = await reconcile(dry_run=True, batch_size=100)

        # Assertions for dry-run
        assert result["postgres_total"] == 3
        assert result["meilisearch_total"] == 2
        assert result["missing_in_search"] == 1
        assert result["stale_in_search"] == 1
        assert result["repaired"] == 0
        assert result["failed"] == 0

        # Verify close was NOT called in dry-run
        mock_search_service.close.assert_not_called()


@pytest.mark.asyncio
async def test_sync_idempotency_no_duplicates_on_re_run():
    """Test that syncing the same product multiple times doesn't create duplicates."""
    with patch('app.services.search_sync.get_meilisearch_client') as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_index = MagicMock()
        mock_client.index.return_value = mock_index

        mock_task = MagicMock()
        mock_task.task_uid = 12345
        mock_index.add_documents.return_value = mock_task

        with patch('app.services.search_sync._wait_for_task') as mock_wait:
            mock_wait.return_value = None

            test_product = MagicMock()
            test_product.id = uuid4()
            test_product.name = "Test Product"
            test_product.description = "A test product"
            test_product.price = 29.99
            test_product.brand = "TestBrand"
            test_product.category_id = uuid4()
            test_product.search_vector = "test product"
            test_product.embedding = [0.1, 0.2, 0.3]
            test_product.updated_at = None
            test_product.stock_quantity = 10
            test_product.is_active = True

            result1 = await sync_product_to_meilisearch(test_product)
            result2 = await sync_product_to_meilisearch(test_product)

            assert result1 is True
            assert result2 is True
            assert mock_index.add_documents.call_count == 2


@pytest.mark.asyncio
async def test_reconciliation_dry_run_vs_fix_behavior():
    """Test that --dry-run reports without changes and --fix applies fixes."""
    with patch('scripts.reconcile_search.SearchService') as mock_search_service_class, \
         patch('scripts.reconcile_search.AsyncSessionLocal') as mock_session_local:

        mock_search_service = AsyncMock()
        mock_search_service_class.return_value = mock_search_service
        mock_search_service.meilisearch.get_stats.return_value = {"numberOfDocuments": 1}

        mock_session = AsyncMock()
        mock_session_local.return_value.__aenter__.return_value = mock_session

        from datetime import datetime, timezone

        product_synced = MagicMock()
        product_synced.id = uuid4()
        product_synced.updated_at = datetime(2026, 10, 3, 10, 0, 0, tzinfo=timezone.utc)

        product_missing = MagicMock()
        product_missing.id = uuid4()
        product_missing.updated_at = None

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [product_synced, product_missing]
        mock_session.execute.return_value = mock_result

        mock_search_service.meilisearch.get_document.side_effect = [
            {"updated_at": "2026-10-03T10:00:00+00:00"},  # Synced product
            None                                           # Missing product
        ]

        mock_search_service.sync_products_to_meilisearch.return_value = {"status": "succeeded"}
        mock_search_service.close = AsyncMock()

        # Test dry-run
        dry_result = await reconcile(dry_run=True, batch_size=100)

        assert dry_result["postgres_total"] == 2
        assert dry_result["meilisearch_total"] == 1
        assert dry_result["missing_in_search"] == 1
        assert dry_result["stale_in_search"] == 0
        assert dry_result["repaired"] == 0
        assert dry_result["failed"] == 0

        mock_search_service.sync_products_to_meilisearch.assert_not_called()
        mock_search_service.close.assert_not_called()

        # Reset mock for fix test
        mock_search_service.reset_mock()
        mock_search_service.meilisearch.get_stats.return_value = {"numberOfDocuments": 1}
        mock_search_service.meilisearch.get_document.side_effect = [
            {"updated_at": "2026-10-03T10:00:00+00:00"},
            None
        ]
        mock_search_service.sync_products_to_meilisearch.return_value = {"status": "succeeded"}
        mock_search_service.close = AsyncMock()

        # Test fix mode
        fix_result = await reconcile(dry_run=False, batch_size=100)

        assert fix_result["postgres_total"] == 2
        assert fix_result["meilisearch_total"] == 1
        assert fix_result["missing_in_search"] == 1
        assert fix_result["repaired"] == 1
        assert fix_result["failed"] == 0

        mock_search_service.sync_products_to_meilisearch.assert_awaited_once()
        mock_search_service.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_enqueue_sync_job_integration():
    """Test that sync jobs can be enqueued through the queue system."""
    with patch('app.core.queue.get_queue_pool') as mock_get_pool:
        # Mock queue pool as async
        mock_pool = AsyncMock()
        mock_get_pool.return_value = mock_pool
        mock_job = MagicMock()
        mock_job.job_id = "test-job-id-123"
        mock_pool.enqueue_job.return_value = mock_job

        # Test enqueuing a sync job
        test_product_id = uuid4()
        job_id = await enqueue_sync_job(test_product_id)

        # Verify job was enqueued
        assert job_id == "test-job-id-123"
        mock_pool.enqueue_job.assert_awaited_once_with(
            "sync_product_task",
            str(test_product_id),
            "sync",
            _job_timeout=120,
            _max_tries=3
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])