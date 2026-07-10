"""Request Flow tests: entry points, execution path, cycles, explanation."""

import pytest

from app.domain.enums import ImportStatus
from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import GraphRepository


def _fn(key: str, name: str, path: str, **meta):
    return dict(
        key=key,
        kind="function",
        level=4,
        name=name,
        path=path,
        parent_key=f"file:{path}",
        meta={"file_id": 1, "start_line": 1, "end_line": 5, **meta},
    )


def _calls(source: str, target: str):
    return dict(source_key=source, target_key=target, kind="calls", meta={})


ROUTE = "backend/app/presentation/api/v1/auth.py"
SERVICE = "backend/app/application/auth_service.py"

# login (route handler) -> complete_login -> exchange_code
#                                        -> upsert_user
# helper() lives in a route file but is called by login, so it is not an entry.
NODES = [
    _fn("f:login", "login", ROUTE),
    _fn("f:helper", "helper", ROUTE),
    _fn("f:complete_login", "complete_login", SERVICE),
    _fn("f:exchange_code", "exchange_code", SERVICE),
    _fn("f:upsert_user", "upsert_user", SERVICE),
]

EDGES = [
    _calls("f:login", "f:complete_login"),
    _calls("f:login", "f:helper"),
    _calls("f:complete_login", "f:exchange_code"),
    _calls("f:complete_login", "f:upsert_user"),
]


@pytest.fixture
def repo_id(db_session, user: UserModel) -> int:
    repo = RepositoryModel(
        user_id=user.id,
        github_id=31337,
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


def test_entry_points_are_uncalled_route_handlers(client, auth_headers, repo_id):
    resp = client.get(f"/api/v1/repositories/{repo_id}/flows", headers=auth_headers)
    assert resp.status_code == 200
    keys = [e["key"] for e in resp.json()]
    # `helper` is in a route file but is called by login, so it is not an entry.
    assert keys == ["f:login"]


def test_service_functions_are_never_entry_points(client, auth_headers, repo_id):
    keys = [
        e["key"]
        for e in client.get(f"/api/v1/repositories/{repo_id}/flows", headers=auth_headers).json()
    ]
    assert "f:complete_login" not in keys


def test_private_helpers_are_not_entry_points(client, auth_headers, repo_id, db_session):
    """`_owned_repo` lives in a route file but is a helper, not a request entry."""
    GraphRepository(db_session).replace(
        repo_id,
        [_fn("f:login", "login", ROUTE), _fn("f:_owned_repo", "_owned_repo", ROUTE)],
        [],
    )
    keys = [
        e["key"]
        for e in client.get(f"/api/v1/repositories/{repo_id}/flows", headers=auth_headers).json()
    ]
    assert keys == ["f:login"]


def test_route_dirs_match_whole_segments_not_substrings(client, auth_headers, repo_id, db_session):
    """`add_overviews_table.py` must not count as a "views" file."""
    migration = "backend/alembic/versions/37d3716b6d41_add_overviews_table.py"
    GraphRepository(db_session).replace(
        repo_id,
        [_fn("f:login", "login", ROUTE), _fn("f:upgrade", "upgrade", migration)],
        [],
    )
    keys = [
        e["key"]
        for e in client.get(f"/api/v1/repositories/{repo_id}/flows", headers=auth_headers).json()
    ]
    assert keys == ["f:login"]


def test_path_is_a_depth_first_call_trace(client, auth_headers, repo_id):
    resp = client.get(
        f"/api/v1/repositories/{repo_id}/flows/path",
        params={"key": "f:login"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()

    # Depth-first, callees visited in name order: complete_login before helper.
    assert [s["name"] for s in body["steps"]] == [
        "login",
        "complete_login",
        "exchange_code",
        "upsert_user",
        "helper",
    ]
    assert [s["depth"] for s in body["steps"]] == [0, 1, 2, 2, 1]
    assert body["steps"][1]["caller_key"] == "f:login"
    assert {(e["source_key"], e["target_key"]) for e in body["edges"]} == {
        ("f:login", "f:complete_login"),
        ("f:complete_login", "f:exchange_code"),
        ("f:complete_login", "f:upsert_user"),
        ("f:login", "f:helper"),
    }


def test_steps_carry_source_location(client, auth_headers, repo_id):
    body = client.get(
        f"/api/v1/repositories/{repo_id}/flows/path",
        params={"key": "f:login"},
        headers=auth_headers,
    ).json()
    step = body["steps"][0]
    assert step["file_id"] == 1 and step["start_line"] == 1 and step["end_line"] == 5


def test_a_cycle_does_not_hang_or_repeat_a_frame(client, auth_headers, repo_id, db_session):
    """a -> b -> a must terminate, visiting each function once."""
    GraphRepository(db_session).replace(
        repo_id,
        [_fn("f:a", "a", ROUTE), _fn("f:b", "b", SERVICE)],
        [_calls("f:a", "f:b"), _calls("f:b", "f:a")],
    )
    body = client.get(
        f"/api/v1/repositories/{repo_id}/flows/path",
        params={"key": "f:a"},
        headers=auth_headers,
    ).json()
    assert [s["name"] for s in body["steps"]] == ["a", "b"]


def test_depth_is_capped(client, auth_headers, repo_id, db_session):
    """A 10-deep chain is truncated at the max depth rather than run forever."""
    nodes = [_fn(f"f:{i}", f"fn{i}", ROUTE if i == 0 else SERVICE) for i in range(10)]
    edges = [_calls(f"f:{i}", f"f:{i + 1}") for i in range(9)]
    GraphRepository(db_session).replace(repo_id, nodes, edges)

    body = client.get(
        f"/api/v1/repositories/{repo_id}/flows/path",
        params={"key": "f:0"},
        headers=auth_headers,
    ).json()
    # DEFAULT_MAX_DEPTH = 6 -> depths 0..6 inclusive.
    assert max(s["depth"] for s in body["steps"]) == 6
    assert len(body["steps"]) == 7


def test_unknown_entry_point_is_404(client, auth_headers, repo_id):
    resp = client.get(
        f"/api/v1/repositories/{repo_id}/flows/path",
        params={"key": "f:nope"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


class FakeChat:
    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        assert "Execution path" in user_prompt
        return {
            "summary": "It logs the user in.",
            "steps": [
                {"key": "f:login", "explanation": "Receives the request."},
                {"key": "f:hallucinated", "explanation": "Does not exist."},
            ],
        }


def test_explain_narrates_steps_and_drops_unknown_keys(client, auth_headers, repo_id, monkeypatch):
    monkeypatch.setattr("app.application.flow_service.OpenAIChat", lambda: FakeChat())
    resp = client.post(
        f"/api/v1/repositories/{repo_id}/flows/explain",
        params={"key": "f:login"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"] == "It logs the user in."
    # A step the model invented for a key not in the path must be discarded.
    assert [s["key"] for s in body["steps"]] == ["f:login"]


def test_flows_on_unowned_repo_is_404(client, auth_headers):
    assert client.get("/api/v1/repositories/9999/flows", headers=auth_headers).status_code == 404


def test_flows_require_auth(client):
    assert client.get("/api/v1/repositories/1/flows").status_code in (401, 403)
