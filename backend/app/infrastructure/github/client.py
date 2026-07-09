"""Thin GitHub REST + OAuth client.

Isolates all HTTP interaction with GitHub so the application layer depends only
on plain data (dicts), never on transport details.
"""

from __future__ import annotations

from urllib.parse import urlencode

import httpx

from app.core.config import get_settings

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_URL = "https://api.github.com"


class GitHubError(Exception):
    """Raised when a GitHub API interaction fails."""


class GitHubClient:
    """Wraps GitHub OAuth and the subset of the REST API used in Phase 1."""

    def __init__(self, timeout: float = 15.0) -> None:
        self._timeout = timeout

    def build_authorize_url(self, state: str) -> str:
        """Build the URL the user is redirected to in order to grant access."""
        settings = get_settings()
        params = {
            "client_id": settings.github_oauth_client_id,
            "redirect_uri": settings.github_oauth_redirect_uri,
            "scope": "read:user user:email repo",
            "state": state,
        }
        return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code_for_token(self, code: str) -> str:
        """Exchange an OAuth ``code`` for a user access token."""
        settings = get_settings()
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                GITHUB_TOKEN_URL,
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.github_oauth_client_id,
                    "client_secret": settings.github_oauth_client_secret,
                    "code": code,
                    "redirect_uri": settings.github_oauth_redirect_uri,
                },
            )
        if response.status_code != 200:
            raise GitHubError(f"Token exchange failed ({response.status_code})")
        token = response.json().get("access_token")
        if not token:
            raise GitHubError("GitHub did not return an access token")
        return token

    async def get_authenticated_user(self, token: str) -> dict:
        """Fetch the profile of the token's owner."""
        return await self._get(token, "/user")

    async def list_repositories(self, token: str, per_page: int = 100) -> list[dict]:
        """List repositories accessible to the authenticated user."""
        result = await self._get(
            token,
            "/user/repos",
            params={"per_page": per_page, "sort": "updated", "affiliation": "owner"},
        )
        return result if isinstance(result, list) else []

    async def get_repository(self, token: str, full_name: str) -> dict:
        """Fetch a single repository by ``owner/name``."""
        return await self._get(token, f"/repos/{full_name}")

    async def get_file_content(
        self, token: str, full_name: str, path: str, ref: str | None = None
    ) -> str:
        """Fetch a text file's contents from a repository via the raw media type."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{GITHUB_API_URL}/repos/{full_name}/contents/{path}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.raw+json",
                },
                params={"ref": ref} if ref else None,
            )
        if response.status_code != 200:
            raise GitHubError(f"Could not fetch {path} ({response.status_code})")
        return response.text

    async def _get(self, token: str, path: str, params: dict | None = None) -> dict | list:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{GITHUB_API_URL}{path}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
                params=params,
            )
        if response.status_code != 200:
            raise GitHubError(f"GitHub GET {path} failed ({response.status_code})")
        return response.json()
