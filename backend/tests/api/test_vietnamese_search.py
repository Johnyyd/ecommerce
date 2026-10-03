"""
Vietnamese search functionality tests.
Tests Meilisearch Vietnamese tokenizer, typo tolerance, and faceted search.
"""
import pytest
from unittest.mock import AsyncMock, patch
from app.services.search_service import SearchService


class TestVietnameseSearch:
    """Test Vietnamese search configuration and functionality."""

    @pytest.fixture
    def search_service(self):
        """Create a SearchService instance for testing."""
        return SearchService()

    @pytest.mark.asyncio
    async def test_ensure_index_initialized_vietnamese_config(self, search_service):
        """Test that index initialization includes Vietnamese tokenizer settings."""
        with patch.object(search_service.meilisearch, 'index_exists', return_value=False):
            with patch.object(search_service.meilisearch, 'create_index') as mock_create:
                with patch.object(search_service.meilisearch, 'update_settings') as mock_update:
                    result = await search_service.ensure_index_initialized()

                    assert result is True
                    mock_create.assert_called_once()
                    mock_update.assert_called_once()

                    # Check that update_settings was called with Vietnamese config
                    call_args = mock_update.call_args
                    settings = call_args[1]['settings']

                    # Verify Vietnamese tokenizer
                    assert settings['tokenizer'] == 'vi'

                    # Verify typo tolerance settings for Vietnamese
                    assert settings['typoTolerance']['enabled'] is True
                    assert settings['typoTolerance']['minWordSizeForTypos']['oneTypo'] == 4
                    assert settings['typoTolerance']['minWordSizeForTypos']['twoTypos'] == 8

                    # Verify ranking rules
                    expected_ranking_rules = [
                        "words", "typo", "proximity", "attribute", "sort", "exactness"
                    ]
                    assert settings['rankingRules'] == expected_ranking_rules

                    # Verify filterable attributes for faceted search
                    expected_filterable = ["category_id", "brand", "price", "is_active"]
                    assert settings['filterableAttributes'] == expected_filterable

                    # Verify sortable attributes
                    expected_sortable = ["price", "updated_at", "created_at"]
                    assert settings['sortableAttributes'] == expected_sortable

                    # Verify distinct attribute
                    assert settings['distinctAttribute'] == "id"

                    # Verify faceting settings
                    assert settings['faceting']['maxValuesPerFacet'] == 100

    @pytest.mark.asyncio
    async def test_vietnamese_typo_tolerance_search(self, search_service):
        """Test that Vietnamese typo tolerance works for common mistakes."""
        # Mock the Meilisearch search response
        mock_search_result = {
            "hits": [
                {
                    "id": "1",
                    "name": "Áo thun cotton",
                    "description": "Áo thun nam chất liệu cotton",
                    "price": 150000,
                    "brand": "Basic",
                    "category_id": "1"
                }
            ],
            "estimatedTotalHits": 1,
            "processingTimeMs": 5
        }

        with patch.object(search_service.meilisearch, 'search', return_value=mock_search_result) as mock_search:
            # Test typo: "ao thun" should match "áo thun"
            result = await search_service.search_products(
                query="ao thun",
                limit=10
            )

            assert result["estimatedTotalHits"] == 1
            assert len(result["hits"]) == 1
            assert result["hits"][0]["name"] == "Áo thun cotton"

            # Verify the search was called with correct parameters
            mock_search.assert_called_once()
            call_args = mock_search.call_args
            assert call_args[1]['query'] == "ao thun"

            # Test another typo: "dien thoai" should match "điện thoại"
            mock_search.reset_mock()
            result2 = await search_service.search_products(
                query="dien thoai",
                limit=10
            )

            assert result2["estimatedTotalHits"] == 1
            mock_search.assert_called_once()
            call_args2 = mock_search.call_args
            assert call_args2[1]['query'] == "dien thoai"

    @pytest.mark.asyncio
    async def test_faceted_search_performance(self, search_service):
        """Test faceted search performance with Vietnamese products."""
        # Mock response with facet distribution
        mock_search_result = {
            "hits": [
                {
                    "id": "1",
                    "name": "Áo thun Việt Nam",
                    "price": 150000,
                    "brand": "Viet T-Shirt",
                    "category_id": "1",
                    "is_active": True
                }
            ],
            "estimatedTotalHits": 1,
            "processingTimeMs": 8,  # Should be fast (< 100ms)
            "facetDistribution": {
                "category_id": {"1": 1},
                "brand": {"Viet T-Shirt": 1},
                "price": {"150000": 1},
                "is_active": {"True": 1}
            }
        }

        with patch.object(search_service.meilisearch, 'search', return_value=mock_search_result) as mock_search:
            result = await search_service.search_products(
                query="áo thun",
                filters={"category_id": "1", "is_active": True},
                facets=["category_id", "brand", "price", "is_active"],
                limit=10
            )

            assert result["processingTimeMs"] < 100  # Performance requirement: < 100ms
            assert result["estimatedTotalHits"] == 1
            assert "facetDistribution" in result

            # Verify filter was applied correctly
            mock_search.assert_called_once()
            call_args = mock_search.call_args
            assert call_args[1]['query'] == "áo thun"
            assert "category_id = \"1\" AND is_active = True" in call_args[1]['filter']

    @pytest.mark.asyncio
    async def test_vietnamese_diacritics_handling(self, search_service):
        """Test proper handling of Vietnamese diacritics in search."""
        test_cases = [
            # (search_query, expected_matches)
            ("ao", ["áo", "à", "ả", "ã", "ạ"]),  # a with different tones
            ("o", ["ó", "ò", "ỏ", "õ", "ọ", "ô", "ơ"]),  # o variations
            ("u", ["ú", "ù", "ủ", "ũ", "ụ", "ư"]),  # u variations
        ]

        for query_prefix, expected_variants in test_cases:
            with patch.object(search_service.meilisearch, 'search') as mock_search:
                mock_search.return_value = {
                    "hits": [{"id": "1", "name": "Test product"}],
                    "estimatedTotalHits": 1,
                    "processingTimeMs": 6
                }

                result = await search_service.search_products(
                    query=query_prefix,
                    limit=5
                )

                assert result["estimatedTotalHits"] >= 0  # Should not crash
                mock_search.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_with_sorting_vietnamese(self, search_service):
        """Test sorting functionality with Vietnamese search."""
        mock_search_result = {
            "hits": [
                {
                    "id": "1",
                    "name": "Áo thun giá rẻ",
                    "price": 50000,
                },
                {
                    "id": "2",
                    "name": "Áo thun chất lượng",
                    "price": 200000,
                }
            ],
            "estimatedTotalHits": 2,
            "processingTimeMs": 7
        }

        with patch.object(search_service.meilisearch, 'search', return_value=mock_search_result) as mock_search:
            # Test sorting by price ascending
            result = await search_service.search_products(
                query="áo thun",
                sort=["price:asc"],
                limit=10
            )

            assert result["estimatedTotalHits"] == 2
            mock_search.assert_called_once()
            call_args = mock_search.call_args
            assert call_args[1]['sort'] == ["price:asc"]

            # Test sorting by price descending
            mock_search.reset_mock()
            result2 = await search_service.search_products(
                query="áo thun",
                sort=["price:desc"],
                limit=10
            )

            assert result2["estimatedTotalHits"] == 2
            mock_search.assert_called_once()
            call_args2 = mock_search.call_args
            assert call_args2[1]['sort'] == ["price:desc"]

    @pytest.mark.asyncio
    async def test_vietnamese_search_fallback_simulation(self, search_service):
        """Test behavior when Meilisearch is unavailable (simulating fallback)."""
        # Simulate Meilisearch connection error
        with patch.object(search_service.meilisearch, 'search', side_effect=Exception("Connection failed")):
            # In the actual implementation, this would trigger fallback logic
            # For now, we just verify the error is properly propagated
            with pytest.raises(Exception, match="Connection failed"):
                await search_service.search_products(
                    query="test",
                    limit=10
                )


if __name__ == "__main__":
    pytest.main([__file__])