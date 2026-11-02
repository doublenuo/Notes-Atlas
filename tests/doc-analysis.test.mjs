import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { VAULT } from "./helpers.mjs";
import { createResolver } from "../docs/.vitepress/plugins/obsidianEmbed.js";
import {
  countWords,
  formatReadingTime,
  expandEmbeds,
  patchDocAnalysisInfo,
  docAnalysisEmbed,
} from "../docs/.vitepress/plugins/docAnalysisEmbed.ts";

const STUB = join(VAULT, "01.组会材料", "01.组会内容", "组会样例.md");
const DUP = join(VAULT, "02.学习笔记", "重复.md");

// —— countWords：口径必须与 vitepress-plugin-doc-analysis 的 getCounter 逐字一致 ——
test("countWords 与 doc-analysis 口径一致:中文字数与英文词数", () => {
  assert.deepEqual(countWords("你好 world 123"), [2, 2]);
  assert.deepEqual(countWords("纯 English words test"), [1, 3]);
  assert.deepEqual(countWords("——…!@#"), [0, 0]);
});

// —— formatReadingTime：与 getReadTime 分支逐字一致（默认 cn=300/en=160） ——
test("formatReadingTime 不足 1 分钟兜底为 1m", () => {
  assert.equal(formatReadingTime(0, 0), "1m");
  assert.equal(formatReadingTime(50, 0), "1m");
  assert.equal(formatReadingTime(0, 150), "1m");
});

test("formatReadingTime 分钟级:整数与一位小数", () => {
  assert.equal(formatReadingTime(900, 0), "3m");
  assert.equal(formatReadingTime(1000, 0), "3.3m");
  assert.equal(formatReadingTime(0, 320), "2m");
});

test("formatReadingTime 恰好 60 分钟不进小时分支", () => {
  assert.equal(formatReadingTime(18000, 0), "60m");
});

test("formatReadingTime 小时级:整点与带分钟", () => {
  assert.equal(formatReadingTime(36000, 0), "2h");
  assert.equal(formatReadingTime(18300, 0), "1h1m");
});

test("formatReadingTime 天级", () => {
  assert.equal(formatReadingTime(450000, 0), "1d1h");
});

// —— expandEmbeds：字符串级展开，语义与渲染管线对齐 ——
test("expandEmbeds 独立成行嵌入按全文展开且去 frontmatter", () => {
  const resolveNote = createResolver(VAULT);
  const out = expandEmbeds("![[Alpha]]", resolveNote);
  assert.ok(out.includes("嵌入正文段落"), "嵌入正文应展开");
  assert.ok(!out.includes("2026-01-01"), "frontmatter 不应计入");
  assert.ok(out.includes("## Alpha 大标题"), "标题应经 readNote 降级");
  assert.ok(!out.includes("![[Alpha]]"), "嵌入行应被替换");
});

test("expandEmbeds 代码围栏内不展开", () => {
  const resolveNote = createResolver(VAULT);
  const out = expandEmbeds("```md\n![[Alpha]]\n```", resolveNote);
  assert.ok(out.includes("![[Alpha]]"), "围栏内保持原文");
  assert.ok(!out.includes("嵌入正文段落"), "围栏内不应展开");
});

test("expandEmbeds ≥4 缩进与非独立成行不展开", () => {
  const resolveNote = createResolver(VAULT);
  const indented = expandEmbeds("    ![[Alpha]]", resolveNote);
  assert.ok(indented.includes("![[Alpha]]"), "代码块缩进语义保持原文");
  assert.ok(!indented.includes("嵌入正文段落"));
  const inline = expandEmbeds("前文 ![[Alpha]] 后文", resolveNote);
  assert.ok(inline.includes("![[Alpha]]"), "行中写法保持原文");
  assert.ok(!inline.includes("嵌入正文段落"));
});

test("expandEmbeds 循环处保留原文且能终止", () => {
  const resolveNote = createResolver(VAULT);
  const out = expandEmbeds("![[CycleA]]", resolveNote);
  assert.ok(out.includes("A 正文。"), "循环链上的正文应展开");
  assert.equal(
    (out.match(/!\[\[CycleA\]\]/g) || []).length,
    1,
    "仅循环阻断处保留原文",
  );
});

test("expandEmbeds 第 4 层不展开、第 3 层正常", () => {
  const resolveNote = createResolver(VAULT);
  const out = expandEmbeds("![[L1]]", resolveNote);
  assert.ok(out.includes("L3"), "第 3 层应展开");
  assert.ok(out.includes("![[L4]]"), "第 4 层保持原文");
  assert.ok(!out.includes("L4 终点"), "第 4 层正文不应出现");
});

test("expandEmbeds 未找到目标保留原文", () => {
  const resolveNote = createResolver(VAULT);
  assert.equal(expandEmbeds("![[压根没有]]", resolveNote), "![[压根没有]]");
});

// —— patchDocAnalysisInfo：覆盖 wordCount/readingTime/totalFileWords ——
test("patchDocAnalysisInfo 嵌入壳页按展开后计数并更新总字数", () => {
  const raw = matter(readFileSync(STUB, "utf-8")).content;
  const [rcn, ren] = countWords(raw);
  assert.ok(rcn + ren < 50, "前置:壳页原始字数应远小于 1 分钟阈值");

  const entry = {
    fileInfo: { filePath: STUB, relativePath: "01.组会材料/01.组会内容/组会样例.md" },
    wordCount: rcn + ren,
    readingTime: formatReadingTime(rcn, ren),
    frontmatter: {},
  };
  const info = { eachFileWords: [entry], totalFileWords: entry.wordCount };

  patchDocAnalysisInfo(info, VAULT);

  assert.ok(entry.wordCount >= 300, `展开后字数应 ≥300,实际 ${entry.wordCount}`);
  assert.notEqual(entry.readingTime, "1m", "展开后不应再是 1m");
  assert.equal(info.totalFileWords, entry.wordCount, "总字数 = 各文件之和");
});

test("patchDocAnalysisInfo 无嵌入页数值与原口径一致", () => {
  const entry = {
    fileInfo: { filePath: DUP, relativePath: "02.学习笔记/重复.md" },
    wordCount: 99,
    readingTime: "9m",
    frontmatter: {},
  };
  const info = { eachFileWords: [entry], totalFileWords: 0 };

  patchDocAnalysisInfo(info, VAULT);

  assert.equal(entry.wordCount, 4, "# 重复笔记 = 4 个中文字");
  assert.equal(entry.readingTime, "1m");
  assert.equal(info.totalFileWords, 4);
});

test("patchDocAnalysisInfo 缺 eachFileWords 不抛错", () => {
  assert.doesNotThrow(() => patchDocAnalysisInfo({}, VAULT));
  assert.doesNotThrow(() => patchDocAnalysisInfo(undefined, VAULT));
});

// —— vite 插件生命周期 ——
test("docAnalysisEmbed:config 捕获、configResolved 完成打补丁", () => {
  const p = docAnalysisEmbed();
  const themeConfig = {
    docAnalysisInfo: {
      eachFileWords: [
        { fileInfo: { filePath: STUB, relativePath: "01.组会材料/01.组会内容/组会样例.md" }, wordCount: 9, readingTime: "1m" },
        { fileInfo: { filePath: DUP, relativePath: "02.学习笔记/重复.md" }, wordCount: 4, readingTime: "1m" },
      ],
      totalFileWords: 13,
    },
  };
  assert.doesNotThrow(() => p.config({ vitepress: { site: { themeConfig }, srcDir: VAULT } }));
  assert.doesNotThrow(() => p.configResolved());

  const [stub, dup] = themeConfig.docAnalysisInfo.eachFileWords;
  assert.ok(stub.wordCount >= 300, `壳页应按展开计数,实际 ${stub.wordCount}`);
  assert.notEqual(stub.readingTime, "1m");
  assert.equal(dup.wordCount, 4);
  assert.equal(themeConfig.docAnalysisInfo.totalFileWords, stub.wordCount + dup.wordCount);
});

test("docAnalysisEmbed:缺 vitepress 键与缺数据均不抛错", () => {
  const p = docAnalysisEmbed();
  assert.doesNotThrow(() => p.config({}));
  assert.doesNotThrow(() => p.configResolved());
});
