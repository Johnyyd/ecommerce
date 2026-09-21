"""
Embedding Service for generating product embeddings via the Free LLM API.

This service handles communication with the local Free LLM API (OpenAI-compatible)
to generate text embeddings for products. It follows the same patterns as other
services: async functions, configuration from settings, graceful error handling.
"""

import logging
from typing import List, Optional
import openai
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating embeddings via the Free LLM API."""

    def __init__(self):
        self.api_url = settings.EMBEDDING_API_URL
        self.api_key = settings.EMBEDDING_API_KEY
        self.model = "text-embedding-3-small"  # Default model, 1536 dimensions
        self.client = AsyncOpenAI(
            base_url=self.api_url,
            api_key=self.api_key,
        )

    async def close(self):
        """Close the HTTP client."""
        await self.client.close()

    async def get_embedding(self, text: str) -> Optional[List[float]]:
        """Generate an embedding for a single text."""
        if not text or not text.strip():
            # Return a zero vector for empty text
            return [0.0] * 1536

        try:
            response = await self.client.embeddings.create(
                input=text,
                model=self.model
            )
            embedding = response.data[0].embedding
            logger.debug(f"Generated embedding for text (length: {len(text)})")
            return embedding
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            # Return None to indicate failure - caller can decide how to handle
            return None

    async def get_embeddings(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts."""
        if not texts:
            return []

        # Filter out empty texts and keep track of indices
        non_empty_texts = []
        empty_indices = []
        for i, text in enumerate(texts):
            if text and text.strip():
                non_empty_texts.append(text)
            else:
                empty_indices.append(i)

        # Process non-empty texts
        embeddings: List[Optional[List[float]]] = [None] * len(texts)

        # Fill in zero vectors for empty texts
        for idx in empty_indices:
            embeddings[idx] = [0.0] * 1536

        if not non_empty_texts:
            return embeddings

        try:
            # Batch request for non-empty texts
            response = await self.client.embeddings.create(
                input=non_empty_texts,
                model=self.model
            )

            # Extract embeddings and place them in correct positions
            non_empty_idx = 0
            for i in range(len(texts)):
                if i not in empty_indices:
                    embedding = response.data[non_empty_idx].embedding
                    embeddings[i] = embedding
                    non_empty_idx += 1

            logger.debug(f"Generated embeddings for {len(non_empty_texts)} texts")
            return embeddings
        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            # Return None for all in case of batch failure
            return [None] * len(texts)


# Singleton instance for dependency injection
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the embedding service singleton."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service