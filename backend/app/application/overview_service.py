"""Overview use case: generate and cache an LLM project summary."""

from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.infrastructure.db.models import OverviewModel, RepositoryModel
from app.infrastructure.db.repositories import FileRepository, OverviewRepository
from app.infrastructure.github.client import GitHubClient, GitHubError
from app.infrastructure.llm.openai_chat import OpenAIChat

_README_CANDIDATES = ["README.md", "readme.md", "README.rst", "README.txt", "README"]

_SYSTEM = (
    "You are a senior engineer producing a concise onboarding overview of a "
    "software project for a developer who has never seen it. Base your answer "
    "only on the provided structural facts and README. Respond as a JSON object "
    "with keys: summary (2-4 sentences), difficulty (one of 'Beginner', "
    "'Intermediate', 'Advanced'), learning_time_minutes (integer estimate to "
    "understand the project), architecture_style (short phrase), technologies "
    "(array of strings), features (array of short strings)."
)


class OverviewService:
    def __init__(
        self,
        session: Session,
        github: GitHubClient | None = None,
        chat: OpenAIChat | None = None,
    ) -> None:
        self._files = FileRepository(session)
        self._overviews = OverviewRepository(session)
        self._github = github
        self._chat = chat

    def get(self, repository_id: int) -> OverviewModel | None:
        return self._overviews.get(repository_id)

    def folder_map(self, repository_id: int) -> list[dict]:
        """Top-level folders with file counts (computed, not LLM-generated)."""
        counter: Counter[str] = Counter()
        for file, _ in self._files.list_for_repository(repository_id):
            top = file.path.split("/", 1)[0] if "/" in file.path else "(root)"
            counter[top] += 1
        return [
            {"folder": folder, "file_count": count}
            for folder, count in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))
        ]

    async def generate(self, repo: RepositoryModel, token: str | None) -> OverviewModel:
        context = await self._build_context(repo, token)
        data = (self._chat or OpenAIChat()).complete_json(_SYSTEM, context)
        return self._overviews.upsert(repo.id, data)

    async def _build_context(self, repo: RepositoryModel, token: str | None) -> str:
        files = self._files.list_for_repository(repo.id)
        languages = Counter(str(f.language) for f, _ in files if f.language)
        function_total = sum(count for _, count in files)
        folders = self.folder_map(repo.id)

        readme = await self._fetch_readme(repo, token)

        lines = [
            f"Repository: {repo.full_name}",
            f"Description: {repo.description or '(none)'}",
            f"Primary language: {repo.language or 'unknown'}",
            f"Indexed files: {len(files)}  |  Indexed functions: {function_total}",
            "Languages: "
            + (", ".join(f"{lang} ({n})" for lang, n in languages.most_common()) or "unknown"),
            "Top-level folders: "
            + ", ".join(f"{f['folder']} ({f['file_count']})" for f in folders[:12]),
        ]
        if readme:
            lines.append("\nREADME (truncated):\n" + readme[:6000])
        return "\n".join(lines)

    async def _fetch_readme(self, repo: RepositoryModel, token: str | None) -> str | None:
        github = self._github or GitHubClient()
        for candidate in _README_CANDIDATES:
            try:
                return await github.get_file_content(
                    token or "", repo.full_name, candidate, repo.default_branch
                )
            except GitHubError:
                continue
        return None
