"""Learn use case: generate and cache a structured course from a repository."""

from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.infrastructure.db.models import LessonModel, RepositoryModel
from app.infrastructure.db.repositories import FileRepository, LessonRepository
from app.infrastructure.github.client import GitHubClient, GitHubError
from app.infrastructure.llm.openai_chat import OpenAIChat

_README_CANDIDATES = ["README.md", "readme.md", "README.rst", "README.txt", "README"]

_SYSTEM = (
    "You are an expert engineering educator. From the provided facts about a "
    "software project, design a structured course that teaches a developer how "
    "the project is built and why. Reconstruct a logical build order rather than "
    "summarizing the finished code.\n\n"
    "Respond as a JSON object with a single key 'lessons', an ordered array of "
    "8-11 lessons. Each lesson is an object with:\n"
    "- 'title': a short module title\n"
    "- 'content': markdown (use ## headings, short paragraphs, and bullet lists) "
    "that teaches the topic concretely, referencing real folders/files/tech from "
    "the facts.\n\n"
    "Cover, when applicable: the business problem, technology stack, architecture, "
    "folder structure, backend, database, authentication, APIs, frontend, "
    "deployment, and a closing summary. Only include lessons the project actually "
    "supports. Keep each lesson focused and readable."
)


class CourseService:
    def __init__(
        self,
        session: Session,
        github: GitHubClient | None = None,
        chat: OpenAIChat | None = None,
    ) -> None:
        self._files = FileRepository(session)
        self._lessons = LessonRepository(session)
        self._github = github
        self._chat = chat

    def get(self, repository_id: int) -> list[LessonModel]:
        return self._lessons.list_for_repository(repository_id)

    async def generate(self, repo: RepositoryModel, token: str | None) -> list[LessonModel]:
        context = await self._build_context(repo, token)
        data = (self._chat or OpenAIChat()).complete_json(_SYSTEM, context)
        lessons = data.get("lessons") if isinstance(data, dict) else None
        if not isinstance(lessons, list):
            lessons = []
        return self._lessons.replace(repo.id, lessons)

    async def _build_context(self, repo: RepositoryModel, token: str | None) -> str:
        files = self._files.list_for_repository(repo.id)
        languages = Counter(str(f.language) for f, _ in files if f.language)
        function_total = sum(count for _, count in files)

        folder_counter: Counter[str] = Counter()
        for file, _ in files:
            top = file.path.split("/", 1)[0] if "/" in file.path else "(root)"
            folder_counter[top] += 1

        sample_paths = [file.path for file, _ in files[:40]]
        readme = await self._fetch_readme(repo, token)

        lines = [
            f"Repository: {repo.full_name}",
            f"Description: {repo.description or '(none)'}",
            f"Primary language: {repo.language or 'unknown'}",
            f"Indexed files: {len(files)}  |  Indexed functions: {function_total}",
            "Languages: "
            + (", ".join(f"{lang} ({n})" for lang, n in languages.most_common()) or "unknown"),
            "Top-level folders: "
            + ", ".join(f"{name} ({n})" for name, n in folder_counter.most_common(12)),
            "Sample files:\n" + "\n".join(f"  - {p}" for p in sample_paths),
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
