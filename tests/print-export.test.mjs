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

const component = read("components", "ArticleExportPdf.vue");

// 裸 window.print() 会导出空白图：字体未就绪掉字、图未加载留白、mermaid 未画完缺图
test("导出按钮组件：等字体与图片就绪，且预处理异常不阻断打印", () => {
  assert.match(component, /document\.fonts\.ready/, "应等待字体就绪");
  assert.match(component, /\.decode\(\)/, "应等待图片解码");
  assert.match(component, /finally\s*{[^}]*window\.print\(\)/s, "应在 finally 中确保打印被调起");
  assert.match(component, /window\.print\(\)/, "应调起浏览器打印");
});

test("导出按钮组件：等 mermaid 画完并展开 details", () => {
  assert.match(component, /waitForMermaid/, "应有等待 mermaid 的逻辑");
  assert.match(component, /\.mermaid/, "应通过 .mermaid 判断是否渲染完");
  assert.match(component, /details/, "应展开正文内折叠的 details");
});

test("导出按钮组件：与分享按钮并排且右栏总宽不变", () => {
  assert.match(component, /\.VPDocAside:has\(> \.tk-pdf-export\)/, "应通过 :has() 改造父容器实现并排");
  assert.match(component, /column-gap:\s*8px/, "两按钮间距应为 8px");
  assert.match(component, /> \.tk-article-share\s*{[^}]*flex:\s*1 1 auto/, "分享按钮应 flex:1 吃掉剩余宽度");
  assert.match(component, /> \.tk-pdf-export\s*{[^}]*flex:\s*0 0 auto/, "导出按钮容器应固定宽度");
  assert.match(component, /height:\s*36px/, "导出按钮高度应为 36px");
  assert.match(component, /white-space:\s*nowrap/, "按钮文字不换行");
});

test("导出按钮组件：纯图标但有可访问名称，不引新依赖", () => {
  assert.match(component, /aria-label="导出 PDF"/, "纯图标按钮必须有 aria-label");
  assert.match(component, /title="导出 PDF"/, "应有悬停提示");
  assert.match(component, /viewBox="0 0 24 24"/, "图标应为内联 SVG");
  assert.ok(!/from\s+["']@iconify/.test(component), "不应引入 iconify 依赖");
});

const indexTs = read("index.ts");

// 不接插槽则组件永不渲染；不 import print.scss 则打印样式不生效
test("主题入口：挂载 teek-article-share-after 插槽并引入 print.scss", () => {
  assert.match(indexTs, /import ArticleExportPdf from "\.\/components\/ArticleExportPdf\.vue"/, "应引入导出组件");
  assert.match(indexTs, /import "\.\/styles\/print\.scss"/, "应引入打印样式");
  assert.match(indexTs, /"teek-article-share-after":\s*\(\)\s*=>\s*h\(ArticleExportPdf\)/, "应挂在分享按钮之后的插槽上");
});
