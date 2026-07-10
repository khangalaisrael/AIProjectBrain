"""GraphBuilder tests: hierarchy, import/call/inheritance resolution."""

from app.application.graph_builder import (
    GraphBuilder,
    class_key,
    file_key,
    folder_key,
    function_key,
    system_key,
)
from app.domain.enums import EdgeKind, Language, NodeKind
from app.infrastructure.parsing.tree_sitter_parser import parse_file

BACKEND_MAIN = """
from app.core.config import get_settings

def create_app():
    settings = get_settings()
    return settings
"""

BACKEND_CONFIG = """
def get_settings():
    return 1
"""

FRONTEND_PAGE = """
import { helper } from "./util";

class Widget extends Base implements Thing {
  render() { return helper(); }
}
"""

FRONTEND_UTIL = """
export function helper() { return 2; }
"""

BASE_CLASS = """
class Base:
    pass
"""


def _build(files: dict[str, tuple[str, Language]]):
    parsed = {path: parse_file(src, lang) for path, (src, lang) in files.items()}
    file_ids = {path: i + 1 for i, path in enumerate(sorted(parsed))}
    return GraphBuilder("octocat/demo", file_ids).build(parsed)


def _edge_set(edges, kind: EdgeKind):
    return {(e["source_key"], e["target_key"]) for e in edges if e["kind"] == kind.value}


def test_hierarchy_and_system_classification():
    nodes, _ = _build(
        {
            "backend/app/main.py": (BACKEND_MAIN, Language.PYTHON),
            "backend/app/core/config.py": (BACKEND_CONFIG, Language.PYTHON),
            "frontend/app/page.tsx": (FRONTEND_PAGE, Language.TYPESCRIPT),
        }
    )
    by_key = {n["key"]: n for n in nodes}

    # A top-level folder that names its system is folded into the system node,
    # so `backend/` does not become a redundant child of `Backend`.
    assert folder_key("backend") not in by_key
    assert folder_key("frontend") not in by_key
    assert by_key[folder_key("backend/app")]["parent_key"] == system_key("backend")
    assert by_key[folder_key("frontend/app")]["parent_key"] == system_key("frontend")

    # Levels: first visible folder = module (1), file = 3, function = 4.
    assert by_key[folder_key("backend/app")]["level"] == 1
    assert by_key[folder_key("backend/app/core")]["level"] == 2
    assert by_key[file_key("backend/app/main.py")]["level"] == 3
    assert by_key[function_key("backend/app/main.py", "create_app", 4)]["level"] == 4

    # File nodes carry their DB id so the UI can open real source.
    assert by_key[file_key("backend/app/main.py")]["meta"]["file_id"] is not None

    # A method's parent is its class, not the file.
    render = by_key[function_key("frontend/app/page.tsx", "render", 5)]
    assert render["parent_key"] == class_key("frontend/app/page.tsx", "Widget", 4)
    assert by_key[class_key("frontend/app/page.tsx", "Widget", 4)]["kind"] == NodeKind.CLASS.value


def test_import_edges_resolve_in_repo_and_fall_back_to_external():
    nodes, edges = _build(
        {
            "backend/app/main.py": (BACKEND_MAIN, Language.PYTHON),
            "backend/app/core/config.py": (BACKEND_CONFIG, Language.PYTHON),
            "frontend/app/page.tsx": (FRONTEND_PAGE, Language.TYPESCRIPT),
            "frontend/app/util.ts": (FRONTEND_UTIL, Language.TYPESCRIPT),
        }
    )
    imports = _edge_set(edges, EdgeKind.IMPORTS)

    # `from app.core.config import ...` resolves by path suffix.
    assert (
        file_key("backend/app/main.py"),
        file_key("backend/app/core/config.py"),
    ) in imports
    # Relative "./util" resolves against the importing file's directory.
    assert (file_key("frontend/app/page.tsx"), file_key("frontend/app/util.ts")) in imports

    # An unresolvable module becomes an external node.
    nodes2, edges2 = _build({"backend/app/main.py": ("import httpx\n", Language.PYTHON)})
    assert any(n["kind"] == NodeKind.EXTERNAL.value and n["name"] == "httpx" for n in nodes2)
    assert (file_key("backend/app/main.py"), "external:httpx") in _edge_set(
        edges2, EdgeKind.IMPORTS
    )


def test_call_edge_is_attributed_to_the_enclosing_function():
    _, edges = _build(
        {
            "backend/app/main.py": (BACKEND_MAIN, Language.PYTHON),
            "backend/app/core/config.py": (BACKEND_CONFIG, Language.PYTHON),
        }
    )
    assert (
        function_key("backend/app/main.py", "create_app", 4),
        function_key("backend/app/core/config.py", "get_settings", 2),
    ) in _edge_set(edges, EdgeKind.CALLS)


def test_ambiguous_call_target_is_skipped_not_guessed():
    """Two functions share a name -> we must not invent an edge."""
    src_a = "def helper():\n    return 1\n"
    src_b = "def helper():\n    return 2\n"
    caller = "def go():\n    return helper()\n"
    _, edges = _build(
        {
            "pkg/a.py": (src_a, Language.PYTHON),
            "pkg/b.py": (src_b, Language.PYTHON),
            "pkg/main.py": (caller, Language.PYTHON),
        }
    )
    assert _edge_set(edges, EdgeKind.CALLS) == set()


def test_module_level_call_has_no_caller_and_is_skipped():
    _, edges = _build(
        {
            "pkg/a.py": ("def helper():\n    return 1\n", Language.PYTHON),
            "pkg/main.py": ("helper()\n", Language.PYTHON),
        }
    )
    assert _edge_set(edges, EdgeKind.CALLS) == set()


def test_extends_and_implements_edges():
    _, edges = _build(
        {
            "frontend/app/page.tsx": (FRONTEND_PAGE, Language.TYPESCRIPT),
            "frontend/app/util.ts": (FRONTEND_UTIL, Language.TYPESCRIPT),
            "frontend/app/base.ts": (
                "class Base {}\nclass Thing {}\n",
                Language.TYPESCRIPT,
            ),
        }
    )
    widget = class_key("frontend/app/page.tsx", "Widget", 4)
    assert (widget, class_key("frontend/app/base.ts", "Base", 1)) in _edge_set(
        edges, EdgeKind.EXTENDS
    )
    assert (widget, class_key("frontend/app/base.ts", "Thing", 2)) in _edge_set(
        edges, EdgeKind.IMPLEMENTS
    )


def test_python_inheritance_edge():
    _, edges = _build(
        {
            "pkg/base.py": (BASE_CLASS, Language.PYTHON),
            "pkg/child.py": ("class Child(Base):\n    pass\n", Language.PYTHON),
        }
    )
    assert (
        class_key("pkg/child.py", "Child", 1),
        class_key("pkg/base.py", "Base", 2),
    ) in _edge_set(edges, EdgeKind.EXTENDS)


# ---- ORM model detection (Database mode) ----

ORM_MODELS = """
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class UserModel(TimestampMixin, Base):
    pass

class Helper:
    pass
"""

PYDANTIC_SCHEMAS = """
from pydantic import BaseModel

class UserOut(BaseModel):
    pass
"""

LOOKALIKE_BASE = """
from app.core.thing import Base

class NotAModel(Base):
    pass
"""


def _build_python(files: dict[str, str]):
    parsed = {p: parse_file(src, Language.PYTHON) for p, src in files.items()}
    nodes, _ = GraphBuilder("acme/app").build(parsed)
    return {n["key"]: n for n in nodes}


def _has_models(node) -> bool:
    return node["meta"].get("has_models") is True


def test_a_sqlalchemy_model_is_flagged():
    nodes = _build_python({"backend/app/models.py": ORM_MODELS})
    model = next(n for n in nodes.values() if n["name"] == "UserModel")
    assert _has_models(model)


def test_a_plain_class_beside_a_model_is_not_flagged():
    nodes = _build_python({"backend/app/models.py": ORM_MODELS})
    helper = next(n for n in nodes.values() if n["name"] == "Helper")
    assert not _has_models(helper)


def test_a_pydantic_schema_is_not_a_model():
    """BaseModel validates; it does not persist."""
    nodes = _build_python({"backend/app/schemas.py": PYDANTIC_SCHEMAS})
    schema = next(n for n in nodes.values() if n["name"] == "UserOut")
    assert not _has_models(schema)


def test_a_base_class_without_an_orm_import_is_not_a_model():
    """`Base` is a common name; the ORM import is what makes it a model."""
    nodes = _build_python({"backend/app/thing.py": LOOKALIKE_BASE})
    klass = next(n for n in nodes.values() if n["name"] == "NotAModel")
    assert not _has_models(klass)


def test_the_flag_reaches_every_ancestor():
    nodes = _build_python({"backend/app/models.py": ORM_MODELS})

    assert _has_models(nodes[file_key("backend/app/models.py")])
    assert _has_models(nodes[folder_key("backend/app")])
    assert _has_models(nodes[system_key("backend")])


def test_a_branch_with_no_models_stays_unflagged():
    nodes = _build_python(
        {"backend/app/models.py": ORM_MODELS, "frontend/ui/page.py": PYDANTIC_SCHEMAS}
    )
    assert _has_models(nodes[system_key("backend")])
    assert not _has_models(nodes[file_key("frontend/ui/page.py")])
