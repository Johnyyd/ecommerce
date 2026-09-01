from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.endpoints import users, auth, products
from app.core.logging import setup_logging
import logging

setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    # "Vô hiệu hóa Swagger UI (openapi_url=None) khi ở môi trường Production."
    openapi_url=None if settings.ENVIRONMENT == "production" else "/openapi.json"
)

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

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
