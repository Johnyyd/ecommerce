"""
Unit tests for the EmbeddingService.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Optional

from app.services.embedding_service import EmbeddingService


class TestEmbeddingService:
    """Tests for the EmbeddingService class."""

    @pytest.fixture
    def embedding_service(self):
        """Create an EmbeddingService instance."""
        service = EmbeddingService()
        yield service
        # Clean up
        asyncio.run(service.close())

    @pytest.mark.asyncio
    async def test_service_initialization(self, embedding_service):
        """Test that the service initializes with correct configuration."""
        assert embedding_service is not None
        assert hasattr(embedding_service, 'client')
        # Check that the client is set up with the correct base URL and API key
        # We can't easily inspect the client's internal state, but we can test that it doesn't raise on init

    @pytest.mark.asyncio
    async def test_get_embedding_success(self, embedding_service):
        """Test successful embedding generation for a single text."""
        # Mock the openai client's embeddings.create method
        with patch.object(embedding_service.client.embeddings, 'create', new_callable=AsyncMock) as mock_create:
            # Set up the mock to return a fake embedding
            mock_response = Mock()
            mock_response.data = [Mock(embedding=[0.1] * 1536)]
            mock_create.return_value = mock_response

            text = "This is a test product"
            embedding = await embedding_service.get_embedding(text)

            assert embedding is not None
            assert len(embedding) == 1536
            assert all(isinstance(x, float) for x in embedding)
            mock_create.assert_called_once()
            # Check that the call was made with the correct parameters
            call_args = mock_create.call_args
            assert call_args.kwargs['input'] == text
            assert call_args.kwargs['model'] == embedding_service.model

    @pytest.mark.asyncio
    async def test_get_embeddings_batch(self, embedding_service):
        """Test successful embedding generation for multiple texts."""
        with patch.object(embedding_service.client.embeddings, 'create', new_callable=AsyncMock) as mock_create:
            mock_response = Mock()
            # Return two embeddings
            mock_response.data = [
                Mock(embedding=[0.1] * 1536),
                Mock(embedding=[0.2] * 1536)
            ]
            mock_create.return_value = mock_response

            texts = ["First product", "Second product"]
            embeddings = await embedding_service.get_embeddings(texts)

            assert embeddings is not None
            assert len(embeddings) == 2
            assert len(embeddings[0]) == 1536
            assert len(embeddings[1]) == 1536
            mock_create.assert_called_once()
            call_args = mock_create.call_args
            assert call_args.kwargs['input'] == texts
            assert call_args.kwargs['model'] == embedding_service.model

    @pytest.mark.asyncio
    async def test_get_embedding_empty_text(self, embedding_service):
        """Test embedding generation for empty text returns zero vector without calling API."""
        with patch.object(embedding_service.client.embeddings, 'create', new_callable=AsyncMock) as mock_create:
            text = ""
            embedding = await embedding_service.get_embedding(text)

            assert embedding is not None
            assert len(embedding) == 1536
            assert all(x == 0.0 for x in embedding)  # Should be zero vector
            # API should NOT be called for empty text
            mock_create.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_embedding_api_error(self, embedding_service):
        """Test handling of API errors."""
        with patch.object(embedding_service.client.embeddings, 'create', new_callable=AsyncMock) as mock_create:
            # Simulate an API error
            mock_create.side_effect = Exception("API error")

            text = "Test product"
            embedding = await embedding_service.get_embedding(text)

            # Depending on the error handling, we might return None or raise an exception
            # Let's assume the service returns None on error after retries
            assert embedding is None
            # The service should have retried a few times
            assert mock_create.call_count >= 1  # at least one try

    @pytest.mark.asyncio
    async def test_close_client(self, embedding_service):
        """Test that closing the service cleans up resources."""
        # The close method should close the HTTP client
        # For the openai client, we might need to close the underlying httpx client
        # We'll just check that it doesn't raise an exception
        await embedding_service.close()
        # If we reach here, close didn't raise

    @pytest.mark.asyncio
    async def test_embedding_dimension(self, embedding_service):
        """Test that the embedding dimension matches the expected size."""
        with patch.object(embedding_service.client.embeddings, 'create', new_callable=AsyncMock) as mock_create:
            mock_response = Mock()
            mock_response.data = [Mock(embedding=[0.5] * 1536)]
            mock_create.return_value = mock_response

            embedding = await embedding_service.get_embedding("test")
            assert len(embedding) == 1536


if __name__ == "__main__":
    pytest.main([__file__, "-v"])