"""Authentication use cases (GitHub OAuth → local user + session token)."""

from __future__ import annotations

import secrets

from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.infrastructure.db.models import UserModel
from app.infrastructure.db.repositories import UserRepository
from app.infrastructure.github.client import GitHubClient


class AuthService:
    """Coordinates the GitHub OAuth login flow and issues session tokens."""

    def __init__(self, session: Session, github: GitHubClient | None = None) -> None:
        self._users = UserRepository(session)
        self._github = github or GitHubClient()

    @staticmethod
    def new_state() -> str:
        """Generate an anti-CSRF ``state`` value for the authorize request."""
        return secrets.token_urlsafe(24)

    def build_authorize_url(self, state: str) -> str:
        return self._github.build_authorize_url(state)

    async def complete_login(self, code: str) -> tuple[UserModel, str]:
        """Exchange the OAuth code, upsert the user, and mint a session token.

        Returns the persisted user and a signed JWT.
        """
        token = await self._github.exchange_code_for_token(code)
        profile = await self._github.get_authenticated_user(token)
        user = self._users.upsert_from_github(profile, token)
        access_token = create_access_token(str(user.id))
        return user, access_token
