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
