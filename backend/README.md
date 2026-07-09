# AI Project Brain — Backend

FastAPI service following Clean Architecture. See the root
[`README.md`](../README.md) for the full stack and the
[Engineering Constitution](../docs/specs/AI_Project_Brain_Engineering_Constitution.md)
for standards.

## Layers

| Layer            | Path                    | Responsibility                                        |
| ---------------- | ----------------------- | ----------------------------------------------------- |
| `domain`         | `app/domain/`           | Entities + repository interfaces (framework-free)     |
| `application`    | `app/application/`      | Use cases / services orchestrating the domain         |
| `infrastructure` | `app/infrastructure/`   | DB, external APIs, vector store, Celery workers        |
| `presentation`   | `app/presentation/`     | FastAPI routers, schemas, error handling              |

Business logic must never live in the presentation layer.

## Develop

```bash
python -m venv .venv
# Windows:  .venv\Scripts\activate   |  macOS/Linux:  source .venv/bin/activate
pip install -e ".[dev]"

uvicorn app.main:app --reload        # http://localhost:8000/api/v1/health

pytest                               # tests
ruff check .                         # lint
black --check .                      # format check
```

## Migrations

```bash
alembic revision --autogenerate -m "message"
alembic upgrade head
```

The database URL and model metadata are injected from the app settings in
`alembic/env.py`. Import new model modules there so autogeneration sees them.

## Background worker

```bash
celery -A app.infrastructure.celery_app.celery_app worker --loglevel=info
```
