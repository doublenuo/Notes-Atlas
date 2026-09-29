---
date: 2026-09-29 19:55:00
title: 2026-09-29-admin-preview-design
---
# 设计:后台管理系统 Markdown 实时预览

- 日期:2026-09-29
- 状态:已批准(服务端渲染 + 左右分栏 + 全量支持 + 300ms 防抖)
- 关联:`2026-09-28-admin-panel-design.md` §6(原设计已写入"实时预览(markdown-it,`html:false`)"但未实现)、`2026-09-23-obsidian-embed-design.md`

## 1. 背景与目标

后台编辑器当前是裸 `<textarea>`,无任何渲染能力。原 admin-panel 设计 §6 已定案"实时预览
(markdown-it,`html:false` 防预览 XSS)",但实现时只落了源码编辑区。本设计补齐该缺口。

**定案(澄清结果)**:

1. **服务端渲染**:`![[笔记]]` 嵌入与 `[[双链]]` 必须**真实展开**,不能只显示字面文本。
   理由:这两种语法的解析依赖遍历文件系统(`obsidianEmbed` 内部 `walk()` + `readNote()`),
   浏览器端无法实现。否决纯前端方案(需接受 39 篇笔记的嵌入不生效)。
2. **布局**:编辑区**左右分栏**,中间分隔条可拖动。
3. **渲染范围**:基础 Markdown + 真实嵌入/双链 + **mermaid 图表** + **数学公式**。
4. **刷新时机**:输入防抖 **300ms** 实时重渲。

**非目标**:WYSIWYG 可视化编辑、预览区内的分页/滚动同步、预览区编辑(只读)、
媒体上传、多用户并发编辑冲突处理。

## 2. 总体架构

```
浏览器                              Fastify 容器
┌────────────────────────────┐      ┌──────────────────────────────┐
│ 左: 源码 textarea            │      │ POST /admin/api/preview      │
│    (input → 300ms 防抖)      │─────▶│  └─ src/preview.js           │
│ ─── 分隔条(可拖动) ───       │      │     └─ markdown-it(进程单例)  │
│ 右: 预览(只读)               │◀─────│        ├─ gray-matter 剥 fm  │
│    └ KaTeX + Mermaid        │      │        └─ obsidianEmbed(共享) │
└────────────────────────────┘      └──────────────────────────────┘
```

渲染在服务端完成,KaTeX/Mermaid 在浏览器侧对已渲染的 HTML 做二次处理
(公式与图表排版依赖 DOM,无法在服务端完成)。

## 3. 内容现状(设计依据)

全库 192 篇 `.md` 的语法分布,决定渲染范围:

| 语法 | 覆盖 | 处理位置 |
|---|---|---|
| 外部图片 `![](https://...)` | 291 处引用 | 浏览器直连,**无需处理** |
| 本地图片引用 | **0 处** | 不适用 |
| `[[双链]]` | 40 篇 | 服务端(obsidianEmbed) |
| `![[笔记嵌入]]` | 39 篇 | 服务端(obsidianEmbed) |
| 数学公式 | 17 篇 | 浏览器侧 KaTeX |
| ```mermaid | 8 篇 | 浏览器侧 Mermaid |
| 表格 | 17 篇 | markdown-it 内建 |

两点关键结论:

- **图片零风险**:291 处图片引用全部是 `https://` 绝对地址(取自
  `raw.githubusercontent.com` 与腾讯云 COS),没有一处相对路径引用,
  因此预览区不存在图片 404 问题。`docs/public/` 下 13 个图片文件无任何笔记引用。
- **原文 HTML 不需要放行**:全库 `<br>`(40)/`<div>`(22)/`<span>`(10) 全部位于
  ```mermaid 代码块内(节点标签,如 `D["dockerd<br/>守护进程"]`)或 `superpowers/`
  元文档的 Vue 示例中,**真实笔记不依赖 HTML 透传**。故 `html:false` 不会造成可见降级。

公式实际内容为 `\frac`、`\mathrm`、`\partial` 等标准 LaTeX(见
`02.学习笔记/04.agent/002.LLM原理/0002.transformer架构.md`),完全落在 KaTeX 支持子集内。

定界符两种都在用:行间 `$$T\to P=\{p_1,...,p_n\}$$`,以及**行内单 `$`**
(真实笔记中 146 处,如 `01.组会材料/01.组会内容/20251027.md:43` 的
`$r_t(\theta)=\frac{\pi_{\theta}(a_t|s_t)}{\pi_{\text{old}}(a_t|s_t)}$`)。
故 KaTeX 必须开启单 `$` 定界符——这是单 `$` 误判的主要风险面(见 §11)。

## 4. 后端设计

### 4.1 `admin/server/src/preview.js`(新增)

导出 `createPreviewRenderer({ docsDir })`,返回 `{ render(content, relPath) }`。

- markdown-it **进程单例**,选项 `html:false` / `linkify:true` / `breaks:false`
  (与 VitePress 默认一致)
- 挂载 `obsidianEmbed` 插件,`docsRoot = docsDir`
- 入参先经现有 `parseDoc()` 剥 frontmatter、只渲染 body;标题取 `frontmatter.title`
- **resolver 跨请求复用**:`createResolver` 的全库 `walk()` 索引只建立一次
  (192 文件一次性遍历),之后每次渲染只 `readNote()` 实际嵌入的目标文件。
  插件内建的 `MAX_EMBED_DEPTH=3` 与 `naEmbedStack` 循环检测对预览同样生效。

### 4.2 路由 `POST /admin/api/preview`(新增)

请求 `{ content, path }`,响应 `{ html, title }`。

鉴权、限流与错误契约**不新增代码**:路径以 `/admin/api/` 开头即命中现有
`onRequest` 钩子的 cookie 校验;错误统一 `{code, message}` 走既有
`setErrorHandler` 与 `SEMANTIC` 白名单。

## 5. 共享插件:`obsidianEmbed` 单一事实来源

`docs/.vitepress/plugins/obsidianEmbed.ts` 移至仓库根 **`shared/obsidianEmbed.js`**
(已验证为纯 JS 语法、无类型注解,`.ts` 后缀名不副实)。

- 改动 5 处 import:
  - `docs/.vitepress/config.ts:6`
  - `docs/.vitepress/plugins/docAnalysisEmbed.ts:13`
  - `tests/resolver.test.mjs:5`
  - `tests/helpers.mjs:4`
  - `tests/doc-analysis.test.mjs:7`
- `admin/server/Dockerfile` 增加 `COPY shared ./shared`
- 构建上下文 `/data/stacks/admin` 需同步 `shared/`

**否决"复制一份进 admin"**:双份必然静默漂移——站点插件演进后预览会与线上表现
越差越远,且没有任何信号。移动方案由现有 96 个用例(`npm test`,2026-09-29 实测
96 pass / 0 fail)做回归护栏。

## 6. 前端设计

### 6.1 结构

`#editor-content` 内改为 `.split` 容器:

```
┌─ .pane-source ──────────┬─ .divider ─┬─ .pane-preview ─┐
│ .editor-header          │            │  (只读,独立滚动) │
│ .editor-info            │            │                  │
│ textarea#editor         │            │                  │
└─────────────────────────┴────────────┴──────────────────┘
```

### 6.2 CSS

新增分栏 flex。**显式声明 `min-width:0` / `min-height:0` / `flex-shrink:0`**——
上一个 UI bug(`文档内容挤在左上角`)的根因正是缺失这些属性导致 textarea
退回默认 20×2 固有尺寸,本次不复犯。

预览排版:标题/表格/代码块/引用/图片 `max-width:100%`;
`.na-embed` 卡片样式从 `docs/.vitepress/theme/styles/embed.scss` 移植精简版。

分隔条:`cursor:col-resize`,hover/drag 高亮,宽度由 CSS 变量 `--split` 承载。

### 6.3 交互

- `input` → 300ms 防抖 → `POST /admin/api/preview`
- **竞态保护**:递增请求序号,只应用最新序号的响应,丢弃过期响应
  (连续打字时不出现预览内容倒退)
- 打开文件时立即渲染一次
- 分隔条拖动:`mousedown`/`mousemove` 写 `--split`,clamp 在 20%~80%
- mermaid:`mermaid.initialize({ startOnLoad:false })`,渲染后处理 `.language-mermaid`
- 公式:**纯客户端 KaTeX auto-render**,定界符 `$...$` / `$$...$$` / `\(...\)` / `\[...\]`
  (与站点 `markdown-it-mathjax3` 的定界符集合一致)。
  **服务端不引入数学插件**——省下 `mathjax-full`(8.9MB)等依赖;
  markdown-it 原样透传公式文本,KaTeX 在渲染后的 HTML 上扫描排版。
  KaTeX `auto-render` 默认忽略 `code`/`pre`/`script`/`style`,代码块内的 `$` 不会被误排;
  解析失败时按 `throwOnError:false` 退回原文,不会中断整篇预览。

### 6.4 vendor 依赖

放入 `admin/server/public/vendor/`,**不引 CDN**(避免供应链风险 + 境内网络不可达):

| 库 | 体积 | 选型理由 |
|---|---|---|
| `mermaid.min.js` | 3.3MB | UMD 自包含单文件(`mermaid/dist` 解包 75MB/217 个 ESM chunk,不可整体 vendor) |
| `katex/`(js+css+woff2) | ≈700KB | 站点用 MathJax(8.9MB),但实际公式仅标准 LaTeX 子集,KaTeX 更小更快 |

## 7. 安全边界

预览区与登录**同源**,预览 XSS 等价于会话劫持(cookie 虽 HttpOnly + SameSite=Strict,
但同源脚本不受 SameSite 保护)。以下三条已逐条实测:

| 攻击面 | 机制 | 实测结论 |
|---|---|---|
| 笔记原文 HTML | `html:false` 时 **parser** 不生成 html token,改为实体化 | `<img src=x onerror=alert(1)>` → `&lt;img...&gt;` ✅ |
| 插件生成的 `html_block` | 属可信 token;插件对 `href` 与 `label` 均调 `escapeHtml`(`obsidianEmbed.ts:201`) | ✅ |
| 链接属性 | markdown-it 默认 `renderToken` 转义属性值 | ✅ |

补充约束:

- 预览 HTML 以 `innerHTML` 注入,安全性完全依赖上述三条,不得为"更好看"放开 `html:true`
- 渲染中的笔记内容不写入日志(沿用现有"不记 body"约定)
- vendor 库本地化,不从第三方 CDN 动态加载

## 8. 错误处理与降级

| 场景 | 行为 |
|---|---|
| 嵌入未命中 / 循环 / 超 3 层 | 沿用插件内建黄色告警块(不额外处理) |
| frontmatter 畸形 | 复用 `parseDoc` 既有 try/catch,退回渲染全文,不 500 |
| 预览接口 500 / 网络失败 | 预览区显示错误信息,**不阻断源码编辑与保存** |
| mermaid 语法错 | 仅该图显示 mermaid 错误文本,不影响其余内容 |

## 9. 测试

新增 `tests/admin/preview.test.mjs`,沿用现有 `node --test` 框架:

- 基础 Markdown 渲染
- **`html:false` 转义断言**:`<img onerror=...>` 不得产生可执行标签
- `[[双链]]` → `<a href="/...">`
- `![[嵌入]]` → `na-embed` 卡片 + 标题降级
- 循环嵌入 / 超 3 层 → 告警块
- 未登录 → 401(鉴权钩子覆盖)
- 畸形 frontmatter → 不 500
- 预览结果不含 frontmatter YAML 原文

另:`obsidianEmbed` 移位后,现有 96 个用例必须全绿(2026-09-29 基线实测
96 pass / 0 fail)——这是共享插件重构的回归护栏。

## 10. 部署

- rsync 增量增加 `shared/` 与 `admin/server/public/vendor/`
- `admin/server/Dockerfile` 增加 `COPY shared ./shared`
- **`docker compose up -d --build`**——显式带 `--build`。
  上一次 UI 事故的根因正是 `up -d` 复用了过期镜像,导致源码已修而线上未修
- 验证:`/admin/style.css` 200、预览分栏 CSS 生效、`/admin/api/preview` 未登录 401

## 11. 已知取舍

- **`createResolver` 的文件清单索引在进程内只建一次**:索引建立后,新建的
  **非论文目录**笔记需重启容器才能被裸目标名命中(论文目录与带 `/` 的路径目标始终实时)。
  这是插件既有语义,预览沿用同一实例故行为一致;不为此改动共享插件。
- 预览渲染读磁盘(嵌入展开),300ms 防抖下单人编辑开销可忽略;构建期同样逻辑已在跑。
- **单 `$` 公式定界符的误判**:正文中的货币写法(如 `$100`)或 shell 变量
  (`$1`、`${...}`)可能被 KaTeX 尝试排版。缓解:`auto-render` 默认忽略
  `code`/`pre`(全库此类误判样本均在代码围栏内),且 `throwOnError:false`
  使解析失败退回原文。当前全库真实笔记中**未发现**货币误判样本。
