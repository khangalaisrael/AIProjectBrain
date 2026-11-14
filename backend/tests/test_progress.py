"""Lesson progress follows the account."""

from app.domain.enums import ImportStatus
from app.infrastructure.db.models import LessonModel, RepositoryModel, UserModel


def _repo_with_lessons(db, user_id: int, github_id: int, n: int = 2):
    repo = RepositoryModel(
        user_id=user_id,
        github_id=github_id,
        name=f"r{github_id}",
        full_name=f"o/r{github_id}",
        clone_url="https://github.com/o/r.git",
        default_branch="main",
        status=ImportStatus.READY,
    )
    db.add(repo)
    db.flush()
    lessons = [
        LessonModel(repository_id=repo.id, order_index=i, title=f"L{i}", content="x")
        for i in range(n)
    ]
    db.add_all(lessons)
    db.commit()
    return repo, lessons


def test_progress_requires_auth(client):
    assert client.get("/api/v1/progress").status_code == 401


def test_mark_and_list_progress(client, auth_headers, db_session, user: UserModel):
    repo, lessons = _repo_with_lessons(db_session, user.id, 1)
    assert client.get("/api/v1/progress", headers=auth_headers).json() == {"completed": {}}

    for lesson in lessons:
        r = client.put(
            f"/api/v1/progress/lessons/{lesson.id}", json={"done": True}, headers=auth_headers
        )
        assert r.status_code == 204
    # Marking twice is harmless.
    client.put(f"/api/v1/progress/lessons/{lessons[0].id}", json={"done": True}, headers=auth_headers)

    done = client.get("/api/v1/progress", headers=auth_headers).json()["completed"]
    assert done == {str(repo.id): [lessons[0].id, lessons[1].id]}

    client.put(f"/api/v1/progress/lessons/{lessons[0].id}", json={"done": False}, headers=auth_headers)
    done = client.get("/api/v1/progress", headers=auth_headers).json()["completed"]
    assert done == {str(repo.id): [lessons[1].id]}


def test_cannot_touch_someone_elses_lesson(client, auth_headers, db_session):
    other = UserModel(github_id=999, username="other", email="o@example.com", access_token="t")
    db_session.add(other)
    db_session.commit()
    _, lessons = _repo_with_lessons(db_session, other.id, 2, n=1)
    r = client.put(
        f"/api/v1/progress/lessons/{lessons[0].id}", json={"done": True}, headers=auth_headers
    )
    assert r.status_code == 404
