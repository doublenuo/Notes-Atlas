import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMd, VAULT } from "./helpers.mjs";

test("KaTeX：行内公式、块公式与 MathJax 扩展写法 \\*", async () => {
  const md = await makeMd(VAULT);
  const html = md.render(
    "行内 $x^\\*$ 与 $\\lambda_i^\\*$\n\n$$\nE = mc^2\n$$\n",
  );

  assert.ok(html.includes('class="katex"'), "应输出 KaTeX 结构");
  assert.ok(html.includes("katex-display"), "块公式应输出 katex-display");
  assert.ok(!html.includes("katex-error"), "不应出现 KaTeX 渲染错误");
  assert.ok(!html.includes("mjx-container"), "不应再输出 MathJax 结构");
  assert.ok(html.includes("∗"), "\\* 应被映射为 ∗");
  assert.ok(!html.includes("$$"), "定界符不应残留");
});
