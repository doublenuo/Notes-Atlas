import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMd, VAULT, DOCS } from "./helpers.mjs";
import { chmodSync } from "node:fs";
import { join } from "node:path";

test("! [[]] 全文嵌入：卡片、去 frontmatter、标题降级、公式", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[Alpha]]");

  assert.match(html, /class="na-embed"/);
  assert.match(html, /class="na-embed-source"/);
  assert.ok(!html.includes("2026-01-01"), "frontmatter 的 date 不应出现");
  assert.match(html, /<h2[^>]*>Alpha 大标题/, "H1 应降级为 H2");
  assert.match(html, /<h3[^>]*>小节标题/, "H2 应降级为 H3");
  assert.ok(!html.includes("$$"), "$$ 定界符不应残留");
  assert.ok(html.includes("mjx-container"), "公式应被 MathJax 预渲染（mjx-container）");
  assert.ok(html.includes("嵌入正文段落"), "笔记正文应出现");
  assert.equal(html.split("嵌入正文段落").length - 1, 1, "嵌入正文只应渲染一次");
  assert.equal(html.split('class="header-anchor"').length - 1, 2, "锚点不应翻倍（H1、H2 各一）");
});

test("来源条：frontmatter title + 源路径回链", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[Alpha]]");
  assert.ok(html.includes("📎 论文笔记 · Alpha"));
  assert.ok(html.includes(`href="${encodeURI("/01.组会材料/02.论文笔记/Alpha")}"`));
});

test("来源条：有 permalink 用 permalink 回链", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[有链接]]");
  assert.ok(html.includes(`href="${encodeURI("/meet/haslink")}"`));
});

test("来源条：无 title 时回退文件名", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[无标题]]");
  assert.ok(html.includes("📎 论文笔记 · 无标题"));
});

test("嵌入：相对路径目标按宿主页源文件目录解析（../02.论文笔记/Alpha）", async () => {
  const md = await makeMd(VAULT);
  // 生产 env 提供 realPath（rewrite/permalink 前的源文件绝对路径），相对目标按它的目录解析：
  // 宿主页位于 01.组会材料/01.组会内容/，../02.论文笔记/Alpha 应上跳一级进入 02.论文笔记
  const html = md.render("![[../02.论文笔记/Alpha]]", {
    realPath: join(VAULT, "01.组会材料", "01.组会内容", "组会样例.md"),
    relativePath: "materials/meet/组会样例.md", // 生产中被 permalink/rewrite 改写，须不被用于相对解析
  });
  assert.match(html, /class="na-embed"/);
  assert.match(html, /<h2[^>]*>Alpha 大标题/);
  assert.ok(html.includes(`href="${encodeURI("/01.组会材料/02.论文笔记/Alpha")}"`), "回链应指向论文笔记源页");
});

test("嵌入：直接路径查询（含 / 相对 docs 根）不受宿主目录影响", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[01.组会材料/02.论文笔记/Alpha]]", {
    realPath: join(VAULT, "01.组会材料", "01.组会内容", "组会样例.md"),
  });
  assert.match(html, /class="na-embed"/);
  assert.match(html, /<h2[^>]*>Alpha 大标题/);
});

test("真实库集成：Multi-Loco 嵌入（组会页实际用法）", async () => {
  const md = await makeMd(DOCS);
  const html = md.render("![[Multi-Loco]]");
  assert.match(html, /class="na-embed"/);
  assert.ok(!html.includes("![[Multi-Loco]]"), "不应残留字面语法");
  // Multi-Loco 已有 permalink（/materials/paper/multi-loco），noteHref 应优先用它而非磁盘源路径。
  // 依据：docs/01.组会材料/02.论文笔记/Multi-Loco.md 的 frontmatter。
  assert.ok(html.includes(`class="na-embed-source" href="${encodeURI("/materials/paper/multi-loco")}"`), "来源条应回链 Multi-Loco 的 permalink");
  assert.match(html, /<h2[^>]*>Multi-Loco: Unifying/, "H1 应降级为 H2 且文本锚定正确");
});

test("嵌入：围栏内 # 注释不被降级，外部标题照常降级", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[Fence]]");
  assert.ok(html.includes("# 围栏内注释不降级"), "围栏内注释应原样出现");
  assert.ok(!html.includes("## 围栏内注释不降级"), "围栏内注释不应被降级");
  assert.match(html, /<h3[^>]*>外部小节/, "外部 H2 应降级为 H3");
  assert.ok(html.includes("# 波浪线后注释不降级"), "混标记栏内注释应原样");
  assert.ok(!html.includes("## 波浪线后注释不降级"), "混标记栏内注释不应被降级");
});

test("嵌入：畸形 frontmatter 不炸 build，原文可见降级", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[坏头]]");
  assert.match(html, /class="na-embed"/);
  assert.ok(html.includes("坏头降级正文"), "正文应可见");
  assert.ok(html.includes("title: [未闭合"), "坏 frontmatter 应原文可见");
});

test("嵌入：读失败降级为空笔记而非抛错", async () => {
  const p = join(VAULT, "01.组会材料", "02.论文笔记", "锁定.md");
  chmodSync(p, 0o000);
  try {
    const md = await makeMd(VAULT);
    const html = md.render("![[锁定]]");
    assert.match(html, /class="na-embed"/);
    assert.ok(!html.includes("锁定正文"), "读失败时不应有正文");
  } finally {
    chmodSync(p, 0o644);
  }
});
