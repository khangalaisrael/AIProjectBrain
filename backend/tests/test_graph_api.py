"""Graph API tests: level filtering, edge roll-up, drill-in, node detail."""

import pytest

from app.domain.enums import ImportStatus
from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import GraphRepository

# A miniature two-system graph:
#   repo -> system:backend -> folder:backend -> file:a.py -> function:go
#   repo -> system:frontend -> folder:frontend -> file:b.ts -> function:helper
# with a single function -> function call edge across the two systems.
NODES = [
    dict(
        key="repo:octocat/demo", kind="repository", level=0, name="demo", parent_key=None, meta={}
    ),
    dict(
        key="system:backend",
        kind="system",
        level=0,
        name="Backend",
        parent_key="repo:octocat/demo",
        meta={},
    ),
    dict(
        key="system:frontend",
        kind="system",
        level=0,
        name="Frontend",
        parent_key="repo:octocat/demo",
        meta={},
    ),
    dict(
        key="folder:backend",
        kind="folder",
        level=1,
        name="backend",
        parent_key="system:backend",
        meta={},
    ),
    dict(
        key="folder:frontend",
        kind="folder",
        level=1,
        name="frontend",
        parent_key="system:frontend",
        meta={},
    ),
    dict(
        key="file:backend/a.py",
        kind="file",
        level=3,
        name="a.py",
        path="backend/a.py",
        parent_key="folder:backend",
        meta={"file_id": 7},
    ),
    dict(
        key="file:frontend/b.ts",
        kind="file",
        level=3,
        name="b.ts",
        path="frontend/b.ts",
        parent_key="folder:frontend",
        meta={"file_id": 8},
    ),
    dict(
        key="function:backend/a.py::go#1",
        kind="function",
        level=4,
        name="go",
        path="backend/a.py",
        parent_key="file:backend/a.py",
        meta={"file_id": 7, "start_line": 1},
    ),
    dict(
        key="function:frontend/b.ts::helper#1",
        kind="function",
        level=4,
        name="helper",
        path="frontend/b.ts",
        parent_key="file:frontend/b.ts",
        meta={"file_id": 8},
    ),
]

EDGES = [
    dict(
        source_key="function:backend/a.py::go#1",
        target_key="function:frontend/b.ts::helper#1",
        kind="calls",
        meta={},
    ),
    dict(source_key="file:backend/a.py", target_key="file:frontend/b.ts", kind="imports", meta={}),
]


@pytest.fixture
def repo_id(db_session, user: UserModel) -> int:
    repo = RepositoryModel(
        user_id=user.id,
        github_id=4242,
        name="demo",
        full_name="octocat/demo",
        clone_url="https://github.com/octocat/demo.git",
        default_branch="main",
        status=ImportStatus.READY,
    )
    db_session.add(repo)
    db_session.commit()
    GraphRepository(db_session).replace(repo.id, NODES, EDGES)
    return repo.id


def test_level_zero_shows_only_systems_and_rolls_edges_up(client, auth_headers, repo_id):
    resp = client.get(f"/api/v1/repositories/{repo_id}/graph?max_level=0", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()

    assert {n["key"] for n in body["nodes"]} == {
        "repo:octocat/demo",
        "system:backend",
        "system:frontend",
    }

    # Both the deep call edge and the file import edge collapse onto the systems,
    # deduped into one backend -> frontend edge per kind.
    rolled = {(e["source_key"], e["target_key"], e["kind"], e["weight"]) for e in body["edges"]}
    assert ("system:backend", "system:frontend", "calls", 1) in rolled
    assert ("system:backend", "system:frontend", "imports", 1) in rolled


def test_deeper_level_reveals_more_nodes(client, auth_headers, repo_id):
    resp = client.get(f"/api/v1/repositories/{repo_id}/graph?max_level=3", headers=auth_headers)
    keys = {n["key"] for n in resp.json()["nodes"]}
    assert "file:backend/a.py" in keys
    assert "function:backend/a.py::go#1" not in keys  # level 4 stays hidden

    # At file level the call edge rolls up onto the two files.
    edges = {(e["source_key"], e["target_key"], e["kind"]) for e in resp.json()["edges"]}
    assert ("file:backend/a.py", "file:frontend/b.ts", "calls") in edges


def test_edges_inside_a_single_visible_node_are_dropped(client, auth_headers, repo_id, db_session):
    """A call between two functions in the same file must not become a self-loop."""
    GraphRepository(db_session).replace(
        repo_id,
        NODES
        + [
            dict(
                key="function:backend/a.py::other#9",
                kind="function",
                level=4,
                name="other",
                path="backend/a.py",
                parent_key="file:backend/a.py",
                meta={},
            )
        ],
        [
            dict(
                source_key="function:backend/a.py::go#1",
                target_key="function:backend/a.py::other#9",
                kind="calls",
                meta={},
            )
        ],
    )
    resp = client.get(f"/api/v1/repositories/{repo_id}/graph?max_level=3", headers=auth_headers)
    assert resp.json()["edges"] == []


def test_children_drill_in(client, auth_headers, repo_id):
    resp = client.get(
        f"/api/v1/repositories/{repo_id}/graph/children",
        params={"key": "system:backend"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert [n["key"] for n in resp.json()["nodes"]] == ["folder:backend"]


def test_node_detail_exposes_source_location(client, auth_headers, repo_id):
    resp = client.get(
        f"/api/v1/repositories/{repo_id}/graph/node",
        params={"key": "function:backend/a.py::go#1"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["kind"] == "function"
    assert body["meta"]["file_id"] == 7
    assert body["meta"]["start_line"] == 1


def test_unknown_node_is_404(client, auth_headers, repo_id):
    resp = client.get(
        f"/api/v1/repositories/{repo_id}/graph/node",
        params={"key": "function:nope"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_max_level_out_of_range_is_422(client, auth_headers, repo_id):
    resp = client.get(f"/api/v1/repositories/{repo_id}/graph?max_level=9", headers=auth_headers)
    assert resp.status_code == 422


def test_graph_on_unowned_repo_is_404(client, auth_headers):
    assert client.get("/api/v1/repositories/9999/graph", headers=auth_headers).status_code == 404


def test_graph_requires_auth(client):
    assert client.get("/api/v1/repositories/1/graph").status_code in (401, 403)
