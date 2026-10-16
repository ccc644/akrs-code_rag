# AI、Agent 与代码分析技术分析

## 1. 先给结论

这个系统不是单纯的“把字符串拼到 Prompt 后调用一次模型”。它具备可观察的 Agent 工作流：模型被装配为带工具的 Deep Agents 图，工具可以读取源码、搜索、访问知识和记忆，运行状态通过 LangGraph 检查点保存，源码回答还经过证据覆盖检查。

同时，它也不是一个完全自主规划的多 Agent 系统。当前 `subagents=[]`，没有证据表明系统使用了多 Agent 协作、自动执行用户源码或通用向量数据库。更准确的描述是：**带有工具调用、持久化状态、上下文管理和源码证据门禁的单 Agent AI 应用**。

## 2. 已实现技术、部分实现技术和未实现技术

| 技术 | 状态 | 代码证据与边界 |
| --- | --- | --- |
| LLM API 集成 | 已实现 | `infrastructure/providers/models.py` 的 `create_model`，支持配置化供应商和用量记录 |
| Tool Calling | 已实现 | `agents/tools/source.py`、`conversation.py`、知识工具通过 LangChain `@tool` 暴露给 Agent |
| Agent 工作流 | 已实现 | `graph_builder.py` 使用 `create_deep_agent`，由模型决定何时读源码、搜索或调用记忆工具 |
| 工作流状态 | 已实现 | LangGraph checkpointer、SQLite、运行事件和断点恢复 |
| ReAct 风格循环 | 部分实现 | 工具调用与结果回传形成“思考—工具—结果”循环，但没有单独宣称使用某个 ReAct 提示模板 |
| RAG | 已实现资料检索增强 | 项目资料、调试记录与交接资料共用 `HybridIndex`，融合词面命中、领域同义词、标题加权与语义相似度；源码由工具按需读取 |
| Embedding | 已实现，运行需本机模型 | FastEmbed 本地多语言模型，分块、向量归一化、NumPy 余弦相似度计算及模型/文本版本缓存；模型不可用时降级为词面检索 |
| 向量数据库 | 使用 SQLite 缓存向量，未采用独立向量服务 | NumPy 负责精确相似度计算；当前没有独立向量数据库或 ANN 索引 |
| 结构化输出 | 部分实现 | 关系工具返回 JSON，模型设置探测和部分复核要求结构化 JSON；普通回答仍是文本 |
| 长期记忆 | 已实现 | `modules/memory` 保存项目事实和用户偏好，并有 stale、冲突、来源和恢复状态 |
| 失败重试与降级 | 已实现 | 队列恢复、模型错误转译、MCP 降级、Roslyn 缺失时明确返回 unavailable/unknown |
| 多 Agent | 未实现 | `create_deep_agent(..., subagents=[])`，当前是单图执行 |
| 执行未知业务源码 | 明确禁止 | `SourceBackend.write/edit/delete` 只读；C# 和 Python 都采用静态分析 |

## 3. Tool Calling 是怎么发生的

源码工具在 `agents/tools/source.py` 定义为异步工具，工具内部使用 `asyncio.to_thread` 调用同步文件和解析逻辑。`safe_source_tools` 将参数错误转换为 `ToolException`，避免工具异常直接破坏图运行。

主要本地工具包括：

- `read_source`：读取显式行号并返回版本。
- `read_source_context`：读取 C# 符号或 Python 符号附近的上下文。
- `read_source_batch`：合并相邻范围，控制行数和 token 预算。
- `search_source`、`find_source_files`：检索内容和路径。
- `csharp_symbols`、`csharp_relations`：C# 语法和 Roslyn 语义分析。
- `python_symbols`、`python_relations`：Python AST 符号和保守关系分析。
- 记忆、知识、调试记录和对话历史工具：由对应模块在图构建时加入。

模型发起工具调用后，运行时记录 `tool_start`、`tool_end` 和阶段事件；工具结果会回到图消息中，模型再根据结果决定是否继续读取。工具返回的源码属于证据资料，提示词明确要求忽略资料中可能出现的指令。

## 4. RAG 与源码证据的区别

资料检索和源码证据在系统中承担不同职责：

1. 知识、调试问题和交接资料用于提供背景、历史经验和流程说明，属于检索增强上下文。
2. `Workspace` 读取的是当前源码文件，返回 SHA-256 版本和行号；它是当前实现的直接依据。
3. `SourceEvidence` 只登记真正读过的范围。回答引用必须指向当前版本且覆盖已读行号。
4. `SourceEvidenceGuard` 发现引用无效时会要求补读，最多进行有限修复；它不证明结论语义绝对正确。

因此面试时应说“资料检索 + 可核对源码证据”，不能笼统说“所有内容都来自向量数据库”。

## 5. Python 分析器的技术设计

本次新增 `modules/source_analysis/python.py`，使用 Python 标准库 `ast.parse`：

- 解析 `class`、普通函数、异步函数和类方法，记录限定名、行范围、参数、装饰器和基类。
- 读取顶层 `import` / `from ... import ...`，根据工作区内的 `.py` 路径尝试解析模块文件。
- 遍历 `ast.Call`，对同一文件中可按名称匹配的函数给出候选目标；导入目标只标记可定位模块，不假装完成类型绑定。
- 扫描工作区内 Python 文件，寻找可能的调用者和继承信息。
- 语法错误只返回错误位置和 `syntax_error` 状态，不执行文件、不导入依赖、不启动子进程。
- 动态导入、`getattr`、猴子补丁、运行时多态、装饰器实际替换和外部包内部实现保持未知。

这是一种适合本地源码问答的“保守静态索引”，目标是给 Agent 提供可核对的候选范围，而不是重建完整 Python 类型系统。

## 6. 可靠性与幻觉控制

- 路径边界：`Workspace.resolve` 拒绝绝对路径、`..`、符号链接越界和生成目录。
- 版本边界：读取结果带 SHA-256；选区在发送前重新核对，旧选区会标记 stale。
- 证据边界：回答中的源码链接要经过覆盖检查；无法覆盖的链接会被降级。
- 语义边界：Roslyn 缺依赖时返回 unknown/partial；Python 动态行为在结果中明确说明未知。
- 上下文边界：批量读取限制范围，重复工具正文可压缩，超出预算时列出 remaining 而不是假装读完。
- 数据边界：源码工具只读，禁止通过 Agent 修改或执行业务源码。

## 7. 面试表达

可以这样描述：

> 我独立负责的是一个面向源码理解与调试知识复用的 AI 应用。系统使用 Deep Agents/LangGraph 组织单 Agent 工具调用，资料侧使用本地多语言 Embedding 与关键词、领域同义词和标题加权做混合检索；历史调试经验另外核对设备、版本和工况。Agent 可以继续调用检索与源码读取工具补齐证据，回答通过源码版本、行号覆盖校验和结论复核。C# 采用 Roslyn，Python 采用 AST 静态分析；长对话通过上下文预算、摘要、历史回查、checkpoint 和长期记忆管理。

不要说：系统“自动理解了全部代码”“通过 Agent 自动运行 Python”“使用了多 Agent 协作”或“所有检索都由向量数据库完成”。这些说法超出当前代码证据。
