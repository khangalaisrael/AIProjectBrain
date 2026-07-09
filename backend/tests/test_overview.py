"""Project Overview endpoint tests (GitHub + LLM mocked)."""

import pytest

from app.domain.enums import ImportStatus, Language
from app.infrastructure.db.models import FileModel, RepositoryModel, UserModel

_OVERVIEW_JSON = {
    "summary": "A FastAPI + Next.js app that turns repos into courses.",
    "difficulty": "Intermediate",
    "learning_time_minutes": 120,
    "architecture_style": "Clean Architecture",
    "technologies": ["FastAPI", "Next.js", "Qdrant"],
    "features": ["GitHub import", "RAG chat"],
}


class FakeGitHub:
    async def get_file_content(self, token, full_name, path, ref=None) -> str:
        return "# Demo\nA sample project."


class FakeChat:
    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        return _OVERVIEW_JSON


@pytest.fixture
def mock_clients(monkeypatch):
    monkeypatch.setattr("app.application.overview_service.GitHubClient", lambda: FakeGitHub())
    monkeypatch.setattr("app.application.overview_service.OpenAIChat", lambda: FakeChat())


@pytest.fixture
def repo_id(db_session, user: UserModel) -> int:
    repo = RepositoryModel(
        user_id=user.id,
        github_id=777,
        name="demo",
        full_name="octocat/demo",
        clone_url="https://github.com/octocat/demo.git",
        default_branch="main",
        status=ImportStatus.READY,
    )
    db_session.add(repo)
    db_session.commit()
    db_session.add_all(
        [
            FileModel(repository_id=repo.id, path="backend/app/main.py", language=Language.PYTHON),
            FileModel(
                repository_id=repo.id, path="frontend/app/page.tsx", language=Language.TYPESCRIPT
            ),
            FileModel(repository_id=repo.id, path="README.md", language=None),
        ]
    )
    db_session.commit()
    return repo.id


def test_get_overview_before_generation_is_404(client, auth_headers, repo_id):
    resp = client.get(f"/api/v1/repositories/{repo_id}/overview", headers=auth_headers)
    assert resp.status_code == 404


def test_generate_and_then_get_overview(client, auth_headers, repo_id, mock_clients):
    gen = client.post(f"/api/v1/repositories/{repo_id}/overview", headers=auth_headers)
    assert gen.status_code == 200
    body = gen.json()
    assert body["summary"] == _OVERVIEW_JSON["summary"]
    assert body["difficulty"] == "Intermediate"
    assert "FastAPI" in body["technologies"]
    # Folder map is computed from indexed files.
    folders = {f["folder"]: f["file_count"] for f in body["folder_map"]}
    assert folders["backend"] == 1 and folders["frontend"] == 1 and folders["(root)"] == 1

    # Now cached and retrievable.
    got = client.get(f"/api/v1/repositories/{repo_id}/overview", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["summary"] == _OVERVIEW_JSON["summary"]


def test_overview_on_unowned_repo_is_404(client, auth_headers):
    assert (
        client.post("/api/v1/repositories/4321/overview", headers=auth_headers).status_code == 404
    )


def test_overview_requires_auth(client):
    assert client.get("/api/v1/repositories/1/overview").status_code in (401, 403)
