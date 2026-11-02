import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMd, DOCS } from "./helpers.mjs";

test("脚注：[^n] 引用渲染为上标，文末生成脚注区", async () => {
  const md = await makeMd(DOCS);
  const html = md.render("这句话有个脚注[^1]。\n\n[^1]: 这里是脚注内容");
  // 引用处：上标 + 回跳锚点
  assert.ok(html.includes('class="footnote-ref"'), "引用应渲染为 footnote-ref 上标：" + html);
  assert.ok(html.includes('href="#fn1"'), "引用应指向文末脚注锚点");
  // 文末：脚注区块 + 回跳链接
  assert.ok(html.includes('class="footnotes"'), "应生成文末脚注区");
  assert.ok(html.includes("这里是脚注内容"), "脚注内容应保留");
  assert.ok(html.includes('href="#fnref1"'), "脚注应带回到引用处的回跳链接");
  // 「参考资料」二级标题在脚注列表之前
  assert.ok(html.includes('<h2 id="footnotes-heading">参考资料</h2>'), "应注入参考资料标题：" + html);
  const headingIdx = html.indexOf('<h2 id="footnotes-heading">');
  const listIdx = html.indexOf('footnotes-list');
  assert.ok(headingIdx > -1 && listIdx > -1 && headingIdx < listIdx, "标题应在脚注列表之前");
});

test("脚注与 obsidianEmbed 共存：脚注定义不被吃成 wikilink", async () => {
  const md = await makeMd(DOCS);
  // 与生产一致：cleanUrls 下站内链接不带 .html 后缀
  const html = md.render("带维基链接的脚注[^wiki]。\n\n[^wiki]: 定义里也可以有[[3. 第三章：Docker安装与基础配置]]链接", { cleanUrls: true });
  assert.ok(html.includes('class="footnotes"'), "脚注区应正常生成：" + html);
  // 定义内容里的 [[ ]] 仍按 obsidianEmbed 规则转站内链接，而不是死链
  assert.ok(!html.includes("[[3. 第三章"), "wikilink 应被解析而非保留原文：" + html);
  assert.ok(html.includes('href="/02.学习笔记/10.开发工具/001.Docker基础教程/3. 第三章：Docker安装与基础配置"'), "wikilink 应解析为站内链接");
});

test("脚注：定义缺失时不炸、保留原文", async () => {
  const md = await makeMd(DOCS);
  const html = md.render("悬空引用[^ghost]。");
  assert.ok(html.includes("ghost"), "未定义的脚注标记应保留可读文本：" + html);
});
