"""The worker must know about the tasks the API enqueues."""

from app.infrastructure.celery_app import celery_app


def test_worker_registers_the_indexing_task():
    """A bare worker imports only the Celery app; `include` must pull in tasks.

    Eager mode hides this: the web process imports `tasks` lazily when it
    enqueues, so the task exists there whether or not `include` is set.
    """
    celery_app.loader.import_default_modules()
    assert "index_repository" in celery_app.tasks


def test_enqueued_task_name_matches_the_registered_one():
    from app.infrastructure.tasks import index_repository

    assert index_repository.name == "index_repository"
