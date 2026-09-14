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

    SECRET_KEY: str = "super_secret_key_change_me_in_production"

    # PayOS / VietQR Open Banking Credentials
    PAYOS_CLIENT_ID: str = "payos_client_id_demo"
    PAYOS_API_KEY: str = "payos_api_key_demo"
    PAYOS_CHECKSUM_KEY: str = "payos_checksum_key_secret_2026"
    VIETQR_BANK_ID: str = "vietinbank"  # VietinBank BIN 970415 or slug
    VIETQR_BANK_NAME: str = "Vietinbank"
    VIETQR_ACCOUNT_NO: str = "100879630629"
    VIETQR_ACCOUNT_NAME: str = "ECOMMERCE ENTERPRISE"

    # Pillar 3: Async Workers, Media & Reporting settings
    FRONTEND_URL: str = "http://localhost:3000"
    MEDIA_DIR: str = "media"
    REPORTS_DIR: str = "reports"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAIL_FROM: str = "noreply@ecommerce.local"

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), env_file_encoding="utf-8", extra="ignore")


settings = Settings()
