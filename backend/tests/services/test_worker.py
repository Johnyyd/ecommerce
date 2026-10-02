import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone
from app.models.product import Product
from app.services.embedding_service import EmbeddingService
from app.services.search_service import SearchService


@pytest.mark.asyncio
async def test_generate_embeddings_task_no_products():
    """Test embeddings generation when no products need embeddings."""
    from app.worker import generate_embeddings_task

    # Mock context and dependencies
    ctx = MagicMock()

    with patch('app.worker.get_db_session') as mock_get_db_session, \
         patch('app.worker.ProductRepository') as mock_repo_class, \
         patch('app.worker.get_embedding_service') as mock_get_embedding_service:

        # Mock async generator for db session
        mock_session = AsyncMock()
        mock_get_db_session.return_value.__aiter__.return_value = [mock_session]

        # Mock repository to return no products
        mock_repo = AsyncMock()
        mock_repo_class.return_value = mock_repo
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        # Mock embedding service
        mock_embedding_service = AsyncMock()
        mock_get_embedding_service.return_value = mock_embedding_service

        # Execute task
        result = await generate_embeddings_task(ctx, batch_size=50)

        # Assertions
        assert result["processed"] == 0
        assert result["embedded"] == 0
        assert result["failed"] == 0
        assert result["skipped"] == 0
        mock_embedding_service.close.assert_called_once()


@pytest.mark.asyncio
async def test_generate_embeddings_task_with_products():
    """Test embeddings generation with products needing embeddings."""
    from app.worker import generate_embeddings_task

    # Mock context and dependencies
    ctx = MagicMock()

    with patch('app.worker.get_db_session') as mock_get_db_session, \
         patch('app.worker.ProductRepository') as mock_repo_class, \
         patch('app.worker.get_embedding_service') as mock_get_embedding_service:

        # Mock async generator for db session
        mock_session = AsyncMock()
        mock_get_db_session.return_value.__aiter__.return_value = [mock_session]

        # Mock repository to return products
        mock_repo = AsyncMock()
        mock_repo_class.return_value = mock_repo

        # Create test products
        test_product_ids = [uuid4(), uuid4()]
        test_products = []
        for pid in test_product_ids:
            product = MagicMock(spec=Product)
            product.id = pid
            product.name = f"Test Product {pid}"
            product.description = f"Description for {pid}"
            product.embedding = None
            test_products.append(product)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = test_products
        mock_session.execute.return_value = mock_result

        # Mock embedding service to return embeddings
        mock_embedding_service = AsyncMock()
        mock_embedding_service.get_embeddings.return_value = [
            [0.1, 0.2, 0.3],  # embedding for first product
            [0.4, 0.5, 0.6]   # embedding for second product
        ]
        mock_get_embedding_service.return_value = mock_embedding_service

        # Mock session.add and commit
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()

        # Execute task
        result = await generate_embeddings_task(ctx, batch_size=50)

        # Assertions
        assert result["processed"] == 2
        assert result["embedded"] == 2
        assert result["failed"] == 0
        assert result["skipped"] == 0
        assert mock_session.add.call_count == 2
        assert mock_session.commit.call_count == 1
        mock_embedding_service.close.assert_called_once()


@pytest.mark.asyncio
async def test_generate_embeddings_task_batch_processing():
    """Test embeddings generation processes in batches correctly."""
    from app.worker import generate_embeddings_task

    # Mock context and dependencies
    ctx = MagicMock()

    with patch('app.worker.get_db_session') as mock_get_db_session, \
         patch('app.worker.ProductRepository') as mock_repo_class, \
         patch('app.worker.get_embedding_service') as mock_get_embedding_service, \
         patch('asyncio.sleep', return_value=None) as mock_sleep:

        # Mock async generator for db session
        mock_session = AsyncMock()
        mock_get_db_session.return_value.__aiter__.return_value = [mock_session]

        # Mock repository to return products (more than batch size)
        mock_repo = AsyncMock()
        mock_repo_class.return_value = mock_repo

        # Create test products (3 products, batch size 2)
        test_product_ids = [uuid4(), uuid4(), uuid4()]
        test_products = []
        for pid in test_product_ids:
            product = MagicMock(spec=Product)
            product.id = pid
            product.name = f"Test Product {pid}"
            product.description = f"Description for {pid}"
            product.embedding = None
            test_products.append(product)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = test_products
        mock_session.execute.return_value = mock_result

        # Mock embedding service to return embeddings
        mock_embedding_service = AsyncMock()
        # Return embeddings for first batch, then second batch
        mock_embedding_service.get_embeddings.side_effect = [
            [[0.1, 0.2], [0.3, 0.4]],  # First batch embeddings
            [[0.5, 0.6]]               # Second batch embeddings
        ]
        mock_get_embedding_service.return_value = mock_embedding_service

        # Mock session.add and commit
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()

        # Execute task with batch_size=2
        result = await generate_embeddings_task(ctx, batch_size=2)

        # Assertions
        assert result["processed"] == 3
        assert result["embedded"] == 3
        assert result["failed"] == 0
        assert result["skipped"] == 0
        # Should have called sleep once between batches
        mock_sleep.assert_called_once_with(0.5)
        mock_embedding_service.close.assert_called_once()


@pytest.mark.asyncio
async def test_sync_to_meilisearch_task_no_products():
    """Test Meilisearch sync when no products have embeddings."""
    from app.worker import sync_to_meilisearch_task

    # Mock context and dependencies
    ctx = MagicMock()

    with patch('app.worker.get_db_session') as mock_get_db_session, \
         patch('app.worker.ProductRepository') as mock_repo_class, \
         patch('app.worker.SearchService') as mock_search_service_class:

        # Mock async generator for db session
        mock_session = AsyncMock()
        mock_get_db_session.return_value.__aiter__.return_value = [mock_session]

        # Mock repository to return no products
        mock_repo = AsyncMock()
        mock_repo_class.return_value = mock_repo
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        # Mock search service
        mock_search_service = AsyncMock()
        mock_search_service_class.return_value = mock_search_service

        # Execute task
        result = await sync_to_meilisearch_task(ctx, batch_size=100)

        # Assertions
        assert result["processed"] == 0
        assert result["synced"] == 0
        assert result["failed"] == 0
        assert result["skipped"] == 0
        mock_search_service.close.assert_called_once()


@pytest.mark.asyncio
async def test_sync_to_meilisearch_task_with_products():
    """Test Meilisearch sync with products having embeddings."""
    from app.worker import sync_to_meilisearch_task

    # Mock context and dependencies
    ctx = MagicMock()

    with patch('app.worker.get_db_session') as mock_get_db_session, \
         patch('app.worker.ProductRepository') as mock_repo_class, \
         patch('app.worker.SearchService') as mock_search_service_class, \
         patch('app.worker.record_failed_sync', new_callable=AsyncMock):

        # Mock async generator for db session
        mock_session = AsyncMock()
        mock_get_db_session.return_value.__aiter__.return_value = [mock_session]

        # Mock repository to return products
        mock_repo = AsyncMock()
        mock_repo_class.return_value = mock_repo

        # Create test products with embeddings
        test_product_ids = [uuid4(), uuid4()]
        test_products = []
        for pid in test_product_ids:
            product = MagicMock(spec=Product)
            product.id = pid
            product.name = f"Test Product {pid}"
            product.description = f"Description for {pid}"
            product.embedding = [0.1, 0.2, 0.3]  # Has embedding
            product.updated_at = datetime.now(timezone.utc)
            product.category_id = uuid4()
            test_products.append(product)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = test_products
        mock_session.execute.return_value = mock_result

        # Mock search service to return success
        mock_search_service = AsyncMock()
        mock_search_service.sync_products_to_meilisearch.return_value = {
            "status": "succeeded"
        }
        mock_search_service_class.return_value = mock_search_service

        # Execute task
        result = await sync_to_meilisearch_task(ctx, batch_size=100)

        # Assertions
        assert result["processed"] == 2
        assert result["synced"] == 2
        assert result["failed"] == 0
        assert result["skipped"] == 0
        mock_search_service.close.assert_called_once()


@pytest.mark.asyncio
async def test_sync_to_meilisearch_task_batch_processing():
    """Test Meilisearch sync processes in batches correctly."""
    from app.worker import sync_to_meilisearch_task

    # Mock context and dependencies
    ctx = MagicMock()

    with patch('app.worker.get_db_session') as mock_get_db_session, \
         patch('app.worker.ProductRepository') as mock_repo_class, \
         patch('app.worker.SearchService') as mock_search_service_class, \
         patch('app.worker.record_failed_sync', new_callable=AsyncMock), \
         patch('asyncio.sleep', return_value=None) as mock_sleep:

        # Mock async generator for db session
        mock_session = AsyncMock()
        mock_get_db_session.return_value.__aiter__.return_value = [mock_session]

        # Mock repository to return products (more than batch size)
        mock_repo = AsyncMock()
        mock_repo_class.return_value = mock_repo

        # Create test products (3 products, batch size 2)
        test_product_ids = [uuid4(), uuid4(), uuid4()]
        test_products = []
        for pid in test_product_ids:
            product = MagicMock(spec=Product)
            product.id = pid
            product.name = f"Test Product {pid}"
            product.description = f"Description for {pid}"
            product.embedding = [0.1, 0.2, 0.3]  # Has embedding
            product.updated_at = datetime.now(timezone.utc)
            product.category_id = uuid4()
            test_products.append(product)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = test_products
        mock_session.execute.return_value = mock_result

        # Mock search service to return success for each batch
        mock_search_service = AsyncMock()
        mock_search_service.sync_products_to_meilisearch.return_value = {
            "status": "succeeded"
        }
        mock_search_service_class.return_value = mock_search_service

        # Execute task with batch_size=2
        result = await sync_to_meilisearch_task(ctx, batch_size=2)

        # Assertions
        assert result["processed"] == 3
        assert result["synced"] == 3
        assert result["failed"] == 0
        assert result["skipped"] == 0
        # Should have called sleep once between batches
        mock_sleep.assert_called_once_with(0.2)
        mock_search_service.close.assert_called_once()


@pytest.mark.asyncio
async def test_incremental_sync_task_no_products():
    """Test incremental sync when no recently updated products."""
    from app.worker import incremental_sync_task

    # Mock context and dependencies
    ctx = MagicMock()

    with patch('app.worker.get_db_session') as mock_get_db_session, \
         patch('app.worker.ProductRepository') as mock_repo_class, \
         patch('app.worker.SearchService') as mock_search_service_class:

        # Mock async generator for db session
        mock_session = AsyncMock()
        mock_get_db_session.return_value.__aiter__.return_value = [mock_session]

        # Mock repository to return no products
        mock_repo = AsyncMock()
        mock_repo_class.return_value = mock_repo
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        # Mock search service
        mock_search_service = AsyncMock()
        mock_search_service_class.return_value = mock_search_service

        # Execute task
        result = await incremental_sync_task(ctx)

        # Assertions
        assert result["processed"] == 0
        assert result["updated"] == 0
        assert result["failed"] == 0
        mock_search_service.close.assert_called_once()


@pytest.mark.asyncio
async def test_incremental_sync_task_with_products():
    """Test incremental sync with recently updated products."""
    from app.worker import incremental_sync_task

    # Mock context and dependencies
    ctx = MagicMock()

    with patch('app.worker.get_db_session') as mock_get_db_session, \
         patch('app.worker.ProductRepository') as mock_repo_class, \
         patch('app.worker.SearchService') as mock_search_service_class, \
         patch('app.worker.record_failed_sync', new_callable=AsyncMock):

        # Mock async generator for db session
        mock_session = AsyncMock()
        mock_get_db_session.return_value.__aiter__.return_value = [mock_session]

        # Mock repository to return products
        mock_repo = AsyncMock()
        mock_repo_class.return_value = mock_repo

        # Create test products with embeddings
        test_product_ids = [uuid4(), uuid4()]
        test_products = []
        for pid in test_product_ids:
            product = MagicMock(spec=Product)
            product.id = pid
            product.name = f"Test Product {pid}"
            product.description = f"Description for {pid}"
            product.embedding = [0.1, 0.2, 0.3]  # Has embedding
            product.updated_at = datetime.now(timezone.utc)
            product.category_id = uuid4()
            test_products.append(product)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = test_products
        mock_session.execute.return_value = mock_result

        # Mock search service to return success
        mock_search_service = AsyncMock()
        mock_search_service.sync_products_to_meilisearch.return_value = {
            "status": "succeeded"
        }
        mock_search_service_class.return_value = mock_search_service

        # Execute task
        result = await incremental_sync_task(ctx)

        # Assertions
        assert result["processed"] == 2
        assert result["updated"] == 2
        assert result["failed"] == 0
        mock_search_service.close.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__])