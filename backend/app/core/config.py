"""Application configuration.

All settings are read from environment variables (or a local `.env`) so that
secrets never live in source, per the Engineering Constitution.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
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

    # Fernet key used to encrypt third-party access tokens at rest. Generate with:
    #   python -c "from cryptography.fernet import Fernet;
    #              print(Fernet.generate_key().decode())"
    token_encryption_key: str = ""

    # AI — chat runs on Claude by default; embeddings always use OpenAI
    # (Anthropic has no embeddings API). Set LLM_PROVIDER=openai to chat on GPT.
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "anthropic"
    llm_model: str = "claude-opus-5-5"
    # Claude reasoning depth: low | medium | high | xhigh | max
    llm_effort: str = "low"
    embedding_provider: str = "openai"
    embedding_model: str = "text-embedding-3-small"
    # text-embedding-3-small returns 1536-dim vectors
    embedding_dim: int = 1536
    qdrant_collection: str = "code_chunks"
    # Number of code chunks retrieved per RAG question
    rag_top_k: int = 6

    # Observability
    sentry_dsn: str | None = None

    # API metadata
    api_v1_prefix: str = Field(default="/api/v1")

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        """Pin bare Postgres URLs to psycopg 3.

        Hosted providers (e.g. Neon via Vercel) hand out ``postgres://`` or
        ``postgresql://`` URLs, which SQLAlchemy would map to psycopg2 — a driver
        this project doesn't install.
        """
        for scheme in ("postgres://", "postgresql://"):
            if value.startswith(scheme):
                return "postgresql+psycopg://" + value[len(scheme) :]
        return value

    @property
    def cors_origins(self) -> list[str]:
        """CORS origins as a list."""
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
