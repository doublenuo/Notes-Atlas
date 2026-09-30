import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THEME = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", ".vitepress", "theme");

// 文件尚未创建时返回空串，让断言给出清晰失败信息而不是 import 期 ENOENT
const read = (...parts) => {
  const file = path.join(THEME, ...parts);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
};

const printScss = read("styles", "print.scss");

// 导出 PDF 走浏览器打印，打印样式必须把站点框架全部摘掉，只留 .vp-doc 正文
test("print.scss：隐藏导航、侧栏、右栏、评论等框架元素", () => {
  for (const selector of [
    ".VPNav",
    ".VPSidebar",
    ".VPLocalNav",
    ".VPDocAside",
    ".tk-article-analyze",
    ".pager",
    ".tk-right-bottom-button",
    "iframe",
  ]) {
    assert.ok(printScss.includes(selector), `print.scss 应隐藏 ${selector}`);
  }
});

test("print.scss：A4 页面与结构归零，正文铺满纸张", () => {
  assert.match(printScss, /@page\s*{[^}]*size:\s*A4/, "应设置 @page size: A4");
  assert.match(printScss, /\.VPDoc \.container\s*{[^}]*display:\s*block/, "应取消两栏布局");
  assert.match(printScss, /\.vp-doc\s*{[^}]*max-width:\s*none/, "应取消 .vp-doc 最大宽度");
});

test("print.scss：代码块换行、宽表格不丢列、图片不超宽", () => {
  assert.match(printScss, /pre\s*{[^}]*white-space:\s*pre-wrap/, "代码块应 white-space: pre-wrap");
  assert.match(printScss, /table\s*{[^}]*table-layout:\s*fixed/, "宽表格应 table-layout: fixed");
  assert.match(printScss, /th,\s*\n?\s*td\s*{[^}]*word-break/, "单元格应允许断词");
  assert.match(printScss, /img\s*{[^}]*max-width:\s*100%\s*!important/, "图片应限制 max-width: 100%");
});

test("print.scss：深色模式强制白底黑字，标题不与正文分离", () => {
  assert.match(printScss, /background:\s*#fff\s*!important/, "打印应强制白底");
  assert.match(printScss, /color:\s*#000\s*!important/, "打印应强制黑字");
  assert.match(printScss, /break-after:\s*avoid/, "标题应避免与正文分页");
  assert.match(printScss, /break-inside:\s*avoid/, "块元素应避免跨页撕裂");
});
