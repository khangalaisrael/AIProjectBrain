"""Repository import/listing tests (GitHub client + task queue mocked)."""

import pytest

_GITHUB_REPO = {
    "id": 1,
    "name": "demo",
    "full_name": "octocat/demo",
    "description": "A demo repo",
    "language": "Python",
    "private": False,
    "default_branch": "main",
    "clone_url": "https://github.com/octocat/demo.git",
}


class FakeGitHubClient:
    async def list_repositories(self, token: str, per_page: int = 100) -> list[dict]:
        return [_GITHUB_REPO]

    async def get_repository(self, token: str, full_name: str) -> dict:
        return {**_GITHUB_REPO, "full_name": full_name}


@pytest.fixture
def mock_github(monkeypatch):
    monkeypatch.setattr(
        "app.application.repository_service.GitHubClient", lambda: FakeGitHubClient()
    )


@pytest.fixture
def enqueued(monkeypatch):
    """Capture indexing enqueue calls instead of hitting Celery/Redis."""
    calls: list[int] = []
    monkeypatch.setattr("app.application.repository_service._default_enqueue_index", calls.append)
    return calls


def test_list_github_repositories(client, auth_headers, mock_github):
    response = client.get("/api/v1/repositories/github", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()[0]["full_name"] == "octocat/demo"


def test_import_repository_creates_record_and_queues_indexing(
    client, auth_headers, mock_github, enqueued
):
    response = client.post(
        "/api/v1/repositories",
        headers=auth_headers,
        json={"full_name": "octocat/demo"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["full_name"] == "octocat/demo"
    assert body["status"] == "pending"
    assert enqueued == [body["id"]]


def test_import_is_idempotent(client, auth_headers, mock_github, enqueued):
    first = client.post(
        "/api/v1/repositories", headers=auth_headers, json={"full_name": "octocat/demo"}
    )
    second = client.post(
        "/api/v1/repositories", headers=auth_headers, json={"full_name": "octocat/demo"}
    )
    assert first.json()["id"] == second.json()["id"]
    assert len(enqueued) == 1  # only queued on first import


def test_list_imported_repositories(client, auth_headers, mock_github, enqueued):
    client.post("/api/v1/repositories", headers=auth_headers, json={"full_name": "octocat/demo"})
    response = client.get("/api/v1/repositories", headers=auth_headers)
    assert response.status_code == 200
    assert [r["full_name"] for r in response.json()] == ["octocat/demo"]


def test_repositories_require_auth(client):
    assert client.get("/api/v1/repositories").status_code in (401, 403)
