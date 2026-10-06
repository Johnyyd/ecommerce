import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy import select, desc, func
from app.core.db import AsyncSessionLocal
from app.models.product import Product
from app.models.order import OrderItem
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)


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
        - Collaborative filtering (based on co-purchased items in order history)
        - Semantic similarity (based on embeddings)
        - Content-based fallback (same category or brand)
        - Popularity/New arrivals cold-start mitigation
        """
        collaborative_recs: List[Dict[str, Any]] = []
        semantic_recs: List[Dict[str, Any]] = []

        if use_collaborative:
            collaborative_recs = await self._get_collaborative_recommendations(
                product_id, limit
            )

        if use_semantic:
            product_embedding = await self._get_product_embedding(str(product_id))
            if product_embedding:
                semantic_recs = await self._get_semantic_recommendations(
                    product_embedding, limit, exclude_id=product_id
                )

        # Hybrid scoring: combine both approaches
        all_recs = await self._hybrid_score(
            collaborative_recs, semantic_recs,
            collaborative_weight=collaborative_weight
        )

        existing_ids = {r["id"] for r in all_recs}
        existing_ids.add(str(product_id))

        # Fallback 1: Products from same category/brand if results are sparse
        if len(all_recs) < limit:
            category_recs = await self._get_category_recommendations(
                product_id, limit - len(all_recs), exclude_ids=existing_ids
            )
            for r in category_recs:
                if r["id"] not in existing_ids:
                    all_recs.append(r)
                    existing_ids.add(r["id"])

        # Fallback 2: Popular products from Meilisearch or orders
        if len(all_recs) < limit:
            popular = await self.search_service.get_popular_products(limit=limit)
            for p in popular:
                if p["id"] not in existing_ids:
                    all_recs.append(p)
                    existing_ids.add(p["id"])

        # Fallback 3: New arrivals from database (guarantees non-empty response)
        if len(all_recs) < limit:
            new_arrivals = await self.get_new_arrivals(limit=limit)
            for item in new_arrivals:
                if item["id"] not in existing_ids:
                    all_recs.append(item)
                    existing_ids.add(item["id"])

        final_recs = [r for r in all_recs if r.get("id") != str(product_id)]
        return final_recs[:limit]

    async def _get_collaborative_recommendations(
        self, product_id: UUID, limit: int
    ) -> List[Dict[str, Any]]:
        """Get collaborative filtering recommendations based on co-occurrence in orders."""
        try:
            async with AsyncSessionLocal() as session:
                subquery = select(OrderItem.order_id).where(OrderItem.product_id == product_id)
                stmt = (
                    select(
                        OrderItem.product_id,
                        Product.name,
                        Product.price,
                        Product.brand,
                        Product.category_id,
                        func.count(OrderItem.id).label("freq")
                    )
                    .join(Product, Product.id == OrderItem.product_id)
                    .where(
                        OrderItem.order_id.in_(subquery),
                        OrderItem.product_id != product_id
                    )
                    .group_by(OrderItem.product_id, Product.id)
                    .order_by(desc("freq"))
                    .limit(limit)
                )
                result = await session.execute(stmt)
                rows = result.all()
                if rows:
                    max_freq = max(r.freq for r in rows) or 1
                    return [
                        {
                            "id": str(r.product_id),
                            "name": r.name,
                            "price": float(r.price) if r.price else 0.0,
                            "brand": r.brand or "",
                            "category_id": str(r.category_id) if r.category_id else "",
                            "score": float(r.freq) / float(max_freq),
                        }
                        for r in rows
                    ]
        except Exception as e:
            logger.warning(f"Error getting collaborative recommendations: {e}")
        return []

    async def _get_semantic_recommendations(
        self, embedding: List[float], limit: int, exclude_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Get recommendations based on vector similarity using pgvector."""
        try:
            stmt = select(Product)
            if exclude_id:
                stmt = stmt.where(Product.id != exclude_id)
            stmt = stmt.order_by(
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
                    "brand": product.brand or "",
                    "category_id": str(product.category_id) if product.category_id else "",
                    "similarity_score": 1.0 - product.embedding.cosine_distance(embedding) if hasattr(product.embedding, 'cosine_distance') else 0.8,
                })

            return recommendations
        except Exception as e:
            logger.warning(f"Error getting semantic recommendations: {e}")
            return []

    async def _get_category_recommendations(
        self, product_id: UUID, limit: int, exclude_ids: Optional[set] = None
    ) -> List[Dict[str, Any]]:
        """Fallback to products in the same category or brand."""
        try:
            async with AsyncSessionLocal() as session:
                curr = await session.get(Product, product_id)
                if not curr:
                    return []
                stmt = select(Product).where(Product.id != product_id)
                if exclude_ids:
                    # Convert str IDs to UUID if needed, or filter in Python
                    pass
                if curr.category_id:
                    stmt = stmt.where(Product.category_id == curr.category_id)
                elif curr.brand:
                    stmt = stmt.where(Product.brand == curr.brand)
                stmt = stmt.order_by(desc(Product.created_at)).limit(limit + 5)
                res = await session.execute(stmt)
                prods = res.scalars().all()
                return [
                    {
                        "id": str(p.id),
                        "name": p.name,
                        "price": float(p.price) if p.price else 0.0,
                        "brand": p.brand or "",
                        "category_id": str(p.category_id) if p.category_id else "",
                        "similarity_score": 0.7,
                    }
                    for p in prods
                    if str(p.id) != str(product_id) and (not exclude_ids or str(p.id) not in exclude_ids)
                ][:limit]
        except Exception as e:
            logger.warning(f"Error getting category recommendations: {e}")
            return []

    async def _hybrid_score(
        self,
        collaborative: List[Dict[str, Any]],
        semantic: List[Dict[str, Any]],
        collaborative_weight: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Combine collaborative and semantic recommendations with weighted scoring, preserving item details."""
        scored: Dict[str, float] = {}
        details: Dict[str, Dict[str, Any]] = {}

        # Add collaborative scores
        for rec in collaborative:
            pid = str(rec.get("id"))
            score = float(rec.get("score", 0.5))
            scored[pid] = scored.get(pid, 0) + score * collaborative_weight
            details[pid] = rec

        # Add semantic scores
        for rec in semantic:
            pid = str(rec.get("id"))
            score = float(rec.get("similarity_score", 0.5))
            scored[pid] = scored.get(pid, 0) + score * (1 - collaborative_weight)
            if pid not in details:
                details[pid] = rec

        sorted_recs = sorted(scored.items(), key=lambda x: x[1], reverse=True)
        result = [
            {**details[pid], "id": pid, "score": round(score, 4)}
            for pid, score in sorted_recs
        ]

        return result

    async def _get_product_embedding(self, product_id: str) -> Optional[List[float]]:
        """Get embedding for a product by ID."""
        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(Product.embedding).where(Product.id == product_id)
                )
                embedding = result.scalar_one_or_none()
                return embedding if embedding else None
        except Exception as e:
            logger.warning(f"Error getting product embedding: {e}")
            return None

    async def get_cold_start_recommendations(
        self, user_id: UUID = None, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recommendations for cold-start scenarios:
        - When there's insufficient interaction data
        - Fall back to popular products or new arrivals
        """
        if user_id:
            recs = await self.get_recommendations(
                product_id=user_id,
                limit=limit,
                use_collaborative=False,
                use_semantic=True
            )
            if recs:
                return recs

        popular = await self.search_service.get_popular_products(limit=limit)
        if popular:
            return popular
        return await self.get_new_arrivals(limit=limit)

    async def get_new_arrivals(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get newest products as recommendations."""
        try:
            async with AsyncSessionLocal() as session:
                stmt = select(Product).order_by(Product.created_at.desc()).limit(limit)
                result = await session.execute(stmt)
                products = result.scalars().all()

            return [
                {
                    "id": str(product.id),
                    "name": product.name,
                    "price": float(product.price) if product.price else 0.0,
                    "brand": product.brand or "",
                    "category_id": str(product.category_id) if product.category_id else "",
                    "similarity_score": 0.8,
                }
                for product in products
            ]
        except Exception as e:
            logger.warning(f"Error getting new arrivals: {e}")
            return []
