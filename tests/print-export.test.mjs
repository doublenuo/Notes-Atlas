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

// teek 用 .edit-info/.last-updated 渲染更新信息，只写 VitePress 原生类名会漏进 PDF
test("print.scss：隐藏 teek 自有类名的「最后更新」与「在 GitHub 上编辑」", () => {
  for (const selector of [".edit-info", ".edit-link", ".last-updated"]) {
    assert.ok(printScss.includes(selector), `print.scss 应隐藏 ${selector}`);
  }
});

// 「最近更新」卡片与 giscus 评论区都不在 VitePress 原生类名体系内，命中不到就会漏进 PDF
test("print.scss：隐藏「最近更新」卡片（标题、日期列表、更多文章）", () => {
  assert.ok(printScss.includes(".tk-article-update"), "应隐藏 .tk-article-update 整张卡片");
  assert.match(printScss, /:has\(a\[aria-label="最近更新"\]\)/, "应有 :has() 按 aria-label 兜底命中");
  assert.match(printScss, /:has\(a\[aria-label\^="更多文章"\]\)/, "应一并覆盖「更多文章」链接");
});

test("print.scss：隐藏表情反应区与评论区（评论列表、输入框）", () => {
  assert.ok(printScss.includes("#tk-comment"), "应隐藏 giscus 挂载容器 #tk-comment");
  assert.ok(printScss.includes(".tk-layout__comment"), "应隐藏评论布局容器 .tk-layout__comment");
  assert.ok(printScss.includes("#giscus-container"), "应隐藏 giscus 自建容器作为冗余保险");
  assert.ok(printScss.includes(".giscus-frame"), "应隐藏 giscus iframe");
});

// 统一隐藏类：给任意元素一个「不进 PDF」的约定，避免每次都写专用选择器
test("print.scss：提供通用 .no-print 隐藏类", () => {
  assert.match(printScss, /\.no-print\s*,?\s*(\[data-no-print\])?\s*{[^}]*display:\s*none/, "应提供 .no-print / [data-no-print] 通用隐藏类");
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

test("导出按钮组件：搬进分享块内并排，且不改 .VPDocAside 的垂直布局", () => {
  assert.match(component, /querySelector<HTMLElement>\("\.tk-article-share"\)/, "应定位 teek 分享块作为挂载目标");
  assert.match(component, /<Teleport[^>]*:to="shareHost"/, "应通过 Teleport 把按钮搬进分享块");

  // .VPDocAside 是 100vh 固定容器里的 column flex；改它的 flex 方向会让子元素
  // （含 flex-grow:1 的 .spacer 与目录）重新分配，导致右栏被撑满、元素纵向散开
  assert.ok(!/\.VPDocAside\s*[:{]/.test(component), "不应给 .VPDocAside 写任何样式");
  assert.ok(!/flex:\s*1 1 100%/.test(component), "不应把 flex-basis 设为 100%，那会把 .spacer 撑成整屏高");
  assert.ok(!/flex-grow:\s*0/.test(component), "不应调 .VPDocAside 的 flex-grow");

  assert.match(component, /\.tk-article-share:has\(> \.tk-pdf-export\)\s*{[^}]*display:\s*flex/, "分享块应改为横向 flex");
  assert.match(component, /align-items:\s*stretch/, "分享块应 stretch，使两按钮自适应等高");
  assert.match(component, /gap:\s*8px/, "两按钮间距应为 8px");
  assert.match(component, /> \.tk-article-share__button\s*{[^}]*flex:\s*1 1 auto/, "分享按钮应 flex:1 吃掉剩余宽度");
  // 被挤窄时 teek 的文字会换行，把按钮撑高到 64px，两按钮将不齐
  assert.match(component, /> \.tk-article-share__button\s*{[^}]*white-space:\s*nowrap/s, "分享按钮文字应禁止换行");
  assert.match(component, /> \.tk-pdf-export\s*{[^}]*flex:\s*0 0 auto/, "导出按钮容器应固定宽度");
  assert.match(component, /align-self:\s*stretch/, "导出按钮应 stretch 到与分享按钮同高");
  assert.match(component, /white-space:\s*nowrap/, "按钮文字不换行");
});

test("导出按钮组件：带可见文字标签与可访问名称，不引新依赖", () => {
  assert.match(component, /aria-label="导出 PDF"/, "按钮必须有 aria-label");
  assert.match(component, /title="导出 PDF"/, "应有悬停提示");
  assert.match(component, /<span class="tk-pdf-export__text">导出 PDF<\/span>/, "应有可见文字标签");
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
