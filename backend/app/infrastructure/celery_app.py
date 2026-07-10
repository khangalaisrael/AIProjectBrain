"""Celery application (background worker entry point).

Run a worker with:
    celery -A app.infrastructure.celery_app.celery_app worker --loglevel=info
"""

from __future__ import annotations

from celery import Celery

from app.core.config import get_settings

_settings = get_settings()

celery_app = Celery(
    "ai_project_brain",
    broker=_settings.redis_url,
    backend=_settings.redis_url,
    # A worker must import the task module to register the task. The web process
    # gets away without this because it imports `tasks` lazily when enqueuing,
    # but a standalone worker would answer `index_repository` with NotRegistered.
    include=["app.infrastructure.tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Eager mode runs tasks inline (no broker/worker). Failures are recorded on
    # the repository row rather than propagated, so an import request still
    # returns cleanly even if indexing fails.
    task_always_eager=_settings.celery_task_always_eager,
    task_eager_propagates=False,
)
