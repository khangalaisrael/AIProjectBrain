"""Persistence repositories (data access) over the ORM models.

These encapsulate all SQLAlchemy queries so the application/service layer works
with a small, intention-revealing API instead of raw sessions.
"""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.domain.enums import ImportStatus
from app.infrastructure.db.models import (
    ChatMessageModel,
    DecisionModel,
    DocumentModel,
    FileModel,
    FunctionModel,
    GraphEdgeModel,
    GraphNodeModel,
    LessonModel,
    OverviewModel,
    RepositoryModel,
    UserModel,
)


class UserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, user_id: int) -> UserModel | None:
        return self._session.get(UserModel, user_id)

    def get_by_github_id(self, github_id: int) -> UserModel | None:
        return self._session.scalar(select(UserModel).where(UserModel.github_id == github_id))

    def upsert_from_github(self, profile: dict, access_token: str) -> UserModel:
        """Create or update a user from a GitHub profile + access token."""
        user = self.get_by_github_id(profile["id"])
        if user is None:
            user = UserModel(github_id=profile["id"])
            self._session.add(user)

        user.username = profile.get("login") or user.username
        user.email = profile.get("email")
        user.avatar_url = profile.get("avatar_url")
        user.access_token = access_token

        self._session.commit()
        self._session.refresh(user)
        return user


class RepositoryRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, repository_id: int) -> RepositoryModel | None:
        return self._session.get(RepositoryModel, repository_id)

    def list_for_user(self, user_id: int) -> list[RepositoryModel]:
        return list(
            self._session.scalars(
                select(RepositoryModel)
                .where(RepositoryModel.user_id == user_id)
                .order_by(RepositoryModel.created_at.desc())
            )
        )

    def get_for_user_by_github_id(self, user_id: int, github_id: int) -> RepositoryModel | None:
        return self._session.scalar(
            select(RepositoryModel).where(
                RepositoryModel.user_id == user_id,
                RepositoryModel.github_id == github_id,
            )
        )

    def create_from_github(self, user_id: int, repo: dict) -> RepositoryModel:
        """Create a repository record from a GitHub repo payload."""
        model = RepositoryModel(
            user_id=user_id,
            github_id=repo["id"],
            name=repo["name"],
            full_name=repo["full_name"],
            description=repo.get("description"),
            default_branch=repo.get("default_branch") or "main",
            clone_url=repo["clone_url"],
            language=repo.get("language"),
            is_private=bool(repo.get("private", False)),
            status=ImportStatus.PENDING,
        )
        self._session.add(model)
        self._session.commit()
        self._session.refresh(model)
        return model

    def set_status(
        self, repository_id: int, status: ImportStatus, error_message: str | None = None
    ) -> None:
        repo = self.get_by_id(repository_id)
        if repo is None:
            return
        repo.status = status
        repo.error_message = error_message
        self._session.commit()


class FileRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_repository(self, repository_id: int) -> list[tuple[FileModel, int]]:
        """Return (file, function_count) pairs ordered by path."""
        rows = self._session.execute(
            select(FileModel, func.count(FunctionModel.id))
            .outerjoin(FunctionModel, FunctionModel.file_id == FileModel.id)
            .where(FileModel.repository_id == repository_id)
            .group_by(FileModel.id)
            .order_by(FileModel.path)
        ).all()
        return [(file, count) for file, count in rows]

    def get(self, repository_id: int, file_id: int) -> FileModel | None:
        file = self._session.get(FileModel, file_id)
        if file is None or file.repository_id != repository_id:
            return None
        return file

    def list_functions(self, file_id: int) -> list[FunctionModel]:
        return list(
            self._session.scalars(
                select(FunctionModel)
                .where(FunctionModel.file_id == file_id)
                .order_by(FunctionModel.start_line)
            )
        )


class OverviewRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, repository_id: int) -> OverviewModel | None:
        return self._session.scalar(
            select(OverviewModel).where(OverviewModel.repository_id == repository_id)
        )

    def upsert(self, repository_id: int, data: dict) -> OverviewModel:
        overview = self.get(repository_id)
        if overview is None:
            overview = OverviewModel(repository_id=repository_id)
            self._session.add(overview)

        overview.summary = data.get("summary", "")
        overview.difficulty = data.get("difficulty")
        overview.learning_time_minutes = data.get("learning_time_minutes")
        overview.architecture_style = data.get("architecture_style")
        overview.technologies = data.get("technologies") or []
        overview.features = data.get("features") or []

        self._session.commit()
        self._session.refresh(overview)
        return overview


class LessonRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_repository(self, repository_id: int) -> list[LessonModel]:
        return list(
            self._session.scalars(
                select(LessonModel)
                .where(LessonModel.repository_id == repository_id)
                .order_by(LessonModel.order_index)
            )
        )

    def replace(self, repository_id: int, lessons: list[dict]) -> list[LessonModel]:
        """Replace all lessons for a repository with a freshly generated set."""
        self._session.execute(delete(LessonModel).where(LessonModel.repository_id == repository_id))
        models = [
            LessonModel(
                repository_id=repository_id,
                order_index=index,
                title=str(lesson.get("title", f"Lesson {index + 1}")),
                content=str(lesson.get("content", "")),
            )
            for index, lesson in enumerate(lessons)
        ]
        self._session.add_all(models)
        self._session.commit()
        return self.list_for_repository(repository_id)


class GraphRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_nodes(self, repository_id: int, max_level: int | None = None) -> list[GraphNodeModel]:
        statement = select(GraphNodeModel).where(GraphNodeModel.repository_id == repository_id)
        if max_level is not None:
            statement = statement.where(GraphNodeModel.level <= max_level)
        return list(
            self._session.scalars(statement.order_by(GraphNodeModel.level, GraphNodeModel.key))
        )

    def list_edges(self, repository_id: int) -> list[GraphEdgeModel]:
        return list(
            self._session.scalars(
                select(GraphEdgeModel).where(GraphEdgeModel.repository_id == repository_id)
            )
        )

    def get_node(self, repository_id: int, key: str) -> GraphNodeModel | None:
        return self._session.scalar(
            select(GraphNodeModel).where(
                GraphNodeModel.repository_id == repository_id, GraphNodeModel.key == key
            )
        )

    def children(self, repository_id: int, parent_key: str) -> list[GraphNodeModel]:
        return list(
            self._session.scalars(
                select(GraphNodeModel)
                .where(
                    GraphNodeModel.repository_id == repository_id,
                    GraphNodeModel.parent_key == parent_key,
                )
                .order_by(GraphNodeModel.name)
            )
        )

    def clear(self, repository_id: int) -> None:
        self._session.execute(
            delete(GraphEdgeModel).where(GraphEdgeModel.repository_id == repository_id)
        )
        self._session.execute(
            delete(GraphNodeModel).where(GraphNodeModel.repository_id == repository_id)
        )

    def replace(self, repository_id: int, nodes: list[dict], edges: list[dict]) -> None:
        """Swap in a freshly built graph for a repository."""
        self.clear(repository_id)
        self._session.add_all(GraphNodeModel(repository_id=repository_id, **node) for node in nodes)
        self._session.add_all(GraphEdgeModel(repository_id=repository_id, **edge) for edge in edges)
        self._session.commit()


class DocumentRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_repository(self, repository_id: int) -> list[DocumentModel]:
        return list(
            self._session.scalars(
                select(DocumentModel)
                .where(DocumentModel.repository_id == repository_id)
                .order_by(DocumentModel.doc_type)
            )
        )

    def get(self, repository_id: int, doc_type: str) -> DocumentModel | None:
        return self._session.scalar(
            select(DocumentModel).where(
                DocumentModel.repository_id == repository_id,
                DocumentModel.doc_type == doc_type,
            )
        )

    def upsert(self, repository_id: int, doc_type: str, title: str, content: str) -> DocumentModel:
        document = self.get(repository_id, doc_type)
        if document is None:
            document = DocumentModel(repository_id=repository_id, doc_type=doc_type)
            self._session.add(document)

        document.title = title
        document.content = content

        self._session.commit()
        self._session.refresh(document)
        return document


class DecisionRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_repository(self, repository_id: int) -> list[DecisionModel]:
        return list(
            self._session.scalars(
                select(DecisionModel)
                .where(DecisionModel.repository_id == repository_id)
                .order_by(DecisionModel.order_index)
            )
        )

    def replace(self, repository_id: int, decisions: list[dict]) -> list[DecisionModel]:
        """Replace all decisions for a repository with a freshly generated set."""
        self._session.execute(
            delete(DecisionModel).where(DecisionModel.repository_id == repository_id)
        )
        models = [
            DecisionModel(
                repository_id=repository_id,
                order_index=index,
                decision=str(item.get("decision", f"Decision {index + 1}")),
                reason=str(item.get("reason", "")),
                tradeoffs=str(item.get("tradeoffs", "")),
                alternatives=str(item.get("alternatives", "")),
            )
            for index, item in enumerate(decisions)
        ]
        self._session.add_all(models)
        self._session.commit()
        return self.list_for_repository(repository_id)


class ChatMessageRepository:
    """The stored conversation between one user and one repository."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_thread(self, repository_id: int, user_id: int) -> list[ChatMessageModel]:
        """The thread in the order it was written."""
        stmt = (
            select(ChatMessageModel)
            .where(
                ChatMessageModel.repository_id == repository_id,
                ChatMessageModel.user_id == user_id,
            )
            .order_by(ChatMessageModel.id)
        )
        return list(self._session.scalars(stmt))

    def append(
        self,
        repository_id: int,
        user_id: int,
        role: str,
        content: str,
        citations: list[dict] | None = None,
    ) -> ChatMessageModel:
        model = ChatMessageModel(
            repository_id=repository_id,
            user_id=user_id,
            role=role,
            content=content,
            citations=citations or [],
        )
        self._session.add(model)
        self._session.commit()
        self._session.refresh(model)
        return model

    def clear_thread(self, repository_id: int, user_id: int) -> int:
        """Delete the thread. Returns how many messages went."""
        stmt = delete(ChatMessageModel).where(
            ChatMessageModel.repository_id == repository_id,
            ChatMessageModel.user_id == user_id,
        )
        deleted = self._session.execute(stmt).rowcount or 0
        self._session.commit()
        return deleted
