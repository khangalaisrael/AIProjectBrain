"""Documentation endpoint tests (GitHub + LLM mocked)."""

import pytest

from app.domain.enums import ImportStatus, Language
from app.infrastructure.db.models import FileModel, FunctionModel, RepositoryModel, UserModel

ROUTE_SOURCE = '@router.get("/health")\ndef health(): ...'


class FakeGitHub:
    async def get_file_content(self, token, full_name, path, ref=None) -> str:
        if path.endswith("health.py"):
            return ROUTE_SOURCE
        return "# Demo project"


class FakeChat:
    """Echoes which doc type was requested so tests can tell prompts apart."""

    last_user_prompt: str = ""

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        FakeChat.last_user_prompt = user_prompt
        if "README" in system_prompt:
            return "# Demo\nA generated readme."
        if "API surface" in system_prompt:
            return "## Endpoints\n- GET /health"
        if "architecture document" in system_prompt:
            return "## Layers\nClean Architecture."
        return "## Folders\nbackend/ holds the API."


@pytest.fixture
def mock_clients(monkeypatch):
    FakeChat.last_user_prompt = ""
    monkeypatch.setattr("app.application.docs_service.GitHubClient", lambda: FakeGitHub())
    monkeypatch.setattr("app.application.docs_service.OpenAIChat", lambda: FakeChat())


@pytest.fixture
def repo_id(db_session, user: UserModel) -> int:
    repo = RepositoryModel(
        user_id=user.id,
        github_id=1234,
        name="demo",
        full_name="octocat/demo",
        clone_url="https://github.com/octocat/demo.git",
        default_branch="main",
        status=ImportStatus.READY,
    )
    db_session.add(repo)
    db_session.commit()

    file = FileModel(
        repository_id=repo.id, path="backend/app/main.py", language=Language.PYTHON, size_bytes=10
    )
    db_session.add(file)
    db_session.commit()
    db_session.add(
        FunctionModel(
            file_id=file.id,
            repository_id=repo.id,
            name="create_app",
            start_line=1,
            end_line=5,
        )
    )
    db_session.commit()
    return repo.id


def test_docs_empty_before_generation(client, auth_headers, repo_id):
    resp = client.get(f"/api/v1/repositories/{repo_id}/docs", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.parametrize(
    ("doc_type", "expected"),
    [
        ("readme", "generated readme"),
        ("api", "GET /health"),
        ("architecture", "Clean Architecture"),
        ("folders", "backend/ holds the API"),
    ],
)
def test_generate_each_doc_type(client, auth_headers, repo_id, mock_clients, doc_type, expected):
    resp = client.post(f"/api/v1/repositories/{repo_id}/docs/{doc_type}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["doc_type"] == doc_type
    assert expected in body["content"]


def test_generated_docs_are_listed_and_regenerate_upserts(
    client, auth_headers, repo_id, mock_clients
):
    client.post(f"/api/v1/repositories/{repo_id}/docs/readme", headers=auth_headers)
    client.post(f"/api/v1/repositories/{repo_id}/docs/api", headers=auth_headers)
    # Regenerating readme must update, not duplicate.
    client.post(f"/api/v1/repositories/{repo_id}/docs/readme", headers=auth_headers)

    listed = client.get(f"/api/v1/repositories/{repo_id}/docs", headers=auth_headers).json()
    assert sorted(d["doc_type"] for d in listed) == ["api", "readme"]


def test_api_doc_context_includes_route_file_source(
    client, auth_headers, repo_id, db_session, mock_clients
):
    """The API doc must see real route source, not just function names."""
    route_file = FileModel(
        repository_id=repo_id,
        path="backend/app/presentation/api/v1/health.py",
        language=Language.PYTHON,
        size_bytes=10,
    )
    db_session.add(route_file)
    db_session.commit()

    client.post(f"/api/v1/repositories/{repo_id}/docs/api", headers=auth_headers)
    assert ROUTE_SOURCE in FakeChat.last_user_prompt

    # Other doc types do not pull route source.
    client.post(f"/api/v1/repositories/{repo_id}/docs/readme", headers=auth_headers)
    assert ROUTE_SOURCE not in FakeChat.last_user_prompt


def test_invalid_doc_type_is_422(client, auth_headers, repo_id, mock_clients):
    resp = client.post(f"/api/v1/repositories/{repo_id}/docs/bogus", headers=auth_headers)
    assert resp.status_code == 422


def test_docs_on_unowned_repo_is_404(client, auth_headers):
    assert client.get("/api/v1/repositories/4321/docs", headers=auth_headers).status_code == 404


def test_docs_require_auth(client):
    assert client.get("/api/v1/repositories/1/docs").status_code in (401, 403)
