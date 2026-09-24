import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMd, VAULT, DOCS } from "./helpers.mjs";

test("[[ ]] 行内引用 → 站内链接（真实库）", async () => {
  const md = await makeMd(DOCS);
  // 与生产渲染一致：站点 cleanUrls:true；vitepress linkPlugin 对内部 link_open 必做
  // 「非 cleanUrls 时加 .html + 末尾 decodeURI」，故断言生产终态（原文中文、无 .html）
  const html = md.render("请先阅读[[第三章：Docker安装与基础配置]]再操作。", {
    cleanUrls: true,
  });
  const expected = "/02.学习笔记/10.开发工具/001.Docker/第三章：Docker安装与基础配置";
  assert.ok(html.includes(`href="${expected}"`), `链接应指向笔记源页，实际：${html}`);
  assert.ok(html.includes(">第三章：Docker安装与基础配置</a>"));
  assert.ok(html.indexOf("请先阅读") < html.indexOf("<a "), "正文应在链接之前");
});

test("[[ ]] 保持原文：未命中目标、|别名/#标题非目标、跨行、反引号代码", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("引用[[不存在的章节]]结束");
  assert.ok(html.includes("[[不存在的章节]]"));
  const spaced = md.render("引用[[ 不存在章节 ]]结束");
  assert.ok(spaced.includes("[[ 不存在章节 ]]"), "字面回退应保留原文空格（trim 仅用于查找）");
  const nonGoal = md.render("见[[Alpha|别名]]与[[Alpha#小节]]");
  assert.ok(nonGoal.includes("[[Alpha|别名]]"), "|别名 非目标应保持原文");
  assert.ok(nonGoal.includes("[[Alpha#小节]]"), "#标题 非目标应保持原文");
  const multiline = md.render("[[Alpha\n下一行]]");
  assert.ok(multiline.includes("[[Alpha") && multiline.includes("下一行]]"), "跨行应保持原文");
  const inCode = md.render("`[[Alpha]]`");
  assert.ok(inCode.includes("<code>[[Alpha]]</code>"), "反引号代码内应原样");
  assert.ok(!inCode.includes("na-embed"), "反引号代码内不应触发嵌入");
});

test("行中 ! [[]] 保持原文（块规则只处理独立成行）", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("前文 ![[Alpha]] 后文");
  assert.ok(html.includes("![[Alpha]]"));
  assert.ok(!html.includes("na-embed"));
  const lazy = md.render("前文行\n![[Alpha]]");
  assert.ok(lazy.includes('class="na-embed"'), "段落续行中的独立嵌入行应中断段落并嵌入");
  assert.ok(lazy.includes("<p>前文行</p>"), "前文行应独立成段");
});
