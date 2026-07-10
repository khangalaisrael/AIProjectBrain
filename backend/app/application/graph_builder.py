"""Builds the Software Atlas knowledge graph from static-analysis output.

Nodes form a strict hierarchy (repository -> system -> folder -> file ->
class -> function) linked by ``parent_key``. Edges capture the interesting
relationships: imports, calls, extends, implements.

Resolution is deliberately conservative: imports and calls are matched **by
name**, with no type inference. When a name is ambiguous (two functions share
it) the edge is **skipped** rather than guessed, so the graph under-reports
instead of lying.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from app.domain.enums import EdgeKind, NodeKind
from app.infrastructure.parsing.tree_sitter_parser import ParsedFile

# Zoom levels (see the Software Atlas spec).
LEVEL_SYSTEM = 0
LEVEL_MODULE = 1
LEVEL_PACKAGE = 2
LEVEL_FILE = 3
LEVEL_FUNCTION = 4

_PYTHON_EXTS = (".py",)
_WEB_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")

# Top-level folder names that clearly belong to a system bucket.
_SYSTEM_BY_FOLDER = {
    "frontend": "frontend",
    "client": "frontend",
    "web": "frontend",
    "ui": "frontend",
    "backend": "backend",
    "server": "backend",
    "api": "backend",
    "alembic": "database",
    "migrations": "database",
    "db": "database",
    "database": "database",
    "prisma": "database",
    "infra": "infrastructure",
    "infrastructure": "infrastructure",
    "deploy": "infrastructure",
    "docker": "infrastructure",
    "scripts": "infrastructure",
    ".github": "infrastructure",
    "ops": "infrastructure",
}

_SYSTEM_LABELS = {
    "frontend": "Frontend",
    "backend": "Backend",
    "database": "Database",
    "infrastructure": "Infrastructure",
}

# Base classes that mark a persistence model. `BaseModel` is deliberately
# absent: that is pydantic, which validates rather than persists.
_ORM_BASES = {
    "Base",
    "DeclarativeBase",
    "Model",
    "db.Model",
    "models.Model",
    "SQLModel",
    "Document",
}

# ...but `Base` and `Model` are common names, so a matching base only counts
# when the file actually imports an ORM. Precision over recall, as everywhere
# else in this module.
_ORM_MODULES = (
    "sqlalchemy",
    "sqlmodel",
    "django.db",
    "mongoengine",
    "beanie",
    "peewee",
    "tortoise",
    "flask_sqlalchemy",
)

# Set on a model class, and on every ancestor that contains one, so the Atlas
# can light the database layer at any zoom level.
META_HAS_MODELS = "has_models"


def _imports_an_orm(parsed: ParsedFile) -> bool:
    return any(
        parsed_import.module.startswith(orm)
        for parsed_import in parsed.imports
        for orm in _ORM_MODULES
    )


def _is_orm_model(klass, parsed: ParsedFile) -> bool:
    """A class that an ORM will map to a table.

    Name-based, like every other resolution here: a class extending ``Base`` in
    a file that imports SQLAlchemy is a model. One that extends ``Base`` in a
    file that doesn't is left alone.
    """
    if not any(base in _ORM_BASES for base in klass.extends):
        return False
    return _imports_an_orm(parsed)


@dataclass
class _Graph:
    nodes: dict[str, dict] = field(default_factory=dict)
    edges: list[dict] = field(default_factory=list)

    def add_node(self, **node) -> None:
        self.nodes.setdefault(node["key"], node)

    def add_edge(self, source: str, target: str, kind: EdgeKind, **meta) -> None:
        if source == target:
            return
        self.edges.append(
            {"source_key": source, "target_key": target, "kind": kind.value, "meta": meta}
        )


# ---- key helpers ------------------------------------------------------------


def repo_key(full_name: str) -> str:
    return f"repo:{full_name}"


def system_key(bucket: str) -> str:
    return f"system:{bucket}"


def folder_key(path: str) -> str:
    return f"folder:{path}"


def file_key(path: str) -> str:
    return f"file:{path}"


def class_key(path: str, name: str, line: int) -> str:
    return f"class:{path}::{name}#{line}"


def function_key(path: str, name: str, line: int) -> str:
    return f"function:{path}::{name}#{line}"


def external_key(module: str) -> str:
    return f"external:{module}"


# ---- builder ----------------------------------------------------------------


class GraphBuilder:
    def __init__(self, full_name: str, file_ids: dict[str, int] | None = None) -> None:
        self._full_name = full_name
        self._file_ids = file_ids or {}
        self._graph = _Graph()

    def build(self, parsed_by_path: dict[str, ParsedFile]) -> tuple[list[dict], list[dict]]:
        paths = sorted(parsed_by_path)

        self._add_repository()
        systems = self._classify_systems(paths)
        for bucket in sorted(set(systems.values())):
            self._add_system(bucket)

        for path in paths:
            self._add_path_hierarchy(path, systems)

        function_index = self._add_definitions(parsed_by_path)
        self._add_import_edges(parsed_by_path, set(paths))
        self._add_call_edges(parsed_by_path, function_index)
        self._add_inheritance_edges(parsed_by_path)
        self._propagate_model_flag()

        return list(self._graph.nodes.values()), self._graph.edges

    def _propagate_model_flag(self) -> None:
        """Mark every ancestor of a model class as containing one.

        Zooming out must not lose the database layer: if a class is a model, its
        file, folders, system and the repository all carry the flag too.
        """
        nodes = self._graph.nodes
        seeds = [key for key, node in nodes.items() if node["meta"].get(META_HAS_MODELS)]

        for key in seeds:
            parent = nodes[key]["parent_key"]
            while parent is not None and parent in nodes:
                ancestor = nodes[parent]
                if ancestor["meta"].get(META_HAS_MODELS):
                    break  # this branch is already marked all the way up
                ancestor["meta"][META_HAS_MODELS] = True
                parent = ancestor["parent_key"]

    # -- nodes ---------------------------------------------------------------

    def _add_repository(self) -> None:
        self._graph.add_node(
            key=repo_key(self._full_name),
            kind=NodeKind.REPOSITORY.value,
            level=LEVEL_SYSTEM,
            name=self._full_name,
            path=None,
            parent_key=None,
            meta={},
        )

    def _add_system(self, bucket: str) -> None:
        self._graph.add_node(
            key=system_key(bucket),
            kind=NodeKind.SYSTEM.value,
            level=LEVEL_SYSTEM,
            name=_SYSTEM_LABELS[bucket],
            path=None,
            parent_key=repo_key(self._full_name),
            meta={"bucket": bucket},
        )

    def _classify_systems(self, paths: list[str]) -> dict[str, str]:
        """Map each top-level folder to a system bucket."""
        by_folder: dict[str, list[str]] = defaultdict(list)
        for path in paths:
            top = path.split("/", 1)[0] if "/" in path else ""
            by_folder[top].append(path)

        systems: dict[str, str] = {}
        for folder, folder_paths in by_folder.items():
            if not folder:
                continue  # root files attach to the repository node
            named = _SYSTEM_BY_FOLDER.get(folder.lower())
            systems[folder] = named or _bucket_from_languages(folder_paths)
        return systems

    def _add_path_hierarchy(self, path: str, systems: dict[str, str]) -> None:
        parts = path.split("/")
        file_name = parts[-1]
        folders = parts[:-1]

        if not folders:
            parent = repo_key(self._full_name)
        else:
            top = folders[0]
            bucket = systems.get(top, "infrastructure")
            parent = system_key(bucket)

            # A top-level folder that *names* its system (e.g. `backend/` under
            # Backend) would be a redundant node, so fold it into the system.
            skip_top = _SYSTEM_BY_FOLDER.get(top.lower()) is not None

            accumulated: list[str] = []
            for depth, folder in enumerate(folders):
                accumulated.append(folder)
                if depth == 0 and skip_top:
                    continue
                current = "/".join(accumulated)
                visible_depth = depth - 1 if skip_top else depth
                self._graph.add_node(
                    key=folder_key(current),
                    kind=NodeKind.FOLDER.value,
                    # The first visible folder is a "module"; deeper ones are packages.
                    level=LEVEL_MODULE if visible_depth == 0 else LEVEL_PACKAGE,
                    name=folder,
                    path=current,
                    parent_key=parent,
                    meta={},
                )
                parent = folder_key(current)

        self._graph.add_node(
            key=file_key(path),
            kind=NodeKind.FILE.value,
            level=LEVEL_FILE,
            name=file_name,
            path=path,
            parent_key=parent,
            meta={"file_id": self._file_ids.get(path)},
        )

    def _add_definitions(self, parsed_by_path: dict[str, ParsedFile]) -> dict[str, list[str]]:
        """Add class + function nodes; return a name -> keys index for calls."""
        function_index: dict[str, list[str]] = defaultdict(list)

        for path, parsed in parsed_by_path.items():
            for klass in parsed.classes:
                meta = {
                    "file_id": self._file_ids.get(path),
                    "start_line": klass.start_line,
                    "end_line": klass.end_line,
                }
                if _is_orm_model(klass, parsed):
                    meta[META_HAS_MODELS] = True
                self._graph.add_node(
                    key=class_key(path, klass.name, klass.start_line),
                    kind=NodeKind.CLASS.value,
                    level=LEVEL_FILE,
                    name=klass.name,
                    path=path,
                    parent_key=file_key(path),
                    meta=meta,
                )

            for func in parsed.functions:
                owner = _enclosing_class(parsed, func.start_line)
                parent = (
                    class_key(path, owner.name, owner.start_line)
                    if owner is not None
                    else file_key(path)
                )
                key = function_key(path, func.name, func.start_line)
                self._graph.add_node(
                    key=key,
                    kind=NodeKind.FUNCTION.value,
                    level=LEVEL_FUNCTION,
                    name=func.name,
                    path=path,
                    parent_key=parent,
                    meta={
                        "file_id": self._file_ids.get(path),
                        "start_line": func.start_line,
                        "end_line": func.end_line,
                        "signature": func.signature,
                    },
                )
                function_index[func.name].append(key)

        return function_index

    # -- edges ---------------------------------------------------------------

    def _add_import_edges(
        self, parsed_by_path: dict[str, ParsedFile], known_paths: set[str]
    ) -> None:
        for path, parsed in parsed_by_path.items():
            for imported in parsed.imports:
                target_path = _resolve_module(imported.module, path, known_paths)
                if target_path is not None:
                    self._graph.add_edge(file_key(path), file_key(target_path), EdgeKind.IMPORTS)
                    continue

                module = imported.module
                if not module or module.startswith("."):
                    continue  # unresolvable relative import; don't invent a node
                key = external_key(module)
                self._graph.add_node(
                    key=key,
                    kind=NodeKind.EXTERNAL.value,
                    level=LEVEL_MODULE,
                    name=module,
                    path=None,
                    parent_key=None,
                    meta={},
                )
                self._graph.add_edge(file_key(path), key, EdgeKind.IMPORTS)

    def _add_call_edges(
        self, parsed_by_path: dict[str, ParsedFile], function_index: dict[str, list[str]]
    ) -> None:
        for path, parsed in parsed_by_path.items():
            for call in parsed.calls:
                targets = function_index.get(call.callee, [])
                if len(targets) != 1:
                    continue  # unknown, or ambiguous -> skip rather than guess

                caller = _enclosing_function(parsed, call.caller, call.line)
                if caller is None:
                    continue  # module-level call; no function to attribute it to

                self._graph.add_edge(
                    function_key(path, caller.name, caller.start_line),
                    targets[0],
                    EdgeKind.CALLS,
                    line=call.line,
                )

    def _add_inheritance_edges(self, parsed_by_path: dict[str, ParsedFile]) -> None:
        class_index: dict[str, list[str]] = defaultdict(list)
        for path, parsed in parsed_by_path.items():
            for klass in parsed.classes:
                class_index[klass.name].append(class_key(path, klass.name, klass.start_line))

        for path, parsed in parsed_by_path.items():
            for klass in parsed.classes:
                source = class_key(path, klass.name, klass.start_line)
                for base, kind in (
                    *[(b, EdgeKind.EXTENDS) for b in klass.extends],
                    *[(i, EdgeKind.IMPLEMENTS) for i in klass.implements],
                ):
                    simple = base.rsplit(".", 1)[-1]
                    targets = class_index.get(simple, [])
                    if len(targets) == 1:
                        self._graph.add_edge(source, targets[0], kind)


# ---- resolution helpers -----------------------------------------------------


def _bucket_from_languages(paths: list[str]) -> str:
    python = sum(1 for p in paths if p.endswith(_PYTHON_EXTS))
    web = sum(1 for p in paths if p.endswith(_WEB_EXTS))
    if python > web:
        return "backend"
    if web > 0:
        return "frontend"
    return "infrastructure"


def _enclosing_class(parsed: ParsedFile, line: int):
    """Innermost class whose body contains ``line``."""
    candidates = [c for c in parsed.classes if c.start_line <= line <= c.end_line]
    return max(candidates, key=lambda c: c.start_line) if candidates else None


def _enclosing_function(parsed: ParsedFile, caller_name: str | None, line: int):
    """The function named ``caller_name`` whose body contains ``line``."""
    if not caller_name:
        return None
    candidates = [
        f for f in parsed.functions if f.name == caller_name and f.start_line <= line <= f.end_line
    ]
    return max(candidates, key=lambda f: f.start_line) if candidates else None


def _module_candidates(module: str, source_path: str) -> list[str]:
    """Possible file paths (suffixes) a module specifier could refer to."""
    if module.startswith("."):
        # Relative import: resolve against the importing file's directory.
        source_dir = source_path.rsplit("/", 1)[0] if "/" in source_path else ""
        stripped = module.lstrip(".")
        ups = len(module) - len(stripped) - 1  # one dot == current dir
        parts = source_dir.split("/") if source_dir else []
        if ups:
            parts = parts[:-ups] if ups <= len(parts) else []
        if stripped:
            parts.extend(stripped.replace(".", "/").split("/"))
        base = "/".join(p for p in parts if p)
    else:
        base = module.replace(".", "/")

    if not base:
        return []
    return [
        f"{base}.py",
        f"{base}/__init__.py",
        f"{base}.ts",
        f"{base}.tsx",
        f"{base}.js",
        f"{base}.jsx",
        f"{base}/index.ts",
        f"{base}/index.tsx",
        f"{base}/index.js",
    ]


def _resolve_module(module: str, source_path: str, known_paths: set[str]) -> str | None:
    """Resolve a module specifier to an indexed file path, or None.

    Matches on path suffix (so ``app.core.config`` finds
    ``backend/app/core/config.py``). Ambiguous matches resolve to None.
    """
    if not module:
        return None

    # Strip common frontend path aliases such as "@/lib/foo".
    normalized = module[2:] if module.startswith("@/") else module

    for candidate in _module_candidates(normalized, source_path):
        if candidate in known_paths:
            return candidate
        matches = [p for p in known_paths if p.endswith("/" + candidate)]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            return None  # ambiguous
    return None
