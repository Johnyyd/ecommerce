"""
Unit tests for MeilisearchService using the official meilisearch Python SDK.
Tests cover index management, search operations, and error handling.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, List, Optional

from app.services.search_service import MeilisearchService, SearchService, MEILISEARCH_INDEX_NAME


class TestMeilisearchService:
    """Tests for the low-level MeilisearchService class."""

    @pytest.fixture
    def mock_task(self):
        """Create a mock task object."""
        mock_t = Mock()
        mock_t.task_uid = 1
        return mock_t

    @pytest.fixture
    def mock_index(self):
        """Create a mock Meilisearch index."""
        mock_idx = Mock()
        mock_idx.uid = MEILISEARCH_INDEX_NAME
        return mock_idx

    @pytest.fixture
    def mock_search_result(self):
        """Create a mock search result."""
        mock_result = Mock()
        mock_result.hits = [
            {"id": "1", "name": "Áo thun", "price": 100.0},
            {"id": "2", "name": "Áo khoác", "price": 200.0}
        ]
        mock_result.estimated_total_hits = 2
        mock_result.processing_time_ms = 5
        mock_result.query = "ao thun"
        mock_result.facet_distribution = {
            "category_id": {"cat1": 5, "cat2": 3},
            "brand": {"Brand A": 6, "Brand B": 4}
        }
        return mock_result

    @pytest.fixture
    def mock_stats(self):
        """Create a mock stats object."""
        mock_s = Mock()
        mock_s.number_of_documents = 100
        mock_s.is_indexing = False
        mock_s.field_distribution = {"name": 100, "description": 95, "price": 100}
        return mock_s

    @pytest.fixture
    def service_with_mocks(self, mock_task, mock_index, mock_search_result, mock_stats):
        """Create a MeilisearchService with fully mocked client."""
        with patch('app.services.search_service.Client') as mock_client_class:
            mock_client = Mock()
            mock_client_class.return_value = mock_client

            # Configure client methods
            mock_client.create_index.return_value = mock_task
            mock_client.delete_index.return_value = mock_task
            mock_client.get_index.return_value = mock_index
            mock_client.index.return_value = mock_index
            mock_client.wait_for_task.return_value = None

            # Configure index methods
            mock_index.add_documents.return_value = mock_task
            mock_index.update_documents.return_value = mock_task
            mock_index.delete_documents.return_value = mock_task
            mock_index.search.return_value = mock_search_result
            mock_index.get_document.return_value = {"id": "1", "name": "Áo thun", "price": 100.0}
            mock_index.get_stats.return_value = mock_stats
            mock_index.update_settings.return_value = mock_task

            service = MeilisearchService()
            service.client = mock_client
            yield service, mock_client, mock_index, mock_task

    @pytest.mark.asyncio
    async def test_service_initialization(self):
        """Test that the service initializes with correct configuration."""
        service = MeilisearchService()

        assert service.base_url == "http://meilisearch:7700"
        assert service.master_key == "masterKey123"
        assert service.index_name == MEILISEARCH_INDEX_NAME
        assert service.client is not None
        await service.close()

    @pytest.mark.asyncio
    async def test_create_index_success(self, service_with_mocks):
        """Test successful index creation."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.create_index()

        assert result["taskUid"] == 1
        assert result["status"] == "succeeded"
        mock_client.create_index.assert_called_once_with(MEILISEARCH_INDEX_NAME)
        mock_client.wait_for_task.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_create_index_with_custom_settings(self, service_with_mocks):
        """Test index creation with custom settings."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        settings = {
            "searchableAttributes": ["name", "description", "brand"],
            "filterableAttributes": ["category_id", "brand", "price"],
            "sortableAttributes": ["price", "created_at"],
            "rankingRules": [
                "words",
                "typo",
                "proximity",
                "attribute",
                "sort",
                "exactness"
            ],
            "typoTolerance": {
                "enabled": True,
                "minWordSizeForTypos": {
                    "oneTypo": 5,
                    "twoTypos": 9
                }
            }
        }

        result = await service.create_index(settings=settings)

        assert result["taskUid"] == 1
        assert result["status"] == "succeeded"
        mock_client.create_index.assert_called_once()
        call_args = mock_client.create_index.call_args
        assert call_args[1]['uid'] == MEILISEARCH_INDEX_NAME

    @pytest.mark.asyncio
    async def test_delete_index_success(self, service_with_mocks):
        """Test successful index deletion."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.delete_index()

        assert result["taskUid"] == 1
        assert result["status"] == "succeeded"
        mock_client.delete_index.assert_called_once_with(MEILISEARCH_INDEX_NAME)
        mock_client.wait_for_task.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_index_exists_true(self, service_with_mocks):
        """Test index existence check when index exists."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.index_exists()

        assert result is True
        mock_client.get_index.assert_called_once_with(MEILISEARCH_INDEX_NAME)

    @pytest.mark.asyncio
    async def test_index_exists_false(self, service_with_mocks):
        """Test index existence check when index doesn't exist."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        from meilisearch.errors import MeilisearchApiError
        mock_client.get_index.side_effect = MeilisearchApiError("Index not found", Mock())

        result = await service.index_exists()

        assert result is False

    @pytest.mark.asyncio
    async def test_add_documents_success(self, service_with_mocks):
        """Test adding documents to index."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        documents = [
            {"id": "1", "name": "Product 1", "price": 10.0},
            {"id": "2", "name": "Product 2", "price": 20.0}
        ]

        result = await service.add_documents(MEILISEARCH_INDEX_NAME, documents)

        assert result["taskUid"] == 1
        assert result["status"] == "succeeded"
        mock_client.index.assert_called_once_with(MEILISEARCH_INDEX_NAME)
        mock_index.add_documents.assert_called_once_with(documents)
        mock_client.wait_for_task.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_update_documents_success(self, service_with_mocks):
        """Test updating documents in index."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        documents = [
            {"id": "1", "name": "Updated Product 1", "price": 15.0}
        ]

        result = await service.update_documents(MEILISEARCH_INDEX_NAME, documents)

        assert result["taskUid"] == 1
        assert result["status"] == "succeeded"
        mock_index.update_documents.assert_called_once_with(documents)
        mock_client.wait_for_task.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_delete_documents_success(self, service_with_mocks):
        """Test deleting documents from index."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        document_ids = ["1", "2"]

        result = await service.delete_documents(MEILISEARCH_INDEX_NAME, document_ids)

        assert result["taskUid"] == 1
        assert result["status"] == "succeeded"
        mock_index.delete_documents.assert_called_once_with(document_ids)
        mock_client.wait_for_task.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_search_with_query_only(self, service_with_mocks, mock_search_result):
        """Test basic search with query only."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.search("ao thun")

        assert result["estimatedTotalHits"] == 2
        assert len(result["hits"]) == 2
        assert result["hits"][0]["name"] == "Áo thun"
        mock_client.index.assert_called_once_with(MEILISEARCH_INDEX_NAME)
        mock_index.search.assert_called_once()
        call_kwargs = mock_index.search.call_args[1]
        assert call_kwargs['q'] == "ao thun"

    @pytest.mark.asyncio
    async def test_search_with_filters(self, service_with_mocks, mock_search_result):
        """Test search with filter parameters."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.search(
            "ao thun",
            filter="category_id = cat1 AND price > 50",
            limit=10,
            offset=0
        )

        assert result["estimatedTotalHits"] == 2
        call_kwargs = mock_index.search.call_args[1]
        assert call_kwargs['filter'] == "category_id = cat1 AND price > 50"
        assert call_kwargs['limit'] == 10
        assert call_kwargs['offset'] == 0

    @pytest.mark.asyncio
    async def test_search_with_facets(self, service_with_mocks, mock_search_result):
        """Test search requesting facet distributions."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.search(
            "ao",
            facets=["category_id", "brand", "price_range"]
        )

        assert "facetDistribution" in result
        assert "category_id" in result["facetDistribution"]
        assert result["facetDistribution"]["category_id"]["cat1"] == 5
        call_kwargs = mock_index.search.call_args[1]
        assert call_kwargs['facets'] == ["category_id", "brand", "price_range"]

    @pytest.mark.asyncio
    async def test_search_with_sort(self, service_with_mocks, mock_search_result):
        """Test search with sort parameter."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.search("product", sort=["price:asc"])

        call_kwargs = mock_index.search.call_args[1]
        assert call_kwargs['sort'] == ["price:asc"]

    @pytest.mark.asyncio
    async def test_search_with_highlight(self, service_with_mocks, mock_search_result):
        """Test search with highlight attributes."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.search("cotton", attributesToHighlight=["name", "description"])

        call_kwargs = mock_index.search.call_args[1]
        assert call_kwargs['attributesToHighlight'] == ["name", "description"]

    @pytest.mark.asyncio
    async def test_get_document_success(self, service_with_mocks):
        """Test getting a single document."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.get_document(MEILISEARCH_INDEX_NAME, "1")

        assert result["id"] == "1"
        assert result["name"] == "Áo thun"
        mock_index.get_document.assert_called_once_with("1")

    @pytest.mark.asyncio
    async def test_get_stats_success(self, service_with_mocks, mock_stats):
        """Test getting index statistics."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        result = await service.get_stats()

        assert result["numberOfDocuments"] == 100
        assert result["isIndexing"] is False
        mock_index.get_stats.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_settings(self, service_with_mocks):
        """Test updating index settings."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        settings = {
            "searchableAttributes": ["name", "description", "brand"],
            "filterableAttributes": ["category_id", "brand", "price"],
            "synonyms": {
                "ao thun": ["t-shirt", "tee"],
                "quan jean": ["jeans", "denim"]
            },
            "stopWords": ["của", "và", "là", "cho"]
        }

        result = await service.update_settings(MEILISEARCH_INDEX_NAME, settings)

        assert result["taskUid"] == 1
        assert result["status"] == "succeeded"
        mock_index.update_settings.assert_called_once_with(settings)
        mock_client.wait_for_task.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_connection_error_handling(self, service_with_mocks):
        """Test handling of connection errors."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        from meilisearch.errors import MeilisearchCommunicationError
        mock_client.get_index.side_effect = MeilisearchCommunicationError("Connection refused")

        result = await service.index_exists()

        assert result is False

    @pytest.mark.asyncio
    async def test_close_client(self, service_with_mocks):
        """Test closing the HTTP client."""
        service, mock_client, mock_index, mock_task = service_with_mocks

        # close() is a no-op for the sync client
        await service.close()
        # Just verify it doesn't throw
        assert True


class TestSearchService:
    """Tests for the high-level SearchService class."""

    @pytest.fixture
    def mock_meilisearch_service(self):
        """Create a mock MeilisearchService."""
        mock_service = AsyncMock(spec=MeilisearchService)
        mock_service.index_name = MEILISEARCH_INDEX_NAME
        mock_service.add_documents = AsyncMock(return_value={"taskUid": 1, "status": "enqueued"})
        mock_service.search = AsyncMock(return_value={
            "hits": [
                {"id": "1", "name": "Áo thun nam", "price": 150000, "brand": "Brand A", "category_id": "cat-1"}
            ],
            "estimatedTotalHits": 1,
            "processingTimeMs": 5,
            "query": "ao thun",
            "facetDistribution": {
                "category_id": {"cat-1": 1},
                "brand": {"Brand A": 1}
            }
        })
        mock_service.close = AsyncMock()
        return mock_service

    @pytest.fixture
    def search_service(self, mock_meilisearch_service):
        """Create a SearchService with mocked MeilisearchService."""
        with patch('app.services.search_service.MeilisearchService', return_value=mock_meilisearch_service):
            service = SearchService()
            service.meilisearch = mock_meilisearch_service
            yield service

    @pytest.mark.asyncio
    async def test_search_service_initialization(self, search_service):
        """Test SearchService initializes correctly."""
        assert search_service is not None
        assert search_service.meilisearch is not None

    @pytest.mark.asyncio
    async def test_sync_product_to_meilisearch(self, search_service, mock_meilisearch_service):
        """Test syncing a single product to Meilisearch."""
        mock_product = Mock()
        mock_product.id = "test-id-1"
        mock_product.name = "Áo thun cotton"
        mock_product.description = "Áo thun cotton cao cấp"
        mock_product.price = 150000
        mock_product.brand = "Brand A"
        mock_product.category_id = "cat-1"
        mock_product.search_vector = "á thun cotton cao cấp"
        mock_product.embedding = [0.1] * 1536
        mock_product.updated_at = Mock()
        mock_product.updated_at.isoformat.return_value = "2024-01-01T00:00:00"

        result = await search_service.sync_product_to_meilisearch(mock_product)

        assert result["status"] == "enqueued"
        mock_meilisearch_service.add_documents.assert_called_once()
        # Verify document structure
        call_args = mock_meilisearch_service.add_documents.call_args
        documents = call_args.kwargs.get('documents') or call_args.args[1]
        assert len(documents) == 1
        doc = documents[0]
        assert doc["id"] == "test-id-1"
        assert doc["name"] == "Áo thun cotton"
        assert doc["price"] == 150000.0
        assert doc["brand"] == "Brand A"
        assert doc["category_id"] == "cat-1"

    @pytest.mark.asyncio
    async def test_sync_products_to_meilisearch_batch(self, search_service, mock_meilisearch_service):
        """Test syncing multiple products in batch."""
        products = []
        for i in range(3):
            mock_product = Mock()
            mock_product.id = f"test-id-{i}"
            mock_product.name = f"Product {i}"
            mock_product.description = f"Description {i}"
            mock_product.price = 100.0 * (i + 1)
            mock_product.brand = f"Brand {i}"
            mock_product.category_id = f"cat-{i}"
            mock_product.search_vector = f"product {i} description {i}"
            mock_product.embedding = [0.1] * 1536
            mock_product.updated_at = Mock()
            mock_product.updated_at.isoformat.return_value = "2024-01-01T00:00:00"
            products.append(mock_product)

        result = await search_service.sync_products_to_meilisearch(products)

        assert result["status"] == "enqueued"
        mock_meilisearch_service.add_documents.assert_called_once()
        call_args = mock_meilisearch_service.add_documents.call_args
        documents = call_args.kwargs.get('documents') or call_args.args[1]
        assert len(documents) == 3

    @pytest.mark.asyncio
    async def test_search_products_with_filters(self, search_service, mock_meilisearch_service):
        """Test searching products with filters."""
        mock_meilisearch_service.search.return_value = {
            "hits": [
                {"id": "1", "name": "Áo thun nam", "price": 150000, "brand": "Brand A", "category_id": "cat-1"}
            ],
            "estimatedTotalHits": 1,
            "processingTimeMs": 5,
            "query": "ao thun",
            "facetDistribution": {
                "category_id": {"cat-1": 1},
                "brand": {"Brand A": 1}
            }
        }

        result = await search_service.search_products(
            query="ao thun",
            filters={"category_id": "cat-1", "brand": "Brand A"},
            limit=20
        )

        assert result["estimatedTotalHits"] == 1
        assert len(result["hits"]) == 1
        assert "facetDistribution" in result
        mock_meilisearch_service.search.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_popular_products(self, search_service, mock_meilisearch_service):
        """Test getting popular products."""
        mock_meilisearch_service.search.return_value = {
            "hits": [
                {"id": "1", "name": "Popular Product 1", "price": 100.0},
                {"id": "2", "name": "Popular Product 2", "price": 200.0}
            ],
            "estimatedTotalHits": 2,
            "processingTimeMs": 3,
            "query": ""
        }

        result = await search_service.get_popular_products(limit=10)

        assert result["estimatedTotalHits"] == 2
        mock_meilisearch_service.search.assert_called_once()
        call_kwargs = mock_meilisearch_service.search.call_args.kwargs
        assert call_kwargs['q'] == ""
        assert call_kwargs['limit'] == 10

    @pytest.mark.asyncio
    async def test_get_recommendations_by_embedding(self, search_service, mock_meilisearch_service):
        """Test getting recommendations by embedding vector."""
        mock_meilisearch_service.search.return_value = {
            "hits": [
                {"id": "2", "name": "Similar Product", "price": 150.0}
            ],
            "estimatedTotalHits": 1,
            "processingTimeMs": 4,
            "query": ""
        }

        embedding = [0.1] * 1536
        result = await search_service.get_recommendations_by_embedding(embedding, limit=5)

        assert result["estimatedTotalHits"] == 1
        mock_meilisearch_service.search.assert_called_once()

    @pytest.mark.asyncio
    async def test_close_delegates_to_meilisearch(self, search_service, mock_meilisearch_service):
        """Test that close() delegates to MeilisearchService."""
        await search_service.close()

        mock_meilisearch_service.close.assert_called_once()


class TestSearchServiceIntegration:
    """Integration-style tests for search operations."""

    @pytest.mark.asyncio
    async def test_vietnamese_typo_tolerance_search(self):
        """Test that Vietnamese queries with typos return relevant results."""
        # This test documents expected behavior - actual Meilisearch
        # configuration for Vietnamese is done in index settings
        pass

    @pytest.mark.asyncio
    async def test_faceted_search_price_ranges(self):
        """Test faceted search with price range buckets."""
        # Expected facet configuration for price ranges
        price_ranges = ["0-50000", "50000-100000", "100000-500000", "500000+"]
        # Meilisearch facet search would return distribution across these ranges
        pass

    @pytest.mark.asyncio
    async def test_empty_search_results(self):
        """Test handling of empty search results."""
        pass

    @pytest.mark.asyncio
    async def test_large_batch_sync_performance(self):
        """Test syncing large batches of products (1000+)."""
        # Should process in chunks to avoid memory issues
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])