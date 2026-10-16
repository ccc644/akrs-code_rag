// 本文件为兼容性重建（原文件因 .gitignore 的 data/ 规则未随仓库分发），数据来源为 resources/knowledge/flows/flowchart-catalog.html 的图谱目录条目（只提供 id，用于保证每个可打开条目都有阅读条目），无法重建的部分留空，不得当作原始人工复核语料。
// 原文件的阅读说明文字（用途 / 条件 / 异常）在现有资源中没有对应来源，全部留空字符串。
import type { FlowchartCatalogEntry } from '../types';

export interface DiagramReading {
  summary: string;
  condition: string;
  exception: string;
}

// 目录中的每个条目都保留空说明，避免 UI 读取未登记条目时崩溃；文字留空而不编写推测内容。
export const diagramReadings: Record<string, DiagramReading> = {
  "startup-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "transport-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "dispense-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "wafer-supply-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "bonding-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "pickup-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "bond-action-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "failure-recovery-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "epoxy-template": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "safe-motion": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "mapping-restore-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "stop-cleanup-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "manual-epoxy-trial": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "nozzle-exchange": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "calibration-task-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "calibration-execution-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "transport-pause-stop-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "postbond-feedback-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "bond-camera-calibration-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "background-lifecycle-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "wafer-selection-consistency-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "emergency-stop-close-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "dispense-config-consumption-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "recipe-initialization-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "recipe-lifecycle-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "permission-gating-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "task-closure-gate-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "vision-motion-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "maintenance-calibration-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "wafer-search-gate-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "exit-save-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "relative-bond-order-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "recipe-live-reload-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "wafer-change-retry-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "automation-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "machine-start-readiness-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s1-step-commit-gate-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s1-return-gates-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s1-segment-interaction-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s1-defect-outcome-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s1-rework-context-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s1-stop-rework-recovery-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s1-task-loop-pause-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "process-step-injection-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s2-action-boundary-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s2-reset-retry-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s2-task-entry-boundary-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "statistics-log-producer-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "transport-start-gating-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "wafer-pick-handshake-sequence": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "bin-configuration-sequence": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "bin-failure-handshake-sequence": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "recipe-switch-sequence": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "s2-predispense-retry": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "background-task-sequence": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "motion-arrival-sequence": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "automation-sequence": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "async-persistence-dataflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "runtime-dataflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "framework-runtime-architecture": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "zx2200-architecture": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "showcase-v1": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "mapping-recovery-acceptance": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "config-production-gates": {
    "summary": "",
    "condition": "",
    "exception": ""
  },
  "wafer-vision-outcome-workflow": {
    "summary": "",
    "condition": "",
    "exception": ""
  }
};

// 全函数：任意输入都返回布尔值；只有“HTML 补充页”（无独立规格）算作补充资料。
export function isSupportingEntry(entry: FlowchartCatalogEntry | null | undefined): boolean {
  return entry?.type === 'supplemental';
}
