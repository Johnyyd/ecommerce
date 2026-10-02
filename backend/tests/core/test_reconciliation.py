"""
Unit tests for the reconciliation script.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from scripts.reconcile_search import reconcile


@pytest.mark.asyncio
async def test_reconcile_dry_run():
    """Test reconciliation in dry-run mode."""
    with patch('scripts.reconcile_search.SearchService') as mock_search_service_class, \
         patch('scripts.reconcile_search.AsyncSessionLocal') as mock_session_local:

        # Mock search service
        mock_search_service = AsyncMock()
        mock_search_service_class.return_value = mock_search_service
        mock_search_service.meilisearch.get_stats.return_value = {"numberOfDocuments": 5}

        # Mock database session
        mock_session = AsyncMock()
        mock_session_local.return_value.__aenter__.return_value = mock_session
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        # Run reconciliation
        result = await reconcile(dry_run=True, batch_size=100)

        # Assertions
        assert result["postgres_total"] == 0
        assert result["meilisearch_total"] == 5
        assert result["missing_in_search"] == 0
        assert result["stale_in_search"] == 0
        assert result["repaired"] == 0
        assert result["failed"] == 0

        # In dry-run mode, close is not called because of early return
        # Verify close was NOT called
        mock_search_service.close.assert_not_called()


@pytest.mark.asyncio
async def test_reconcile_with_discrepancies():
    """Test reconciliation with missing and stale products."""
    with patch('scripts.reconcile_search.SearchService') as mock_search_service_class, \
         patch('scripts.reconcile_search.AsyncSessionLocal') as mock_session_local:

        # Mock search service
        mock_search_service = AsyncMock()
        mock_search_service_class.return_value = mock_search_service
        mock_search_service.meilisearch.get_stats.return_value = {"numberOfDocuments": 1}

        # Mock database session with one product
        mock_session = AsyncMock()
        mock_session_local.return_value.__aenter__.return_value = mock_session

        # Create mock product
        mock_product = MagicMock()
        mock_product.id = 123
        mock_product.updated_at = None

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_product]
        mock_session.execute.return_value = mock_result

        # Mock Meilisearch document lookup - return None for missing, return stale doc
        mock_search_service.meilisearch.get_document.side_effect = [
            None,  # First call - product missing
        ]

        # Mock sync_products_to_meilisearch
        mock_search_service.sync_products_to_meilisearch.return_value = {"status": "succeeded"}

        # Run reconciliation
        result = await reconcile(dry_run=False, batch_size=100)

        # Assertions
        assert result["postgres_total"] == 1
        assert result["meilisearch_total"] == 1
        assert result["missing_in_search"] == 1
        assert result["repaired"] == 1  # Should have attempted repair
        assert result["failed"] == 0

        # Verify sync was called
        mock_search_service.sync_products_to_meilisearch.assert_awaited_once()
        # Verify close was called
        mock_search_service.close.assert_awaited_once()