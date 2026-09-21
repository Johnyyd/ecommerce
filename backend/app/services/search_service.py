"""
Meilisearch Service for E-Commerce Platform.

This module provides:
- MeilisearchService: Low-level client wrapper for Meilisearch operations
- SearchService: High-level search operations combining Meilisearch and PostgreSQL

Follows patterns from email.py: async functions, configuration from settings,
graceful error handling with logging.
"""

import logging
from typing import Any, Dict, List, Optional
from meilisearch import Client
from meilisearch.errors import MeilisearchApiError, MeilisearchCommunicationError
from app.core.config import settings

logger = logging.getLogger(__name__)

MEILISEARCH_INDEX_NAME = "products"


class MeilisearchService:
    """Low-level wrapper for Meilisearch client operations."""

    def __init__(self):
        self.base_url = settings.MEILISEARCH_URL
        self.master_key = settings.MEILISEARCH_MASTER_KEY
        self.client = Client(
            url=self.base_url,
            api_key=self.master_key
        )
        self.index_name = MEILISEARCH_INDEX_NAME

    async def close(self):
        """Close the Meilisearch client (no-op for sync client, kept for interface compatibility)."""
        # The official meilisearch-python client is synchronous
        # No async close needed, but kept for interface consistency
        pass

    async def create_index(self, index_name: str = None, settings: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a Meilisearch index with optional settings."""
        index_name = index_name or self.index_name
        settings_dict = settings or {}
        try:
            # Create index with optional settings
            task = self.client.create_index(index_name, **settings_dict)
            # Wait for task to complete
            self.client.wait_for_task(task.task_uid)
            return {"taskUid": task.task_uid, "status": "succeeded"}
        except MeilisearchApiError as e:
            logger.error(f"Failed to create index {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")

    async def delete_index(self, index_name: str = None) -> Dict[str, Any]:
        """Delete a Meilisearch index."""
        index_name = index_name or self.index_name
        try:
            task = self.client.delete_index(index_name)
            self.client.wait_for_task(task.task_uid)
            return {"taskUid": task.task_uid, "status": "succeeded"}
        except MeilisearchApiError as e:
            logger.error(f"Failed to delete index {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")

    async def index_exists(self, index_name: str = None) -> bool:
        """Check if a Meilisearch index exists."""
        index_name = index_name or self.index_name
        try:
            self.client.get_index(index_name)
            return True
        except MeilisearchApiError as e:
            # Check status_code - it might be a Mock or int
            status_code = getattr(e, 'status_code', None)
            if isinstance(status_code, int) and status_code == 404:
                return False
            # Also check the error code string
            if getattr(e, 'code', '') == 'index_not_found':
                return False
            logger.error(f"Error checking index existence: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            return False

    async def add_documents(self, index_name: str, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Add documents to a Meilisearch index."""
        try:
            index = self.client.index(index_name)
            task = index.add_documents(documents)
            self.client.wait_for_task(task.task_uid)
            return {"taskUid": task.task_uid, "status": "succeeded"}
        except MeilisearchApiError as e:
            logger.error(f"Failed to add documents to {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")

    async def update_documents(self, index_name: str, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Update documents in a Meilisearch index."""
        try:
            index = self.client.index(index_name)
            task = index.update_documents(documents)
            self.client.wait_for_task(task.task_uid)
            return {"taskUid": task.task_uid, "status": "succeeded"}
        except MeilisearchApiError as e:
            logger.error(f"Failed to update documents in {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")

    async def delete_documents(self, index_name: str, document_ids: List[str]) -> Dict[str, Any]:
        """Delete documents from a Meilisearch index."""
        try:
            index = self.client.index(index_name)
            task = index.delete_documents(document_ids)
            self.client.wait_for_task(task.task_uid)
            return {"taskUid": task.task_uid, "status": "succeeded"}
        except MeilisearchApiError as e:
            logger.error(f"Failed to delete documents from {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")

    async def search(
        self,
        query: str,
        index_name: str = None,
        filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        facets: Optional[List[str]] = None,
        sort: Optional[List[str]] = None,
        attributesToHighlight: Optional[List[str]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Search the Meilisearch index with various options."""
        try:
            index_name = index_name or self.index_name
            index = self.client.index(index_name)
            search_params = {"q": query}

            if filter is not None:
                search_params["filter"] = filter
            if limit is not None:
                search_params["limit"] = limit
            if offset is not None:
                search_params["offset"] = offset
            if facets is not None:
                search_params["facets"] = facets
            if sort is not None:
                search_params["sort"] = sort
            if attributesToHighlight is not None:
                search_params["attributesToHighlight"] = attributesToHighlight

            # Add any additional parameters
            search_params.update(kwargs)

            result = index.search(**search_params)

            # Convert result to dict format
            return {
                "hits": result.hits,
                "estimatedTotalHits": result.estimated_total_hits,
                "processingTimeMs": result.processing_time_ms,
                "query": result.query,
                "facetDistribution": getattr(result, 'facet_distribution', None)
            }
        except MeilisearchApiError as e:
            logger.error(f"Search failed for {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")

    async def get_document(self, index_name: str, document_id: str) -> Dict[str, Any]:
        """Get a single document from Meilisearch."""
        try:
            index = self.client.index(index_name)
            document = index.get_document(document_id)
            return document
        except MeilisearchApiError as e:
            logger.error(f"Failed to get document {document_id} from {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")

    async def get_stats(self, index_name: str = None) -> Dict[str, Any]:
        """Get index statistics."""
        index_name = index_name or self.index_name
        try:
            index = self.client.index(index_name)
            stats = index.get_stats()
            return {
                "numberOfDocuments": stats.number_of_documents,
                "isIndexing": stats.is_indexing,
                "fieldDistribution": stats.field_distribution
            }
        except MeilisearchApiError as e:
            logger.error(f"Failed to get stats for {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")

    async def update_settings(self, index_name: str, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Update index settings (searchable attributes, filterable attributes, synonyms, etc.)."""
        try:
            index = self.client.index(index_name)
            task = index.update_settings(settings)
            self.client.wait_for_task(task.task_uid)
            return {"taskUid": task.task_uid, "status": "succeeded"}
        except MeilisearchApiError as e:
            logger.error(f"Failed to update settings for {index_name}: {e}")
            raise Exception(f"Meilisearch API error: {e.message}")
        except MeilisearchCommunicationError as e:
            logger.error(f"Meilisearch connection error: {e}")
            raise Exception(f"Meilisearch connection error: {str(e)}")


class SearchService:
    """High-level search service combining Meilisearch and PostgreSQL FTS/vector search."""

    def __init__(self):
        self.meilisearch = MeilisearchService()

    async def close(self):
        await self.meilisearch.close()

    async def sync_product_to_meilisearch(self, product) -> Dict[str, Any]:
        """Sync a single product to Meilisearch index."""
        doc = {
            "id": str(product.id),
            "name": product.name,
            "description": product.description or "",
            "price": float(product.price) if product.price else 0.0,
            "brand": product.brand or "",
            "category_id": str(product.category_id) if product.category_id else "",
            "search_vector": product.search_vector or "",
            "embedding": product.embedding or [],
            "updated_at": product.updated_at.isoformat() if product.updated_at else "",
        }

        result = await self.meilisearch.add_documents(
            index_name=self.meilisearch.index_name,
            documents=[doc]
        )
        return result

    async def sync_products_to_meilisearch(self, products) -> Dict[str, Any]:
        """Sync multiple products to Meilisearch index."""
        documents = []
        for product in products:
            doc = {
                "id": str(product.id),
                "name": product.name,
                "description": product.description or "",
                "price": float(product.price) if product.price else 0.0,
                "brand": product.brand or "",
                "category_id": str(product.category_id) if product.category_id else "",
                "search_vector": product.search_vector or "",
                "embedding": product.embedding or [],
                "updated_at": product.updated_at.isoformat() if product.updated_at else "",
            }
            documents.append(doc)

        result = await self.meilisearch.add_documents(
            index_name=self.meilisearch.index_name,
            documents=documents
        )
        return result

    async def search_products(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
        offset: int = 0,
        facets: Optional[List[str]] = None,
        sort: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Search products using Meilisearch with optional filters and facets."""
        # Build filter string from filters dict
        filter_str = None
        if filters:
            filter_parts = []
            for key, value in filters.items():
                if value is not None:
                    if isinstance(value, list):
                        # Handle IN clauses
                        formatted_values = ", ".join(f'"{v}"' if isinstance(v, str) else str(v) for v in value)
                        filter_parts.append(f"{key} IN [{formatted_values}]")
                    else:
                        # Handle equality
                        formatted_value = f'"{value}"' if isinstance(value, str) else str(value)
                        filter_parts.append(f"{key} = {formatted_value}")
            if filter_parts:
                filter_str = " AND ".join(filter_parts)

        return await self.meilisearch.search(
            index_name=self.meilisearch.index_name,
            query=query,
            filter=filter_str,
            limit=limit,
            offset=offset,
            facets=facets,
            sort=sort
        )

    async def get_popular_products(self, limit: int = 10) -> Dict[str, Any]:
        """Get popular products from Meilisearch."""
        return await self.meilisearch.search(
            index_name=self.meilisearch.index_name,
            query="",
            sort=["price:desc"],
            limit=limit
        )

    async def get_recommendations_by_embedding(
        self,
        embedding: List[float],
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get recommendations based on vector similarity (placeholder for pgvector search)."""
        # This would be implemented with pgvector semantic similarity
        # For now, return popular products as fallback
        return await self.get_popular_products(limit=limit)