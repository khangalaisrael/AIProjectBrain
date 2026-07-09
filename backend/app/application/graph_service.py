"""Queries over the stored knowledge graph, including semantic-zoom roll-up."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.infrastructure.db.models import GraphNodeModel
from app.infrastructure.db.repositories import GraphRepository


@dataclass(slots=True)
class RolledEdge:
    source_key: str
    target_key: str
    kind: str
    weight: int


@dataclass(slots=True)
class GraphView:
    nodes: list[GraphNodeModel]
    edges: list[RolledEdge]


class GraphService:
    def __init__(self, session: Session) -> None:
        self._graph = GraphRepository(session)

    def node(self, repository_id: int, key: str) -> GraphNodeModel | None:
        return self._graph.get_node(repository_id, key)

    def view(self, repository_id: int, max_level: int) -> GraphView:
        """Nodes at or above ``max_level``, with deeper edges rolled up to them.

        This is what makes semantic zoom real: a function -> function call
        becomes a folder -> folder dependency when viewed at the module level.
        """
        all_nodes = self._graph.list_nodes(repository_id)
        visible = [node for node in all_nodes if node.level <= max_level]
        visible_keys = {node.key for node in visible}

        ancestors = _ancestor_index({n.key: n for n in all_nodes}, visible_keys)
        edges = self._graph.list_edges(repository_id)
        return GraphView(nodes=visible, edges=_roll_up(edges, ancestors))

    def children(self, repository_id: int, parent_key: str) -> GraphView:
        """Direct children of a node, plus the edges rolled up between them."""
        all_nodes = self._graph.list_nodes(repository_id)
        by_key = {n.key: n for n in all_nodes}

        children = [n for n in all_nodes if n.parent_key == parent_key]
        child_keys = {n.key for n in children}

        ancestors = _ancestor_index(by_key, child_keys)
        edges = self._graph.list_edges(repository_id)
        return GraphView(nodes=children, edges=_roll_up(edges, ancestors))


def _ancestor_index(by_key: dict[str, GraphNodeModel], targets: set[str]) -> dict[str, str | None]:
    """Map every node key to its nearest ancestor within ``targets`` (or itself)."""
    resolved: dict[str, str | None] = {}

    def resolve(key: str) -> str | None:
        if key in resolved:
            return resolved[key]
        if key in targets:
            resolved[key] = key
            return key

        node = by_key.get(key)
        if node is None or not node.parent_key:
            resolved[key] = None
            return None

        # Guard against a malformed parent chain looping forever.
        resolved[key] = None
        answer = resolve(node.parent_key)
        resolved[key] = answer
        return answer

    for key in by_key:
        resolve(key)
    return resolved


def _roll_up(edges, ancestors: dict[str, str | None]) -> list[RolledEdge]:
    """Lift each edge to its endpoints' visible ancestors, dedupe, and count."""
    counts: dict[tuple[str, str, str], int] = {}
    for edge in edges:
        source = ancestors.get(edge.source_key)
        target = ancestors.get(edge.target_key)
        if not source or not target or source == target:
            continue  # dropped, or collapsed into a single node
        key = (source, target, edge.kind)
        counts[key] = counts.get(key, 0) + 1

    return [
        RolledEdge(source_key=s, target_key=t, kind=k, weight=w)
        for (s, t, k), w in sorted(counts.items())
    ]
