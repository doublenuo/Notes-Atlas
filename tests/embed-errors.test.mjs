import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { makeMd, VAULT } from "./helpers.mjs";

test("嵌入目标不存在 → 告警块，不吞错", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[压根没有]]");
  assert.match(html, /na-embed-warning/);
  assert.match(html, /未找到嵌入笔记：压根没有/);
  assert.ok(!html.includes("na-embed-source"), "不应渲染正常卡片");
});

test("嵌入目标不存在（相对路径）→ 告警块，不吞错", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[../不存在目录/压根没有]]", {
    realPath: join(VAULT, "01.组会材料", "01.组会内容", "组会样例.md"),
  });
  assert.match(html, /na-embed-warning/);
  assert.match(html, /未找到嵌入笔记：\.\.\/不存在目录\/压根没有/);
  assert.ok(!html.includes("na-embed-source"), "不应渲染正常卡片");
});

test("嵌入循环 A→B→A → 循环告警且能终止", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[CycleA]]");
  assert.match(html, /na-embed-warning/);
  assert.match(html, /嵌入循环/);
  assert.ok(html.includes("CycleB 标题"), "B 的内容应已渲染");
});

test("嵌入深度 >3 → 层级告警，第 4 层不渲染", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[L1]]");
  assert.match(html, /na-embed-warning/);
  assert.match(html, /嵌入层级超过 3 层：L4/);
  assert.ok(html.includes("L3"), "第 3 层应渲染");
  assert.ok(!html.includes("L4 终点"), "第 4 层不应渲染");
});
