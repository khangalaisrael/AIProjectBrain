"""Structured logging setup (observability-first).

Kept intentionally minimal for the scaffold. A later phase can swap this for a
JSON formatter / OpenTelemetry integration without changing call sites.
"""

from __future__ import annotations

import logging

from app.core.config import get_settings


def configure_logging() -> None:
    """Configure root logging based on the application settings."""
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger."""
    return logging.getLogger(name)
