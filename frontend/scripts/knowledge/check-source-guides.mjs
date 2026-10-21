import { knowledgePath, projectRoot } from './resources.mjs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceGuides, sourceEvidence } from '../../src/features/knowledge/sourceGuides.ts';
import { archifyData } from '../../src/features/knowledge/data/archifyData.ts';
import { presentationTopics } from '../../src/features/knowledge/data/presentation.ts';
import { validateSourceGuides } from './source-guide-validation.mjs';

const trunkRoot = resolve(projectRoot, 'trunk', 'swe-agent');
const counts = await validateSourceGuides({
  guides: sourceGuides,
  evidence: sourceEvidence,
  trunkRoot,
  topics: presentationTopics.map((item) => item.id),
  diagrams: archifyData.flowchartCatalog.entries.map((item) => item.id),
});
for (const diagram of Object.values(sourceEvidence.diagrams)) {
  if (!/^archify\/[a-z0-9-]+\.html$/.test(diagram.path)) throw new Error('复核图谱路径无效');
  const bytes = await readFile(knowledgePath(diagram.path));
  if (createHash('sha256').update(bytes).digest('hex') !== diagram.sha256)
    throw new Error(`复核图谱已变化，需同步复核内容与版本：${diagram.path}`);
}
console.log(
  `源码说明检查通过：${counts.guides} 个专题，${counts.flows} 条流程，${counts.steps} 个节点，${counts.claims} 条说明；${counts.files} 个文件、${counts.ranges} 段依据均与 trunk 一致。`,
);
