"""Tree-sitter based static analysis for Python, JavaScript, and TypeScript.

Extracts the facts the knowledge graph is built from: function and class
definitions, import statements, and call sites (attributed to their enclosing
function). Kept dependency-light and framework-free so it can run inside a
Celery worker.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import tree_sitter_javascript
import tree_sitter_python
import tree_sitter_typescript
from tree_sitter import Language as TSLanguage
from tree_sitter import Node, Parser

from app.domain.enums import Language

# Node types that represent a callable definition, per grammar.
_FUNCTION_NODE_TYPES: dict[Language, set[str]] = {
    Language.PYTHON: {"function_definition"},
    Language.JAVASCRIPT: {
        "function_declaration",
        "generator_function_declaration",
        "method_definition",
    },
    Language.TYPESCRIPT: {
        "function_declaration",
        "generator_function_declaration",
        "method_definition",
    },
}

_CLASS_NODE_TYPES: dict[Language, set[str]] = {
    Language.PYTHON: {"class_definition"},
    Language.JAVASCRIPT: {"class_declaration"},
    Language.TYPESCRIPT: {"class_declaration"},
}

_CALL_NODE_TYPES: dict[Language, set[str]] = {
    Language.PYTHON: {"call"},
    Language.JAVASCRIPT: {"call_expression"},
    Language.TYPESCRIPT: {"call_expression"},
}

_TS_LANGUAGES: dict[Language, TSLanguage] = {
    Language.PYTHON: TSLanguage(tree_sitter_python.language()),
    Language.JAVASCRIPT: TSLanguage(tree_sitter_javascript.language()),
    Language.TYPESCRIPT: TSLanguage(tree_sitter_typescript.language_typescript()),
}


@dataclass(slots=True)
class ParsedFunction:
    name: str
    start_line: int
    end_line: int
    signature: str | None


@dataclass(slots=True)
class ParsedClass:
    name: str
    start_line: int
    end_line: int
    extends: list[str] = field(default_factory=list)
    implements: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ParsedImport:
    """A module a file depends on, plus the symbols pulled from it."""

    module: str
    names: list[str] = field(default_factory=list)
    line: int = 0


@dataclass(slots=True)
class ParsedCall:
    """A call site. ``caller`` is the enclosing function, when there is one."""

    callee: str
    line: int
    caller: str | None = None


@dataclass(slots=True)
class ParsedFile:
    functions: list[ParsedFunction] = field(default_factory=list)
    classes: list[ParsedClass] = field(default_factory=list)
    imports: list[ParsedImport] = field(default_factory=list)
    calls: list[ParsedCall] = field(default_factory=list)


def parse_functions(source: str, language: Language) -> list[ParsedFunction]:
    """Extract function/method definitions from ``source`` for ``language``."""
    return parse_file(source, language).functions


def parse_file(source: str, language: Language) -> ParsedFile:
    """Extract functions, classes, imports, and calls from a source file."""
    ts_language = _TS_LANGUAGES.get(language)
    if ts_language is None:
        return ParsedFile()

    parser = Parser(ts_language)
    tree = parser.parse(bytes(source, "utf-8"))

    parsed = ParsedFile()
    _walk(tree.root_node, language, parsed, caller=None)
    return parsed


def _walk(node: Node, language: Language, out: ParsedFile, caller: str | None) -> None:
    """Depth-first walk, threading the enclosing function name down the tree."""
    node_type = node.type

    if node_type in _FUNCTION_NODE_TYPES.get(language, ()):
        name = _name_of(node)
        out.functions.append(
            ParsedFunction(
                name=name,
                start_line=_line(node.start_point),
                end_line=_line(node.end_point),
                signature=_signature(node),
            )
        )
        caller = name  # calls inside this body belong to it

    elif node_type in _CLASS_NODE_TYPES.get(language, ()):
        extends, implements = _class_heritage(node, language)
        out.classes.append(
            ParsedClass(
                name=_name_of(node),
                start_line=_line(node.start_point),
                end_line=_line(node.end_point),
                extends=extends,
                implements=implements,
            )
        )

    elif node_type in _CALL_NODE_TYPES.get(language, ()):
        callee = _callee_name(node)
        if callee:
            out.calls.append(ParsedCall(callee=callee, line=_line(node.start_point), caller=caller))

    elif _is_import(node_type, language):
        imported = _parse_import(node, language)
        if imported is not None:
            out.imports.append(imported)

    for child in node.children:
        _walk(child, language, out, caller)


# ---- helpers ----------------------------------------------------------------


def _line(point) -> int:
    return point[0] + 1


def _text(node: Node | None) -> str:
    if node is None or node.text is None:
        return ""
    return node.text.decode("utf-8", errors="replace")


def _name_of(node: Node) -> str:
    name_node = node.child_by_field_name("name")
    return _text(name_node) if name_node is not None else "<anonymous>"


def _signature(node: Node) -> str | None:
    """First line of the definition, trimmed, as a lightweight signature."""
    text = _text(node)
    if not text:
        return None
    first_line = text.splitlines()[0].strip()
    return first_line[:2000] or None


def _class_heritage(node: Node, language: Language) -> tuple[list[str], list[str]]:
    """Return ``(extends, implements)`` names for a class definition."""
    if language is Language.PYTHON:
        arguments = node.child_by_field_name("superclasses")
        if arguments is None:
            return [], []
        bases = [
            _text(child)
            for child in arguments.children
            if child.type in {"identifier", "attribute"}
        ]
        return bases, []  # Python has no `implements`

    # JS/TS: class_heritage wraps `extends_clause` and/or `implements_clause`;
    # descend to identifiers rather than taking the raw clause text.
    extends: list[str] = []
    implements: list[str] = []
    for child in node.children:
        if child.type != "class_heritage":
            continue
        for clause in child.children:
            if clause.type == "implements_clause":
                _collect_identifiers(clause, implements)
            elif clause.type == "extends_clause":
                _collect_identifiers(clause, extends)
            else:
                _collect_identifiers(clause, extends)
    return extends, implements


def _collect_identifiers(node: Node, out: list[str]) -> None:
    if node.type in {"identifier", "type_identifier"}:
        text = _text(node)
        if text:
            out.append(text)
        return
    for child in node.children:
        _collect_identifiers(child, out)


def _callee_name(node: Node) -> str | None:
    """The called symbol: ``foo`` for ``foo()``, ``bar`` for ``obj.bar()``."""
    function_node = node.child_by_field_name("function")
    if function_node is None:
        return None

    if function_node.type in {"identifier", "shorthand_property_identifier"}:
        return _text(function_node) or None

    # attribute (python) / member_expression (js, ts) -> take the final property
    if function_node.type in {"attribute", "member_expression"}:
        attribute = function_node.child_by_field_name(
            "attribute"
        ) or function_node.child_by_field_name("property")
        return _text(attribute) or None

    return None


def _is_import(node_type: str, language: Language) -> bool:
    if language is Language.PYTHON:
        return node_type in {"import_statement", "import_from_statement"}
    return node_type == "import_statement"


def _parse_import(node: Node, language: Language) -> ParsedImport | None:
    line = _line(node.start_point)

    if language is Language.PYTHON:
        if node.type == "import_from_statement":
            module_node = node.child_by_field_name("module_name")
            module = _text(module_node)
            # Compare by byte offset: tree-sitter Nodes are recreated per access,
            # so `is not` would never exclude the module itself.
            module_start = module_node.start_byte if module_node is not None else -1
            names = [
                _text(child)
                for child in node.children
                if child.type in {"dotted_name", "identifier"} and child.start_byte != module_start
            ]
            return ParsedImport(module=module, names=names, line=line) if module else None

        # plain `import a.b.c`
        modules = [
            _text(child)
            for child in node.children
            if child.type in {"dotted_name", "aliased_import"}
        ]
        return ParsedImport(module=modules[0], line=line) if modules else None

    # JS/TS: `import x from "mod"` -> the source string
    source_node = node.child_by_field_name("source")
    module = _text(source_node).strip("\"'")
    return ParsedImport(module=module, line=line) if module else None
