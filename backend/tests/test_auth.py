"""GitHub OAuth auth-flow tests (GitHub client mocked)."""

from urllib.parse import parse_qs, urlparse

import pytest


class FakeGitHubClient:
    """Stand-in for the real GitHub client during the OAuth callback."""

    async def exchange_code_for_token(self, code: str) -> str:
        return "gho_freshtoken"

    async def get_authenticated_user(self, token: str) -> dict:
        return {
            "id": 4242,
            "login": "octocat",
            "email": "octocat@example.com",
            "avatar_url": "https://avatars.example/octocat.png",
        }


def test_me_requires_authentication(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


def test_me_with_valid_token(client, auth_headers):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "octocat"


def test_me_with_invalid_token(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_login_redirects_to_github_with_state(client):
    response = client.get("/api/v1/auth/github/login", follow_redirects=False)
    assert response.status_code == 307
    location = response.headers["location"]
    assert location.startswith("https://github.com/login/oauth/authorize")
    assert "gh_oauth_state" in response.headers.get("set-cookie", "")
    assert parse_qs(urlparse(location).query)["state"]


def test_callback_creates_user_and_issues_token(client, monkeypatch):
    monkeypatch.setattr("app.application.auth_service.GitHubClient", lambda: FakeGitHubClient())

    login = client.get("/api/v1/auth/github/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]

    callback = client.get(
        "/api/v1/auth/github/callback",
        params={"code": "abc123", "state": state},
        follow_redirects=False,
    )
    assert callback.status_code == 200
    body = callback.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["username"] == "octocat"

    # The issued token authenticates against /me.
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["github_id"] == 4242


def test_callback_rejects_mismatched_state(client):
    response = client.get(
        "/api/v1/auth/github/callback",
        params={"code": "abc123", "state": "forged"},
        follow_redirects=False,
    )
    assert response.status_code == 400


@pytest.mark.parametrize("missing", ["code", "state"])
def test_callback_requires_code_and_state(client, missing):
    params = {"code": "x", "state": "y"}
    del params[missing]
    response = client.get("/api/v1/auth/github/callback", params=params)
    assert response.status_code == 422
