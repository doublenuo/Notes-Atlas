import test from "node:test";
import assert from "node:assert/strict";
import { parseDoc, applyForm, buildTemplate, FORM_FIELDS } from "../../admin/server/src/frontmatter.js";

const HERO_SRC = `---
layout: home
hero:
  name: "Hi Atlas"
  text: "笔记"
  actions:
    - theme: brand
      text: 去读书
      link: /001
---

# 正文开始
`;

test("表单回写 title 后,hero 等嵌套键原样保真", () => {
  const out = applyForm(HERO_SRC, { title: "新标题" });
  const { frontmatter, body } = parseDoc(out);
  assert.equal(frontmatter.title, "新标题");
  assert.equal(frontmatter.layout, "home");
  assert.deepEqual(frontmatter.hero, {
    name: "Hi Atlas",
    text: "笔记",
    actions: [{ theme: "brand", text: "去读书", link: "/001" }],
  });
  assert.equal(body, parseDoc(HERO_SRC).body, "正文不得被改动");
  assert.equal(parseDoc(HERO_SRC).frontmatter.title, undefined, "applyForm 不得经全局缓存污染原数据");
  assert.equal(applyForm(out, { title: "新标题" }), out, "同输入回写幂等");
});

test("只改 FORM_FIELDS 已知字段,表单里的未知键被忽略", () => {
  assert.deepEqual(FORM_FIELDS, ["title", "date", "tags", "categories", "sticky"]);
  const out = applyForm(HERO_SRC, { title: "t2", evil: "x", layout: "docs", sticky: false });
  const { frontmatter } = parseDoc(out);
  assert.equal(frontmatter.title, "t2");
  assert.equal(frontmatter.layout, "home", "未知键不进表单通道;layout 保持原值");
  assert.equal("evil" in frontmatter, false);
  assert.equal(frontmatter.sticky, false, "falsy 布尔值必须真实落盘而非丢键");
});

test("无 frontmatter 的文件补出头部且正文保留", () => {
  const out = applyForm("# 只有正文\n\n段落。\n", { title: "T", tags: ["a:b", "#hash", "标签,逗号"] });
  const { frontmatter, body } = parseDoc(out);
  assert.equal(frontmatter.title, "T");
  assert.deepEqual(frontmatter.tags, ["a:b", "#hash", "标签,逗号"], "YAML 特殊字符值往返保真");
  assert.ok(body.includes("段落。"));
});

test("buildTemplate 含 title/date/tags/categories 骨架", () => {
  const out = buildTemplate("2026-09-28-新文章.md", "2026-09-28 14:00:00");
  const { frontmatter, body } = parseDoc(out);
  assert.equal(frontmatter.title, "2026-09-28-新文章");
  assert.equal(frontmatter.date, "2026-09-28 14:00:00");
  assert.deepEqual(frontmatter.tags, []);
  assert.deepEqual(frontmatter.categories, []);
  assert.ok(body.startsWith("# 2026-09-28-新文章"));
});

test("parseDoc 往返:原文件不被改动", () => {
  const { frontmatter, body } = parseDoc(HERO_SRC);
  assert.equal(frontmatter.layout, "home");
  assert.ok(body.trimStart().startsWith("# 正文开始"), "正文容忍分隔符后空行、以标题开始");
  // 回归:正文以 --- 开头的文档,applyForm 不得把正文误当 frontmatter 毁掉
  const tricky = "---\ntitle: a\n---\n---\n\n# x\n正文\n";
  const t = parseDoc(applyForm(tricky, { title: "b" }));
  assert.equal(t.frontmatter.title, "b");
  assert.ok(t.body.includes("# x") && t.body.includes("正文"), "正文以 --- 开头时须完整保留");
});
