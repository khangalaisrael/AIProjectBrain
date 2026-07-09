"""Code Explorer use cases: browse files/functions and explain a file."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.infrastructure.db.models import FileModel, FunctionModel, RepositoryModel
from app.infrastructure.db.repositories import FileRepository
from app.infrastructure.github.client import GitHubClient
from app.infrastructure.llm.openai_chat import OpenAIChat

# Keep the file content sent to the model bounded.
_MAX_EXPLAIN_CHARS = 12_000

_EXPLAIN_SYSTEM = (
    "You are a senior engineer explaining a single source file to a developer "
    "who is new to the codebase. Cover its purpose, main responsibilities, and "
    "the notable functions and how they fit together. Be concise, concrete, and "
    "use short markdown sections."
)


@dataclass(slots=True)
class FileDetail:
    file: FileModel
    functions: list[FunctionModel]
    content: str


class ExplorerService:
    def __init__(
        self,
        session: Session,
        github: GitHubClient | None = None,
        chat: OpenAIChat | None = None,
    ) -> None:
        self._files = FileRepository(session)
        self._github = github
        self._chat = chat

    def list_files(self, repository_id: int) -> list[tuple[FileModel, int]]:
        return self._files.list_for_repository(repository_id)

    def get_file(self, repository_id: int, file_id: int) -> FileModel | None:
        return self._files.get(repository_id, file_id)

    async def file_detail(
        self, repo: RepositoryModel, file: FileModel, token: str | None
    ) -> FileDetail:
        functions = self._files.list_functions(file.id)
        content = await self._fetch_content(repo, file, token)
        return FileDetail(file=file, functions=functions, content=content)

    async def explain_file(self, repo: RepositoryModel, file: FileModel, token: str | None) -> str:
        content = await self._fetch_content(repo, file, token)
        chat = self._chat or OpenAIChat()
        user_prompt = (
            f"File: {file.path}\nLanguage: {file.language or 'unknown'}\n\n"
            f"```\n{content[:_MAX_EXPLAIN_CHARS]}\n```"
        )
        return chat.complete(_EXPLAIN_SYSTEM, user_prompt)

    async def _fetch_content(
        self, repo: RepositoryModel, file: FileModel, token: str | None
    ) -> str:
        github = self._github or GitHubClient()
        return await github.get_file_content(
            token or "", repo.full_name, file.path, repo.default_branch
        )
