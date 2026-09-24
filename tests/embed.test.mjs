import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMd, VAULT, DOCS } from "./helpers.mjs";

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

test("真实库集成：Multi-Loco 嵌入（组会页实际用法）", async () => {
  const md = await makeMd(DOCS);
  const html = md.render("![[Multi-Loco]]");
  assert.match(html, /class="na-embed"/);
  assert.ok(!html.includes("![[Multi-Loco]]"), "不应残留字面语法");
  assert.ok(
    html.includes(`href="${encodeURI("/01.组会材料/02.论文笔记/Multi-Loco")}"`) ||
      /href="\/meet\//.test(html),
    "回链应指向笔记源页或其 permalink"
  );
  assert.match(html, /<h2/, "笔记 H1 应降级为 H2");
});
