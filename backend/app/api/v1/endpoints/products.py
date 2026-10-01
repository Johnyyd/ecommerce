import json
from uuid import UUID
from typing import List, Annotated, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from redis.asyncio import Redis

from app.core.db import get_db_session
from app.core.redis import get_redis_client
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, PaginatedProductResponse
from app.services.product import ProductService
from app.services.search_service import SearchService
from app.services.recommendation_service import RecommendationService
from app.crud.product import ProductRepository
from app.api.deps import get_current_admin, get_current_staff
from app.models.user import User


router = APIRouter()

def get_product_service(session: AsyncSession = Depends(get_db_session)) -> ProductService:
    repo = ProductRepository(session)
    return ProductService(repo)

def get_search_service() -> SearchService:
    return SearchService()

def get_recommendation_service() -> RecommendationService:
    return RecommendationService()

@router.get("/presigned-url")
async def get_presigned_url(
    filename: str,
    current_staff: User = Depends(get_current_staff)
):
    """
    Returns an AWS S3 Presigned URL to allow frontend direct upload.
    """
    presigned_url = f"https://my-ecommerce-bucket.s3.amazonaws.com/{filename}?AWSAccessKeyId=MOCK&Signature=MOCK&Expires=3600"
    return {"url": presigned_url, "method": "PUT"}

@router.get("/search")
async def search_products_endpoint(
    q: str = "",
    category_id: Optional[UUID] = None,
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    page: int = 1,
    limit: int = 12,
    sort: Optional[str] = None,
    facets: Optional[str] = None,
    search_service: SearchService = Depends(get_search_service),
    product_service: ProductService = Depends(get_product_service),
    redis: Redis = Depends(get_redis_client)
) -> Any:
    """
    Advanced product search using Meilisearch with faceted filtering and typo tolerance.
    Gracefully falls back to PostgreSQL Full-Text Search if Meilisearch is unavailable.
    """
    offset = max(0, (page - 1) * limit)
    cache_key = f"products:search:{q}:{category_id}:{brand}:{min_price}:{max_price}:{page}:{limit}:{sort}:{facets}"

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    filters: dict[str, Any] = {}
    if category_id:
        filters["category_id"] = str(category_id)
    if brand:
        filters["brand"] = brand

    facet_list = [f.strip() for f in facets.split(",") if f.strip()] if facets else ["category_id", "brand"]
    sort_list = [sort] if sort else None

    items = []
    total = 0
    facet_distribution = {}

    try:
        search_res = await search_service.search_products(
            query=q,
            filters=filters or None,
            limit=limit,
            offset=offset,
            facets=facet_list,
            sort=sort_list
        )
        items = search_res.get("hits", [])
        total = search_res.get("estimatedTotalHits") or len(items)
        facet_distribution = search_res.get("facetDistribution") or {}
    except Exception:
        # Fallback to PostgreSQL FTS
        products = await product_service.get_products(
            skip=offset, limit=limit, category_id=category_id, brand=brand,
            min_price=min_price, max_price=max_price, q=q or None
        )
        total = await product_service.get_products_count(
            category_id=category_id, brand=brand,
            min_price=min_price, max_price=max_price, q=q or None
        )
        items = [ProductResponse.model_validate(p).model_dump(mode='json') for p in products]

    response_data = {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "facets": facet_distribution
    }
    await redis.setex(cache_key, 120, json.dumps(response_data))
    return response_data

@router.get("", response_model=PaginatedProductResponse, include_in_schema=False)
@router.get("/", response_model=PaginatedProductResponse)
async def list_products(
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[UUID] = None,
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    q: Optional[str] = None,
    low_stock: Optional[bool] = None,
    service: ProductService = Depends(get_product_service),
    redis: Redis = Depends(get_redis_client)
) -> Any:
    # Build cache key carefully including all params
    params = f"{skip}:{limit}:{category_id}:{brand}:{min_price}:{max_price}:{q}"
    if low_stock is not None:
        params += f":{low_stock}"
    cache_key = f"products:list:{params}"
    
    # Try to get from cache
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
        
    products = await service.get_products(
        skip=skip, limit=limit, category_id=category_id, brand=brand, 
        min_price=min_price, max_price=max_price, q=q, low_stock=low_stock
    )
    total_count = await service.get_products_count(
        category_id=category_id, brand=brand, 
        min_price=min_price, max_price=max_price, q=q, low_stock=low_stock
    )
    
    # Serialize and cache for 5 minutes
    items_data = [ProductResponse.model_validate(p).model_dump(mode='json') for p in products]
    response_data = {"items": items_data, "total": total_count}
    await redis.setex(cache_key, 300, json.dumps(response_data))
    
    return response_data

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    service: ProductService = Depends(get_product_service),
    redis: Redis = Depends(get_redis_client)
) -> Any:
    cache_key = f"product:{product_id}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    product = await service.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    response_data = ProductResponse.model_validate(product).model_dump(mode='json')
    await redis.setex(cache_key, 300, json.dumps(response_data))
    return response_data

@router.get("/{product_id}/recommendations")
async def get_product_recommendations(
    product_id: UUID,
    limit: int = 6,
    rec_service: RecommendationService = Depends(get_recommendation_service),
    redis: Redis = Depends(get_redis_client)
) -> Any:
    """
    Get AI-powered hybrid product recommendations (collaborative + semantic + popularity/category fallback).
    """
    cache_key = f"product:recommendations:{product_id}:{limit}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    recommendations = await rec_service.get_recommendations(
        product_id=product_id,
        limit=limit
    )
    await redis.setex(cache_key, 300, json.dumps(recommendations))
    return recommendations

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate,
    current_staff: User = Depends(get_current_staff),
    service: ProductService = Depends(get_product_service),
    redis: Redis = Depends(get_redis_client)
) -> Any:
    product = await service.create_product(product_in)
    
    # Invalidate list cache
    # Since we can't easily iterate all skip/limit keys, a pattern delete might be needed, or we just rely on TTL.
    # For now, let's just clear a known key or let TTL handle it.
    await redis.delete("products:list:0:100")
    return product

@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    product_in: ProductUpdate,
    current_staff: User = Depends(get_current_staff),
    service: ProductService = Depends(get_product_service),
    redis: Redis = Depends(get_redis_client)
) -> Any:
    product = await service.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    product = await service.update_product(product, product_in)
    
    # Invalidate caches
    await redis.delete(f"product:{product_id}")
    await redis.delete("products:list:0:100")
    
    return product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    current_staff: User = Depends(get_current_staff),
    service: ProductService = Depends(get_product_service),
    redis: Redis = Depends(get_redis_client)
):
    success = await service.delete_product(product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found")
        
    await redis.delete(f"product:{product_id}")
    await redis.delete("products:list:0:100")
    return None


