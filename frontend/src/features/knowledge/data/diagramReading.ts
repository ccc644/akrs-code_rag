import type { FlowchartCatalogEntry } from '../types';

export interface DiagramReading {
  summary: string;
  condition: string;
  exception: string;
}

// 当前仓库未登记流程图谱阅读说明；空表让 UI 在无图谱时保持稳定。
export const diagramReadings: Record<string, DiagramReading> = {};

// 全函数：任意输入都返回布尔值；只有“HTML 补充页”（无独立规格）算作补充资料。
export function isSupportingEntry(entry: FlowchartCatalogEntry | null | undefined): boolean {
  return entry?.type === 'supplemental';
}
