import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.endpoints import users, auth, products, orders, cart, addresses, payments, categories, brands, vouchers, backup, reviews, async_jobs, shipping
from app.core.logging import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from contextlib import asynccontextmanager
import logging

setup_logging()
logger = logging.getLogger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    try:
        from app.core.queue import close_queue_pool
        await close_queue_pool()
    except Exception as e:
        logger.warning("Error during queue pool shutdown: %s", e)

app = FastAPI(
    title=settings.PROJECT_NAME,
    # "Vô hiệu hóa Swagger UI (openapi_url=None) khi ở môi trường Production."
    openapi_url=None if settings.ENVIRONMENT == "production" else "/openapi.json",
    lifespan=lifespan
)

# Prometheus metrics instrumentation
Instrumentator().instrument(app).expose(app)

# "Loại bỏ CORSMiddleware ở FastAPI trong môi trường Production để Gateway/Nginx xử lý Preflight OPTIONS."
if settings.ENVIRONMENT != "production":
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Static media files mounting for product images & WebP variants
media_dir = Path(settings.MEDIA_DIR)
try:
    media_dir.mkdir(parents=True, exist_ok=True)
except Exception as e:
    logger.warning("Media directory creation check: %s", e)

if media_dir.exists():
    app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(cart.router, prefix="/api/v1/cart", tags=["cart"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(addresses.router, prefix="/api/v1/addresses", tags=["addresses"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(categories.router, prefix="/api/v1/categories", tags=["categories"])
app.include_router(brands.router, prefix="/api/v1/brands", tags=["brands"])
app.include_router(vouchers.router, prefix="/api/v1/vouchers", tags=["vouchers"])
app.include_router(backup.router, prefix="/api/v1/admin/backups", tags=["backups"])
app.include_router(reviews.router, prefix="/api/v1/reviews", tags=["reviews"])
app.include_router(shipping.router, prefix="/api/v1/shipping", tags=["shipping"])
app.include_router(async_jobs.router, prefix="/api/v1", tags=["async-jobs"])

@app.get("/api/health")
@app.get("/health")
async def health_check():
    return {"status": "ok"}

