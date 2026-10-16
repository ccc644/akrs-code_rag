// 本文件为兼容性重建（原文件因 .gitignore 的 data/ 规则未随仓库分发），数据来源为 frontend/src/features/knowledge/reviews/*.ts 的 guide.topic 与 guide.diagrams（专题 id 与已复核绑定的图谱）；architecture 专题取自 resources/knowledge/flows/flowchart-catalog.html 中 data-group="architecture" 的条目，无法重建的部分留空，不得当作原始人工复核语料。
// 原文件的人工撰写文案（title / summary / purpose / conditions / exceptions）无法从现有资源忠实重建，全部留空。
// 专题顺序按 sourceGuides.ts 的数组顺序，architecture 置首（与展示页“从系统全局到生产”的入口一致；原顺序不可考）。
export interface PresentationTopic {
  id: string;
  title: string;
  summary: string;
  purpose: string;
  conditions: string[];
  exceptions: string[];
  diagrams: string[];
}

// 文案没有可追溯来源，统一留空，避免把重建数据当成人工复核结论。
export const presentationTopics: PresentationTopic[] = [
  {
    "id": "architecture",
    "title": "",
    "summary": "",
    "purpose": "",
    "conditions": [],
    "exceptions": [],
    "diagrams": [
      "framework-runtime-architecture",
      "zx2200-architecture"
    ]
  },
  {
    "id": "startup",
    "title": "",
    "summary": "",
    "purpose": "",
    "conditions": [],
    "exceptions": [],
    "diagrams": [
      "startup-workflow",
      "machine-start-readiness-workflow"
    ]
  },
  {
    "id": "recovery",
    "title": "",
    "summary": "",
    "purpose": "",
    "conditions": [],
    "exceptions": [],
    "diagrams": [
      "failure-recovery-workflow",
      "stop-cleanup-workflow"
    ]
  },
  {
    "id": "transport",
    "title": "",
    "summary": "",
    "purpose": "",
    "conditions": [],
    "exceptions": [],
    "diagrams": [
      "transport-workflow",
      "transport-pause-stop-workflow",
      "transport-start-gating-workflow",
      "bin-failure-handshake-sequence"
    ]
  },
  {
    "id": "s1",
    "title": "",
    "summary": "",
    "purpose": "",
    "conditions": [],
    "exceptions": [],
    "diagrams": [
      "dispense-workflow",
      "s1-step-commit-gate-workflow",
      "s1-return-gates-workflow",
      "s1-segment-interaction-workflow",
      "s1-defect-outcome-workflow",
      "s1-rework-context-workflow"
    ]
  },
  {
    "id": "s2",
    "title": "",
    "summary": "",
    "purpose": "",
    "conditions": [],
    "exceptions": [],
    "diagrams": [
      "bonding-workflow",
      "pickup-workflow",
      "bond-action-workflow",
      "s2-task-entry-boundary-workflow",
      "relative-bond-order-workflow",
      "s2-action-boundary-workflow"
    ]
  },
  {
    "id": "wafer",
    "title": "",
    "summary": "",
    "purpose": "",
    "conditions": [],
    "exceptions": [],
    "diagrams": [
      "wafer-supply-workflow",
      "wafer-search-gate-workflow",
      "wafer-change-retry-workflow",
      "wafer-pick-handshake-sequence",
      "wafer-vision-outcome-workflow"
    ]
  }
];

const topicByDiagram = new Map<string, PresentationTopic>();
for (const topic of presentationTopics)
  for (const diagram of topic.diagrams)
    if (!topicByDiagram.has(diagram)) topicByDiagram.set(diagram, topic);

// 全函数：任意输入都返回专题或 undefined（未登记图谱），调用点均以 ?. 处理，不抛异常。
export function topicForDiagram(id: string): PresentationTopic | undefined {
  return typeof id === 'string' ? topicByDiagram.get(id) : undefined;
}

// 全函数：目录条目的标题可能带“01 · ”章节前缀（CooperationNotes.tsx 也用同样方式去掉），
// 去掉前缀后为空则退回 id，保证任何输入都返回字符串且不抛异常。
export function displayDiagramTitle(id: string, title?: string | null): string {
  const text = typeof title === 'string' ? title.replace(/^\s*\d+\s*·\s*/, '').trim() : '';
  return text || (typeof id === 'string' ? id : '');
}
