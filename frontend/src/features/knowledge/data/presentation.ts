export interface PresentationTopic {
  id: string;
  title: string;
  summary: string;
  purpose: string;
  conditions: string[];
  exceptions: string[];
  diagrams: string[];
}

// 当前仓库只保留一个经人工核对源码范围的专题；其余专题等待逐条复核后再加入。
export const presentationTopics: PresentationTopic[] = [
  {
    id: 'architecture',
    title: 'SWE-agent 架构与运行流程',
    summary: '从命令行入口到单实例运行、Agent 步进循环和工具边界的静态阅读。',
    purpose: '帮助定位 SWE-agent 的主要执行入口、循环终止条件和工具调用边界。',
    conditions: ['以只读方式阅读 trunk 中的源码快照'],
    exceptions: ['不覆盖模型后端、容器环境和运行时行为'],
    diagrams: [],
  },
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
