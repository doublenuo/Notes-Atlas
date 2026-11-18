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
