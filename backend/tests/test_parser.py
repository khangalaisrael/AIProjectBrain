"""Tree-sitter parser extraction tests."""

from app.domain.enums import Language
from app.infrastructure.parsing.tree_sitter_parser import parse_file, parse_functions

PYTHON_SOURCE = """
def greet(name):
    return f"hi {name}"


class Service:
    def run(self):
        return 1
"""

JS_SOURCE = """
function add(a, b) {
  return a + b;
}

class Widget {
  render() {
    return null;
  }
}
"""

TS_SOURCE = """
function identity<T>(value: T): T {
  return value;
}
"""


def test_parses_python_functions_and_methods():
    functions = parse_functions(PYTHON_SOURCE, Language.PYTHON)
    names = {f.name for f in functions}
    assert {"greet", "run"} <= names

    greet = next(f for f in functions if f.name == "greet")
    assert greet.start_line == 2
    assert greet.signature is not None and greet.signature.startswith("def greet")


def test_parses_javascript_functions_and_methods():
    functions = parse_functions(JS_SOURCE, Language.JAVASCRIPT)
    names = {f.name for f in functions}
    assert {"add", "render"} <= names


def test_parses_typescript_generic_function():
    functions = parse_functions(TS_SOURCE, Language.TYPESCRIPT)
    names = {f.name for f in functions}
    assert "identity" in names


def test_empty_source_returns_no_functions():
    assert parse_functions("", Language.PYTHON) == []


# ---- static analysis for the knowledge graph --------------------------------

_PY_GRAPH_SOURCE = """
import httpx
from app.core.config import get_settings, Settings
from .sibling import thing


class Service(Base, Mixin):
    def run(self):
        return get_settings()


def create_app():
    return make_app()
"""

_TS_GRAPH_SOURCE = """
import { useState } from "react";
import helper from "./util";

class Widget extends Base implements Thing {
  render() {
    return helper(1);
  }
}
"""


def test_parse_file_extracts_python_imports_with_names():
    parsed = parse_file(_PY_GRAPH_SOURCE, Language.PYTHON)
    modules = {i.module: i.names for i in parsed.imports}

    assert modules["httpx"] == []
    # The module itself must not leak into its own imported-names list.
    assert modules["app.core.config"] == ["get_settings", "Settings"]
    assert ".sibling" in modules


def test_parse_file_extracts_classes_with_bases():
    parsed = parse_file(_PY_GRAPH_SOURCE, Language.PYTHON)
    service = next(c for c in parsed.classes if c.name == "Service")
    assert service.extends == ["Base", "Mixin"]
    assert service.implements == []


def test_parse_file_separates_typescript_extends_from_implements():
    parsed = parse_file(_TS_GRAPH_SOURCE, Language.TYPESCRIPT)
    widget = next(c for c in parsed.classes if c.name == "Widget")
    assert widget.extends == ["Base"]
    assert widget.implements == ["Thing"]


def test_parse_file_attributes_calls_to_the_enclosing_function():
    parsed = parse_file(_PY_GRAPH_SOURCE, Language.PYTHON)
    calls = {(c.callee, c.caller) for c in parsed.calls}
    assert ("get_settings", "run") in calls
    assert ("make_app", "create_app") in calls


def test_parse_file_records_method_calls_by_final_attribute():
    parsed = parse_file("def go():\n    return obj.method()\n", Language.PYTHON)
    assert [(c.callee, c.caller) for c in parsed.calls] == [("method", "go")]


def test_module_level_call_has_no_caller():
    parsed = parse_file("setup()\n", Language.PYTHON)
    assert parsed.calls[0].caller is None
