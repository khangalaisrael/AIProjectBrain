"""Developer Thinking use case: infer engineering decisions behind a project."""

from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.infrastructure.db.models import DecisionModel, RepositoryModel
from app.infrastructure.db.repositories import DecisionRepository, FileRepository
from app.infrastructure.github.client import GitHubClient, GitHubError
from app.infrastructure.llm.openai_chat import OpenAIChat

_README_CANDIDATES = ["README.md", "readme.md", "README.rst", "README.txt", "README"]

# Manifest/config files that reveal technology choices. Best-effort — missing is fine.
_MANIFEST_CANDIDATES = [
    "pyproject.toml",
    "backend/pyproject.toml",
    "requirements.txt",
    "package.json",
    "frontend/package.json",
    "docker-compose.yml",
]

_MAX_MANIFEST_CHARS = 1_500

_SYSTEM = (
    "You are a staff engineer performing an architecture review. From the "
    "provided facts about a project, infer the important engineering decisions "
    "its authors made, and explain the thinking behind each one.\n\n"
    "Respond as a JSON object with a single key 'decisions', an array of 6-10 "
    "objects. Each object has:\n"
    "- 'decision': the choice made (e.g. 'Use the Repository pattern for data access')\n"
    "- 'reason': why it was likely chosen, grounded in this project's needs\n"
    "- 'tradeoffs': what it costs (complexity, performance, coupling, etc.)\n"
    "- 'alternatives': other options that could have been chosen instead\n\n"
    "Only infer decisions the provided facts actually support. Do not invent "
    "technologies that are not present. Keep each field to 1-3 sentences."
)


class ThinkingService:
    def __init__(
        self,
        session: Session,
        github: GitHubClient | None = None,
        chat: OpenAIChat | None = None,
    ) -> None:
        self._files = FileRepository(session)
        self._decisions = DecisionRepository(session)
        self._github = github
        self._chat = chat

    def get(self, repository_id: int) -> list[DecisionModel]:
        return self._decisions.list_for_repository(repository_id)

    async def generate(self, repo: RepositoryModel, token: str | None) -> list[DecisionModel]:
        context = await self._build_context(repo, token)
        data = (self._chat or OpenAIChat()).complete_json(_SYSTEM, context)
        decisions = data.get("decisions") if isinstance(data, dict) else None
        if not isinstance(decisions, list):
            decisions = []
        return self._decisions.replace(repo.id, decisions)

    async def _build_context(self, repo: RepositoryModel, token: str | None) -> str:
        files = self._files.list_for_repository(repo.id)
        languages = Counter(str(f.language) for f, _ in files if f.language)
        function_total = sum(count for _, count in files)

        folder_counter: Counter[str] = Counter()
        for file, _ in files:
            top = file.path.split("/", 1)[0] if "/" in file.path else "(root)"
            folder_counter[top] += 1

        lines = [
            f"Repository: {repo.full_name}",
            f"Description: {repo.description or '(none)'}",
            f"Indexed files: {len(files)}  |  Indexed functions: {function_total}",
            "Languages: "
            + (", ".join(f"{lang} ({n})" for lang, n in languages.most_common()) or "unknown"),
            "Top-level folders: "
            + ", ".join(f"{name} ({n})" for name, n in folder_counter.most_common(12)),
            "Sample files:\n" + "\n".join(f"  - {file.path}" for file, _ in files[:40]),
        ]

        readme = await self._fetch_first(repo, token, _README_CANDIDATES)
        if readme:
            lines.append("\nREADME (truncated):\n" + readme[:5000])

        for candidate in _MANIFEST_CANDIDATES:
            content = await self._fetch(repo, token, candidate)
            if content:
                lines.append(f"\n{candidate}:\n{content[:_MAX_MANIFEST_CHARS]}")

        return "\n".join(lines)

    async def _fetch_first(
        self, repo: RepositoryModel, token: str | None, candidates: list[str]
    ) -> str | None:
        for candidate in candidates:
            content = await self._fetch(repo, token, candidate)
            if content:
                return content
        return None

    async def _fetch(self, repo: RepositoryModel, token: str | None, path: str) -> str | None:
        github = self._github or GitHubClient()
        try:
            return await github.get_file_content(
                token or "", repo.full_name, path, repo.default_branch
            )
        except GitHubError:
            return None
