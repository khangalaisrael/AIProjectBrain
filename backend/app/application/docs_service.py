"""Documentation use case: generate and cache per-type project docs."""

from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.domain.enums import DocType
from app.infrastructure.db.models import DocumentModel, RepositoryModel
from app.infrastructure.db.repositories import DocumentRepository, FileRepository
from app.infrastructure.github.client import GitHubClient, GitHubError
from app.infrastructure.llm.openai_chat import OpenAIChat

_README_CANDIDATES = ["README.md", "readme.md", "README.rst", "README.txt", "README"]

# How much of the file/function map to include in the prompt.
_MAX_CONTEXT_FILES = 60
_MAX_FUNCS_PER_FILE = 8

# Path fragments that usually hold HTTP route definitions. For the API doc we
# include these files' source so the model sees real decorators, methods, and
# paths rather than guessing from function names.
_ROUTE_PATH_HINTS = ("/api/", "routes", "router", "endpoints", "views", "controllers")
_MAX_ROUTE_FILES = 6
_MAX_ROUTE_FILE_CHARS = 2_500

_BASE_SYSTEM = (
    "You are a senior engineer writing documentation for a software project. "
    "Use ONLY the provided facts about the repository — never invent files, "
    "endpoints, or technologies that are not present. Write clean GitHub-"
    "flavored markdown with headings, short paragraphs, lists, and code blocks "
    "where useful. Do not wrap the whole document in a code fence."
)

_TITLES: dict[DocType, str] = {
    DocType.README: "README",
    DocType.API: "API Documentation",
    DocType.ARCHITECTURE: "Architecture",
    DocType.FOLDERS: "Folder Guide",
}

_INSTRUCTIONS: dict[DocType, str] = {
    DocType.README: (
        "Write a README for this project: a one-line description, what it does, "
        "the technology stack, the project layout, how to get started, and how "
        "to run tests. Keep it practical."
    ),
    DocType.API: (
        "Document the project's API surface. Identify the HTTP endpoints or the "
        "main public interfaces from the file and function names. For each, give "
        "its purpose and, where inferable, method/path, inputs and outputs. If "
        "the project exposes no HTTP API, document its main public modules and "
        "functions instead, and say so."
    ),
    DocType.ARCHITECTURE: (
        "Write an architecture document: the overall style, the layers or major "
        "components and their responsibilities, how a request or the main data "
        "flow moves through the system, and the key external dependencies."
    ),
    DocType.FOLDERS: (
        "Write a folder-by-folder guide. For each significant top-level folder "
        "(and important subfolders), explain what lives there, what it is "
        "responsible for, and point to representative files."
    ),
}


class DocsService:
    def __init__(
        self,
        session: Session,
        github: GitHubClient | None = None,
        chat: OpenAIChat | None = None,
    ) -> None:
        self._files = FileRepository(session)
        self._documents = DocumentRepository(session)
        self._github = github
        self._chat = chat

    def list(self, repository_id: int) -> list[DocumentModel]:
        return self._documents.list_for_repository(repository_id)

    async def generate(
        self, repo: RepositoryModel, doc_type: DocType, token: str | None
    ) -> DocumentModel:
        context = await self._build_context(repo, doc_type, token)
        system = f"{_BASE_SYSTEM}\n\n{_INSTRUCTIONS[doc_type]}"
        content = (self._chat or OpenAIChat()).complete(system, context)
        return self._documents.upsert(repo.id, doc_type.value, _TITLES[doc_type], content)

    async def _build_context(
        self, repo: RepositoryModel, doc_type: DocType, token: str | None
    ) -> str:
        files = self._files.list_for_repository(repo.id)
        languages = Counter(str(f.language) for f, _ in files if f.language)

        folder_counter: Counter[str] = Counter()
        for file, _ in files:
            top = file.path.split("/", 1)[0] if "/" in file.path else "(root)"
            folder_counter[top] += 1

        lines = [
            f"Repository: {repo.full_name}",
            f"Description: {repo.description or '(none)'}",
            f"Primary language: {repo.language or 'unknown'}",
            f"Indexed files: {len(files)}",
            "Languages: "
            + (", ".join(f"{lang} ({n})" for lang, n in languages.most_common()) or "unknown"),
            "Top-level folders: "
            + ", ".join(f"{name} ({n})" for name, n in folder_counter.most_common(15)),
            "",
            "Files and their functions:",
        ]

        # Prefer files that actually contain functions when trimming.
        ranked = sorted(files, key=lambda pair: (-pair[1], pair[0].path))
        for file, _count in ranked[:_MAX_CONTEXT_FILES]:
            names = [fn.name for fn in self._files.list_functions(file.id)][:_MAX_FUNCS_PER_FILE]
            suffix = f": {', '.join(names)}" if names else ""
            lines.append(f"  - {file.path}{suffix}")

        if doc_type is DocType.API:
            lines.extend(await self._route_sources(repo, files, token))

        readme = await self._fetch_readme(repo, token)
        if readme:
            lines.append("\nExisting README (truncated):\n" + readme[:5000])

        return "\n".join(lines)

    async def _route_sources(self, repo: RepositoryModel, files, token: str | None) -> list[str]:
        """Source of likely route files, so HTTP endpoints can be documented exactly."""
        candidates = [
            file
            for file, _ in files
            if any(hint in file.path.lower() for hint in _ROUTE_PATH_HINTS)
        ][:_MAX_ROUTE_FILES]
        if not candidates:
            return []

        blocks = ["\nSource of route/endpoint files (use these for exact methods and paths):"]
        for file in candidates:
            content = await self._fetch(repo, token, file.path)
            if content:
                blocks.append(f"\n--- {file.path} ---\n{content[:_MAX_ROUTE_FILE_CHARS]}")
        return blocks

    async def _fetch_readme(self, repo: RepositoryModel, token: str | None) -> str | None:
        for candidate in _README_CANDIDATES:
            content = await self._fetch(repo, token, candidate)
            if content:
                return content
        return None

    async def _fetch(self, repo: RepositoryModel, token: str | None, path: str) -> str | None:
        """Fetch a file's content, returning None when it is missing."""
        github = self._github or GitHubClient()
        try:
            return await github.get_file_content(
                token or "", repo.full_name, path, repo.default_branch
            )
        except GitHubError:
            return None
