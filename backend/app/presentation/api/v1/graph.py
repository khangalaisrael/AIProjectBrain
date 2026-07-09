"""Software Atlas routes: the repository knowledge graph."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.application.graph_service import GraphService, GraphView
from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import get_db
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import GraphEdgeOut, GraphNodeOut, GraphOut

router = APIRouter(prefix="/repositories", tags=["atlas"])

# Deepest zoom level the graph models (0 systems .. 4 functions).
MAX_LEVEL = 4


def _owned_repo(repository_id: int, user: UserModel, db: Session) -> RepositoryModel:
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


def _to_out(view: GraphView) -> GraphOut:
    return GraphOut(
        nodes=[GraphNodeOut.model_validate(node) for node in view.nodes],
        edges=[
            GraphEdgeOut(
                source_key=edge.source_key,
                target_key=edge.target_key,
                kind=edge.kind,
                weight=edge.weight,
            )
            for edge in view.edges
        ],
    )


@router.get("/{repository_id}/graph", response_model=GraphOut)
def get_graph(
    repository_id: int,
    max_level: int = Query(default=0, ge=0, le=MAX_LEVEL),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GraphOut:
    """Nodes down to ``max_level``, with deeper edges rolled up onto them."""
    _owned_repo(repository_id, current_user, db)
    return _to_out(GraphService(db).view(repository_id, max_level))


@router.get("/{repository_id}/graph/children", response_model=GraphOut)
def get_graph_children(
    repository_id: int,
    key: str = Query(min_length=1, max_length=1024),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GraphOut:
    """Direct children of a node (drill-in), with edges rolled up between them."""
    _owned_repo(repository_id, current_user, db)
    return _to_out(GraphService(db).children(repository_id, key))


@router.get("/{repository_id}/graph/node", response_model=GraphNodeOut)
def get_graph_node(
    repository_id: int,
    key: str = Query(min_length=1, max_length=1024),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GraphNodeOut:
    """A single node's detail, including its source location when it has one."""
    _owned_repo(repository_id, current_user, db)
    node = GraphService(db).node(repository_id, key)
    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found")
    return GraphNodeOut.model_validate(node)
