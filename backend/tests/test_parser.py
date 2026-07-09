"""Tree-sitter parser extraction tests."""

from app.domain.enums import Language
from app.infrastructure.parsing.tree_sitter_parser import parse_functions

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
