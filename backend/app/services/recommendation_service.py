from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy import select
from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.models.product import Product
from app.services.search_service import SearchService, MEILISEARCH_INDEX_NAME


class RecommendationService:
    """AI-powered product recommendation engine using hybrid approach."""

    def __init__(self, search_service: SearchService = None):
        self.search_service = search_service or SearchService()

    async def get_recommendations(
        self,
        product_id: UUID,
        limit: int = 10,
        use_collaborative: bool = True,
        use_semantic: bool = True,
        collaborative_weight: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Get product recommendations using hybrid approach:
        - Collaborative filtering (based on purchase history)
        - Semantic similarity (based on embeddings)
        - Cold-start handling when data is insufficient
        """
        # Try to get collaborative filtering recommendations first
        collaborative_recs = []
        semantic_recs = []

        if use_collaborative:
            collaborative_recs = await self._get_collaborative_recommendations(
                product_id, limit
            )

        if use_semantic:
            # Get the product to find its embedding
            from app.crud.product import ProductRepository
            from sqlalchemy.ext.asyncio import AsyncSession
            # We'll need a session - this is a simplified approach
            # In practice, the session would be injected
            product_embedding = await self._get_product_embedding(str(product_id))
            if product_embedding:
                semantic_recs = await self._get_semantic_recommendations(
                    product_embedding, limit
                )

        # Hybrid scoring: combine both approaches
        all_recs = await self._hybrid_score(
            collaborative_recs, semantic_recs,
            collaborative_weight=collaborative_weight
        )

        # If no recommendations from either source, fall back to popular products
        if not all_recs:
            all_recs = await self.search_service.get_popular_products(limit=limit)

        return all_recs[:limit]

    async def _get_collaborative_recommendations(
        self, product_id: UUID, limit: int
    ) -> List[Dict[str, Any]]:
        """Get collaborative filtering recommendations."""
        # This would query order data to find products frequently bought together
        # For now, return empty list - would need order/interaction data
        return []

    async def _get_semantic_recommendations(
        self, embedding: List[float], limit: int
    ) -> List[Dict[str, Any]]:
        stmt = select(Product).order_by(
            Product.embedding.cosine_distance(embedding)
        ).limit(limit)
        async with AsyncSessionLocal() as session:
            result = await session.execute(stmt)
            products = result.scalars().all()

        recommendations = []
        for product in products:
            recommendations.append({
                "id": str(product.id),
                "name": product.name,
                "price": float(product.price) if product.price else 0.0,
                "similarity_score": 1.0 - product.embedding.cosine_distance(embedding) if hasattr(product.embedding, 'cosine_distance') else 0.5,
            })

        return recommendations

    async def _hybrid_score(
        self,
        collaborative: List[Dict[str, Any]],
        semantic: List[Dict[str, Any]],
        collaborative_weight: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Combine collaborative and semantic recommendations with weighted scoring."""
        scored: Dict[str, float] = {}

        # Add collaborative scores
        for rec in collaborative:
            pid = rec.get("id")
            score = rec.get("score", 0.5)
            scored[pid] = scored.get(pid, 0) + score * collaborative_weight

        # Add semantic scores
        for rec in semantic:
            pid = rec.get("id")
            score = rec.get("similarity_score", 0.5)
            scored[pid] = scored.get(pid, 0) + score * (1 - collaborative_weight)

        # Sort by score and return
        sorted_recs = sorted(scored.items(), key=lambda x: x[1], reverse=True)
        result = [
            {"id": pid, "score": score}
            for pid, score in sorted_recs
        ]

        return result

    async def _get_product_embedding(self, product_id: str) -> Optional[List[float]]:
        """Get embedding for a product by ID."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Product.embedding).where(Product.id == product_id)
            )
            embedding = result.scalar_one_or_none()
            return embedding if embedding else None

    async def get_cold_start_recommendations(
        self, user_id: UUID = None, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recommendations for cold-start scenarios:
        - When there's insufficient interaction data
        - Fall back to content-based similarity and popularity
        """
        if user_id:
            # Try to get collaborative recommendations
            recs = await self.get_recommendations(
                product_id=user_id,  # Using user_id as placeholder
                limit=limit,
                use_collaborative=False,
                use_semantic=True
            )
            return recs

        # No user context - return popular products
        return await self.search_service.get_popular_products(limit=limit)

    async def get_new_arrivals(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get newest products as recommendations."""
        async with AsyncSessionLocal() as session:
            stmt = select(Product).order_by(Product.created_at.desc()).limit(limit)
            result = await session.execute(stmt)
            products = result.scalars().all()

        return [
            {
                "id": str(product.id),
                "name": product.name,
                "price": float(product.price) if product.price else 0.0,
                "similarity_score": 0.8,  # Default relevance score
            }
            for product in products
        ]