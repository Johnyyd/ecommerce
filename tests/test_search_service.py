import pytest
import asyncio
from unittest.mock import Mock, patch
from app.services.search_service import SearchService


@pytest.fixture
def search_service():
    return SearchService()


@pytest.mark.asyncio
async def test_search_service_initialization(search_service):
    """Test that the search service initializes correctly."""
    assert search_service is not None
    assert hasattr(search_service, 'client')
    assert search_service.index_name == "products"


@pytest.mark.asyncio
@patch('app.services.search_service.Client')
async def test_initialize_index_success(mock_client_class, search_service):
    """Test successful index initialization."""
    # Mock the Meilisearch client
    mock_client = Mock()
    mock_client_class.return_value = mock_client
    mock_index = Mock()
    mock_client.index.return_value = mock_index

    # Mock index.fetch_info to raise exception (index doesn't exist)
    mock_index.fetch_info.side_effect = Exception("Index not found")
    mock_client.create_index.return_value = mock_index

    result = await search_service.initialize_index()

    assert result is True
    mock_client.create_index.assert_called_once_with("products")
    mock_index.update_settings.assert_called_once()


@pytest.mark.asyncio
@patch('app.services.search_service.Client')
async def test_initialize_index_already_exists(mock_client_class, search_service):
    """Test index initialization when index already exists."""
    # Mock the Meilisearch client
    mock_client = Mock()
    mock_client_class.return_value = mock_client
    mock_index = Mock()
    mock_client.index.return_value = mock_index

    # Mock index.fetch_info to succeed (index exists)
    mock_index.fetch_info.return_value = Mock()

    result = await search_service.initialize_index()

    assert result is True
    mock_client.create_index.assert_not_called()
    mock_index.update_settings.assert_called_once()


@pytest.mark.asyncio
@patch('app.services.search_service.Client')
async def test_add_product_success(mock_client_class, search_service):
    """Test successful product addition."""
    # Mock the Meilisearch client
    mock_client = Mock()
    mock_client_class.return_value = mock_client
    mock_index = Mock()
    mock_client.index.return_value = mock_index

    product_data = {
        "id": "test-product-id",
        "name": "Test Product",
        "description": "A test product",
        "price": 29.99,
        "brand": "Test Brand",
        "category_id": "test-category-id",
        "stock_quantity": 100,
        "rating": 4.5,
        "image_url": "http://example.com/image.jpg"
    }

    result = await search_service.add_product(product_data)

    assert result is True
    mock_index.add_documents.assert_called_once()


@pytest.mark.asyncio
@patch('app.services.search_service.Client')
async def test_search_products_success(mock_client_class, search_service):
    """Test successful product search."""
    # Mock the Meilisearch client
    mock_client = Mock()
    mock_client_class.return_value = mock_client
    mock_index = Mock()
    mock_client.index.return_value = mock_index

    # Mock search results
    mock_index.search.return_value = {
        "hits": [
            {
                "id": "test-product-id",
                "name": "Test Product",
                "price": 29.99
            }
        ],
        "estimatedTotalHits": 1,
        "processingTimeMs": 5
    }

    result = await search_service.search_products(
        query="test",
        limit=10,
        offset=0
    )

    assert result["total"] == 1
    assert len(result["hits"]) == 1
    assert result["hits"][0]["name"] == "Test Product"
    mock_index.search.assert_called_once()


@pytest.mark.asyncio
@patch('app.services.search_service.Client')
async def test_delete_product_success(mock_client_class, search_service):
    """Test successful product deletion."""
    # Mock the Meilisearch client
    mock_client = Mock()
    mock_client_class.return_value = mock_client
    mock_index = Mock()
    mock_client.index.return_value = mock_index

    result = await search_service.delete_product("test-product-id")

    assert result is True
    mock_index.delete_document.assert_called_once_with("test-product-id")


if __name__ == "__main__":
    pytest.main([__file__])