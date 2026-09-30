---
date: 2026-09-30 20:10:00
title: 2026-09-30-article-export-pdf
---
# 文章导出 PDF 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在文章页右栏「分享此页面」按钮右侧加一个纯图标「导出 PDF」按钮，点击后做打印前预处理（字体、懒加载图、mermaid、`<details>`）并调起浏览器打印对话框，打印样式只输出纯正文（`.vp-doc`），用户在对话框里另存为 PDF。

**架构：** 一个 Vue 组件（`ArticleExportPdf.vue`）通过 teek 插槽 `teek-article-share-after` 挂到分享按钮之后；用 `:has()` 把父容器 `.VPDocAside` 改成可换行横向 flex，分享按钮 `flex:1` 收缩、导出按钮固定 36px 方块，行总宽恒等于原分享按钮宽度（右栏 224px 不变）。打印排版全部收在独立的全局 `styles/print.scss`（`@media print`）。零新增依赖，不碰后端与 teek 配置。

**技术栈：** VitePress 1.6 + vitepress-theme-teek 1.5.6 + Vue 3.5（`h()` 渲染函数插槽）、SCSS、`node:test` 静态断言测试、Chrome headless `--print-to-pdf` 真实验收。

**规格：** `docs/superpowers/specs/2026-09-30-article-export-pdf-design.md`

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `docs/.vitepress/theme/styles/print.scss` | 新建 | 打印样式：隐藏站点框架、结构归零、A4 排版、防断页、强制白底 |
| `docs/.vitepress/theme/components/ArticleExportPdf.vue` | 新建 | 导出按钮组件：内联 SVG 图标、打印前预处理、点击调 `window.print()`、与分享按钮并排的布局样式 |
| `docs/.vitepress/theme/index.ts` | 修改 | import 组件与 `print.scss`；在现有插槽表里挂 `teek-article-share-after` |
| `tests/print-export.test.mjs` | 新建 | 四个文件内容的静态断言（沿用 `tests/admin/dockerfile.test.mjs` 风格） |

改动只在 `docs/**` 与 `tests/**`：命中 CI `deploy.yml` 的 `paths: docs/**` → push 后自动发布；不改依赖，`pnpm-lock.yaml` 不变。

## 背景速览（均为实测事实，实现时直接采信，不要重新推导）

- 右栏 `.aside-container` 固定宽 **224px**；分享按钮 `.tk-article-share__button` 是 `width:100%` 整宽胶囊（`padding:7px 14px`、14px 字号、高约 36px），其外层 `.tk-article-share` 自带 `padding:14px 0`。
- `.VPDocAside` 已是 `display:flex; flex-direction:column`，实测其**直接子节点**只有三个：`tk-article-share`、`content`（目录）、`spacer`。
- teek 插槽 `teek-article-share-after` 渲染在 `ArticleShare` 之后、目录之前，与分享块是 `.VPDocAside` 下的**平级兄弟**（`node_modules/vitepress-theme-teek/lib/components/theme/Layout/src/index.vue2.js` 第 524-526 行）——所以无法用父级包裹实现并排，必须靠 `:has()` 改父容器。
- 文章 H1 在 `.vp-doc` 内，保留它即含标题；mermaid 容器类名是 `.mermaid`（mermaid v11 渲染完成后加 `data-processed="true"`）；代码块是 `div.language-*`。
- 站点 markdown 图片当前不带 `loading="lazy"`，图片等待步骤按「未 complete 的图片」实现即可（等价覆盖将来出现的懒加载图）。
- 本机可用 `google-chrome`、`pdfinfo`、`pdftotext`、`pdftoppm`；`pnpm` 10.33.0 已安装。

---

### 任务 1：打印样式 print.scss

**文件：**
- 创建：`tests/print-export.test.mjs`
- 创建：`docs/.vitepress/theme/styles/print.scss`

- [ ] **步骤 1：编写失败的测试**

创建 `tests/print-export.test.mjs`：

```js
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
    'iframe',
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/print-export.test.mjs`

预期：4 个测试全部 FAIL，报错形如 `print.scss 应隐藏 .VPNav`（当前 `read` 返回空串）。

- [ ] **步骤 3：编写最少实现代码**

创建 `docs/.vitepress/theme/styles/print.scss`：

```scss
/* 打印样式：文章导出 PDF
   规格：docs/superpowers/specs/2026-09-30-article-export-pdf-design.md
   浏览器打印 / 另存为 PDF 时只输出纯正文（.vp-doc），隐藏导航、侧栏、右栏、评论等框架元素 */

@media print {
  @page {
    size: A4;
    margin: 15mm;
  }

  /* 深色模式下强制白底黑字，否则导出为黑底 */
  html,
  body,
  .VPContent,
  .VPDoc,
  .VPDoc .content,
  .VPDoc .content-container,
  .vp-doc {
    background: #fff !important;
    color: #000 !important;
  }

  /* 隐藏站点框架：顶栏、左右侧栏、右栏、日期作者块、上下页、悬浮按钮、评论、壁纸彩带 */
  .VPNav,
  .VPNavBar,
  .DocSearch,
  .VPSidebar,
  .VPLocalNav,
  .VPDocAside,
  .VPSkipLink,
  .tk-article-analyze,
  .pager,
  .tk-right-bottom-button,
  .tk-comment-giscus,
  [id^="giscus"],
  iframe,
  .tk-body-bg-image,
  .tk-ribbon {
    display: none !important;
  }

  /* 结构归零：取消两栏布局与居中窄栏，让正文铺满纸张 */
  .VPDoc .container {
    display: block !important;
    padding: 0 !important;
  }

  .VPDoc .content,
  .VPDoc .content-container,
  .vp-doc {
    max-width: none !important;
    width: auto !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* A4 排版：代码块换行不横向裁切 */
  pre {
    white-space: pre-wrap !important;
    word-break: break-word;
  }

  /* A4 排版：宽表格不丢列 */
  table {
    table-layout: fixed;
    width: 100%;
  }

  th,
  td {
    word-break: break-word;
  }

  /* 长 URL、长路径不断行错乱 */
  a,
  code,
  p {
    overflow-wrap: anywhere;
  }

  /* 图片不超页宽；height:auto 抵消 medium-zoom 可能残留的缩放 */
  img {
    display: block;
    max-width: 100% !important;
    height: auto !important;
  }

  /* 标题不与正文分页分离 */
  h1,
  h2,
  h3 {
    break-after: avoid;
    page-break-after: avoid;
  }

  /* 块元素不跨页撕裂 */
  pre,
  table,
  blockquote,
  img {
    break-inside: avoid;
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/print-export.test.mjs`

预期：4 个测试全部 PASS（`# pass 4`、`# fail 0`）。

- [ ] **步骤 5：Commit**

```bash
git add tests/print-export.test.mjs docs/.vitepress/theme/styles/print.scss
git commit -m "feat(docs): 新增导出 PDF 的打印样式"
```

---

### 任务 2：导出按钮组件

**文件：**
- 创建：`docs/.vitepress/theme/components/ArticleExportPdf.vue`
- 修改：`tests/print-export.test.mjs`（追加组件断言）

- [ ] **步骤 1：编写失败的测试**

追加到 `tests/print-export.test.mjs` 末尾：

```js
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
  assert.match(component, /> \.tk-pdf-export\s*{[^}]*flex:\s*0 0 auto/, "导出按钮应固定宽度");
  assert.match(component, /width:\s*36px/, "导出按钮应为 36px 方块");
});

test("导出按钮组件：纯图标但有可访问名称，不引新依赖", () => {
  assert.match(component, /aria-label="导出 PDF"/, "纯图标按钮必须有 aria-label");
  assert.match(component, /title="导出 PDF"/, "应有悬停提示");
  assert.match(component, /viewBox="0 0 24 24"/, "图标应为内联 SVG");
  assert.ok(!/from\s+["']@iconify/.test(component), "不应引入 iconify 依赖");
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/print-export.test.mjs`

预期：前 4 个 PASS，新增 4 个 FAIL（`read` 返回空串，报错形如 `应等待字体就绪`）。

- [ ] **步骤 3：编写最少实现代码**

创建 `docs/.vitepress/theme/components/ArticleExportPdf.vue`：

```vue
<script setup lang="ts" name="ArticleExportPdf">
/** 正文容器：导出内容以 .vp-doc 为准（含文章 H1 标题） */
const getDoc = () => document.querySelector<HTMLElement>(".vp-doc");

/** 等字体就绪：字体未就绪时中文与公式可能掉字 */
const waitForFonts = async () => {
  if (document.fonts?.ready) await document.fonts.ready;
};

/** 等图片就绪：未加载完的图片在 PDF 里是空白块（懒加载图改 eager 后等 decode） */
const waitForImages = async () => {
  const doc = getDoc();
  if (!doc) return;

  const images = Array.from(doc.querySelectorAll<HTMLImageElement>(".vp-doc img"));
  await Promise.all(
    images.map(async img => {
      if (img.complete) return;
      img.loading = "eager";
      try {
        await img.decode();
      } catch {
        /* 未完成或跨域图片 decode 会失败，不阻断打印 */
      }
    })
  );
};

/** 等 mermaid 画完：mermaid 为客户端渲染，未完成时导出缺图；上限 1.5s 后放弃 */
const waitForMermaid = async (timeout = 1500) => {
  const doc = getDoc();
  if (!doc) return;

  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (!doc.querySelector(".mermaid:not([data-processed='true'])")) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

/** 折叠的 details 打印时仍是收起状态，导出前展开 */
const expandDetails = () => {
  getDoc()?.querySelectorAll<HTMLDetailsElement>("details").forEach(item => (item.open = true));
};

const handleClick = async () => {
  try {
    await waitForFonts();
    await waitForImages();
    await waitForMermaid();
    expandDetails();
  } catch (error) {
    // 预处理异常不得阻断打印
    console.warn("[导出 PDF] 打印前预处理异常：", error);
  } finally {
    window.print();
  }
};
</script>

<template>
  <div class="tk-pdf-export">
    <button class="tk-pdf-export__button" type="button" title="导出 PDF" aria-label="导出 PDF" @click="handleClick">
      <!-- 内联 SVG（文件 + 下箭头）：不引 iconify，避免运行时联网取图标 -->
      <svg
        class="tk-pdf-export__icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M12 11v5" />
        <path d="m9.5 13.5 2.5 2.5 2.5-2.5" />
      </svg>
    </button>
  </div>
</template>

<style>
/* 分享按钮本是 width:100% 整宽胶囊：让它 flex:1 收缩 + 8px 间距 + 36px 方块，
   行总宽恒等于原分享按钮宽度，右栏 224px 不会被撑宽。
   不支持 :has() 的浏览器整块规则失效，按钮退化为排在分享按钮下方，不破版。 */
.VPDocAside:has(> .tk-pdf-export) {
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: 8px;
}

.VPDocAside:has(> .tk-pdf-export) > .tk-article-share {
  flex: 1 1 auto;
  min-width: 0;
}

/* 补 padding:14px 0 与分享块上下对齐（分享块自带同样内边距） */
.VPDocAside:has(> .tk-pdf-export) > .tk-pdf-export {
  flex: 0 0 auto;
  padding: 14px 0;
}

/* 目录（content）、spacer 等其余块回到整行 */
.VPDocAside:has(> .tk-pdf-export) > :not(.tk-article-share):not(.tk-pdf-export) {
  flex: 1 1 100%;
}

.tk-pdf-export__button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 14px;
  background-color: var(--vp-c-bg-alt);
  color: var(--tk-theme-color);
  font-size: 18px;
  cursor: pointer;
  transition: all var(--tk-transition-duration-slow) cubic-bezier(0.25, 0.8, 0.25, 1);
}

.tk-pdf-export__button:hover {
  background-color: var(--vp-c-brand-soft);
  transform: translateY(-1px);
}

.tk-pdf-export__button:active {
  transform: scale(0.9);
}
</style>
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/print-export.test.mjs`

预期：8 个测试全部 PASS（`# pass 8`、`# fail 0`）。

- [ ] **步骤 5：Commit**

```bash
git add tests/print-export.test.mjs docs/.vitepress/theme/components/ArticleExportPdf.vue
git commit -m "feat(docs): 新增文章导出 PDF 按钮组件"
```

---

### 任务 3：主题入口接线

**文件：**
- 修改：`docs/.vitepress/theme/index.ts`
- 修改：`tests/print-export.test.mjs`（追加接线断言）

- [ ] **步骤 1：编写失败的测试**

追加到 `tests/print-export.test.mjs` 末尾：

```js
const indexTs = read("index.ts");

// 不接插槽则组件永不渲染；不 import print.scss 则打印样式不生效
test("主题入口：挂载 teek-article-share-after 插槽并引入 print.scss", () => {
  assert.match(indexTs, /import ArticleExportPdf from "\.\/components\/ArticleExportPdf\.vue"/, "应引入导出组件");
  assert.match(indexTs, /import "\.\/styles\/print\.scss"/, "应引入打印样式");
  assert.match(indexTs, /"teek-article-share-after":\s*\(\)\s*=>\s*h\(ArticleExportPdf\)/, "应挂在分享按钮之后的插槽上");
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/print-export.test.mjs`

预期：8 PASS、1 FAIL（报错 `应引入导出组件`）。

- [ ] **步骤 3：接线**

在 `docs/.vitepress/theme/index.ts` 做三处修改。

其一，在 `import ContributeChart from "./components/ContributeChart.vue";` 之后加一行：

```ts
import ArticleExportPdf from "./components/ArticleExportPdf.vue";
```

其二，在 `import "./styles/banner-mobile.scss"; // 手机端首页 Banner 网格壁纸变换（须在主题 CSS 之后）` 之后加一行：

```ts
import "./styles/print.scss"; // 打印样式：导出 PDF 时只输出正文（须在主题 CSS 之后）
```

其三，把插槽表改为：

```ts
      return () => h(Teek.Layout, null, {
        "teek-archives-top-before": () => h(ContributeChart),
        // 右上角设置弹层底部注入「主题配置」区块
        "teek-theme-enhance-bottom": () => h(ThemeConfig, { onChange: handleThemeConfigChange }),
        // 「分享此页面」右侧的「导出 PDF」按钮
        "teek-article-share-after": () => h(ArticleExportPdf),
      });
```

- [ ] **步骤 4：运行全量测试验证通过**

运行：`npm test`

预期：`# pass 151`（基线 142 + 本计划新增 9），`# fail 0`。

- [ ] **步骤 5：Commit**

```bash
git add docs/.vitepress/theme/index.ts tests/print-export.test.mjs
git commit -m "feat(docs): 挂载导出 PDF 按钮到分享按钮插槽"
```

---

### 任务 4：构建与 Chrome headless 真实打印验收

**文件：**
- 无代码改动（本任务只验证；若发现问题，回到任务 1/2 修 CSS 或组件后再提交）

- [ ] **步骤 1：构建站点**

运行：`pnpm docs:build`

预期：约 30-60s 结束，输出含 `build complete in ...`。若报 SCSS 语法错误，回到任务 1 检查 `print.scss`。

- [ ] **步骤 2：对样例页出 PDF（表格 + mermaid + 图片 + 代码块最全的一篇）**

```bash
cd /home/weno/works/Notes-Atlas
URL=$(python3 -c "import pathlib;print(pathlib.Path('docs/.vitepress/dist/02.学习笔记/10.开发工具/001.Docker/第四章：Docker核心概念.html').resolve().as_uri())")
google-chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=20000 \
  --print-to-pdf=/tmp/opencode/export-check.pdf "$URL"
```

预期：命令无报错，`/tmp/opencode/export-check.pdf` 生成。

- [ ] **步骤 3：检查页面尺寸与页数**

运行：`pdfinfo /tmp/opencode/export-check.pdf | grep -E "Pages|Page size"`

预期：`Page size: 595 x 842 pts (A4)`；`Pages` 大于 1（该页有 6 张表格 + 60 个代码块）。

若 `Page size` 不是 A4，说明 `@page` 未生效（检查 `print.scss` 是否在 `index.ts` 中 import）。

- [ ] **步骤 4：检查正文在、框架不在**

```bash
pdftotext /tmp/opencode/export-check.pdf - > /tmp/opencode/export-check.txt
grep -c "Docker" /tmp/opencode/export-check.txt       # 预期 > 0（正文在）
grep -c "分享此页面" /tmp/opencode/export-check.txt     # 预期 0（分享按钮已隐藏）
grep -c "On this page" /tmp/opencode/export-check.txt  # 预期 0（右栏目录已隐藏）
```

说明：目录标题在本主题下固定渲染为英文 `On this page`（实测构建产物），用它做断言比匹配「目录」二字可靠——笔记正文本身常出现「目录」一词。`grep -c` 无匹配时输出 0 并返回退出码 1，属正常。

- [ ] **步骤 5：目视核对第一页**

运行：

```bash
pdftoppm -png -r 80 -f 1 -l 1 /tmp/opencode/export-check.pdf /tmp/opencode/export-page
ls /tmp/opencode/export-page*
```

然后用 read 工具查看生成的 PNG，确认：正文单栏铺满纸张宽度（左右无大块留白）、无顶栏与侧栏残留、代码块与表格未被裁切。

若版式有问题（如正文仍居中窄栏、代码块横向溢出被切），修正 `print.scss` 对应规则后重新执行步骤 1-5，改动单独提交：

```bash
git add docs/.vitepress/theme/styles/print.scss
git commit -m "fix(docs): 修正导出 PDF 的打印排版"
```

- [ ] **步骤 6：真实浏览器人工核对按钮布局（无头 Chrome 验证不了，必须人工）**

`:has()` 布局、悬停提示、窄屏隐藏、深色模式这四项无头环境无法验证，必须在真实浏览器里过一遍。

起 dev server（后台）：

```bash
cd /home/weno/works/Notes-Atlas
pnpm docs:dev
```

打开 `http://localhost:5173/02.学习笔记/10.开发工具/001.Docker/第四章：Docker核心概念.html`，逐项核对：

1. **并排与总宽**：分享按钮右侧紧邻一个 PDF 图标按钮，右栏没有被撑宽。在 DevTools Console 执行下面这段量尺寸：

```js
const aside = document.querySelector(".aside-container").getBoundingClientRect().width;
const share = document.querySelector(".tk-article-share__button").getBoundingClientRect();
const exp = document.querySelector(".tk-pdf-export__button").getBoundingClientRect();
console.log({ aside, shareWidth: Math.round(share.width), exportWidth: Math.round(exp.width), gap: Math.round(exp.left - share.right), 同高: Math.round(share.top) === Math.round(exp.top) });
```

预期：`aside: 224`、`exportWidth: 36`、`shareWidth: 180`（= 224 − 8 − 36，说明总宽守恒）、`gap: 8`、`同高: true`。

2. **悬停与点击**：鼠标停在按钮上出现浏览器原生提示「导出 PDF」；点击出现打印对话框。
3. **深色模式**：点导航栏右侧的月亮图标切到深色，再点导出按钮，打印预览应为白底黑字（不是黑底）。
4. **窄屏**：DevTools 设备模拟切到 375px 宽，右栏整体隐藏、导出按钮随之消失，页面无横向滚动条。

若执行环境没有可用浏览器（AI 代理常见），把上面 4 项原样交给用户人工核对，并明确说明「这 4 项尚未验证」，不要自行声称通过。

核对通过后停掉 dev server：

```bash
pkill -f "vitepress dev docs" || true
```

---

### 任务 5：提交推送与线上复验

**文件：**
- 无新文件

- [ ] **步骤 1：确认工作区只包含本功能的改动**

运行：`git status --short`

预期：只有 `.obsidian/graph.json`、`.obsidian/workspace.json`、前序 `docs/superpowers/**` 的 frontmatter 补写、`?? admin/server/Caddyfile` 这类与本功能无关的条目（这些**不要**提交）。本功能文件应已全部 commit，工作区无 `docs/.vitepress/**` 与 `tests/print-export.test.mjs` 的未提交改动。

- [ ] **步骤 2：推送**

运行：`git push origin main`

预期：推送成功。若失败（网络/权限），记录错误并重试；**不要**因此回滚本地提交。

- [ ] **步骤 3：观测 CI**

```bash
gh run list -R doublenuo/Notes-Atlas --limit 3 --json databaseId,status,conclusion,headBranch,displayTitle
```

预期：出现本次提交对应的 `docs` workflow 运行，`status` 为 `in_progress` 或 `completed`。等它结束（约 2 分钟），`conclusion` 应为 `success`。

- [ ] **步骤 4：线上复验打印效果**

```bash
URL="https://blogs.lovetulin.cn/02.%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0/10.%E5%BC%80%E5%8F%91%E5%B7%A5%E5%85%B7/001.Docker/%E7%AC%AC%E5%9B%9B%E7%AB%A0%EF%BC%9ADocker%E6%A0%B8%E5%BF%83%E6%A6%82%E5%BF%B5.html"
google-chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=20000 \
  --print-to-pdf=/tmp/opencode/export-online.pdf "$URL"
pdftotext /tmp/opencode/export-online.pdf - | grep -c "分享此页面"   # 预期 0
```

预期：`分享此页面` 命中 0 次（右栏已隐藏）。若线上 PDF 与本地一致，说明 CI 产物包含本次改动。

- [ ] **步骤 5：清理临时文件**

```bash
rm -f /tmp/opencode/export-check.pdf /tmp/opencode/export-check.txt /tmp/opencode/export-page*.png /tmp/opencode/export-online.pdf
```

---

## 范围外（不要顺手做）

- 不引入 jsPDF / html2canvas / 任何新依赖；不改 `pnpm-lock.yaml`
- 不改 `teekConfig.ts`（分享按钮配置保持原样，导出按钮跟随其显隐）
- 不做整站 PDF、不做服务端预生成、不做快捷键、不做移动端独立入口
- 不修 `admin/server/Caddyfile` 未跟踪却被告 `Dockerfile` `COPY` 的历史遗留问题（与本功能无关，另开任务）
