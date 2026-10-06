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
            # Meilisearch Python client v0.43+ uses 'options' parameter
            task = self.client.create_index(index_name, options=settings_dict)
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
            search_params = {}

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

            # Add any additional parameters (exclude query, index_name which are handled separately)
            for k, v in kwargs.items():
                if k not in ("query", "index_name"):
                    search_params[k] = v

            if search_params:
                result = index.search(query, search_params)
            else:
                result = index.search(query)

            # Convert result to dict format (Meilisearch Python client v0.43+ returns dict)
            return {
                "hits": result.get("hits", []),
                "estimatedTotalHits": result.get("estimatedTotalHits", 0),
                "processingTimeMs": result.get("processingTimeMs", 0),
                "query": result.get("query", query),
                "facetDistribution": result.get("facetDistribution")
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
            # Handle Meilisearch < v1.11 where 'tokenizer' field is not supported
            if "tokenizer" in settings and "tokenizer" in str(e).lower():
                logger.warning(f"Tokenizer not supported by Meilisearch version. Retrying without tokenizer for {index_name}.")
                clean_settings = {k: v for k, v in settings.items() if k != "tokenizer"}
                try:
                    task = index.update_settings(clean_settings)
                    self.client.wait_for_task(task.task_uid)
                    return {"taskUid": task.task_uid, "status": "succeeded"}
                except Exception as inner_e:
                    logger.error(f"Failed to update settings without tokenizer for {index_name}: {inner_e}")
                    raise
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

    async def ensure_index_initialized(self) -> bool:
        """Initialize index and its searchable/filterable/sortable settings with Vietnamese support."""
        try:
            exists = await self.meilisearch.index_exists()
            if not exists:
                await self.meilisearch.create_index(
                    index_name=self.meilisearch.index_name,
                    settings={"primaryKey": "id"}
                )
            await self.meilisearch.update_settings(
                index_name=self.meilisearch.index_name,
                settings={
                    # Vietnamese tokenizer
                    "tokenizer": "vi",
                    # Searchable attributes (weighted for relevance)
                    "searchableAttributes": [
                        "name",
                        "description",
                        "brand"
                    ],
                    # Filterable attributes for faceted search
                    "filterableAttributes": [
                        "category_id",
                        "brand",
                        "price",
                        "is_active"
                    ],
                    # Sortable attributes
                    "sortableAttributes": [
                        "price",
                        "updated_at",
                        "created_at"
                    ],
                    # Typo tolerance settings for Vietnamese
                    "typoTolerance": {
                        "enabled": True,
                        "minWordSizeForTypos": {
                            "oneTypo": 4,
                            "twoTypos": 8
                        }
                    },
                    # Ranking rules for better relevance
                    "rankingRules": [
                        "words",
                        "typo",
                        "proximity",
                        "attribute",
                        "sort",
                        "exactness"
                    ],
                    # Distinct attribute for deduplication (e.g., same product different variants)
                    "distinctAttribute": "id",
                    # Faceting for advanced filtering
                    "faceting": {
                        "maxValuesPerFacet": 100
                    },
                    # Performance: limit search time to return partial results faster
                    "searchCutoffMs": 50
                }
            )
            return True
        except Exception as e:
            logger.warning(f"Could not initialize Meilisearch index settings: {e}")
            return False

    def _format_product_doc(self, product: Any) -> Dict[str, Any]:
        """Format a product into a Meilisearch document supporting both ORM model and dict."""
        if isinstance(product, dict):
            return {
                "id": str(product.get("id")),
                "name": product.get("name", ""),
                "description": product.get("description") or "",
                "price": float(product.get("price") or 0.0),
                "brand": product.get("brand") or "",
                "category_id": str(product.get("category_id")) if product.get("category_id") else "",
                "search_vector": str(product.get("search_vector") or ""),
                "embedding": product.get("embedding") or [],
                "updated_at": str(product.get("updated_at") or ""),
            }
        return {
            "id": str(product.id),
            "name": getattr(product, "name", ""),
            "description": getattr(product, "description", "") or "",
            "price": float(product.price) if getattr(product, "price", None) else 0.0,
            "brand": getattr(product, "brand", "") or "",
            "category_id": str(product.category_id) if getattr(product, "category_id", None) else "",
            "search_vector": str(getattr(product, "search_vector", "") or ""),
            "embedding": getattr(product, "embedding", []) or [],
            "updated_at": product.updated_at.isoformat() if getattr(product, "updated_at", None) else "",
        }

    async def sync_product_to_meilisearch(self, product) -> Dict[str, Any]:
        """Sync a single product to Meilisearch index."""
        doc = self._format_product_doc(product)
        result = await self.meilisearch.add_documents(
            index_name=self.meilisearch.index_name,
            documents=[doc]
        )
        return result

    async def sync_products_to_meilisearch(self, products) -> Dict[str, Any]:
        """Sync multiple products to Meilisearch index supporting dicts or ORM objects."""
        documents = [self._format_product_doc(p) for p in products]
        result = await self.meilisearch.add_documents(
            index_name=self.meilisearch.index_name,
            documents=documents
        )
        return result

    # Allowed filter fields to prevent Meilisearch filter injection
    _ALLOWED_FILTER_FIELDS = frozenset({
        "category_id", "brand", "price", "is_active", "stock_quantity",
        "rating", "created_at", "updated_at"
    })

    # Allowed sort fields to prevent sort injection
    _ALLOWED_SORT_FIELDS = frozenset({
        "price", "created_at", "updated_at", "rating", "popularity"
    })

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
        # Build filter string from filters dict with validation
        filter_str = None
        if filters:
            filter_parts = []
            for key, value in filters.items():
                # Validate filter field against whitelist
                if key not in self._ALLOWED_FILTER_FIELDS:
                    logger.warning(f"Rejected filter field: {key} (not in whitelist)")
                    continue
                if value is not None:
                    if isinstance(value, list):
                        # Handle IN clauses - validate each value
                        formatted_values = []
                        for v in value:
                            if isinstance(v, str):
                                # Escape quotes in string values
                                escaped = v.replace('"', '\\"')
                                formatted_values.append(f'"{escaped}"')
                            else:
                                formatted_values.append(str(v))
                        filter_parts.append(f"{key} IN [{', '.join(formatted_values)}]")
                    else:
                        # Handle equality - escape string values
                        if isinstance(value, str):
                            escaped = value.replace('"', '\\"')
                            formatted_value = f'"{escaped}"'
                        else:
                            formatted_value = str(value)
                        filter_parts.append(f"{key} = {formatted_value}")
            if filter_parts:
                filter_str = " AND ".join(filter_parts)

        # Validate sort fields
        validated_sort = None
        if sort:
            validated_sort = []
            for s in sort:
                # Extract base field name (remove direction suffix like :asc, :desc and leading -)
                base_field = s.lstrip('-').split(':')[0]
                if base_field in self._ALLOWED_SORT_FIELDS:
                    validated_sort.append(s)
                else:
                    logger.warning(f"Rejected sort field: {base_field} (not in whitelist)")

        return await self.meilisearch.search(
            index_name=self.meilisearch.index_name,
            query=query,
            filter=filter_str,
            limit=limit,
            offset=offset,
            facets=facets,
            sort=validated_sort
        )

    async def get_popular_products(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get popular products as a list of product dicts, sorted by interaction count (popularity)."""
        try:
            res = await self.meilisearch.search(
                index_name=self.meilisearch.index_name,
                query="",
                sort=["popularity:desc"],  # Sort by popularity instead of price
                limit=limit
            )
            hits = res.get("hits", [])
            if hits:
                return hits
        except Exception as e:
            logger.warning(f"Meilisearch get_popular_products fallback: {e}")

        # Fallback to database if Meilisearch is empty or down
        try:
            from app.core.db import AsyncSessionLocal
            from app.models.product import Product
            from app.models.order import OrderItem
            from sqlalchemy import select, desc, func
            async with AsyncSessionLocal() as session:
                # Try to get products with most order interactions first
                stmt = select(Product, func.count(OrderItem.id).label('order_count'))\
                    .select_from(Product.join(OrderItem, Product.id == OrderItem.product_id, isouter=True))\
                    .group_by(Product.id)\
                    .order_by(desc('order_count'), desc(Product.created_at))\
                    .limit(limit)
                result = await session.execute(stmt)
                products = result.all()
                return [
                    {
                        "id": str(product.Product.id),
                        "name": product.Product.name,
                        "description": product.Product.description or "",
                        "price": float(product.Product.price) if product.Product.price else 0.0,
                        "brand": product.Product.brand or "",
                        "category_id": str(product.Product.category_id) if product.Product.category_id else "",
                    }
                    for product in products
                ]
        except Exception as db_err:
            logger.error(f"Database fallback in get_popular_products failed: {db_err}")
            return []

    async def get_recommendations_by_embedding(
        self,
        embedding: List[float],
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recommendations based on vector similarity or fallback."""
        return await self.get_popular_products(limit=limit)