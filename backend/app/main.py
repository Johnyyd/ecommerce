import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI, Request, Response
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.api.v1.endpoints import users, auth, products, orders, cart, addresses, payments, categories, brands, vouchers, backup, reviews, async_jobs, shipping
from app.core.logging import setup_logging
from app.core.telemetry import init_telemetry, tracing_middleware
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from contextlib import asynccontextmanager
import logging
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

setup_logging()
logger = logging.getLogger("app.main")

# Initialize OpenTelemetry
tracer_provider = init_telemetry()

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Baseline Defense-in-Depth Security Headers (All environments)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"

        # Production & HTTPS Specific Headers
        is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
        if settings.ENVIRONMENT == "production" or is_https:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )

        return response

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
    openapi_url=None if settings.ENVIRONMENT == "production" else "/openapi.json",
    lifespan=lifespan
)

# Attach limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add SlowAPI Middleware
app.add_middleware(SlowAPIMiddleware)

# Add Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS Middleware - Use configured origins
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Trace-ID", "X-Span-ID"],
)

# Add OpenTelemetry tracing middleware
app.middleware("http")(tracing_middleware)

# Prometheus metrics instrumentation
Instrumentator().instrument(app).expose(app)

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
