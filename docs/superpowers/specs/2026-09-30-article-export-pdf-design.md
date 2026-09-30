---
date: 2026-09-30 19:52:00
title: 2026-09-30-article-export-pdf-design
---
# 文章导出 PDF 设计规格

**日期：** 2026-09-30
**状态：** 设计已确认，待实现

## 1. 背景与目标

文章页右栏有 teek 主题内置的「分享此页面」按钮（`articleShare.enabled: true`，文案见 `docs/.vitepress/teekConfig.ts`），点一下复制当前页链接。日常有把笔记导出成 PDF 的需求（打印留档、发给同组、离线阅读）。

目标：在**分享按钮右侧**加一个「导出 PDF」按钮，点一下把当前文章导出为 PDF。

明确的三条边界（已与用户确认）：

1. **交互方式**：调起浏览器打印对话框 → 另存为 PDF。不做「点一下直接下载 .pdf」。
2. **导出内容**：纯正文（`.vp-doc`，含文章 H1 标题与正文）。不含日期/作者/分类等元信息块。
3. **入口范围**：只在桌面端出现，跟随分享按钮的显示逻辑（窄屏右栏整体隐藏，导出按钮一并消失）。

## 2. 决策摘要

| 项 | 决策 | 理由 |
|---|---|---|
| PDF 生成方式 | `window.print()` + 打印样式 | 零新增依赖；文字可选可搜索；中文/公式/代码/mermaid 全为矢量。服务端无头浏览器不可行（宿主机 1.9GB 内存，已发生 OOM 杀 dockerd） |
| 内容范围 | 纯正文 `.vp-doc` | 导出物干净，适合存档分享 |
| 按钮形态 | 纯图标方块 36×36 + `title` 提示 | 保持右栏总宽不变（见 §5） |
| 插入位置 | teek 插槽 `teek-article-share-after` | 主题原生扩展点，`articleShare.enabled` 为假时自动一起消失 |
| 布局实现 | `:has()` 改造父容器 `.VPDocAside` 为可换行横向 flex | 插槽渲染的是平级兄弟节点，无共同父级可包裹；`:has()` 精确限定作用域，不污染无导出按钮的页面 |
| 按钮样式 | 自写样式 + teek CSS 变量 | 不复用主题私有类名，主题升级不会样式错位；深色模式自动跟随 |
| 图标 | 内联 SVG（文件+下箭头） | 不引 iconify：避免运行时联网拉图标、避免增加打包体积 |
| 打印样式位置 | 新增 `theme/styles/print.scss`，全局 `@media print` | 与仓库现有 `styles/*.scss` 写法一致；在 teek CSS 之后 import，优先级可控 |
| 组件测试 | 源码静态断言，不做组件渲染测试 | 仓库现有测试（`tests/**/*.test.mjs`）为 `node:test` + 源码断言，`.vue` 挂不上运行时 |

## 3. 约束（均为对现有代码/产物的实测，非推测）

- 右栏 `.aside-container` 固定宽 **224px**（`docs/.vitepress/dist/assets/css/*.css`）
- 分享按钮 `.tk-article-share__button` 是 `width: 100%` 的**整宽**胶囊，高约 36px（`padding: 7px 14px` + 14px 字号）
- `.tk-article-share` 自带 `padding: 14px 0`
- 父容器 `.VPDocAside` 已是 `display: flex; flex-direction: column`
- teek 的 `ArticleShare` 前后各有一个插槽：`teek-article-share-before` / `teek-article-share-after`，仅在 `articleShare.enabled` 为真时渲染
- 插槽内容与 `ArticleShare` 组件是 `.VPDocAside` 下的**平级兄弟节点**（`teek/lib/components/theme/Layout/src/index.vue2.js` 第 524-526 行）
- `index.ts` 已在使用同一套插槽机制（`teek-archives-top-before`、`teek-theme-enhance-bottom`）
- 文章 H1 位于 `.vp-doc` 内（实测构建产物），因此「保留正文」即含标题
- teek 主题版本锁定 `vitepress-theme-teek@1.5.6`（`package.json` 为 `^1.5.6`）
- 本机有 `google-chrome`，可用 `--headless --print-to-pdf` 做真实验收

## 4. 架构与改动清单

```
docs/.vitepress/theme/
├── index.ts                          (改) 挂载插槽 + import print.scss
├── components/
│   └── ArticleExportPdf.vue          (新) 导出按钮组件
└── styles/
    └── print.scss                    (新) 打印样式
tests/print-export.test.mjs           (新) 静态断言测试
```

数据流：用户点击 → 组件执行打印前预处理 → `window.print()` → 浏览器按 `print.scss` 排版 → 用户在对话框选「另存为 PDF」。无网络请求、无后端接口、无新依赖。

## 5. 按钮布局契约

目标形态（右栏 224px 内）：

```
┌─ 224px ───────────────────────────┐
│ [🔗 分享此页面        ] [📄]  ← 8px │  合计 224px，与现状完全一致
├───────────────────────────────────┤
│ 本页目录（自动换行到下一行，占满整行）  │
└───────────────────────────────────┘
```

**总宽不变的关键**：分享按钮本来就是 `width: 100%` 整宽，所以「分享按钮（flex:1 收缩）+ 8px 间距 + 36px 方块」的总和恒等于原分享按钮宽度，右栏不会被撑宽，分享按钮仅收窄约 44px，中文文案仍完整显示。

组件结构：

```html
<div class="tk-pdf-export">
  <button class="tk-pdf-export__button" title="导出 PDF" aria-label="导出 PDF">
    <svg><!-- 内联：文件+下箭头 --></svg>
  </button>
</div>
```

样式要点（组件内全局 style，作用于插槽挂载点及其父级）：

```css
.VPDocAside:has(> .tk-pdf-export) {
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: 8px;
}
.VPDocAside:has(> .tk-pdf-export) > .tk-article-share { flex: 1 1 auto; min-width: 0; }
.VPDocAside:has(> .tk-pdf-export) > .tk-pdf-export    { flex: 0 0 auto; }
.VPDocAside:has(> .tk-pdf-export) > :not(.tk-article-share):not(.tk-pdf-export) {
  flex: 1 1 100%;   /* 目录等后续块回到整行 */
}
```

- 按钮视觉：圆角 14px、`background: var(--vp-c-bg-alt)`、`color: var(--tk-theme-color)`、hover 背景 `var(--vp-c-brand-soft)` + 上浮 1px、active `scale(.9)`，与分享按钮手感一致
- 按钮固定 36×36（`padding: 0`，图标居中），外层 `.tk-pdf-export` 补 `padding: 14px 0` 与分享块对齐
- **降级**：不支持 `:has()` 的浏览器整块规则失效，导出按钮落到分享按钮下方（独占一行、自身样式完好），不破版

`index.ts` 接线（并入现有插槽表）：

```ts
return () => h(Teek.Layout, null, {
  "teek-archives-top-before": () => h(ContributeChart),
  "teek-theme-enhance-bottom": () => h(ThemeConfig, { onChange: handleThemeConfigChange }),
  "teek-article-share-after": () => h(ArticleExportPdf),
});
```

## 6. 打印样式契约（`styles/print.scss`）

**保留**：`.vp-doc`（H1 + 正文）、代码高亮、表格、图片、mermaid 的 SVG、MathJax。

**隐藏**（选择器全部取自真实构建产物）：

| 元素 | 选择器 |
|---|---|
| 顶栏 / 搜索 | `.VPNav` `.DocSearch` |
| 左侧边栏 | `.VPSidebar` |
| 移动端目录 | `.VPLocalNav` |
| 整个右栏（目录 + 分享 + 导出按钮） | `.VPDocAside` |
| 日期/作者/分类块 | `.tk-article-analyze` |
| 上一页/下一页 | `.pager` |
| 右下角悬浮按钮 | `.tk-right-bottom-button` |
| 评论 | `.tk-comment-giscus`、`[id^="giscus"]`、`iframe` |
| 壁纸 / 彩带 | `.tk-body-bg-image`、`.tk-ribbon` |

**结构归零**（否则 PDF 会保留网页的居中窄栏与左侧留白）：

```css
.VPDoc .container { display: block; }   /* 取消两栏 */
.VPDoc .content   { max-width: none; width: auto; margin: 0; padding: 0; }
.vp-doc           { max-width: none; padding: 0; }
```

**A4 排版**（四个必处理项）：

```css
@page { size: A4; margin: 15mm; }

pre            { white-space: pre-wrap; word-break: break-word; }  /* 代码块不横向裁切 */
table          { table-layout: fixed; width: 100%; }               /* 宽表格不丢列 */
th, td         { word-break: break-word; }
a, code, p     { overflow-wrap: anywhere; }                        /* 长 URL/路径不断行溢出 */
img            { max-width: 100% !important; height: auto; display: block; }

h1, h2, h3     { break-after: avoid; page-break-after: avoid; }     /* 标题不与正文分离 */
pre, table, blockquote, img { break-inside: avoid; }                /* 块元素不跨页撕裂 */
```

**深色模式**：打印时强制白底黑字（`html, body { background: #fff !important; color: #000 !important; }` 及常见容器背景），否则导出为黑底。

## 7. 打印前预处理契约

裸 `window.print()` 会导出空白图（懒加载未触发、字体未就绪、mermaid 未画完）。点击后按序执行，再调打印：

1. `await document.fonts.ready` — 等中文字体与 MathJax 字体就绪，否则首字可能掉字
2. 正文内 `img[loading="lazy"]` 改为 `eager`，逐个 `await img.decode()`
3. 等待 mermaid 渲染完成（轮询 `.mermaid svg` 是否出现），上限 1.5s 后放弃
4. 展开正文内所有 `<details>`
5. `window.print()`

全过程同步完成、无网络请求，上限约 1.5s。任一步骤异常都不得阻断第 5 步（用 `try/finally` 包裹，保证打印对话框一定出现）。

## 8. 错误处理

- 预处理任一步骤失败（字体 API 不存在、decode 拒绝、mermaid 超时）→ 静默跳过该步，仍调起打印
- 按钮无异步失败态：预处理在点击后进行，按钮不进入 loading 态（打印对话框本身即反馈）
- 不新增任何网络请求，因此无网络错误分支

## 9. 测试

### 9.1 单测（`tests/print-export.test.mjs`，`node:test`）

沿用仓库现有源码静态断言风格（如 `tests/admin/dockerfile.test.mjs`），断言：

- `styles/print.scss` 存在，且含隐藏清单关键类名（`.VPNav`、`.VPSidebar`、`.VPDocAside`、`.pager`、`iframe`、`.tk-article-analyze`）
- 含 `@page` 与 `size: A4`
- 含 `pre` 换行、`table-layout: fixed`、`img` 的 `max-width: 100% !important`
- 含强制白底规则
- `theme/index.ts` 含 `teek-article-share-after` 插槽挂载
- `ArticleExportPdf.vue` 含 `window.print()`、`document.fonts.ready`

### 9.2 真实打印验收（Chrome headless）

```bash
pnpm docs:build
google-chrome --headless --print-to-pdf=/tmp/export.pdf \
  "file://$PWD/docs/.vitepress/dist/<某篇文章>.html"
```

检查项：PDF 页数合理、正文单栏铺满、无导航/侧栏/评论残留、代码块与表格未被裁切。该步骤在实现后实际执行，并在部署后用线上页面复验一次。

## 10. 部署与回归

- 改动仅在 `docs/**`，命中 `deploy.yml` 的 `paths: docs/**` → push 后自动触发 CI 构建并发布到 `/opt/blogs`（约 2 分钟）
- 不改 `admin/server/**`，面板与容器无需重建
- 不新增依赖，`pnpm-lock.yaml` 不变，CI 的 `pnpm install --frozen-lockfile` 不受影响

## 11. 验收清单（人工，`https://blogs.lovetulin.cn/`）

1. 桌面端文章页右栏：分享按钮右侧紧邻一个 PDF 图标按钮，间距约 8px，右栏总宽与改动前一致（无横向撑开）
2. 悬停导出按钮显示「导出 PDF」提示，点击出现浏览器打印对话框
3. 打印预览中：只有正文与 H1 标题；无顶栏、左右侧栏、目录、日期作者块、上下页、评论、悬浮按钮
4. 预览中代码块完整换行不裁切、宽表格列不丢、长链接不断行错乱
5. 深色模式下预览为白底黑字
6. 有图/有 mermaid/有公式/有表格的笔记，导出 PDF 中对应元素均正常显示
7. 窄屏（手机宽度）下右栏隐藏，导出按钮随之消失，无横向滚动条

## 12. 范围外（本次不做）

- 整站合并为一个 PDF
- 服务端 / CI 预生成 PDF 文件
- 直接下载 `.pdf`（jsPDF + html2canvas 栅格化，文字不可选、体积大）
- 快捷键触发
- 打印纸张方向、页眉页脚等选项（交由浏览器打印对话框）
- 移动端独立入口
