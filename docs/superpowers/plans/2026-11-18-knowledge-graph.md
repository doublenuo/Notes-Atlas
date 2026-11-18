---
date: 2026-11-18 22:43:18
title: 2026-11-18-knowledge-graph
---
# 知识网络（反向链接与相关笔记）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [x]`）语法来跟踪进度。

**目标：** 构建期为每篇正文页生成「相关笔记」与「被引用」，通过 `transformPageData` 注入页面数据，在文末 `doc-after` 插槽 SSR 渲染，零客户端请求。

**架构：** 新增纯函数模块 `docs/.vitepress/plugins/knowledgeGraph.ts`，在 config 加载时扫描一次全部 md，产出 `Map<rel, Connections>`；config 的 `transformPageData` 把结果挂到 `pageData.connections`；`ArticleConnections.vue` 从 `useData().page` 读取并渲染。链接提取对齐 `obsidianEmbed.js` 的渲染规则，URL 一律复用 `permalinks.ts` 的 `PageInfo.url`。

**技术栈：** VitePress 1.6.4、Vue 3.5、gray-matter、Node 24 类型剥离 + `node --test`、TypeScript。

**规格：** `docs/superpowers/specs/2026-11-18-knowledge-graph-design.md`

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `docs/.vitepress/plugins/knowledgeGraph.ts` | 创建 | 纯函数：链接提取、页面元数据、反链、相关度评分、图构建 |
| `docs/.vitepress/permalinks.ts` | 修改 `:101` | `stripOrdinal` 加 `export`，供 section 命名复用 |
| `docs/.vitepress/config.ts` | 修改 | 加载期建图 + 注册 `transformPageData` |
| `docs/.vitepress/theme/index.ts` | 修改 | 引入组件并挂到 `doc-after` 插槽 |
| `docs/.vitepress/theme/components/ArticleConnections.vue` | 创建 | 展示「相关笔记 / 被引用」 |
| `tests/knowledge-graph.test.mjs` | 创建 | 纯函数单测（临时 vault） |

任务拆分原则：先纯函数（可测），再接线（config），最后展示（组件）。每个任务结束都能独立运行测试或构建。

---

## 任务 1：链接扫描纯函数

**文件：**
- 创建：`docs/.vitepress/plugins/knowledgeGraph.ts`
- 创建：`tests/knowledge-graph.test.mjs`

- [x] **步骤 1：编写失败的测试**

创建 `tests/knowledge-graph.test.mjs`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractWikiLinks,
  ownProseLength,
} from "../docs/.vitepress/plugins/knowledgeGraph.ts";

test("extractWikiLinks：独立行嵌入计入，行中嵌入不计入", () => {
  assert.deepEqual(extractWikiLinks("![[Alpha]]\n"), ["Alpha"]);
  assert.deepEqual(extractWikiLinks("前文 ![[Alpha]] 后文"), []);
});

test("extractWikiLinks：行内链接可多个，空目标不计入", () => {
  assert.deepEqual(extractWikiLinks("见 [[Alpha]] 与 [[Beta]]"), ["Alpha", "Beta"]);
  assert.deepEqual(extractWikiLinks("[[   ]]"), []);
});

test("extractWikiLinks：别名、锚点、跨行都不计入", () => {
  assert.deepEqual(extractWikiLinks("[[Alpha|别名]] [[Alpha#小节]]"), []);
  assert.deepEqual(extractWikiLinks("[[Alpha\n下一行]]"), []);
});

test("extractWikiLinks：围栏代码与行内代码不计入", () => {
  const src = ["```md", "[[Alpha]]", "```", "正文 `[[Beta]]` 结束"].join("\n");
  assert.deepEqual(extractWikiLinks(src), []);
});

test("ownProseLength：剔除独立行嵌入后计数", () => {
  assert.equal(ownProseLength("![[A]]\n![[B]]\n"), 0);
  const prose = "正文".repeat(60);
  assert.equal(ownProseLength(`![[A]]\n${prose}`), 120);
});
```

- [x] **步骤 2：运行测试验证失败**

运行：`node --test tests/knowledge-graph.test.mjs`

预期：FAIL，`ERR_MODULE_NOT_FOUND`（`knowledgeGraph.ts` 不存在）。

- [x] **步骤 3：编写最少实现**

创建 `docs/.vitepress/plugins/knowledgeGraph.ts`：

```ts
/**
 * 构建期知识网络索引：反向链接与相关笔记。
 * 规格：docs/superpowers/specs/2026-11-18-knowledge-graph-design.md
 */

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** 剔除行内代码（含多反引号），用等长空格占位，避免后续误判为链接 */
function stripInlineCode(line: string): string {
  return line.replace(/(`+)([\s\S]*?)\1/g, (match) => " ".repeat(match.length));
}

/** 提取正文中的 wiki 目标（与 obsidianEmbed 渲染规则对齐；去重与自引用由调用方处理） */
export function extractWikiLinks(src: string): string[] {
  const targets: string[] = [];
  let fence: { char: string; len: number } | null = null;

  for (const raw of src.split("\n")) {
    const fenceMatch = raw.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!fence) {
        // ``` 的 info string 含反引号时按 CommonMark 不算开栏
        if (char === "~" || !fenceMatch[2].includes("`")) {
          fence = { char, len };
          continue;
        }
      } else if (char === fence.char && len >= fence.len && fenceMatch[2].trim() === "") {
        fence = null;
        continue;
      }
      if (fence) continue;
    }
    if (fence) continue;

    const line = stripInlineCode(raw);
    const re = /(!?)\[\[([^\[\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const target = match[2].trim();
      if (!target || target.includes("|") || target.includes("#")) continue;
      const indent = raw.match(/^ */)?.[0].length ?? 0;
      const standalone = indent < 4 && raw.trim() === match[0];
      if (match[1] === "!" && !standalone) continue;
      targets.push(target);
    }
  }
  return targets;
}

/** 自有正文长度：剔除独立行 ![[...]] 后 trim 的字符数 */
export function ownProseLength(src: string): number {
  return src
    .split("\n")
    .filter((line) => !/^ {0,3}!\[\[[^\]\n]+\]\]\s*$/.test(line))
    .join("\n")
    .trim().length;
}
```

- [x] **步骤 4：运行测试验证通过**

运行：`node --test tests/knowledge-graph.test.mjs`

预期：PASS（5 个测试）。

- [x] **步骤 5：Commit**

```bash
git add docs/.vitepress/plugins/knowledgeGraph.ts tests/knowledge-graph.test.mjs
git commit -m "feat: 添加知识网络链接扫描工具"
```

---

## 任务 2：页面元数据、出链与反链

**文件：**
- 修改：`docs/.vitepress/plugins/knowledgeGraph.ts`（顶部 import、追加类型与图构建）
- 修改：`docs/.vitepress/permalinks.ts:101`
- 修改：`tests/knowledge-graph.test.mjs`（替换 import、加 helper 与反链测试）

- [x] **步骤 1：追加失败的测试**

把 `tests/knowledge-graph.test.mjs` 顶部的 import 替换为：

```js
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { collectPages } from "../docs/.vitepress/permalinks.ts";
import {
  buildKnowledgeGraph,
  extractWikiLinks,
  ownProseLength,
} from "../docs/.vitepress/plugins/knowledgeGraph.ts";
```

在 import 之后加入 helper：

```js
const roots = [];
after(() => roots.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const PROSE = "这是一段用于测试的正文。".repeat(20); // 260 字符

function note(title, body, meta = {}) {
  const lines = ["---", `title: ${title}`];
  if (meta.tags) lines.push(`tags: [${meta.tags.join(", ")}]`);
  if (meta.categories) lines.push(`categories: [${meta.categories.join(", ")}]`);
  if (meta.permalink) lines.push(`permalink: ${meta.permalink}`);
  if (meta.date) lines.push(`date: ${meta.date}`);
  if (meta.layout) lines.push(`layout: ${meta.layout}`);
  if (meta.article === false) lines.push("article: false");
  lines.push("---", "");
  return `${lines.join("\n")}\n${body}\n`;
}

function makeVault(files) {
  const root = mkdtempSync(join(tmpdir(), "na-kg-"));
  roots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  const pages = collectPages(root);
  return { root, pages, graph: buildKnowledgeGraph(root, pages) };
}

function backlinkRels(graph, rel) {
  return graph.get(rel).backlinks.map((item) => item.rel);
}
```

在文件末尾追加：

```js
test("buildKnowledgeGraph：裸名与相对路径都能解析成反链", () => {
  const { graph } = makeVault({
    "02.学习笔记/Alpha.md": note("Alpha", `${PROSE}\n\n见 [[Beta]] 与 [[./子目录/Delta]]`),
    "02.学习笔记/Beta.md": note("Beta", PROSE),
    "02.学习笔记/子目录/Delta.md": note("Delta", PROSE),
    "02.学习笔记/子目录/Gamma.md": note("Gamma", `${PROSE}\n\n见 [[./Delta]]`),
  });
  assert.deepEqual(backlinkRels(graph, "02.学习笔记/Beta.md"), ["02.学习笔记/Alpha.md"]);
  assert.deepEqual(
    backlinkRels(graph, "02.学习笔记/子目录/Delta.md").sort(),
    ["02.学习笔记/Alpha.md", "02.学习笔记/子目录/Gamma.md"],
  );
});

test("buildKnowledgeGraph：空壳页不作来源，纯嵌入的组会页可以作来源", () => {
  const { graph } = makeVault({
    "02.学习笔记/Beta.md": note("Beta", PROSE),
    "01.组会材料/01.组会内容/组会.md": note("组会", "![[Beta]]", { tags: ["强化学习"] }),
    "02.学习笔记/空壳.md": note("空壳", "", { tags: ["强化学习"] }),
  });
  assert.deepEqual(backlinkRels(graph, "02.学习笔记/Beta.md"), ["01.组会材料/01.组会内容/组会.md"]);
});

test("buildKnowledgeGraph：同一目标多次引用只计一条，自引用忽略", () => {
  const { graph } = makeVault({
    "02.学习笔记/A.md": note("A", `${PROSE}\n\n[[A]] [[A]]\n\n[[B]]\n\n![[B]]`),
    "02.学习笔记/B.md": note("B", PROSE),
  });
  assert.deepEqual(backlinkRels(graph, "02.学习笔记/A.md"), []);
  assert.equal(graph.get("02.学习笔记/B.md").backlinks.length, 1);
});

test("buildKnowledgeGraph：行中 ![[...]] 不产生反链", () => {
  const { graph } = makeVault({
    "02.学习笔记/A.md": note("A", `${PROSE}\n\n前文 ![[B]] 后文`),
    "02.学习笔记/B.md": note("B", PROSE),
  });
  assert.deepEqual(graph.get("02.学习笔记/B.md").backlinks, []);
});

test("buildKnowledgeGraph：反链按日期倒序，无日期排最后", () => {
  const { graph } = makeVault({
    "03.其他/S1.md": note("S1", `${PROSE}\n\n[[T]]`, { date: "2026-01-01" }),
    "03.其他/S2.md": note("S2", `${PROSE}\n\n[[T]]`, { date: "2026-02-01" }),
    "03.其他/S3.md": note("S3", `${PROSE}\n\n[[T]]`),
    "03.其他/T.md": note("T", PROSE),
  });
  assert.deepEqual(backlinkRels(graph, "03.其他/T.md"), [
    "03.其他/S2.md",
    "03.其他/S1.md",
    "03.其他/S3.md",
  ]);
});

test("buildKnowledgeGraph：URL 复用 permalink，首页映射为 /", () => {
  const { graph } = makeVault({
    "03.其他/X.md": note("X", `${PROSE}\n\n[[T]]`, { permalink: "/custom/x" }),
    "03.其他/T.md": note("T", `${PROSE}\n\n[[index]]`),
    "index.md": note("首页", PROSE, { layout: "home" }),
  });
  assert.equal(graph.get("03.其他/T.md").backlinks[0].url, "/custom/x");
  assert.equal(graph.get("index.md").backlinks[0].url, "/");
});

test("buildKnowledgeGraph：无关系页面返回空结构", () => {
  const { graph } = makeVault({
    "04.随笔/Z.md": note("Z", PROSE),
  });
  assert.deepEqual(graph.get("04.随笔/Z.md"), { backlinks: [], related: [] });
});
```

- [x] **步骤 2：运行测试验证失败**

运行：`node --test tests/knowledge-graph.test.mjs`

预期：FAIL，`buildKnowledgeGraph is not a function` 或模块导出缺失。

- [x] **步骤 3：实现元数据与反链**

在 `docs/.vitepress/permalinks.ts:101` 把：

```ts
function stripOrdinal(name: string) {
```

改为：

```ts
export function stripOrdinal(name: string) {
```

在 `docs/.vitepress/plugins/knowledgeGraph.ts` 顶部（文件注释之后）加入 import：

```ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { createResolver } from "./obsidianEmbed.js";
// 带 .ts 扩展名：node --test 直接加载本插件时不做扩展名补全
import { stripOrdinal } from "../permalinks.ts";
import type { PageInfo } from "../permalinks.ts";
```

在 `ownProseLength` 之后追加：

```ts
export interface NoteRef {
  /** 相对 docs 的 posix 路径 */
  rel: string;
  /** 站内绝对路径，以 / 开头 */
  url: string;
  title: string;
  /** 人类可读分区，如「学习笔记 · 强化学习基础」 */
  section: string;
}

export interface RelatedNote extends NoteRef {
  /** 如「共同标签：强化学习」 */
  reason: string;
}

export interface Connections {
  backlinks: NoteRef[];
  related: RelatedNote[];
}

export const EMPTY_CONNECTIONS: Connections = { backlinks: [], related: [] };

interface PageMeta {
  rel: string;
  url: string;
  title: string;
  section: string;
  dir: string;
  tags: string[];
  categories: string[];
  date: number;
  isArticle: boolean;
  body: string;
  ownProse: number;
  links: Set<string>;
}

function toStringList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function toTimestamp(value: unknown): number {
  if (value === undefined || value === null || value === "") return Number.NEGATIVE_INFINITY;
  const time = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

/** 目录 → 分区名：顶层 + 末级，去掉序号前缀；只有一级时只显示一级 */
function sectionOfDir(dir: string): string {
  if (!dir || dir === ".") return "";
  const parts = dir.split("/").filter(Boolean).map(stripOrdinal);
  if (parts.length <= 1) return parts[0] ?? "";
  return parts[0] === parts[parts.length - 1] ? parts[0] : `${parts[0]} · ${parts[parts.length - 1]}`;
}

function pageUrl(url: string): string {
  return url === "index" ? "/" : `/${url}`;
}

/** 日期倒序；缺失日期（-Infinity）排在最后 */
function compareDate(a: number, b: number): number {
  if (a === b) return 0;
  const left = Number.isFinite(a) ? a : -Infinity;
  const right = Number.isFinite(b) ? b : -Infinity;
  return right - left;
}

function toNoteRef(meta: PageMeta): NoteRef {
  return { rel: meta.rel, url: meta.url, title: meta.title, section: meta.section };
}

export function buildKnowledgeGraph(docsRoot: string, pages: PageInfo[]): Map<string, Connections> {
  try {
    return build(docsRoot, pages);
  } catch (error) {
    console.warn("[knowledgeGraph] 知识网络索引构建失败，已跳过：", error);
    return new Map();
  }
}

function build(docsRoot: string, pages: PageInfo[]): Map<string, Connections> {
  const resolver = createResolver(docsRoot);
  const metas = new Map<string, PageMeta>();

  for (const page of pages) {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(docsRoot, page.rel), "utf8").replace(/\r\n?/g, "\n");
    } catch {
      continue;
    }
    let data: Record<string, unknown> = {};
    let body = raw;
    try {
      const parsed = matter(raw);
      data = parsed.data as Record<string, unknown>;
      body = parsed.content;
    } catch {
      // 畸形 frontmatter：按无元数据正文继续，索引不阻断构建
    }
    const layout = typeof data.layout === "string" ? data.layout : "";
    metas.set(page.rel, {
      rel: page.rel,
      url: pageUrl(page.url),
      title: page.title,
      section: sectionOfDir(page.dir),
      dir: page.dir,
      tags: toStringList(data.tags),
      categories: toStringList(data.categories),
      date: toTimestamp(data.date),
      isArticle: data.article !== false && (layout === "" || layout === "doc"),
      body,
      ownProse: ownProseLength(body),
      links: new Set<string>(),
    });
  }

  // 出链：只从正文页提取，目标必须是 PAGES 中的页面
  for (const meta of metas.values()) {
    if (!meta.isArticle || !meta.body.trim()) continue;
    const host = path.join(docsRoot, meta.rel);
    for (const target of extractWikiLinks(meta.body)) {
      const found = resolver(target, host);
      if (!found) continue;
      const rel = found.relPath.split(path.sep).join("/");
      if (rel !== meta.rel && metas.has(rel)) meta.links.add(rel);
    }
  }

  // 反链：来源门槛 = 正文非空 + 正文页（组会页符合）
  const backlinkSources = new Map<string, PageMeta[]>();
  for (const meta of metas.values()) {
    if (!meta.isArticle || !meta.body.trim()) continue;
    for (const rel of meta.links) {
      const sources = backlinkSources.get(rel) ?? [];
      if (!sources.includes(meta)) sources.push(meta);
      backlinkSources.set(rel, sources);
    }
  }

  const graph = new Map<string, Connections>();
  for (const meta of metas.values()) {
    const sources = (backlinkSources.get(meta.rel) ?? [])
      .slice()
      .sort((a, b) => compareDate(a.date, b.date) || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
    graph.set(meta.rel, { backlinks: sources.map(toNoteRef), related: [] });
  }
  return graph;
}
```

> 说明：本任务先交付反链，`related` 暂时为空数组；任务 3 用 TDD 补上相关度评分。

- [x] **步骤 4：运行测试验证通过**

运行：`node --test tests/knowledge-graph.test.mjs`

预期：PASS（12 个测试）。

- [x] **步骤 5：Commit**

```bash
git add docs/.vitepress/permalinks.ts docs/.vitepress/plugins/knowledgeGraph.ts tests/knowledge-graph.test.mjs
git commit -m "feat: 构建知识网络反链索引"
```

---

## 任务 3：相关笔记评分

**文件：**
- 修改：`docs/.vitepress/plugins/knowledgeGraph.ts`（追加 `rankRelated` 并接入 `build`）
- 修改：`tests/knowledge-graph.test.mjs`（追加相关笔记测试）

- [x] **步骤 1：追加失败的测试**

在 `tests/knowledge-graph.test.mjs` 末尾追加：

```js
test("buildKnowledgeGraph：相关候选剔除自有正文不足 100 字的页面", () => {
  const { graph } = makeVault({
    "02.学习笔记/A.md": note("A", PROSE, { tags: ["强化学习"] }),
    "02.学习笔记/组会.md": note("组会", "![[A]]", { tags: ["强化学习"] }),
    "02.学习笔记/B.md": note("B", PROSE, { tags: ["强化学习"] }),
  });
  const relatedRels = graph.get("02.学习笔记/A.md").related.map((item) => item.rel);
  assert.ok(relatedRels.includes("02.学习笔记/B.md"));
  assert.ok(!relatedRels.includes("02.学习笔记/组会.md"));
});

test("buildKnowledgeGraph：共同标签按 IDF 加权，罕见标签优先", () => {
  const { graph } = makeVault({
    "03.其他/Main.md": note("Main", PROSE, { tags: ["大", "罕见"] }),
    "03.其他/Rare.md": note("Rare", PROSE, { tags: ["罕见"] }),
    "03.其他/Big1.md": note("Big1", PROSE, { tags: ["大"] }),
    "03.其他/Big2.md": note("Big2", PROSE, { tags: ["大"] }),
    "03.其他/Big3.md": note("Big3", PROSE, { tags: ["大"] }),
    "03.其他/Big4.md": note("Big4", PROSE, { tags: ["大"] }),
  });
  const related = graph.get("03.其他/Main.md").related;
  assert.equal(related[0].rel, "03.其他/Rare.md");
  assert.equal(related[0].reason, "共同标签：罕见");
});

test("buildKnowledgeGraph：reason 优先级 互相引用 > 本页引用 > 引用了本页 > 共同标签 > 同目录", () => {
  const { graph } = makeVault({
    "02.学习笔记/A.md": note("A", `${PROSE}\n\n[[B]] [[F]]`, { tags: ["强化学习"] }),
    "02.学习笔记/B.md": note("B", `${PROSE}\n\n[[A]]`, { tags: ["强化学习"] }),
    "02.学习笔记/C.md": note("C", PROSE, { tags: ["强化学习"] }),
    "02.学习笔记/D.md": note("D", PROSE),
    "02.学习笔记/E.md": note("E", `${PROSE}\n\n[[A]]`),
    "02.学习笔记/其他/F.md": note("F", PROSE),
  });
  const reasons = Object.fromEntries(
    graph.get("02.学习笔记/A.md").related.map((item) => [item.rel, item.reason]),
  );
  assert.equal(reasons["02.学习笔记/B.md"], "互相引用");
  assert.equal(reasons["02.学习笔记/其他/F.md"], "本页引用");
  assert.equal(reasons["02.学习笔记/E.md"], "引用了本页");
  assert.equal(reasons["02.学习笔记/C.md"], "共同标签：强化学习");
  assert.equal(reasons["02.学习笔记/D.md"], "同目录");
});

test("buildKnowledgeGraph：section 取顶层与末级目录并去序号", () => {
  const { graph } = makeVault({
    "02.学习笔记/T.md": note("T", PROSE, { tags: ["强化学习"] }),
    "02.学习笔记/06.强化学习基础/Deep.md": note("Deep", PROSE, { tags: ["强化学习"] }),
  });
  assert.equal(graph.get("02.学习笔记/T.md").related[0].section, "学习笔记 · 强化学习基础");
});

test("buildKnowledgeGraph：相关笔记最多 5 条", () => {
  const files = { "02.学习笔记/T.md": note("T", PROSE, { tags: ["强化学习"] }) };
  for (let i = 1; i <= 7; i += 1) {
    files[`02.学习笔记/P${i}.md`] = note(`P${i}`, PROSE, { tags: ["强化学习"] });
  }
  const { graph } = makeVault(files);
  assert.equal(graph.get("02.学习笔记/T.md").related.length, 5);
});
```

- [x] **步骤 2：运行测试验证失败**

运行：`node --test tests/knowledge-graph.test.mjs`

预期：FAIL，新增的 5 个测试因 `related` 恒为空而失败。

- [x] **步骤 3：实现评分**

在 `docs/.vitepress/plugins/knowledgeGraph.ts` 的 `toNoteRef` 之后、`buildKnowledgeGraph` 之前插入：

```ts
/** 共同标签里 df 最小的那个（IDF 最高），用于 reason 文案 */
function rarestTag(tags: string[], tagDf: Map<string, number>): string {
  return tags
    .slice()
    .sort((a, b) => (tagDf.get(a) ?? 1) - (tagDf.get(b) ?? 1) || a.localeCompare(b))[0];
}

/**
 * 相关度：4×直接引用 + Σ 1/ln(1+df) + 2×同分类 + 1.5×同目录 + 0.5×同分区
 * 入选门槛：直接引用 / 共同标签 / 同目录 至少一项；候选必须自有正文 >100 字。
 */
function rankRelated(meta: PageMeta, candidates: PageMeta[], tagDf: Map<string, number>): RelatedNote[] {
  const scored: { score: number; meta: PageMeta; reason: string }[] = [];

  for (const cand of candidates) {
    if (cand.rel === meta.rel) continue;
    const outgoing = meta.links.has(cand.rel);
    const incoming = cand.links.has(meta.rel);
    const direct = Number(outgoing) + Number(incoming);
    const sharedTags = meta.tags.filter((tag) => cand.tags.includes(tag));
    const sameDir = meta.dir === cand.dir;
    if (direct === 0 && sharedTags.length === 0 && !sameDir) continue;

    let score = 4 * direct;
    for (const tag of sharedTags) score += 1 / Math.log(1 + (tagDf.get(tag) ?? 1));
    if (meta.categories.some((name) => cand.categories.includes(name))) score += 2;
    if (sameDir) score += 1.5;
    if (meta.rel.split("/")[0] === cand.rel.split("/")[0]) score += 0.5;

    const reason = direct === 2
      ? "互相引用"
      : outgoing
        ? "本页引用"
        : incoming
          ? "引用了本页"
          : sharedTags.length
            ? `共同标签：${rarestTag(sharedTags, tagDf)}`
            : "同目录";
    scored.push({ score, meta: cand, reason });
  }

  scored.sort((a, b) =>
    b.score - a.score ||
    compareDate(a.meta.date, b.meta.date) ||
    a.meta.title.localeCompare(b.meta.title, "zh-CN"));
  return scored.slice(0, 5).map(({ meta: cand, reason }) => ({ ...toNoteRef(cand), reason }));
}
```

把 `build` 中的这段：

```ts
  const graph = new Map<string, Connections>();
  for (const meta of metas.values()) {
    const sources = (backlinkSources.get(meta.rel) ?? [])
      .slice()
      .sort((a, b) => compareDate(a.date, b.date) || a.rel.localeCompare(b.rel));
    graph.set(meta.rel, { backlinks: sources.map(toNoteRef), related: [] });
  }
  return graph;
```

改为：

```ts
  const tagDf = new Map<string, number>();
  for (const meta of metas.values()) {
    for (const tag of meta.tags) tagDf.set(tag, (tagDf.get(tag) ?? 0) + 1);
  }
  const candidates = [...metas.values()].filter((meta) => meta.isArticle && meta.ownProse > 100);

  const graph = new Map<string, Connections>();
  for (const meta of metas.values()) {
    const sources = (backlinkSources.get(meta.rel) ?? [])
      .slice()
      .sort((a, b) => compareDate(a.date, b.date) || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
    const related = meta.isArticle && meta.body.trim()
      ? rankRelated(meta, candidates, tagDf)
      : [];
    graph.set(meta.rel, { backlinks: sources.map(toNoteRef), related });
  }
  return graph;
```

- [x] **步骤 4：运行测试验证通过**

运行：`node --test tests/knowledge-graph.test.mjs`

预期：PASS（33 个测试）。

- [x] **步骤 5：Commit**

```bash
git add docs/.vitepress/plugins/knowledgeGraph.ts tests/knowledge-graph.test.mjs
git commit -m "feat: 计算相关笔记并输出可解释原因"
```

---

## 任务 4：接入 config 的 transformPageData

**文件：**
- 修改：`docs/.vitepress/config.ts:8`（import）
- 修改：`docs/.vitepress/config.ts:27-28`（建图）
- 修改：`docs/.vitepress/config.ts:88-94`（注册钩子）

- [x] **步骤 1：接入**

在 `docs/.vitepress/config.ts` 的 `permalinks` import 之后加：

```ts
import { buildKnowledgeGraph, EMPTY_CONNECTIONS } from './plugins/knowledgeGraph'
```

在 `const PAGES = collectPages(DOCS_ROOT)` 之后加：

```ts
// 知识网络：构建期算一次，随页面数据 SSR 下发。失败时返回空 Map，不影响构建。
const KNOWLEDGE = buildKnowledgeGraph(DOCS_ROOT, PAGES)
```

在 `buildEnd: katexGuard(),` 之前加：

```ts
  // 知识网络：没有关系的页面也写入空结构，保证客户端读取时类型稳定
  transformPageData(pageData) {
    // rewrites 下 relativePath 是目标路径，filePath 才是磁盘源路径
    const rel = pageData.filePath || pageData.relativePath
    return { connections: KNOWLEDGE.get(rel) ?? EMPTY_CONNECTIONS }
  },
```

- [x] **步骤 2：验证真实库索引规模**

运行：

```bash
node --input-type=module -e "
const { collectPages } = await import('./docs/.vitepress/permalinks.ts');
const { buildKnowledgeGraph } = await import('./docs/.vitepress/plugins/knowledgeGraph.ts');
const graph = buildKnowledgeGraph('docs', collectPages('docs'));
const values = [...graph.values()];
console.log({
  pages: graph.size,
  withBacklinks: values.filter((v) => v.backlinks.length > 0).length,
  withRelated: values.filter((v) => v.related.length > 0).length,
  maxBacklinks: Math.max(...values.map((v) => v.backlinks.length)),
});
"
```

预期：`pages: 362`；`withBacklinks` > 0；`withRelated` 为数百；无异常抛出。数值记入 PR 说明。

- [x] **步骤 3：验证构建通过**

运行：`pnpm docs:build`

预期：构建成功（exit 0），无 `[knowledgeGraph]` 告警。

- [x] **步骤 4：验证页面数据已注入**

运行：

```bash
grep -rl 'connections' docs/.vitepress/dist/assets --include='*.js' | head -5
```

预期：能列出若干 `.md.<hash>.js` 页面 chunk。

- [x] **步骤 5：Commit**

```bash
git add docs/.vitepress/config.ts
git commit -m "feat: 将知识网络索引注入页面数据"
```

---

## 任务 5：展示组件与插槽

**文件：**
- 创建：`docs/.vitepress/theme/components/ArticleConnections.vue`
- 修改：`docs/.vitepress/theme/index.ts:23`（import）
- 修改：`docs/.vitepress/theme/index.ts:214`（插槽）

- [x] **步骤 1：创建组件**

创建 `docs/.vitepress/theme/components/ArticleConnections.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { Connections, NoteRef } from '../../plugins/knowledgeGraph'

const { page } = useData()

const isArticle = computed(() => {
  const frontmatter = page.value.frontmatter
  return frontmatter.article !== false
    && (frontmatter.layout === undefined || frontmatter.layout === 'doc')
})

// transformPageData 注入的字段不在 PageData 官方类型里，集中在这里断言一次
const connections = computed<Connections>(() =>
  (page.value as unknown as { connections?: Connections }).connections
  ?? { backlinks: [], related: [] },
)

const related = computed(() => (isArticle.value ? connections.value.related : []))
const backlinks = computed(() => (isArticle.value ? connections.value.backlinks : []))
const visibleBacklinks = computed(() => backlinks.value.slice(0, 5))
const restBacklinks = computed(() => backlinks.value.slice(5))

const hrefOf = (item: NoteRef) => withBase(item.url)
</script>

<template>
  <nav v-if="related.length || backlinks.length" class="na-knowledge no-print" aria-label="知识网络">
    <section v-if="related.length" class="na-knowledge__section">
      <h2 class="na-knowledge__title">相关笔记</h2>
      <ul class="na-knowledge__list">
        <li v-for="item in related" :key="item.rel" class="na-knowledge__item">
          <a class="na-knowledge__link" :href="hrefOf(item)">{{ item.title }}</a>
          <span class="na-knowledge__meta">
            {{ item.section }}<template v-if="item.section && item.reason"> · </template>{{ item.reason }}
          </span>
        </li>
      </ul>
    </section>

    <section v-if="backlinks.length" class="na-knowledge__section">
      <h2 class="na-knowledge__title">
        被引用 <span class="na-knowledge__count">· {{ backlinks.length }}</span>
      </h2>
      <ul class="na-knowledge__list">
        <li v-for="item in visibleBacklinks" :key="item.rel" class="na-knowledge__item">
          <a class="na-knowledge__link" :href="hrefOf(item)">{{ item.title }}</a>
          <span v-if="item.section" class="na-knowledge__meta">{{ item.section }}</span>
        </li>
      </ul>
      <details v-if="restBacklinks.length" class="na-knowledge__more">
        <summary>展开其余 {{ restBacklinks.length }} 篇</summary>
        <ul class="na-knowledge__list">
          <li v-for="item in restBacklinks" :key="item.rel" class="na-knowledge__item">
            <a class="na-knowledge__link" :href="hrefOf(item)">{{ item.title }}</a>
            <span v-if="item.section" class="na-knowledge__meta">{{ item.section }}</span>
          </li>
        </ul>
      </details>
    </section>
  </nav>
</template>

<style scoped>
.na-knowledge {
  display: grid;
  gap: 24px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--vp-c-divider);
}

.na-knowledge__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.na-knowledge__count {
  font-size: 13px;
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.na-knowledge__list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.na-knowledge__item {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  font-size: 14px;
  line-height: 1.6;
}

.na-knowledge__link {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.na-knowledge__link:hover {
  text-decoration: underline;
}

.na-knowledge__meta {
  font-size: 12px;
  color: var(--vp-c-text-3);
  overflow-wrap: anywhere;
}

.na-knowledge__more {
  margin-top: 8px;
  font-size: 13px;
}

.na-knowledge__more summary {
  color: var(--vp-c-text-2);
  cursor: pointer;
}
</style>
```

- [x] **步骤 2：注册到插槽**

在 `docs/.vitepress/theme/index.ts:23` 的 `import ArticleSponsor from "./components/ArticleSponsor.vue";` 之后加：

```ts
import ArticleConnections from "./components/ArticleConnections.vue";
```

在 `docs/.vitepress/theme/index.ts:214` 的 `"doc-footer-before": () => h(ArticleSponsor),` 之后加：

```ts
        // VPDocFooter（编辑链接/最后更新/上下页）之后、评论区之前：相关笔记与被引用
        "doc-after": () => h(ArticleConnections),
```

- [x] **步骤 3：构建并验证 SSR 输出**

运行：`pnpm docs:build`

然后：

```bash
grep -rl 'na-knowledge' docs/.vitepress/dist --include='*.html' | wc -l
grep -rl 'na-knowledge' docs/.vitepress/dist --include='*.html' | head -3
```

预期：数量 > 100；随便挑一个打开，HTML 中能看到「相关笔记」与链接，而不是仅存在于 JS 里。

- [x] **步骤 4：全量测试**

运行：`pnpm test`

预期：全部 PASS，无回归。

- [x] **步骤 5：Commit**

```bash
git add docs/.vitepress/theme/components/ArticleConnections.vue docs/.vitepress/theme/index.ts
git commit -m "feat: 文末展示相关笔记与被引用"
```

---

## 任务 6：边界与冒烟验证

**文件：**
- 只读验证，必要时修 bug

- [x] **步骤 1：确认空关系页面不输出 DOM**

在 `grep -rl 'na-knowledge'` 的结果里找一个使用了 `layout: page` 的功能页（如 `dist/articles.html`）：

```bash
grep -c 'na-knowledge' docs/.vitepress/dist/articles.html
```

预期：`0`。

- [x] **步骤 2：确认反链页面种类齐全**

```bash
grep -rl '被引用' docs/.vitepress/dist --include='*.html' | head -5
```

预期：能列出实际有反链的页面；再对比任务 4 步骤 2 的 `withBacklinks` 数量。

- [x] **步骤 3：确认无 hydration 报错**

运行 `pnpm docs:dev`，打开一个含「相关笔记」的页面，浏览器控制台应无 hydration mismatch 警告。检查完关闭 dev server。

- [x] **步骤 4：确认构建体积与耗时没有异常增长**

对比构建输出总大小（改动前 43MB 左右），新增应小于 1MB。

- [x] **步骤 5：如有修复则 Commit**

```bash
git add -A
git commit -m "fix: 修正知识网络展示的边界问题"
```

---

## 规格覆盖对照

| 规格章节 | 实现位置 |
|---|---|
| §3 数据模型 | 任务 2 的 `NoteRef` / `RelatedNote` / `Connections` |
| §4 链接提取 | 任务 1 `extractWikiLinks` + 任务 2 解析去重 |
| §4.5 不递归展开 | 任务 2 只扫描源页自身正文 |
| §5.1 反链 | 任务 2 来源门槛与日期排序 |
| §5.2 相关笔记 | 任务 3 候选门槛、IDF、reason、top5 |
| §6 注入 | 任务 4 `transformPageData` |
| §7 组件 | 任务 5 `ArticleConnections.vue` |
| §8 失败与边界 | 任务 2 空壳页、任务 1 代码块、任务 6 冒烟 |
| §9 测试 | 任务 1–3 的 33 个单测 + 任务 4–6 构建验证 |
