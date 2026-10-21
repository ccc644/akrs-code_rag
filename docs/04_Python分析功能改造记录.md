# Python 分析系统改造记录

更新日期：2026-10-19。

## 1. 改造目标

原系统以 C# 为主要被分析语言，符号与关系分析依赖 Roslyn helper；Python 只作为补充路径。本次将系统整体切换为 Python 源码分析：

1. 移除 C#/Roslyn 和 tree-sitter-c-sharp 依赖，Python AST 成为唯一的一等分析路径。
2. 把 `trunk/` 中的 C# 业务工程替换为 SWE-agent（NeurIPS 2024，CCF-A）的 Python 源码快照，放在 `trunk/swe-agent/`，作为默认被分析项目；`trunk/` 作为集中放置多个项目的源码大目录。
3. 同步更新提示词、工具标签、知识资料、测试和文档，避免残留“C# 主路径”的描述。

## 2. 被分析源码

`trunk/swe-agent/` 现在是 SWE-agent 的只读快照：

- 上游：`https://github.com/SWE-agent/SWE-agent`
- 提交：`3ea751c087f32b16e039a2233dd6eefecef325d5`
- 许可证：MIT
- 范围：`sweagent/`、`tests/`、`tools/`、`config/`、`docs/` 等；未包含 `.git` 历史和示例轨迹数据。

`trunk/` 用作集中放置被分析项目的大目录，每个子目录是一个独立项目。默认项目指向 `trunk/swe-agent`；新仓库放到 `trunk/<项目名>`，再在应用内新建项目并关联该子目录。

上游说明单独记录在 `trunk/UPSTREAM.md`。源码目录保持只读，应用不会修改或执行其中的业务代码。

## 3. 后端修改

| 文件 | 修改 |
| --- | --- |
| `backend/app/modules/source_analysis/csharp.py` | 删除 Roslyn 服务、C# 项目和调用关系分析 |
| `backend/app/modules/source_analysis/symbol_parser.py` | 删除 tree-sitter-c-sharp 备用解析器 |
| `backend/app/modules/source_analysis/setup.py` | 删除 .NET/Roslyn 安装准备 |
| `backend/tools/SourceAnalysis/` | 删除 Roslyn helper 工程 |
| `backend/app/modules/source_analysis/workspace.py` | 只把 `.py` 分派给 PythonAnalysis；其他后缀返回 `analysis: unsupported` |
| `backend/app/modules/source_analysis/collection.py` | 移除 ProjectAnalysis 和 CSharpAnalysis 依赖，多目录项目直接复用 PythonAnalysis |
| `backend/app/agents/tools/source.py` | 移除 `csharp_symbols`，保留 `python_symbols`、`python_relations` |
| `backend/app/agents/runtime/engine.py` | 删除 `CSharpAnalysis` 装配 |
| `backend/app/agents/runtime/graph_builder.py` | 不再注册 C# 关系工具 |
| `backend/app/agents/runtime/executor.py` | 只在选中 `.py` 时预取 Python 关系 |
| `backend/app/agents/analysis/retrieval_budget.py` | 复核工具集合改为 `python_relations` |
| `backend/app/agents/prompts/system.py` | 提示词改为 Python-only，说明 AST 的保守边界 |
| `backend/app/modules/source_analysis/evidence.py` | 源码问题识别只匹配 `.py` |
| `backend/pyproject.toml` / `uv.lock` | 移除 `tree-sitter` 与 `tree-sitter-c-sharp` |
| `backend/app/core/config.py` | 默认工作区根目录改为 `trunk/swe-agent` |
| `frontend/scripts/knowledge/check-source-guides.mjs` | 知识资料校验根目录改为 `trunk/swe-agent` |
| `scripts/dev/Setup.ps1` | 不再准备 Roslyn 工具 |

## 4. Python 静态分析模型

`PythonAnalysis` 继续使用标准库 `ast.parse`：

- 符号：类、函数、异步函数、类方法、装饰器、参数、基类和限定名。
- 导入：`import`、`from ... import ...`，工作区内按模块路径解析相对导入。
- 关系：同文件名称匹配的调用候选、工作区内同名调用者扫描、继承基类；导入目标只定位到文件。
- 语法错误返回 `syntax_error` 和行列信息，不执行文件、不导入依赖。
- 动态导入、`getattr`、猴子补丁、装饰器替换、运行时多态和外部包内部实现保持未知。

## 5. 前端与知识资料

- `toolLabels.ts` 移除 C# 工具名称。
- `WorkspaceSearch`、`SourceImport` 的示例与可导入后缀改为 Python。
- `resources/knowledge/flows` 和原 AKRS 模块索引已移除；`resources/knowledge/modules/manifest.json` 替换为空的 SWE-agent 清单。
- `sourceGuides.ts` 改为一个 SWE-agent 源码说明专题，覆盖命令行入口、单实例运行、Agent 步进循环和工具边界。
- `source-evidence.json` 为 9 段人工选定源码范围，保存 SHA-256 与精确片段；`npm run knowledge:source-check` 会核对 trunk 是否变化。
- `presentation.ts`、`archifyData.ts`、`diagramReading.ts` 清空 AKRS 专属图谱数据，等待按新源码重新复核后补充。

## 6. 验证

本次实际执行：

- `uv lock`：移除 tree-sitter 依赖后重新解析。
- 后端源码分析相关测试：34 通过、1 跳过（Windows 符号链接权限）。
- 前端 `npx tsc -b`：通过。
- 前端 `npm test`：190 通过。
- 前端 `npm run build`：通过（包含知识资料校验和 Agent 索引生成）。
- 知识资料检查：1 个专题、3 条流程、9 个节点、16 条说明，9 个文件 / 9 段依据与 trunk 一致。

尚未执行：真实模型供应商的在线问答验收、完整后端全量测试的历史对比、SWE-agent 业务项目自身的执行或测试。

## 7. 边界

- 静态关系只代表源码中可推断的候选关系，不是完整调用图或类型系统。
- 源码工作区只读，不执行被分析的 Python 项目。
- 知识图谱和模块索引当前为空，不能把“已建立空清单”描述成“已完成全项目理解”。
- 原有 ARKS 设备业务资料不再随本次快照分发。
