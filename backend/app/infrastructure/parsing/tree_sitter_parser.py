"""Tree-sitter based function extraction for Python, JavaScript, and TypeScript.

Parses source text into an AST and walks it to collect function/method
definitions with their name, line span, and a one-line signature. Kept
dependency-light and framework-free so it can run inside a Celery worker.
"""

from __future__ import annotations

from dataclasses import dataclass

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


def parse_functions(source: str, language: Language) -> list[ParsedFunction]:
    """Extract function/method definitions from ``source`` for ``language``."""
    ts_language = _TS_LANGUAGES.get(language)
    node_types = _FUNCTION_NODE_TYPES.get(language)
    if ts_language is None or node_types is None:
        return []

    parser = Parser(ts_language)
    tree = parser.parse(bytes(source, "utf-8"))

    functions: list[ParsedFunction] = []
    _collect(tree.root_node, node_types, functions)
    return functions


def _collect(node: Node, node_types: set[str], out: list[ParsedFunction]) -> None:
    if node.type in node_types:
        name_node = node.child_by_field_name("name")
        name = _text(name_node) if name_node is not None else "<anonymous>"
        out.append(
            ParsedFunction(
                name=name,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                signature=_signature(node),
            )
        )

    for child in node.children:
        _collect(child, node_types, out)


def _text(node: Node | None) -> str:
    if node is None or node.text is None:
        return ""
    return node.text.decode("utf-8", errors="replace")


def _signature(node: Node) -> str | None:
    """First line of the definition, trimmed, as a lightweight signature."""
    text = _text(node)
    if not text:
        return None
    first_line = text.splitlines()[0].strip()
    return first_line[:2000] or None
