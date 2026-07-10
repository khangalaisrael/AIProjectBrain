"""Aggregate router for API v1.

Feature routers (auth, repositories, courses, code explorer, chat,
documentation, search) are included here as they are built.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.presentation.api.v1 import (
    auth,
    docs,
    explorer,
    flows,
    graph,
    health,
    learn,
    overview,
    repositories,
    thinking,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(repositories.router)
api_router.include_router(explorer.router)
api_router.include_router(overview.router)
api_router.include_router(learn.router)
api_router.include_router(thinking.router)
api_router.include_router(docs.router)
api_router.include_router(graph.router)
api_router.include_router(flows.router)
