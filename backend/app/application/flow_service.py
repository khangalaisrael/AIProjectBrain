"""Request Flow: reconstruct execution paths from the call graph.

An entry point is a function defined in a route-ish file that nothing else
calls. From there we walk `calls` edges depth-first, which reads like a call
trace: handler, then what it calls, then what that calls.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.domain.enums import EdgeKind, NodeKind
from app.infrastructure.db.models import GraphNodeModel, RepositoryModel
from app.infrastructure.db.repositories import GraphRepository
from app.infrastructure.llm.openai_chat import OpenAIChat

# Directory names that hold HTTP route handlers. Matched as whole path segments:
# a substring match would treat `.../add_overviews_table.py` as a "views" file.
_ROUTE_DIRS = {
    "api",
    "routes",
    "router",
    "routers",
    "endpoints",
    "views",
    "controllers",
    "handlers",
}

# Never entry points, whatever they are named.
_EXCLUDED_DIRS = {"tests", "test", "alembic", "migrations", "node_modules", ".next"}

DEFAULT_MAX_DEPTH = 6
DEFAULT_MAX_STEPS = 40


def _is_route_file(path: str | None) -> bool:
    if not path:
        return False
    segments = path.lower().split("/")
    if any(segment in _EXCLUDED_DIRS for segment in segments):
        return False
    # Only directory segments count, never the filename itself.
    return any(segment in _ROUTE_DIRS for segment in segments[:-1])


_EXPLAIN_SYSTEM = (
    "You are explaining how a request travels through a codebase. You are given "
    "an ordered execution path of functions, each with its file and signature. "
    "Respond as a JSON object with:\n"
    "- 'summary': 2-3 sentences describing what this request does end to end.\n"
    "- 'steps': an array of objects with 'key' (copied exactly from the input) "
    "and 'explanation' (1-2 sentences on what that function contributes to the "
    "request, and why it is called at this point).\n"
    "Use only the provided facts. Include every step, in order."
)


@dataclass(slots=True)
class FlowStep:
    key: str
    name: str
    path: str | None
    file_id: int | None
    start_line: int | None
    end_line: int | None
    depth: int
    caller_key: str | None


@dataclass(slots=True)
class Flow:
    entry_key: str
    steps: list[FlowStep] = field(default_factory=list)
    edges: list[tuple[str, str]] = field(default_factory=list)


@dataclass(slots=True)
class StepExplanation:
    key: str
    explanation: str


@dataclass(slots=True)
class FlowExplanation:
    summary: str
    steps: list[StepExplanation] = field(default_factory=list)


class FlowService:
    def __init__(self, session: Session, chat: OpenAIChat | None = None) -> None:
        self._graph = GraphRepository(session)
        self._chat = chat

    # -- entry points --------------------------------------------------------

    def entry_points(self, repository_id: int) -> list[GraphNodeModel]:
        """Public route handlers that nothing else calls."""
        nodes = self._graph.list_nodes(repository_id)
        handlers = [
            node
            for node in nodes
            if node.kind == NodeKind.FUNCTION.value
            # A leading underscore marks a private helper, not a request entry.
            and not node.name.startswith("_") and _is_route_file(node.path)
        ]
        if not handlers:
            return []

        called = {
            edge.target_key
            for edge in self._graph.list_edges(repository_id)
            if edge.kind == EdgeKind.CALLS.value
        }
        roots = [node for node in handlers if node.key not in called]
        # If every handler is called by something, fall back to all of them
        # rather than showing an empty list.
        return sorted(roots or handlers, key=lambda n: (n.path or "", n.name))

    # -- path ----------------------------------------------------------------

    def path(
        self,
        repository_id: int,
        entry_key: str,
        max_depth: int = DEFAULT_MAX_DEPTH,
        max_steps: int = DEFAULT_MAX_STEPS,
    ) -> Flow | None:
        nodes = {n.key: n for n in self._graph.list_nodes(repository_id)}
        entry = nodes.get(entry_key)
        if entry is None:
            return None

        callees: dict[str, list[str]] = defaultdict(list)
        for edge in self._graph.list_edges(repository_id):
            if edge.kind == EdgeKind.CALLS.value:
                callees[edge.source_key].append(edge.target_key)

        flow = Flow(entry_key=entry_key)
        visited: set[str] = set()

        def walk(key: str, depth: int, caller: str | None) -> None:
            # A cycle, or a function already shown, ends this branch — the trace
            # stays finite and never repeats a frame.
            if key in visited or depth > max_depth or len(flow.steps) >= max_steps:
                return
            node = nodes.get(key)
            if node is None:
                return

            visited.add(key)
            flow.steps.append(
                FlowStep(
                    key=node.key,
                    name=node.name,
                    path=node.path,
                    file_id=node.meta.get("file_id"),
                    start_line=node.meta.get("start_line"),
                    end_line=node.meta.get("end_line"),
                    depth=depth,
                    caller_key=caller,
                )
            )
            if caller is not None:
                flow.edges.append((caller, key))

            for callee in sorted(
                callees.get(key, []), key=lambda k: nodes[k].name if k in nodes else k
            ):
                walk(callee, depth + 1, key)

        walk(entry_key, 0, None)
        return flow

    # -- explanation ---------------------------------------------------------

    def explain(self, repo: RepositoryModel, flow: Flow) -> FlowExplanation:
        lines = [f"Repository: {repo.full_name}", "", "Execution path:"]
        for index, step in enumerate(flow.steps):
            indent = "  " * step.depth
            lines.append(f"{index + 1}. {indent}{step.name}  [{step.path}]  key={step.key}")

        chat = self._chat or OpenAIChat()
        data = chat.complete_json(_EXPLAIN_SYSTEM, "\n".join(lines))

        valid = {step.key for step in flow.steps}
        steps = [
            StepExplanation(key=item["key"], explanation=str(item.get("explanation", "")))
            for item in (data.get("steps") or [])
            if isinstance(item, dict) and item.get("key") in valid
        ]
        return FlowExplanation(summary=str(data.get("summary", "")), steps=steps)
