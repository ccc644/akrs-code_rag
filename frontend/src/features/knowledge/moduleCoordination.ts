export interface SignalGuide {
  title: string;
  description: string;
  chapters: string[];
}

// 当前仓库未登记模块协作摘要和信号说明；待按 SWE-agent 源码重新核对后补充。
export const coordinationSummaries: Record<string, string> = {};

export const signalGuides: Record<string, SignalGuide> = {};
