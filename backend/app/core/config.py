"""Application configuration.

All settings are read from environment variables (or a local `.env`) so that
secrets never live in source, per the Engineering Constitution.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core
    environment: str = "development"
    log_level: str = "INFO"

    # API
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_allow_origins: str = "http://localhost:3000"

    # Datastores
    database_url: str = "postgresql+psycopg://brain:change_me@localhost:5432/project_brain"
    redis_url: str = "redis://localhost:6379/0"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None

    # Background processing
    # When True, Celery tasks run synchronously in-process (no Redis/worker
    # required) — convenient for local development and tests.
    celery_task_always_eager: bool = False

    # GitHub OAuth
    github_oauth_client_id: str = ""
    github_oauth_client_secret: str = ""
    github_oauth_redirect_uri: str = "http://localhost:8000/api/v1/auth/github/callback"
    # Where to send the browser after a successful login (frontend receives the token)
    frontend_url: str = "http://localhost:3000"

    # Auth
    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60

    # AI (OpenAI) — one key powers both chat and embeddings
    openai_api_key: str = ""
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o"
    embedding_provider: str = "openai"
    embedding_model: str = "text-embedding-3-small"

    # Observability
    sentry_dsn: str | None = None

    # API metadata
    api_v1_prefix: str = Field(default="/api/v1")

    @property
    def cors_origins(self) -> list[str]:
        """CORS origins as a list."""
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
