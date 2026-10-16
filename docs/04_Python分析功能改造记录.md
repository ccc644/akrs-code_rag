# Python 分析功能改造记录

## 1. 改造目标

原系统的通用源码读取和搜索并不要求文件必须是 C#，但符号解析在 `Workspace.symbols` 中只对 `.cs` 调用 Roslyn helper，执行器也只会为 `.cs` 自动准备语义关系。因此，仅把后缀判断改成 `.py` 会得到“能读文本、不能理解结构”的假支持。

本次改造保留了 C# Roslyn 路径，增加 Python 静态结构和关系分析，并将其接入 Agent 工具和选区上下文。没有改写后端语言，也没有执行任何业务 Python 源码。

## 2. 修改文件

| 文件 | 修改 |
| --- | --- |
| `backend/app/modules/source_analysis/python.py` | 新增 Python AST 分析器、模块路径解析、符号、导入、继承、调用和调用者关系 |
| `backend/app/modules/source_analysis/workspace.py` | `.py` 符号请求转给 `PythonAnalysis`，C# 行为保持原路径 |
| `backend/app/agents/tools/source.py` | 增加 `python_symbols` 和 `python_relations` 工具，并允许注入分析器 |
| `backend/app/agents/runtime/engine.py` | 为每个运行时装配 `PythonAnalysis` |
| `backend/app/agents/runtime/graph_builder.py` | 将 Python 分析器提供给源码工具集合 |
| `backend/app/agents/runtime/executor.py` | 选中 `.py` 时自动准备 Python 关系上下文，`.cs` 仍使用 Roslyn |
| `backend/app/agents/prompts/system.py` | 补充 Python 工具和动态行为未知边界 |
| `backend/app/modules/source_analysis/evidence.py` | 源码问题识别同时覆盖 `.cs` 和 `.py` |
| `frontend/src/features/chat/lib/toolLabels.ts` | 显示两个 Python 工具的中文名称 |
| `frontend/src/features/source_reader/components/WorkspaceSearch.tsx` | 搜索范围提示同时举例 `.cs` 和 `.py` |
| `backend/tests/unit/source_analysis/test_python_analysis.py` | 新增确定性测试 |

## 3. 静态分析模型

### 3.1 符号

`PythonAnalysis.symbols(path)` 通过 `ast.parse` 构建语法树，再访问：

- `ClassDef`：类名、限定名、行范围、装饰器和基类。
- `FunctionDef` / `AsyncFunctionDef`：函数或类方法、异步标记、装饰器、参数和行范围。
- 嵌套定义：使用 `qualname` 保留外层类或函数关系。

返回结果包含 `analysis: "ast"`、文件版本和 `has_syntax_errors`。空文件返回空符号；语法错误返回错误行列和 `syntax_error`，不会尝试执行或导入。

### 3.2 导入

顶层 `import x` 和 `from x import y` 会记录模块、名称、别名和行号。对于工作区内的 `.py` 文件，分析器按相对路径建立模块映射，尝试解析相对导入。例如 `pkg/service.py` 中的 `from .helpers import normalize` 可以定位到 `pkg/helpers.py`。

“能定位模块文件”不等于“已经完成 Python 类型绑定”。别名重写、`__all__`、条件导入、安装包和动态导入仍可能改变真实行为，因此结果保留静态范围声明。

### 3.3 调用和调用者

`ast.Call` 记录调用文本和行号。对同一文件中按名称可匹配的函数，结果给出 `resolved: true` 和目标符号；导入目标只在 `imports.resolved_path` 中给出文件级定位。扫描工作区的 Python 文件，可以找出名称相同的潜在调用者。

这是保守的候选关系，不是完整的调用图。以下情况明确保持未知：多态分派、实例属性实际类型、装饰器替换、猴子补丁、`getattr`/`eval`、动态导入、C 扩展和外部包内部实现。

### 3.4 安全边界

分析器没有 `exec`、`eval`、`importlib`、子进程或项目安装步骤。它只读取 `Workspace` 已经允许的文本文件，且继承现有的路径、大小、编码和符号链接边界。

## 4. 典型输入和结果

```python
from .helpers import normalize

class Service(BaseService):
    @staticmethod
    async def build(value: str):
        return normalize(value)
```

符号结果会包含 `Service`、`Service.build`、`async: true`、`staticmethod`、`BaseService` 和参数 `value`；导入结果会记录 `.helpers` 和 `normalize`；关系结果会把 `normalize(value)` 作为调用候选，并说明这是 AST/名称匹配。

## 5. 测试设计

测试文件为 `backend/tests/unit/source_analysis/test_python_analysis.py`，覆盖：

- 简单类、继承、装饰器和异步方法。
- 相对导入和多个 Python 模块。
- 本文件内函数调用和调用者扫描。
- 语法错误只返回结构化错误，不执行目标文件。

执行命令：

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q tests/unit/source_analysis/test_python_analysis.py
```

本次实际结果：**3 个新增测试通过**。同时复跑了源码工作区相关集成测试：**17 个通过，1 个 Windows 符号链接权限跳过**。

## 6. 功能差异

改造前，Python 文件可以被读取和全文搜索，但 `Workspace.symbols` 返回空符号，选中 `.py` 不会自动生成关系上下文。改造后，Python 文件具有 AST 符号和关系工具，选区会进入与 C# 类似的静态关系预取路径。

还没有实现的能力包括：跨包完整类型推断、第三方库 API 语义、运行时调用覆盖、执行测试来验证目标项目行为，以及 Python 专用的复杂代码质量规则。这些应该在有明确需求和测试样例后逐步增加。
