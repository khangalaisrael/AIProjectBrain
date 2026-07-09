"""Aggregate router for API v1.

Feature routers (auth, repositories, courses, code explorer, chat,
documentation, search) are included here as they are built.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.presentation.api.v1 import auth, explorer, health, overview, repositories

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(repositories.router)
api_router.include_router(explorer.router)
api_router.include_router(overview.router)
