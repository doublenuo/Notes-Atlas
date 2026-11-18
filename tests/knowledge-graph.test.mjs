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

const roots = [];
after(() => roots.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const PROSE = "这是一段用于测试的正文。".repeat(20); // 240 字符

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

test("extractWikiLinks：三反引号围栏排除，未闭合围栏延续到文末", () => {
  assert.deepEqual(extractWikiLinks("```\n[[A]]\n```"), []);
  assert.deepEqual(extractWikiLinks("```\n[[A]]"), []);
  assert.deepEqual(extractWikiLinks("```md\n[[A]]\n```\n[[B]]"), ["B"]);
});

test("extractWikiLinks：~~~ 围栏同样排除，闭栏长度不足仍视为围栏内", () => {
  assert.deepEqual(extractWikiLinks("~~~\n[[A]]\n~~~"), []);
  assert.deepEqual(extractWikiLinks("````\n[[A]]\n```\n[[A]]"), []);
  assert.deepEqual(extractWikiLinks("````\n[[A]]\n````\n[[B]]"), ["B"]);
});

test("extractWikiLinks：info string 含反引号不算围栏", () => {
  assert.deepEqual(extractWikiLinks("```js`\n[[A]]"), ["A"]);
});

test("extractWikiLinks：独立嵌入缩进 0/1/3 计入，4 空格不计", () => {
  for (const spaces of [0, 1, 3]) {
    assert.deepEqual(extractWikiLinks(" ".repeat(spaces) + "![[A]]"), ["A"]);
  }
  assert.deepEqual(extractWikiLinks("    ![[A]]"), []);
});

test("extractWikiLinks：行中/尾随嵌入不计，缩进行内链接仍提取", () => {
  assert.deepEqual(extractWikiLinks("![[A]] 尾随"), []);
  assert.deepEqual(extractWikiLinks("前 ![[A]]"), []);
  assert.deepEqual(extractWikiLinks("前 [[A]] 后"), ["A"]);
  assert.deepEqual(extractWikiLinks("    [[A]]"), ["A"]);
});

test("extractWikiLinks：反引号 run 必须等长配对", () => {
  assert.deepEqual(extractWikiLinks("`[[Alpha]]``"), ["Alpha"]);
  assert.deepEqual(extractWikiLinks("``[[Alpha]]```"), ["Alpha"]);
  assert.deepEqual(extractWikiLinks("``[[Alpha]]``"), []);
});

test("ownProseLength：缩进边界与行中嵌入计入正文", () => {
  assert.equal(ownProseLength("   ![[A]]"), 0);
  assert.equal(ownProseLength("    ![[A]]"), 6);
  assert.equal(ownProseLength("前 ![[A]] 后"), 10);
});

test("extractWikiLinks：CRLF 换行的围栏同样排除", () => {
  assert.deepEqual(extractWikiLinks("```\r\n[[A]]\r\n```"), []);
  assert.deepEqual(extractWikiLinks("```\r\n[[A]]\r\n```\r\n[[B]]"), ["B"]);
});

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

// 修正计划原断言：backlinks 存的是**来源页** NoteRef，原计划把目标页 URL 写成了来源断言
// （index.md 只有 T 这一条来源，T 的 URL 是 /t）。让首页 index.md 也反向引用 T，
// 才能把它的 URL 作为来源 NoteRef 观察到；首页按 index.md 路径识别，不依赖 layout。
test("buildKnowledgeGraph：URL 复用 permalink，首页映射为 /", () => {
  const { graph } = makeVault({
    "03.其他/X.md": note("X", `${PROSE}\n\n[[T]]`, { permalink: "/custom/x" }),
    "03.其他/T.md": note("T", `${PROSE}\n\n[[index]]`),
    "index.md": note("首页", `${PROSE}\n\n[[T]]`),
  });
  assert.deepEqual(backlinkRels(graph, "03.其他/T.md"), ["03.其他/X.md", "index.md"]);
  assert.equal(graph.get("03.其他/T.md").backlinks[0].url, "/custom/x");
  assert.equal(graph.get("03.其他/T.md").backlinks[1].url, "/");
  assert.deepEqual(backlinkRels(graph, "index.md"), ["03.其他/T.md"]);
});

test("buildKnowledgeGraph：无关系页面返回空结构", () => {
  const { graph } = makeVault({
    "04.随笔/Z.md": note("Z", PROSE),
  });
  assert.deepEqual(graph.get("04.随笔/Z.md"), { backlinks: [], related: [] });
});
