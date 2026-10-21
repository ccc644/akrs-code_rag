"""Python 源码的安全静态分析。

这里只使用标准库 ``ast``，不会导入、执行或构建用户提供的 Python 项目。
分析结果用于帮助 Agent 定位证据，不能替代运行时行为或类型检查器。
"""

from __future__ import annotations

import ast
import asyncio
from dataclasses import dataclass
from pathlib import Path

from langchain_core.tools import tool

from app.agents.tools.guards import safe_source_tools
from app.core.config import dump_json


def _end_line(node: ast.AST) -> int:
    return int(getattr(node, "end_lineno", getattr(node, "lineno", 0)))


def _unparse(node: ast.AST | None) -> str:
    if node is None:
        return ""
    try:
        return ast.unparse(node)
    except (AttributeError, ValueError):
        return ""


def _decorator_name(node: ast.AST) -> str:
    return _unparse(node) or type(node).__name__


def _call_name(node: ast.Call) -> str:
    return _unparse(node.func) or type(node.func).__name__


def _module_name(path: str) -> str:
    parts = Path(path).with_suffix("").parts
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def _parse(content: str) -> tuple[ast.Module | None, dict]:
    try:
        return ast.parse(content), {"has_syntax_errors": False}
    except SyntaxError as error:
        return None, {
            "has_syntax_errors": True,
            "analysis": "syntax_error",
            "reason": "Python 语法解析失败，未执行该文件",
            "syntax_error": {
                "message": error.msg,
                "line": error.lineno,
                "column": error.offset,
            },
        }


@dataclass(frozen=True)
class PythonFile:
    path: str
    version: str
    content: str
    tree: ast.Module | None
    metadata: dict


class _SymbolVisitor(ast.NodeVisitor):
    def __init__(self):
        self.symbols: list[dict] = []
        self._parents: list[tuple[str, str]] = []

    def _visit_definition(self, node, kind: str):
        parent_kind = self._parents[-1][1] if self._parents else ""
        actual_kind = "method" if parent_kind == "class" and kind == "function" else kind
        name = node.name
        qualname = ".".join([item[0] for item in self._parents] + [name])
        arguments = getattr(node, "args", None)
        parameters = []
        if arguments:
            all_arguments = [*arguments.posonlyargs, *arguments.args, *arguments.kwonlyargs]
            if arguments.vararg:
                all_arguments.append(arguments.vararg)
            if arguments.kwarg:
                all_arguments.append(arguments.kwarg)
            parameters = [item.arg for item in all_arguments]
        symbol = {
            "name": name,
            "qualname": qualname,
            "kind": actual_kind,
            "line": node.lineno,
            "end_line": _end_line(node),
            "async": isinstance(node, ast.AsyncFunctionDef),
            "decorators": [_decorator_name(item) for item in node.decorator_list],
            "parameters": parameters,
        }
        if isinstance(node, ast.ClassDef):
            symbol["bases"] = [_unparse(item) for item in node.bases if _unparse(item)]
        self.symbols.append(symbol)
        self._parents.append((name, "class" if isinstance(node, ast.ClassDef) else "function"))
        for child in node.body:
            self.visit(child)
        self._parents.pop()

    def visit_ClassDef(self, node):
        self._visit_definition(node, "class")

    def visit_FunctionDef(self, node):
        self._visit_definition(node, "function")

    def visit_AsyncFunctionDef(self, node):
        self._visit_definition(node, "function")


class _CallVisitor(ast.NodeVisitor):
    def __init__(self):
        self.calls: list[dict] = []

    def visit_Call(self, node):
        self.calls.append(
            {"name": _call_name(node), "line": node.lineno, "end_line": _end_line(node)}
        )
        self.generic_visit(node)


def _imports(tree: ast.Module) -> list[dict]:
    result = []
    for node in tree.body:
        if isinstance(node, ast.Import):
            result.extend(
                {
                    "kind": "import",
                    "module": item.name,
                    "name": item.name,
                    "alias": item.asname or item.name.split(".")[0],
                    "line": node.lineno,
                }
                for item in node.names
            )
        elif isinstance(node, ast.ImportFrom):
            module = "." * node.level + (node.module or "")
            result.extend(
                {
                    "kind": "from",
                    "module": module,
                    "name": item.name,
                    "alias": item.asname or item.name,
                    "line": node.lineno,
                }
                for item in node.names
            )
    return result


def _symbol_for_line(symbols: list[dict], line: int) -> dict | None:
    candidates = [item for item in symbols if item["line"] <= line <= item["end_line"]]
    return min(candidates, key=lambda item: item["end_line"] - item["line"], default=None)


class PythonAnalysis:
    """对 Workspace 提供 Python 符号和有限的跨文件关系分析。"""

    def __init__(self, workspace):
        self.workspace = workspace

    def _file(self, path: str) -> PythonFile:
        source = self.workspace.read(path)
        tree, metadata = _parse(source["content"])
        return PythonFile(source["path"], source["version"], source["content"], tree, metadata)

    def symbols(self, path: str) -> dict:
        source = self._file(path)
        if source.tree is None:
            return {"symbols": [], "imports": [], "version": source.version, **source.metadata}
        visitor = _SymbolVisitor()
        visitor.visit(source.tree)
        return {
            "symbols": visitor.symbols,
            "imports": _imports(source.tree),
            "version": source.version,
            "module": _module_name(source.path),
            "analysis": "ast",
            "has_syntax_errors": False,
        }

    def analyze(self, path: str, line: int) -> dict:
        """返回选定行所属作用域的保守静态关系。"""
        return self.relations(path, line)

    def _files(self) -> list[PythonFile]:
        files = []
        for path in self.workspace.files():
            if path.suffix.lower() != ".py":
                continue
            relative = self.workspace.relative(path)
            try:
                files.append(self._file(relative))
            except (OSError, ValueError):
                continue
        return files

    @staticmethod
    def _resolve_import(source_path: str, item: dict, module_paths: dict[str, str]) -> str | None:
        module = item["module"]
        if module.startswith("."):
            package = _module_name(source_path).split(".")[:-1]
            level = len(module) - len(module.lstrip("."))
            package = package[: max(0, len(package) - level + 1)]
            module = ".".join([*package, module.lstrip(".")]).strip(".")
        return module_paths.get(module)

    def relations(self, path: str, line: int) -> dict:
        source = self._file(path)
        if source.tree is None:
            return {"path": source.path, "version": source.version, **source.metadata}
        own_symbols = _SymbolVisitor()
        own_symbols.visit(source.tree)
        selected = _symbol_for_line(own_symbols.symbols, line)
        if line < 1 or line > len(source.content.splitlines()):
            raise ValueError("行号不在 Python 文件范围内")
        module_paths = {}
        parsed_files = []
        for item in self._files():
            if item.tree is None:
                continue
            module_paths[_module_name(item.path)] = item.path
            parsed_files.append(item)
        imports = _imports(source.tree)
        for item in imports:
            item["resolved_path"] = self._resolve_import(source.path, item, module_paths)
        target_names = {item["name"] for item in own_symbols.symbols}
        local_calls = _CallVisitor()
        local_calls.visit(source.tree)
        if selected:
            local_calls.calls = [
                item
                for item in local_calls.calls
                if selected["line"] <= item["line"] <= selected["end_line"]
            ]
        local_by_name = {item["name"]: item for item in own_symbols.symbols}
        calls = []
        for call in local_calls.calls:
            bare = call["name"].split(".")[-1]
            target = local_by_name.get(bare)
            calls.append({**call, "resolved": bool(target), "target": target})
        selected_key = selected["qualname"] if selected else None
        callers = []
        if selected_key:
            for item in parsed_files:
                visitor = _SymbolVisitor()
                visitor.visit(item.tree)
                for row in visitor.symbols:
                    call_visitor = _CallVisitor()
                    # Visit only the selected definition's source range.
                    for node in ast.walk(item.tree):
                        if not isinstance(
                            node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
                        ):
                            continue
                        if node.lineno != row["line"]:
                            continue
                        call_visitor.visit(node)
                    if any(
                        call["name"].split(".")[-1] == selected_key.split(".")[-1]
                        for call in call_visitor.calls
                    ):
                        callers.append({"path": item.path, "symbol": row})
        inherits = []
        if selected and selected["kind"] == "class":
            inherits = selected.get("bases", [])
        return {
            "path": source.path,
            "version": source.version,
            "module": _module_name(source.path),
            "symbol": selected,
            "symbols": own_symbols.symbols,
            "imports": imports,
            "calls": calls,
            "callers": callers,
            "inherits": inherits,
            "analysis": "ast",
            "has_syntax_errors": False,
            "scope": "静态语法与名称匹配；动态导入、重载和运行时分派保持未知",
            "known_names": sorted(target_names),
        }

    def tools(self):
        @tool
        async def python_symbols(path: str) -> str:
            """List Python modules, classes, functions, async functions and decorators via AST."""
            return dump_json(await asyncio.to_thread(self.symbols, path))

        @tool
        async def python_relations(path: str, line: int) -> str:
            """Resolve Python imports, inheritance and conservative static call relations.

            This never imports or executes the inspected project. Dynamic dispatch and
            calls outside the workspace remain explicitly unresolved.
            """
            return dump_json(await asyncio.to_thread(self.relations, path, line))

        return safe_source_tools([python_symbols, python_relations], label="Python 源码工具")
