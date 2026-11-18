import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { collectPages } from "../docs/.vitepress/permalinks.ts";
import {
  buildKnowledgeGraph,
  EMPTY_CONNECTIONS,
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
  if ("date" in meta) lines.push(`date: ${meta.date}`);
  if ("layout" in meta) lines.push(`layout: ${meta.layout}`);
  if (meta.article === false) lines.push("article: false");
  lines.push("---", "");
  return `${lines.join("\n")}\n${body}\n`;
}

function makeVault(files, base = tmpdir()) {
  const root = mkdtempSync(join(base, "na-kg-"));
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

test("buildKnowledgeGraph：相对 docsRoot 下 ../ 目标仍能解析", () => {
  // 简单相对路径（不含 .. 前缀）才会暴露 root 被重复拼接的问题；vault 放 cwd 下，
  // 跑完由 roots 清理，且不改变进程 cwd。
  const { root, pages } = makeVault(
    {
      "02.学习笔记/A.md": note("A", `${PROSE}\n\n[[../01.组会材料/M]]`),
      "01.组会材料/M.md": note("M", PROSE),
    },
    join(process.cwd(), "tests"),
  );
  const docsRoot = relative(process.cwd(), root);
  const graph = buildKnowledgeGraph(docsRoot, pages);
  assert.deepEqual(backlinkRels(graph, "01.组会材料/M.md"), ["02.学习笔记/A.md"]);
});

test("buildKnowledgeGraph：正文页资格（article/layout/空正文）", () => {
  const { graph } = makeVault({
    "03.其他/T.md": note("T", PROSE),
    "03.其他/正文.md": note("正文", `${PROSE}\n\n[[T]]`),
    "03.其他/doc.md": note("doc", `${PROSE}\n\n[[T]]`, { layout: "doc" }),
    "03.其他/article-false.md": note("article-false", `${PROSE}\n\n[[T]]`, { article: false }),
    "03.其他/home.md": note("home", `${PROSE}\n\n[[T]]`, { layout: "home" }),
    "03.其他/page.md": note("page", `${PROSE}\n\n[[T]]`, { layout: "page" }),
    "03.其他/layout-false.md": note("layout-false", `${PROSE}\n\n[[T]]`, { layout: false }),
    "03.其他/空正文.md": note("空正文", "   \n\t\n"),
  });
  assert.deepEqual(backlinkRels(graph, "03.其他/T.md"), [
    "03.其他/doc.md",
    "03.其他/正文.md",
  ]);
});

test("buildKnowledgeGraph：分区名取顶层与末级，重名只显示一次", () => {
  const { graph } = makeVault({
    "03.其他/T1.md": note("T1", PROSE),
    "03.其他/T2.md": note("T2", PROSE),
    "03.其他/T3.md": note("T3", PROSE),
    "03.其他/T4.md": note("T4", PROSE),
    "02.学习笔记/S1.md": note("S1", `${PROSE}\n\n[[T1]]`),
    "02.学习笔记/06.强化学习基础/S2.md": note("S2", `${PROSE}\n\n[[T2]]`),
    "02.学习笔记/02.学习笔记/S3.md": note("S3", `${PROSE}\n\n[[T3]]`),
    "03.其他/S4.md": note("S4", `${PROSE}\n\n[[T4]]`),
  });
  assert.equal(graph.get("03.其他/T1.md").backlinks[0].section, "学习笔记");
  assert.equal(graph.get("03.其他/T2.md").backlinks[0].section, "学习笔记 · 强化学习基础");
  assert.equal(graph.get("03.其他/T3.md").backlinks[0].section, "学习笔记");
  assert.equal(graph.get("03.其他/T4.md").backlinks[0].section, "其他");
});

test("buildKnowledgeGraph：缺失/非法日期排最后，平局按 rel 升序", () => {
  const { graph } = makeVault({
    "03.其他/S-new.md": note("S-new", `${PROSE}\n\n[[T]]`, { date: "2026-02-01" }),
    "03.其他/S-tie-b.md": note("S-tie-b", `${PROSE}\n\n[[T]]`, { date: "2026-01-01" }),
    "03.其他/S-tie-a.md": note("S-tie-a", `${PROSE}\n\n[[T]]`, { date: "2026-01-01" }),
    "03.其他/S-invalid.md": note("S-invalid", `${PROSE}\n\n[[T]]`, { date: "not-a-date" }),
    "03.其他/S-missing.md": note("S-missing", `${PROSE}\n\n[[T]]`),
    "03.其他/T.md": note("T", PROSE),
  });
  assert.deepEqual(backlinkRels(graph, "03.其他/T.md"), [
    "03.其他/S-new.md",
    "03.其他/S-tie-a.md",
    "03.其他/S-tie-b.md",
    "03.其他/S-invalid.md",
    "03.其他/S-missing.md",
  ]);
});

test("buildKnowledgeGraph：date 0 与数字时间戳按毫秒解析", () => {
  const { graph } = makeVault({
    "03.其他/S-epoch.md": note("S-epoch", `${PROSE}\n\n[[T]]`, { date: 0 }),
    "03.其他/S-1990.md": note("S-1990", `${PROSE}\n\n[[T]]`, { date: "1990-01-01" }),
    "03.其他/S-ts.md": note("S-ts", `${PROSE}\n\n[[T]]`, { date: 1735689600000 }),
    "03.其他/S-missing.md": note("S-missing", `${PROSE}\n\n[[T]]`),
    "03.其他/T.md": note("T", PROSE),
  });
  assert.deepEqual(backlinkRels(graph, "03.其他/T.md"), [
    "03.其他/S-ts.md",
    "03.其他/S-1990.md",
    "03.其他/S-epoch.md",
    "03.其他/S-missing.md",
  ]);
});

test("buildKnowledgeGraph：畸形 frontmatter 不阻断且不产生幻影反链", () => {
  const malformed = ["---", "title: [未闭合", "tags: [[T]]", "---", "", "正文"].join("\n");
  const { graph } = makeVault({
    "03.其他/坏页.md": malformed,
    "03.其他/U.md": note("U", `${PROSE}\n\n[[T]]`),
    "03.其他/T.md": note("T", PROSE),
  });
  assert.equal(graph.size, 3);
  assert.deepEqual(backlinkRels(graph, "03.其他/坏页.md"), []);
  assert.deepEqual(backlinkRels(graph, "03.其他/T.md"), ["03.其他/U.md"]);
});

test("buildKnowledgeGraph：内部异常时返回空 Map 且不抛出", () => {
  const { root } = makeVault({ "03.其他/T.md": note("T", PROSE) });
  const warn = console.warn;
  console.warn = () => {};
  try {
    // pages 传 null 模拟内部异常（非可迭代），验证最外层 catch 降级
    const graph = buildKnowledgeGraph(root, null);
    assert.equal(graph.size, 0);
  } finally {
    console.warn = warn;
  }
});

test("EMPTY_CONNECTIONS：外层与两个数组都冻结", () => {
  assert.equal(Object.isFrozen(EMPTY_CONNECTIONS), true);
  assert.equal(Object.isFrozen(EMPTY_CONNECTIONS.backlinks), true);
  assert.equal(Object.isFrozen(EMPTY_CONNECTIONS.related), true);
  assert.throws(
    () => EMPTY_CONNECTIONS.backlinks.push({ rel: "x", url: "/x", title: "x", section: "" }),
    TypeError,
  );
});

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
