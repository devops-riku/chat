from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Chat"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me"

    database_url: str = "postgresql+asyncpg://nexus:nexus_secret@localhost:5432/nexus_chat"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "change-me-jwt"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None
    access_token_cookie: str = "access_token"
    refresh_token_cookie: str = "refresh_token"

    cors_origins: str = "http://localhost:3000"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "nexus_minio"
    minio_secret_key: str = "nexus_minio_secret"
    minio_bucket: str = "nexus-uploads"
    minio_secure: bool = False

    backend_public_url: str = "http://localhost:8000"

    rate_limit_per_minute: int = 120

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
