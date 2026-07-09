"""Indexing service filesystem-walk tests (no network / git)."""

from pathlib import Path

from sqlalchemy import select

from app.application.indexing_service import IndexingService
from app.domain.enums import ImportStatus
from app.infrastructure.db.models import FileModel, FunctionModel, RepositoryModel, UserModel


def _make_repo(db_session) -> RepositoryModel:
    user = UserModel(github_id=1, username="octocat")
    db_session.add(user)
    db_session.commit()
    repo = RepositoryModel(
        user_id=user.id,
        github_id=99,
        name="demo",
        full_name="octocat/demo",
        clone_url="https://github.com/octocat/demo.git",
        status=ImportStatus.PENDING,
    )
    db_session.add(repo)
    db_session.commit()
    return repo


def test_index_directory_persists_files_and_functions(db_session, tmp_path: Path):
    (tmp_path / "app.py").write_text("def main():\n    return 1\n", encoding="utf-8")
    (tmp_path / "util.js").write_text("function helper() { return 2; }\n", encoding="utf-8")
    # Ignored + unsupported files should be skipped.
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "dep.js").write_text("function x(){}", encoding="utf-8")
    (tmp_path / "README.md").write_text("# docs", encoding="utf-8")

    repo = _make_repo(db_session)
    indexed = IndexingService(db_session).index_directory(repo, tmp_path)

    assert indexed == 2  # app.py + util.js only
    files = db_session.scalars(select(FileModel)).all()
    assert {f.path for f in files} == {"app.py", "util.js"}

    functions = db_session.scalars(select(FunctionModel)).all()
    assert {fn.name for fn in functions} == {"main", "helper"}
