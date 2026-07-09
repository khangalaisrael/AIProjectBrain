"""Domain enumerations shared across layers."""

from __future__ import annotations

from enum import StrEnum


class ImportStatus(StrEnum):
    """Lifecycle of a repository as it moves through the indexing pipeline."""

    PENDING = "pending"
    CLONING = "cloning"
    PARSING = "parsing"
    INDEXING = "indexing"
    READY = "ready"
    FAILED = "failed"


class DocType(StrEnum):
    """Kinds of documentation the platform can generate for a repository."""

    README = "readme"
    API = "api"
    ARCHITECTURE = "architecture"
    FOLDERS = "folders"


class Language(StrEnum):
    """Programming languages supported by the parser (Phase 1 scope)."""

    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"

    @classmethod
    def from_path(cls, path: str) -> Language | None:
        """Infer a supported language from a file path, or ``None``."""
        lowered = path.lower()
        if lowered.endswith(".py"):
            return cls.PYTHON
        if lowered.endswith((".ts", ".tsx")):
            return cls.TYPESCRIPT
        if lowered.endswith((".js", ".jsx", ".mjs", ".cjs")):
            return cls.JAVASCRIPT
        return None
