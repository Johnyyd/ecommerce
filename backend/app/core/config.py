from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr, field_validator
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "E-Commerce API"
    ENVIRONMENT: str = "development"
    POSTGRES_SERVER: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "ecommerce_user"
    POSTGRES_PASSWORD: str = "test_password"
    POSTGRES_DB: str = "ecommerce_db"

    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/0"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    SECRET_KEY: str = "test-secret-key-for-testing-only"

    # PayOS / VietQR Open Banking Credentials
    PAYOS_CLIENT_ID: str = "test-client-id"
    PAYOS_API_KEY: str = "test-api-key"
    PAYOS_CHECKSUM_KEY: str = "test-checksum-key"
    VIETQR_BANK_ID: str = "vietinbank"
    VIETQR_BANK_NAME: str = "Vietinbank"
    VIETQR_ACCOUNT_NO: str = "test-account-no"
    VIETQR_ACCOUNT_NAME: str = "Test Account"

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
    GHN_API_TOKEN: str = "test-ghn-token"
    GHN_SHOP_ID: int = 12345
    GHN_FROM_DISTRICT_ID: int = 1
    GHN_FROM_WARD_CODE: str = "test-ward"

    # Meilisearch Configuration
    MEILISEARCH_URL: str = "http://meilisearch:7700"
    MEILISEARCH_MASTER_KEY: str = "test-meilisearch-key"

    # Embedding API Configuration (Free LLM API)
    EMBEDDING_API_URL: str = "http://host.docker.internal:3001/v1"
    EMBEDDING_API_KEY: str | None = None

    # Rate Limiting Configuration
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_WEBHOOK: str = "100/minute"
    RATE_LIMIT_SEARCH: str = "30/minute"
    RATE_LIMIT_UPLOAD: str = "10/minute"

    # CORS Configuration
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8080"]

    # JWT Configuration (A04: Cryptographic Failures - Algorithm Agility)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_PRIVATE_KEY: str | None = None
    JWT_PUBLIC_KEY: str | None = None

    # Auto-cancel Configuration
    AUTO_CANCEL_MINUTES: int = 15

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Validate required secrets are not empty in non-test environments
        if self.ENVIRONMENT != "test":
            if not self.MEILISEARCH_MASTER_KEY or self.MEILISEARCH_MASTER_KEY.startswith("test-"):
                raise ValueError("MEILISEARCH_MASTER_KEY must be set to a real value (not test default)")

    @field_validator("POSTGRES_PASSWORD")
    @classmethod
    def validate_postgres_password(cls, v: str) -> str:
        if not v:
            raise ValueError("POSTGRES_PASSWORD must be set in environment")
        return v

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), env_file_encoding="utf-8", extra="ignore")


settings = Settings()
