---
date: 2026-09-23 23:46:30
title: 2026-09-23-obsidian-embed-design
---
# 设计规格：Obsidian 式 `! [[]]` 嵌入与 `[[ ]]` 站内链接

日期：2026-09-23
状态：已获用户批准（对话中逐节确认）
决策路线：方案 A —— 自写 markdown-it 插件（零新依赖）

## 1. 背景与目标

站点用 VitePress + vitepress-theme-teek，笔记从 Obsidian 库同步。组会内容页（`docs/01.组会材料/01.组会内容/`，36 篇）用 `![[论文名]]` 引用论文笔记（`docs/01.组会材料/02.论文笔记/`，72 篇），共 **65 处**；学习笔记中另有普通 `[[第三章：Docker安装与基础配置]]` 引用。当前 `config.ts` 仅配置 `markdown: { math: true }`，无任何 wiki 语法插件，两类语法均渲染为原文字符。

目标：

1. `![[目标]]`（独立成行）→ 笔记**全文内联嵌入**，包卡片边框，顶部「📎 论文笔记 · 标题」来源条可跳转笔记原页。
2. `[[目标]]`（行内）→ 解析成站内链接。

## 2. 已确认决策

| 决策点 | 结论 |
|---|---|
| 呈现方式 | 全文内联 + 卡片边框 + 来源条回链（非折叠、非链接卡片） |
| 普通 `[[ ]]` | 一并支持，与嵌入共用文件解析器 |
| 实现路线 | 方案 A：自写 markdown-it 块规则 + 内联规则 |
| 依赖 | 零新增（gray-matter 为 vitepress 自带依赖） |

## 3. 语法范围

**支持：**

- `![[目标]]` 独立成行（行首允许 ≤3 空格缩进）→ 全文嵌入。目标可带可不带 `.md` 后缀。现有 65 处全部符合。
- `![[目标]]` **独占一行、但前一行是段落文本（无空行分隔）** → 同样嵌入。〔2026-09-24 裁决补记，任务 4 质量审查 Important-1：「独立成行」按字面执行，**不要求空行分块**；块规则经 `alt: ["paragraph"]` 中断段落（探测走 silent 路径、零 I/O）。行中同行的 `text ![[x]]` 仍按下方非目标保持原文。〕
- `[[目标]]` 行内出现 → 站内链接。

**非目标（YAGNI，用户笔记中未使用）：**

- `![[x#标题]]` 段落引用、`![[x^块]]` 块引用、`|别名` 语法
- 行中间的嵌入（`text ![[x]]` 保持原文显示）
- 被嵌入内容中的相对路径图片/链接改写（现状 301 张图全部为远程 URL，0 张本地）
- Setext 式标题（`===`/`---` 下划线）降级——论文笔记全部使用 ATX `#` 标题

## 4. 文件解析规则（resolver，两种语法共用）

按顺序解析目标 `target`（先剥 `.md` 后缀）：

1. target 含 `/` → 按相对 `docs/` 根的路径解析
2. 否则先在 `docs/01.组会材料/02.论文笔记/<target>.md` 查找（论文笔记优先；65 处嵌入全部命中此级）
3. 再全库 `**/<target>.md`（排除 `.vitepress/`、`node_modules/`、`dist/`、`@fragment/`）
4. 多个同名 → 取路径字典序第一个 + 构建日志 warn
5. 找不到 → 按使用场景走错误处理（见 §7）

解析器对文件读取结果做 `Map` 进程内缓存。

## 5. 嵌入处理流水线（markdown-it 块规则）

实现位置：`md.block.ruler.before('paragraph', 'na_embed', ..., { alt: ["paragraph"] })`（带 alt 以允许嵌入行中断段落——2026-09-24 裁决补记），逐阶段：

1. **读文件**（经 resolver），**gray-matter 剥掉 frontmatter**（date/title 等不进正文）
2. **标题降级**：字符串级对行首 ATX 标题 `#{1,5} ` 追加一个 `#`（`#`→`##`；`######` 不变），保证组会页只有一个 H1、右侧大纲层级正常
3. **递归 parse**：用同一个 md 实例 `md.parse(content, env)` 生成 token，拼入宿主 token 流，外层包 `na_embed_open` / `na_embed_close` 自定义 token
4. 因此 `math: true` 的 `$$` 公式、标题锚点 slug（markdown-it-anchor 自动去重）、代码高亮、列表**全部自动正确**

**循环防护**：通过 `env` 传递嵌入链（目标绝对路径栈 + 深度），深度 > 3 或链内文件重复 → 渲染告警块并 console.warn，不递归。

`[[ ]]` 用 `md.inline.ruler.before('link', 'na_wikilink', ...)` 实现；**前一字符为 `!`（charCode 33）时跳过**，避免与块规则范围外的嵌入语法纠缠（行中 `![[x]]` 按 §3 保持原文）。

## 6. 渲染结构与样式

```html
<div class="na-embed">
  <a class="na-embed-source" href="…">📎 论文笔记 · Multi-Loco</a>
  <div class="na-embed-body">…笔记全文（标题已降级）…</div>
</div>
```

- 来源条文字：`📎 论文笔记 · ` + 目标 frontmatter `title`（无则取文件名去后缀）
- 回链 URL：目标 frontmatter `permalink` 优先（如 `/meet/gmr`），否则源路径 `/01.组会材料/02.论文笔记/<文件名去后缀>`（dist 中该路径 HTML 实测存在）；href 经 `encodeURI` 处理空格与中文
- 卡片样式：浅色底 + 1px 细边框 + 圆角 + 适度外边距；`html.dark` 下暗色适配；嵌套块级内容（段落、代码块、表格）在卡片内正常留白

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| 嵌入目标不存在 | 卡片位置渲染红色 `⚠️ 未找到嵌入笔记：<目标>` + console.warn（**不吞错**） |
| 嵌入循环 / 深度 > 3 | 渲染红色告警块说明循环链 + console.warn |
| 解析歧义（多个同名） | 取字典序第一个 + console.warn |
| 链接目标不存在 | `[[目标]]` 保持原文显示（与现状一致，不误报为死链） |

## 8. 已知取舍

- dev 模式下编辑**被嵌入的笔记**后，宿主组会页需手动刷新/重启才更新（VitePress 按宿主 md 文件缓存转换结果）；`npm run docs:build` 产物永远是新内容。
- 相对路径图片不改写（现状为零，见 §3 非目标）。

## 9. 文件改动面

| 文件 | 动作 |
|---|---|
| `docs/.vitepress/plugins/obsidianEmbed.ts` | 新增：resolver + 块规则 + 内联规则 + open/close token 渲染，实测 235 行（含注释） |
| `docs/.vitepress/config.ts` | `markdown` 块中追加 `config(md)` 注册插件（净增 10 行） |
| `docs/.vitepress/theme/styles/embed.scss` | 新增：`.na-embed` / `.na-embed-source` / `.na-embed-body` 亮暗样式 |
| `docs/.vitepress/theme/index.ts` | 追加 `import "./styles/embed.scss";`（与 L26-28 现有三个样式 import 并列） |

## 10. 验证标准（完成定义）

1. **36 篇组会页**逐一 headless 断言：无 `![[` 字面残留；`.na-embed` 卡片数 == 该页嵌入数；卡片内含目标笔记特征文本；无 JS 报错。终审核验：65/65 处嵌入按目标笔记 H1 前 25 字全命中于所在页 HTML（核验要点：逐页取嵌入卡片文本与目标 md 的 H1 首 25 字比对；原一次性脚本存于 /tmp/opencode/check-feature-text.mjs，可按此要点重建复跑）
2. 嵌入了含 `$$` 公式的笔记（全库 8 篇）时公式正常输出 MathJax
3. 学习笔记的 `[[第三章：Docker安装与基础配置]]` 渲染为 `<a href>`
4. `npm run docs:build` 通过 + dist 全量 grep 无 `![[` 字面残留
5. 回归：文章侧边栏依旧不含 `pdfs` / `组会pptx` 分组
6. 样式验收：任务 6 sweep 对每页首卡断言 getComputedStyle(...).borderRadius 非空（脚本不入库，复跑命令：cd /tmp/opencode && node verify-all-embeds.mjs，期望 total:36 pass:36 failures:[]）

## 11. 关键事实（探索阶段结论，供实现参照）

- 嵌入目标 65 处 / 36 页，**全部**能命中 `02.论文笔记/<同名>.md`，无缺失
- 笔记 72 篇，71 篇自带 `# H1`；301 张图全为 `https://` 远程图；8 篇含 `$$`；0 mermaid；0 Obsidian callout
- 仅 2 篇笔记带 frontmatter `permalink`（`/meet/gmr`、`/meet/robotwin`），其余走源路径回链
- `math: true` 已启用；mermaid 由 `withMermaid` 提供；与本设计无冲突
