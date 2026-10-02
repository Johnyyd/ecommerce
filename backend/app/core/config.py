from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "E-Commerce API"
    ENVIRONMENT: str = "development"
    POSTGRES_SERVER: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "ecommerce_user"
    POSTGRES_PASSWORD: str = "ecommerce_password"
    POSTGRES_DB: str = "ecommerce_db"
    
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None
    
    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/0"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    SECRET_KEY: str

    # PayOS / VietQR Open Banking Credentials
    PAYOS_CLIENT_ID: str
    PAYOS_API_KEY: str
    PAYOS_CHECKSUM_KEY: str
    VIETQR_BANK_ID: str = "vietinbank"  # VietinBank BIN 970415 or slug
    VIETQR_BANK_NAME: str = "Vietinbank"
    VIETQR_ACCOUNT_NO: str
    VIETQR_ACCOUNT_NAME: str

    # Pillar 3: Async Workers, Media & Reporting settings
    FRONTEND_URL: str = "http://localhost:3000"
    MEDIA_DIR: str = "media"
    REPORTS_DIR: str = "reports"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAIL_FROM: str = "noreply@ecommerce.local"

    # Logistics / Shipping (Giao Hàng Nhanh - GHN API v2)
    GHN_API_URL: str = "https://dev-online-gateway.ghn.vn/shiip/public-api"
    GHN_API_TOKEN: str
    GHN_SHOP_ID: int
    GHN_FROM_DISTRICT_ID: int
    GHN_FROM_WARD_CODE: str

    # Meilisearch Configuration
    MEILISEARCH_URL: str = "http://meilisearch:7700"
    MEILISEARCH_MASTER_KEY: str

    # Embedding API Configuration (Free LLM API)
    EMBEDDING_API_URL: str = "http://host.docker.internal:3001/v1"
    EMBEDDING_API_KEY: str

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), env_file_encoding="utf-8", extra="ignore")


settings = Settings()
