"""GitHub OAuth authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.application.auth_service import AuthService
from app.core.config import get_settings
from app.infrastructure.db.models import UserModel
from app.infrastructure.db.session import get_db
from app.infrastructure.github.client import GitHubClient, GitHubError
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

_STATE_COOKIE = "gh_oauth_state"


@router.get("/github/login")
def github_login() -> RedirectResponse:
    """Redirect the browser to GitHub's OAuth authorize page.

    A random ``state`` is stored in an HttpOnly cookie and echoed back by GitHub
    to the callback for CSRF protection.
    """
    state = AuthService.new_state()
    url = GitHubClient().build_authorize_url(state)

    response = RedirectResponse(url=url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.set_cookie(_STATE_COOKIE, state, httponly=True, max_age=600, samesite="lax")
    return response


@router.get("/github/callback")
async def github_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
    gh_oauth_state: str | None = Cookie(default=None),
) -> RedirectResponse:
    """Handle GitHub's redirect: verify state, log the user in, hand off to the UI.

    On success the browser is redirected to ``{frontend_url}/auth/callback`` with
    the signed JWT in the URL fragment (never sent to servers or logged), where
    the frontend stores it and continues.
    """
    if not gh_oauth_state or gh_oauth_state != state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")

    service = AuthService(db)
    try:
        _, access_token = await service.complete_login(code)
    except GitHubError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    frontend_url = get_settings().frontend_url.rstrip("/")
    redirect = RedirectResponse(
        url=f"{frontend_url}/auth/callback#token={access_token}",
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )
    redirect.delete_cookie(_STATE_COOKIE)
    return redirect


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    """Return the authenticated user's profile."""
    return current_user
