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
});

test("只改 FORM_FIELDS 已知字段,表单里的未知键被忽略", () => {
  assert.deepEqual(FORM_FIELDS, ["title", "date", "tags", "categories", "sticky"]);
  const out = applyForm(HERO_SRC, { title: "t2", evil: "x", layout: "docs" });
  const { frontmatter } = parseDoc(out);
  assert.equal(frontmatter.title, "t2");
  assert.equal(frontmatter.layout, "home", "未知键不进表单通道;layout 保持原值");
  assert.equal("evil" in frontmatter, false);
});

test("无 frontmatter 的文件补出头部且正文保留", () => {
  const out = applyForm("# 只有正文\n\n段落。\n", { title: "T", tags: ["a"] });
  const { frontmatter, body } = parseDoc(out);
  assert.equal(frontmatter.title, "T");
  assert.deepEqual(frontmatter.tags, ["a"]);
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
  assert.equal(HERO_SRC.includes("# 正文开始"), true);
});
