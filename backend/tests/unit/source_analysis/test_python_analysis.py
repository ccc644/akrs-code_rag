import json

from app.modules.source_analysis.python import PythonAnalysis
from app.modules.source_analysis.workspace import Workspace


def test_python_symbols_include_classes_async_methods_and_decorators(tmp_path):
    (tmp_path / "sample.py").write_text(
        "from functools import lru_cache\n\n"
        "@lru_cache\n"
        "class Repository(BaseRepository):\n"
        "    @staticmethod\n"
        "    async def load(item_id: str):\n"
        "        return await fetch(item_id)\n",
        encoding="utf-8",
    )

    result = PythonAnalysis(Workspace(tmp_path)).symbols("sample.py")

    assert result["analysis"] == "ast"
    assert result["imports"][0]["module"] == "functools"
    repository = next(item for item in result["symbols"] if item["name"] == "Repository")
    method = next(item for item in result["symbols"] if item["name"] == "load")
    assert repository["bases"] == ["BaseRepository"]
    assert repository["decorators"] == ["lru_cache"]
    assert method["kind"] == "method"
    assert method["async"] is True
    assert method["decorators"] == ["staticmethod"]


def test_python_relations_resolve_local_calls_and_callers_across_modules(tmp_path):
    package = tmp_path / "pkg"
    package.mkdir()
    (package / "__init__.py").write_text("", encoding="utf-8")
    (package / "helpers.py").write_text(
        "def normalize(value):\n    return value.strip()\n", encoding="utf-8"
    )
    (package / "service.py").write_text(
        "from .helpers import normalize\n\n"
        "def build(value):\n    return normalize(value)\n\n"
        "def caller(value):\n    return build(value)\n",
        encoding="utf-8",
    )

    analysis = PythonAnalysis(Workspace(tmp_path))
    result = analysis.relations("pkg/service.py", 4)
    call = next(item for item in result["calls"] if item["name"] == "normalize")
    assert call["resolved"] is False  # 导入目标可定位到模块，但不假装完成类型绑定。
    assert result["imports"][0]["resolved_path"] == "pkg/helpers.py"

    called = analysis.relations("pkg/service.py", 7)
    assert any(item["name"] == "build" and item["resolved"] for item in called["calls"])

    helper_callers = analysis.relations("pkg/service.py", 3)["callers"]
    assert any(item["symbol"]["name"] == "caller" for item in helper_callers)


def test_python_syntax_error_is_reported_without_execution(tmp_path):
    (tmp_path / "broken.py").write_text("def broken(:\n    pass\n", encoding="utf-8")

    result = PythonAnalysis(Workspace(tmp_path)).symbols("broken.py")

    assert result["has_syntax_errors"] is True
    assert result["analysis"] == "syntax_error"
    assert result["symbols"] == []
    assert "syntax_error" in json.dumps(result, ensure_ascii=False)
