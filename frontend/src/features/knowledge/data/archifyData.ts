import type { ArchifyData } from '../types';

// 当前只保留 SWE-agent 的源码说明与空图谱目录；原 AKRS 流程图谱数据已移除，
// 新的图谱需要按当前 trunk 源码重新人工核对后加入。
export const archifyData: ArchifyData = {
  graphs: [],
  refs: {},
  signals: {},
  reviewSummary: { nodeIds: [], edgeIds: [] },
  resourceLinks: [],
  flowchartCatalog: {
    schemaVersion: 1,
    title: 'SWE-agent 源码图谱目录',
    generatedOn: '',
    scope: '当前仓库未登记人工复核的流程图谱',
    counts: {},
    groups: {},
    entries: [],
    validation: {},
  },
  diagramNotes: {},
  diagramRecords: {},
};
