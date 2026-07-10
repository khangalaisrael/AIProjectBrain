"""Request Flow routes: execution paths through the call graph."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.application.flow_service import Flow, FlowService
from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import get_db
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import (
    FlowEdgeOut,
    FlowEntryOut,
    FlowExplanationOut,
    FlowOut,
    FlowStepOut,
    StepExplanationOut,
)

router = APIRouter(prefix="/repositories", tags=["flows"])


def _owned_repo(repository_id: int, user: UserModel, db: Session) -> RepositoryModel:
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


def _load_flow(repository_id: int, key: str, db: Session) -> Flow:
    flow = FlowService(db).path(repository_id, key)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry point not found")
    return flow


@router.get("/{repository_id}/flows", response_model=list[FlowEntryOut])
def list_flows(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FlowEntryOut]:
    """Request entry points — route handlers nothing else calls."""
    _owned_repo(repository_id, current_user, db)
    entries = FlowService(db).entry_points(repository_id)
    return [FlowEntryOut(key=node.key, name=node.name, path=node.path) for node in entries]


@router.get("/{repository_id}/flows/path", response_model=FlowOut)
def get_flow_path(
    repository_id: int,
    key: str = Query(min_length=1, max_length=1024),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlowOut:
    """The ordered execution path taken from an entry point."""
    _owned_repo(repository_id, current_user, db)
    flow = _load_flow(repository_id, key, db)
    return FlowOut(
        entry_key=flow.entry_key,
        steps=[FlowStepOut(**asdict(step)) for step in flow.steps],
        edges=[FlowEdgeOut(source_key=s, target_key=t) for s, t in flow.edges],
    )


@router.post("/{repository_id}/flows/explain", response_model=FlowExplanationOut)
def explain_flow(
    repository_id: int,
    key: str = Query(min_length=1, max_length=1024),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlowExplanationOut:
    """Narrate the request: a summary plus one explanation per step."""
    repo = _owned_repo(repository_id, current_user, db)
    flow = _load_flow(repository_id, key, db)

    explanation = FlowService(db).explain(repo, flow)
    return FlowExplanationOut(
        summary=explanation.summary,
        steps=[StepExplanationOut(key=s.key, explanation=s.explanation) for s in explanation.steps],
    )
