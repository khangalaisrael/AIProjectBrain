# Backend image — serves the API and, with a different command, runs the worker.
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# GitPython shells out to a real `git` binary to clone the repositories we index.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies resolve from pyproject alone, so this layer survives source edits.
COPY pyproject.toml README.md ./
RUN pip install --upgrade pip && pip install .

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY start.py ./

# Clone targets and any other scratch data belong to a non-root user.
RUN useradd --create-home --uid 10001 brain && chown -R brain:brain /app
USER brain

EXPOSE 8000

# Compose overrides this for the worker. Vercel's container runtime tells the
# server which port to bind through $PORT; elsewhere it falls back to 8000.
# start.py migrates only when the schema is behind, then serves (faster cold starts).
CMD ["python", "start.py"]
