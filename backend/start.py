"""Container entrypoint: migrate only if needed, then serve.

`alembic upgrade head` imports the whole app and opens a connection on every
cold start even when nothing changed. Here one cheap query compares the
database's revision with the newest migration file, and the real upgrade only
runs when they differ.
"""

from __future__ import annotations

import os
import subprocess
import sys

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text


def _database_is_current() -> bool:
    from app.core.config import get_settings

    url = get_settings().database_url
    head = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version_num FROM alembic_version")).first()
    except Exception:  # no table yet / not reachable: let alembic decide
        return False
    finally:
        engine.dispose()
    return row is not None and row[0] == head


def main() -> None:
    if not _database_is_current():
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    port = os.environ.get("PORT", "8000")
    os.execvp(
        sys.executable,
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", port],
    )


if __name__ == "__main__":
    main()
