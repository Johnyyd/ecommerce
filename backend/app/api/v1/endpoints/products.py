import json
from uuid import UUID
from typing import List, Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from redis.asyncio import Redis

from app.core.db import get_db_session
from app.core.redis import get_redis_client
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, PaginatedProductResponse
from app.services.product import ProductService
from app.crud.product import ProductRepository
from app.api.deps import get_current_admin
from app.models.user import User


router = APIRouter()

def get_product_service(session: AsyncSession = Depends(get_db_session)) -> ProductService:
    repo = ProductRepository(session)
    return ProductService(repo)

@router.get("/presigned-url")
async def get_presigned_url(
    filename: str,
    current_admin: User = Depends(get_current_admin)
):
    """
    Returns an AWS S3 Presigned URL to allow frontend direct upload.
    """
    presigned_url = f"https://my-ecommerce-bucket.s3.amazonaws.com/{filename}?AWSAccessKeyId=MOCK&Signature=MOCK&Expires=3600"
    return {"url": presigned_url, "method": "PUT"}

@router.get("/", response_model=PaginatedProductResponse)
async def list_products(
    skip: int = 0,
    limit: int = 100,
    service: ProductService = Depends(get_product_service),
    redis: Redis = Depends(get_redis_client)
) -> Any:
    cache_key = f"products:list:{skip}:{limit}"
    
    # Try to get from cache
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
        
    products = await service.get_products(skip=skip, limit=limit)
    total_count = await service.get_products_count()
    
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

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate,
    current_admin: User = Depends(get_current_admin),
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
    current_admin: User = Depends(get_current_admin),
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
    current_admin: User = Depends(get_current_admin),
    service: ProductService = Depends(get_product_service),
    redis: Redis = Depends(get_redis_client)
):
    success = await service.delete_product(product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found")
        
    await redis.delete(f"product:{product_id}")
    await redis.delete("products:list:0:100")
    return None


