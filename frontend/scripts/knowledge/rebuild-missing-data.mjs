// 一次性重建脚本：重新生成 frontend/src/features/knowledge/data/ 下因 .gitignore 的 data/ 规则
// 而未随仓库分发的 4 个模块（archifyData.ts、presentation.ts、diagramReading.ts、source-evidence.json）。
//
// 设计原则（与项目“不臆造、可证伪”一致）：
//   - 只使用 resources/knowledge 下已有资源，逐字复制或按明确规则换算，绝不编写看似合理的业务内容；
//   - 没有可追溯来源的内容一律留空（'' / [] / {}），并在生成物头部注明；
//   - 生成物是兼容性重建产物，可用原始文件直接覆盖，不应作为人工复核语料。
//
// 数据来源：
//   1. resources/knowledge/generated/agent-knowledge.json
//      它是 build-agent-knowledge.mjs 对 { id, ...sourceEvidence.ranges[id], ...sourceEvidence.sources[file] }
//      的展开结果，因此可按 id 反向还原 source-evidence.json 的 sources / ranges 两个字段（无歧义）。
//      diagrams 字段无来源，留空 {}。
//   2. resources/knowledge/flows/index.html 内嵌的 <script id="data" type="application/json">
//      载荷，即旧门户的 archifyData 快照：graphs / refs / signals / reviewSummary / resourceLinks。
//      其中 refs 与 resources/knowledge/flows/source-evidence.json 逐字节一致，signals 与
//      resources/knowledge/flows/signal-inventory.json 逐字节一致（脚本会断言）。
//   3. resources/knowledge/flows/flowchart-catalog.html（flowchart-catalog.json 的静态渲染结果，
//      该 JSON 本身已不在仓库中），提供图谱目录条目的 id / 标题 / 类型 / 分组 / 章节 / 状态 / 关联文件。
//   4. resources/knowledge/flows/*.archify.json：nodeCount / relationCount / specSha256 / qualityProfile
//      按当前文件重算（快照之后有若干图被人工重绘，必须以规格文件为准）。
//   5. frontend/src/features/knowledge/reviews/*.ts：专题 id 与专题绑定的图谱。
//
// 用法：node --experimental-strip-types frontend/scripts/knowledge/rebuild-missing-data.mjs
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { knowledgePath, projectRoot } from './resources.mjs';

const flowsFile = (name) => knowledgePath(`archify/${name}`);
const dataDir = resolve(projectRoot, 'frontend/src/features/knowledge/data');
const readText = (path) => readFile(path, 'utf8');
const readJSON = async (path) => JSON.parse(await readText(path));
const flowsText = (name) => readText(flowsFile(name));
const flowsJSON = async (name) => JSON.parse(await flowsText(name));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value, null, 2);
const requireField = (condition, message) => {
  if (!condition) throw new Error(`重建失败：${message}`);
};
const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const NOTES = [];
const GAPS = [];
const DISCLAIMER =
  '本文件为兼容性重建（原文件因 .gitignore 的 data/ 规则未随仓库分发），数据来源为 {SOURCES}，' +
  '无法重建的部分留空，不得当作原始人工复核语料。';
const header = (sources, extra = []) =>
  [`// ${DISCLAIMER.replace('{SOURCES}', sources)}`, ...extra.map((line) => `// ${line}`), ''].join('\n');

/* ------------------------------------------------------- source-evidence.json */

async function buildSourceEvidence() {
  const payload = await readJSON(
    resolve(projectRoot, 'resources/knowledge/generated/agent-knowledge.json'),
  );
  const sources = {};
  const ranges = {};
  for (const document of payload.documents) {
    for (const reference of document.references) {
      const { id, file, method, start, end, code, path, sha256: digest } = reference;
      requireField(file && path && digest, `引用 ${id} 缺少来源文件信息`);
      const range = { file, method, start, end, code };
      const source = { path, sha256: digest };
      requireField(
        !ranges[id] || JSON.stringify(ranges[id]) === JSON.stringify(range),
        `引用 ${id} 在不同条目中不一致`,
      );
      requireField(
        !sources[file] || JSON.stringify(sources[file]) === JSON.stringify(source),
        `源码文件 ${file} 的指纹在不同条目中不一致`,
      );
      ranges[id] = range;
      sources[file] = source;
    }
  }
  const sortKeys = (object) =>
    Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const evidence = {
    _reconstruction:
      `${DISCLAIMER.replace(
        '{SOURCES}',
        'resources/knowledge/generated/agent-knowledge.json（build-agent-knowledge.mjs 对 ranges/sources 的展开结果，可逐字反向还原）',
      )} 本文件只保留 sources / ranges / diagrams 三个数据字段；diagrams 无来源，为空对象。`,
    sources: sortKeys(sources),
    ranges: sortKeys(ranges),
    diagrams: {},
  };
  await writeFile(resolve(dataDir, 'source-evidence.json'), `${json(evidence)}\n`, 'utf8');
  NOTES.push(
    `source-evidence.json：sources ${Object.keys(sources).length} 个文件，ranges ${Object.keys(ranges).length} 段依据，diagrams 空对象`,
  );
  GAPS.push('source-evidence.json 的 diagrams（复核图谱清单及其 sha256）无法从现有资源重建，留空');
}

/* ------------------------------------------------------------- flowchartCatalog */

function parseCatalogSnapshot(html) {
  const body = html.slice(html.indexOf('<body'));
  const groups = {};
  const entries = [];
  for (const section of body.matchAll(
    /<section class="section" data-group="([^"]+)">([\s\S]*?)<\/section>/g,
  )) {
    const [, group, inner] = section;
    const heading = /<h2>([\s\S]*?)<\/h2>/.exec(inner);
    requireField(heading, `分组 ${group} 缺少标题`);
    groups[group] = heading[1].replace(/^\s*\d+\s*/, '').trim();
    for (const card of inner.matchAll(/<article[\s\S]*?<\/article>/g)) {
      const text = card[0];
      entries.push({
        id: /<p class="id">([^<]*)<\/p>/.exec(text)[1],
        title: /<h3>([^<]*)<\/h3>/.exec(text)[1],
        type: /data-type="([^"]*)"/.exec(text)[1],
        typeLabel: /<span class="badge">([^<]*)<\/span>/.exec(text)[1],
        portalStatus: /data-status="([^"]*)"/.exec(text)[1],
        status: /<span class="status [^"]*">([^<]*)<\/span>/.exec(text)[1],
        chapter: Number(/<span class="chapter">第 (\d+) 章<\/span>/.exec(text)?.[1] ?? 0) || null,
        group,
        groupLabel: groups[group],
        snapshotCounts: [...text.matchAll(/<span>(\d+) (?:个对象|条关系)<\/span>/g)].map((m) =>
          Number(m[1]),
        ),
        links: [...text.matchAll(/<a class="link[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => ({
          href: m[1],
          label: m[2],
        })),
      });
    }
  }
  return { groups, entries };
}

function diagramSize(spec) {
  if (spec.diagram_type === 'sequence') return [spec.participants.length, spec.messages.length];
  if (spec.diagram_type === 'dataflow') return [spec.stages.length, spec.flows.length];
  if (spec.diagram_type === 'architecture') return [spec.components.length, spec.connections.length];
  return [spec.nodes.length, spec.edges.length];
}

/* ---------------------------------------------------------------- archifyData */

async function buildArchifyData() {
  const portalText = await flowsText('index.html');
  const marker = '<script id="data" type="application/json">';
  const start = portalText.indexOf(marker);
  requireField(start >= 0, 'index.html 未找到内嵌数据');
  const portal = JSON.parse(portalText.slice(start + marker.length, portalText.indexOf('</script>', start)));

  const refs = await flowsJSON('source-evidence.json');
  const signals = await flowsJSON('signal-inventory.json');
  // 内嵌载荷与 resources 下的同名资源必须一致，否则重建结果不可信。
  requireField(
    JSON.stringify(portal.refs) === JSON.stringify(refs),
    'index.html 的 refs 与 resources/knowledge/flows/source-evidence.json 不一致',
  );
  requireField(
    JSON.stringify(portal.signals) === JSON.stringify(signals),
    'index.html 的 signals 与 resources/knowledge/flows/signal-inventory.json 不一致',
  );

  const graphs = portal.graphs.map((graph) => {
    requireField(
      graph.slug && graph.title && Array.isArray(graph.nodes),
      `图谱 ${graph.slug} 结构不完整`,
    );
    return {
      slug: graph.slug,
      title: graph.title,
      nodes: graph.nodes.map((node) => {
        requireField(node.id && node.label, `图谱 ${graph.slug} 存在缺少 id/label 的节点`);
        return {
          id: node.id,
          label: node.label,
          refs: node.refs ?? [],
          ...(node.detail ? { detail: node.detail } : {}),
        };
      }),
      edges: graph.edges.map((edge) => {
        requireField(edge.id && edge.from && edge.to, `图谱 ${graph.slug} 存在缺少端点的关系`);
        return { ...edge };
      }),
      cards: graph.cards ?? [],
      ...(graph.validated === undefined ? {} : { validated: graph.validated }),
      ...(graph.diagnostic ? { diagnostic: graph.diagnostic } : {}),
      ...(graph.reviewDocument ? { reviewDocument: graph.reviewDocument } : {}),
    };
  });
  const graphBySlug = new Map(graphs.map((graph) => [graph.slug, graph]));

  // 图谱目录：以 flowchart-catalog.html（flowchart-catalog.json 的静态渲染结果）为骨架，
  // 数量与指纹按当前 *.archify.json / *.html 重算。
  const catalogText = await flowsText('flowchart-catalog.html');
  const snapshot = parseCatalogSnapshot(catalogText);
  const typeLabel = Object.fromEntries(snapshot.entries.map((entry) => [entry.type, entry.typeLabel]));
  const flowFiles = new Set(await readdir(flowsFile('')));
  const specFiles = [...flowFiles].filter((name) => name.endsWith('.archify.json'));
  const snapshotSpecs = new Set(
    snapshot.entries.map((entry) => entry.links.find((link) => link.label === '源规格')?.href).filter(Boolean),
  );

  const items = [];
  for (const entry of snapshot.entries) {
    const link = (label) => entry.links.find((item) => item.label === label)?.href;
    const specHref = link('源规格');
    const htmlHref = link('打开图页');
    const visualHref = link('视觉证据');
    const reviewHrefs = entry.links
      .filter((item) => item.label === '复核文档')
      .map((item) => item.href);
    requireField(htmlHref, `目录条目 ${entry.id} 缺少图页`);
    requireField(await exists(flowsFile(htmlHref)), `目录条目 ${entry.id} 的图页不存在：${htmlHref}`);
    const record = {
      id: entry.id,
      title: entry.title,
      type: entry.type,
      typeLabel: entry.typeLabel,
      group: entry.group,
      groupLabel: entry.groupLabel,
      chapter: entry.chapter,
      qualityProfile: null,
      nodeCount: null,
      relationCount: null,
      spec: null,
      html: `docs/archify/${htmlHref}`,
      visualCheck: visualHref ? `docs/archify/${visualHref}` : null,
      evidence: null,
      specSha256: null,
      htmlSha256: sha256(await readFile(flowsFile(htmlHref))),
      visualCheckSha256: visualHref ? sha256(await readFile(flowsFile(visualHref))) : null,
      evidenceSha256: null,
      portalStatus: entry.portalStatus,
      status: entry.status,
    };
    if (specHref) {
      const bytes = await readFile(flowsFile(specHref));
      const spec = JSON.parse(bytes.toString('utf8'));
      const [nodes, relations] = diagramSize(spec);
      if (
        entry.snapshotCounts.length &&
        (entry.snapshotCounts[0] !== nodes || entry.snapshotCounts[1] !== relations)
      )
        NOTES.push(
          `${entry.id}：快照 ${entry.snapshotCounts.join('/')}，当前规格 ${nodes}/${relations}（以规格为准）`,
        );
      if (spec.diagram_type && spec.diagram_type !== entry.type)
        NOTES.push(`${entry.id}：规格 diagram_type=${spec.diagram_type} 与快照类型 ${entry.type} 不同`);
      record.spec = `docs/archify/${specHref}`;
      record.specSha256 = sha256(bytes);
      record.nodeCount = nodes;
      record.relationCount = relations;
      record.qualityProfile = spec.meta?.quality_profile ?? null;
    }
    items.push({ record, reviewHrefs });
  }

  // 快照之后新增的规格：按同一规则补条目（分组取 diagram_type，主流程章节只由 index.html 内嵌 graphs 决定）。
  for (const file of specFiles) {
    if (snapshotSpecs.has(file)) continue;
    const base = file.replace(/\.archify\.json$/, '');
    const htmlHref =
      [`${base}.html`, `${base.replace(/\.(workflow|sequence|dataflow|architecture)$/, '')}.html`].find(
        (name) => flowFiles.has(name),
      ) ?? null;
    requireField(htmlHref, `新增规格 ${file} 没有对应图页，无法确定目录 id`);
    const id = htmlHref.replace(/\.html$/, '');
    if (items.some((item) => item.record.id === id)) continue;
    const bytes = await readFile(flowsFile(file));
    const spec = JSON.parse(bytes.toString('utf8'));
    const [nodes, relations] = diagramSize(spec);
    const visualHref = `${id}.visual-check.html`;
    const hasVisual = flowFiles.has(visualHref);
    requireField(typeLabel[spec.diagram_type], `规格 ${file} 的 diagram_type 未知：${spec.diagram_type}`);
    items.push({
      record: {
        id,
        title: spec.meta?.title ?? '',
        type: spec.diagram_type,
        typeLabel: typeLabel[spec.diagram_type],
        group: spec.diagram_type,
        groupLabel: snapshot.groups[spec.diagram_type] ?? '',
        chapter: null,
        qualityProfile: spec.meta?.quality_profile ?? null,
        nodeCount: nodes,
        relationCount: relations,
        spec: `docs/archify/${file}`,
        html: `docs/archify/${htmlHref}`,
        visualCheck: hasVisual ? `docs/archify/${visualHref}` : null,
        evidence: null,
        specSha256: sha256(bytes),
        htmlSha256: sha256(await readFile(flowsFile(htmlHref))),
        visualCheckSha256: hasVisual ? sha256(await readFile(flowsFile(visualHref))) : null,
        evidenceSha256: null,
        portalStatus: hasVisual ? 'delivered-visual-evidence' : 'delivered-visual-evidence-missing',
        status: hasVisual ? '已交付 · 有视觉证据' : '已交付 · 待视觉证据',
      },
      reviewHrefs: [],
    });
    NOTES.push(`${id}：快照未收录（规格 ${file}），按当前文件新增条目`);
  }

  const entries = items.map((item) => item.record);
  const flowchartCatalog = {
    // 原 flowchart-catalog.json 的 schemaVersion / generatedOn / validation 字段没有可追溯来源。
    schemaVersion: 1,
    title: /<title>([\s\S]*?)<\/title>/.exec(catalogText)[1],
    generatedOn: '',
    scope: /<h1>[^<]*<\/h1><p>([^<]*)<\/p>/.exec(catalogText)[1],
    groups: snapshot.groups,
    counts: Object.fromEntries(
      Object.keys(snapshot.groups).map((group) => [
        group,
        entries.filter((entry) => entry.group === group).length,
      ]),
    ),
    entries,
    validation: {},
  };

  const diagramRecords = {};
  for (const { record, reviewHrefs } of items) {
    const reviewDocuments = [...reviewHrefs];
    const graph = graphBySlug.get(record.id);
    if (graph?.reviewDocument && !reviewDocuments.includes(graph.reviewDocument))
      reviewDocuments.push(graph.reviewDocument);
    for (const document of reviewDocuments)
      requireField(
        await exists(flowsFile(document)),
        `目录条目 ${record.id} 的复核文档不存在：${document}`,
      );
    diagramRecords[record.id] = {
      htmlAvailable: await exists(flowsFile(record.html.replace(/^docs\/archify\//, ''))),
      reviewDocuments,
      visualAvailable: Boolean(record.visualCheck),
    };
  }

  NOTES.push(
    `flowchartCatalog：${entries.length} 个入口（快照 ${snapshot.entries.length}），分组 ${Object.entries(
      flowchartCatalog.counts,
    )
      .map(([group, count]) => `${group}=${count}`)
      .join(' ')}`,
  );
  NOTES.push(
    `archifyData：graphs ${graphs.length}，refs ${Object.keys(refs).length}，signals ${Object.keys(signals).length}，reviewSummary ${portal.reviewSummary.nodeIds.length}/${portal.reviewSummary.edgeIds.length}，resourceLinks ${portal.resourceLinks.length}`,
  );
  GAPS.push('archifyData.diagramNotes（图谱补充说明）没有可追溯来源，留空对象');
  GAPS.push('flowchartCatalog 的 schemaVersion 为重建常量，generatedOn 为空字符串，validation 为空对象');
  GAPS.push(
    '目录条目的 evidence / evidenceSha256 字段语义不可考（快照中的“复核文档”记入 diagramRecords.reviewDocuments），留空 null',
  );
  GAPS.push('diagramReadings（图谱阅读说明：用途 / 条件 / 异常）没有对应文本，全部留空字符串');

  return { graphs, refs, signals, reviewSummary: portal.reviewSummary, resourceLinks: portal.resourceLinks, flowchartCatalog, diagramRecords, entries };
}

async function writeArchifyData(data) {
  const content = `${header(
    [
      'resources/knowledge/flows/index.html 内嵌数据（graphs / reviewSummary / resourceLinks）',
      'resources/knowledge/flows/source-evidence.json（refs，已与内嵌数据核对一致）',
      'resources/knowledge/flows/signal-inventory.json（signals，已与内嵌数据核对一致）',
      'resources/knowledge/flows/flowchart-catalog.html 与各 *.archify.json / *.html（flowchartCatalog / diagramRecords，数量与指纹按当前文件重算）',
    ].join('；'),
    ['无法重建的部分：diagramNotes、flowchartCatalog.validation / generatedOn、evidence 与 evidenceSha256。'],
  )}import type {
  ArchifyData,
  EvidenceRef,
  FlowchartCatalog,
  FlowGraph,
  ResourceLink,
  ReviewSummary,
  SignalDefinition,
} from '../types';

const graphs: FlowGraph[] = ${json(data.graphs)};

const refs: Record<string, EvidenceRef> = ${json(data.refs)};

const signals: Record<string, SignalDefinition> = ${json(data.signals)};

const reviewSummary: ReviewSummary = ${json(data.reviewSummary)};

const resourceLinks: ResourceLink[] = ${json(data.resourceLinks)};

const flowchartCatalog: FlowchartCatalog = ${json(data.flowchartCatalog)};

const diagramRecords: ArchifyData['diagramRecords'] = ${json(data.diagramRecords)};

export const archifyData: ArchifyData = {
  graphs,
  refs,
  signals,
  reviewSummary,
  resourceLinks,
  flowchartCatalog,
  diagramNotes: {},
  diagramRecords,
};
`;
  await writeFile(resolve(dataDir, 'archifyData.ts'), content, 'utf8');
}

/* --------------------------------------------------------------- presentation */

async function writePresentation(guides, entries) {
  const topics = [
    {
      id: 'architecture',
      diagrams: entries.filter((entry) => entry.group === 'architecture').map((entry) => entry.id),
    },
    ...guides.map((guide) => ({ id: guide.topic, diagrams: [...guide.diagrams] })),
  ];
  const content = `${header(
    'frontend/src/features/knowledge/reviews/*.ts 的 guide.topic 与 guide.diagrams（专题 id 与已复核绑定的图谱）；architecture 专题取自 resources/knowledge/flows/flowchart-catalog.html 中 data-group="architecture" 的条目',
    [
      '原文件的人工撰写文案（title / summary / purpose / conditions / exceptions）无法从现有资源忠实重建，全部留空。',
      '专题顺序按 sourceGuides.ts 的数组顺序，architecture 置首（与展示页“从系统全局到生产”的入口一致；原顺序不可考）。',
    ],
  )}export interface PresentationTopic {
  id: string;
  title: string;
  summary: string;
  purpose: string;
  conditions: string[];
  exceptions: string[];
  diagrams: string[];
}

// 文案没有可追溯来源，统一留空，避免把重建数据当成人工复核结论。
export const presentationTopics: PresentationTopic[] = ${json(
    topics.map((topic) => ({
      id: topic.id,
      title: '',
      summary: '',
      purpose: '',
      conditions: [],
      exceptions: [],
      diagrams: topic.diagrams,
    })),
  )};

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
  const text = typeof title === 'string' ? title.replace(/^\\s*\\d+\\s*·\\s*/, '').trim() : '';
  return text || (typeof id === 'string' ? id : '');
}
`;
  await writeFile(resolve(dataDir, 'presentation.ts'), content, 'utf8');
  NOTES.push(
    `presentation.ts：${topics.length} 个专题（${topics
      .map((topic) => `${topic.id}=${topic.diagrams.length}`)
      .join(' ')}），文案字段全部留空`,
  );
  GAPS.push('presentationTopics 的 title / summary / purpose / conditions / exceptions 无法重建，全部留空');
}

/* ------------------------------------------------------------- diagramReading */

async function writeDiagramReading(entries) {
  const readings = Object.fromEntries(
    entries.map((entry) => [entry.id, { summary: '', condition: '', exception: '' }]),
  );
  const content = `${header(
    'resources/knowledge/flows/flowchart-catalog.html 的图谱目录条目（只提供 id，用于保证每个可打开条目都有阅读条目）',
    ['原文件的阅读说明文字（用途 / 条件 / 异常）在现有资源中没有对应来源，全部留空字符串。'],
  )}import type { FlowchartCatalogEntry } from '../types';

export interface DiagramReading {
  summary: string;
  condition: string;
  exception: string;
}

// 目录中的每个条目都保留空说明，避免 UI 读取未登记条目时崩溃；文字留空而不编写推测内容。
export const diagramReadings: Record<string, DiagramReading> = ${json(readings)};

// 全函数：任意输入都返回布尔值；只有“HTML 补充页”（无独立规格）算作补充资料。
export function isSupportingEntry(entry: FlowchartCatalogEntry | null | undefined): boolean {
  return entry?.type === 'supplemental';
}
`;
  await writeFile(resolve(dataDir, 'diagramReading.ts'), content, 'utf8');
  NOTES.push(`diagramReading.ts：${entries.length} 个空阅读条目`);
}

/* ------------------------------------------------------------------------ run */

await mkdir(dataDir, { recursive: true });
await buildSourceEvidence();
const data = await buildArchifyData();
await writeArchifyData(data);

const { sourceGuides } = await import('../../src/features/knowledge/sourceGuides.ts');
const catalogIds = new Set(data.entries.map((entry) => entry.id));
for (const guide of sourceGuides)
  for (const diagram of guide.diagrams)
    if (!catalogIds.has(diagram)) GAPS.push(`review guide ${guide.id} 绑定的图谱 ${diagram} 不在目录中`);
await writePresentation(sourceGuides, data.entries);
await writeDiagramReading(data.entries);

console.log('重建完成：');
for (const note of NOTES) console.log(`  · ${note}`);
console.log('留空或需要原始文件覆盖：');
for (const gap of GAPS) console.log(`  · ${gap}`);
