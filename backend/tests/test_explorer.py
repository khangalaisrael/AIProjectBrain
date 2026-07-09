"""Code Explorer endpoint tests (GitHub + LLM mocked)."""

import pytest

from app.domain.enums import ImportStatus, Language
from app.infrastructure.db.models import FileModel, FunctionModel, RepositoryModel, UserModel


class FakeGitHub:
    async def get_file_content(self, token, full_name, path, ref=None) -> str:
        return "def main():\n    return 1\n"


class FakeChat:
    def complete(self, system_prompt: str, user_prompt: str) -> str:
        return "This file defines the entry point."


@pytest.fixture
def mock_clients(monkeypatch):
    monkeypatch.setattr("app.application.explorer_service.GitHubClient", lambda: FakeGitHub())
    monkeypatch.setattr("app.application.explorer_service.OpenAIChat", lambda: FakeChat())


@pytest.fixture
def seeded(db_session, user: UserModel) -> dict:
    repo = RepositoryModel(
        user_id=user.id,
        github_id=555,
        name="demo",
        full_name="octocat/demo",
        clone_url="https://github.com/octocat/demo.git",
        default_branch="main",
        status=ImportStatus.READY,
    )
    db_session.add(repo)
    db_session.commit()

    file = FileModel(
        repository_id=repo.id, path="app/main.py", language=Language.PYTHON, size_bytes=42
    )
    db_session.add(file)
    db_session.commit()

    fn = FunctionModel(
        file_id=file.id,
        repository_id=repo.id,
        name="main",
        signature="def main():",
        start_line=1,
        end_line=2,
    )
    db_session.add(fn)
    db_session.commit()
    return {"repo_id": repo.id, "file_id": file.id}


def test_list_files_with_function_counts(client, auth_headers, seeded):
    resp = client.get(f"/api/v1/repositories/{seeded['repo_id']}/files", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body == [
        {"id": seeded["file_id"], "path": "app/main.py", "language": "python", "function_count": 1}
    ]


def test_get_file_returns_content_and_functions(client, auth_headers, seeded, mock_clients):
    resp = client.get(
        f"/api/v1/repositories/{seeded['repo_id']}/files/{seeded['file_id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "def main" in body["content"]
    assert [f["name"] for f in body["functions"]] == ["main"]


def test_explain_file_uses_llm(client, auth_headers, seeded, mock_clients):
    resp = client.post(
        f"/api/v1/repositories/{seeded['repo_id']}/files/{seeded['file_id']}/explain",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["explanation"] == "This file defines the entry point."


def test_files_on_unowned_repo_is_404(client, auth_headers):
    assert client.get("/api/v1/repositories/4321/files", headers=auth_headers).status_code == 404


def test_get_unknown_file_is_404(client, auth_headers, seeded, mock_clients):
    resp = client.get(
        f"/api/v1/repositories/{seeded['repo_id']}/files/999999", headers=auth_headers
    )
    assert resp.status_code == 404


def test_explorer_requires_auth(client):
    assert client.get("/api/v1/repositories/1/files").status_code in (401, 403)
