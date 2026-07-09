"""SQLAlchemy declarative base.

All ORM models inherit from `Base`. Import model modules here (once they exist)
so that Alembic autogeneration can discover their metadata.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
