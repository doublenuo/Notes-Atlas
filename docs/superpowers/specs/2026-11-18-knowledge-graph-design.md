# 知识网络：反向链接与相关笔记设计

- 日期：2026-11-18
- 状态：已确认，待实现
- 范围：`docs/` 下正文页文末的「相关笔记」与「被引用」两个区块，以及构建期索引
- 不在范围：系列/上一篇下一篇导航、/graph 图谱页、Markdown 链接解析、正文内高亮、链接推荐提示、后台管理界面

## 1. 目标与约束

### 目标

- 每篇正文页在文末自动展示两块内容：
  - **相关笔记**：最多 5 条，按可解释的相关度排序；
  - **被引用**：全站其他页面通过 `[[...]]` / `![[...]]` 指向本页的引用列表。
- 数据在**构建期**算好，通过 `transformPageData` 注入页面数据并随 HTML SSR 输出：
  - 读者无需额外请求即可看到内容；
  - 搜索引擎能抓到链接；
  - PWA 离线可用，不产生布局抖动。
- 没有内容时整块不渲染，不出现空标题或空占位。
- 复用现有 `permalinks.ts` 的 URL 体系与 `obsidianEmbed.js` 的解析规则，不另起一套口径。

### 现有系统事实（2026-11-18 实测）

- 站点：VitePress 1.6.4 + `vitepress-theme-teek` 1.5.6，`docs/` 下 365 个 md。
- 内容分布：
  - 182 篇正文（去 frontmatter 后 > 100 字符）；
  - 203 篇有 `tags`（平均 2.0 个），共 31 个标签；Top：机器人操作 59、运动控制 45、人形机器人 45、强化学习 39、教程 32；
  - 224 篇有 `categories`，共 12 个分类；Top：论文笔记 89、组会记录 44、深度学习与大模型 20、开发工具与环境搭建 20。
- 链接分布：
  - 全站只有 78 处 `[[...]]` / `![[...]]`，涉及 43 篇；
  - 站内 Markdown 链接（`[x](/...)`）只有 6 处，且不在笔记之间；
  - 组会记录 44 篇正文中位数仅 58 字符，内容几乎全是 `![[论文]]` 独立行。
- 相关技术事实：
  - `docs/.vitepress/permalinks.ts:133` 的 `collectPages(srcDir)` 已有 `PageInfo { rel, url, title, dir }`，URL 无前导斜杠；
  - `docs/.vitepress/plugins/obsidianEmbed.js` 的 `createResolver(docsRoot)` 返回 `resolveNote(target, hostPath) → { absPath, relPath } | null`；
  - teek 的 `doc-after` 插槽位于正文之后、页脚与评论区之前（`node_modules/vitepress-theme-teek/es/components/theme/Layout/src/index.vue2.mjs:410`）；
  - VitePress 会把 `transformPageData` 的返回值合并进 `pageData`，再经 `injectPageDataCode` 序列化进页面模块（`node_modules/vitepress/dist/node/chunk-D3CUZ4fa.js:36726`、`:36765`），客户端可用 `useData().page` 读取。

### 关键约束

- 不改 `obsidianEmbed.js` 的渲染语义；扫描规则必须与渲染器保持一致，避免“显示成了链接但反链里没有”或反之。
- 不引入任何运行时依赖，不新增客户端请求。
- 不改动现有页面正文；组件只挂在插槽上。
- URL 一律来自 `collectPages`，禁止组件或插件自行拼接。
- 反链来源必须排除“只有 frontmatter 的空壳页”，但不能误伤组会页这类“正文由嵌入构成”的页面。

## 2. 总体架构

```text
config.ts 加载
  ├─ PAGES = collectPages(DOCS_ROOT)            （现有）
  ├─ GRAPH = buildKnowledgeGraph(DOCS_ROOT, PAGES)   （新增，同步一次）
  │     ├─ 扫描每篇 md 的正文，提取 [[...]] / ![[...]]
  │     ├─ resolveNote 命中 → relPath → PageInfo
  │     └─ 生成 { backlinks, related }
  └─ transformPageData(pageData)
        └─ pageData.connections = GRAPH[relativePath]

VitePress 构建
  └─ 每页 __pageData 内含 connections → SSR 渲染

浏览器
  └─ ArticleConnections.vue（doc-after 插槽）
        └─ useData().page.value.connections → 两块列表
```

新增与改动的文件：

| 文件 | 作用 |
|---|---|
| `docs/.vitepress/plugins/knowledgeGraph.ts` | 新增。纯函数：链接提取、图构建、相关度评分 |
| `docs/.vitepress/permalinks.ts` | 改动一行：`stripOrdinal` 加 `export`（生成人类可读分区名） |
| `docs/.vitepress/config.ts` | 构建图、注册 `transformPageData` |
| `docs/.vitepress/theme/index.ts` | 把组件挂到 `doc-after` 插槽 |
| `docs/.vitepress/theme/components/ArticleConnections.vue` | 新增。展示组件 |
| `tests/knowledge-graph.test.mjs` | 新增。纯函数单测 |

### 为什么不用客户端拉 JSON

备选方案是构建期生成 `connections.json`、组件 mount 后 `fetch`。它更解耦，也便于未来做 /graph，但代价是首屏无内容（SEO 抓不到反链）、需要处理布局抖动，并要给 PWA 增加缓存规则。本设计选择 SSR 注入；未来做 /graph 时，构建期额外落一份 JSON 即可，索引逻辑可复用。

## 3. 数据模型

```ts
/** 一条指向某页的引用/推荐 */
export interface NoteRef {
  rel: string      // 源文件相对 docs 的 posix 路径，如 "01.组会材料/2026-10-29 组会.md"
  url: string      // 站内绝对路径，以 / 开头，如 "/study/linux-intro-filesystem"
  title: string
  section: string  // 人类可读分区，如 "学习笔记 · 强化学习基础"
}

export interface RelatedNote extends NoteRef {
  reason: string   // 如 "共同标签：强化学习" / "同目录" / "互相引用"
}

export interface Connections {
  backlinks: NoteRef[]     // 谁引用了本页，按日期倒序
  related: RelatedNote[]   // 相关笔记，最多 5 条
}
```

- 键统一用 `rel`（`PageInfo.rel`），不使用 URL 做身份，避免 permalink 变更时索引错位。
- `url` 生成规则：`PageInfo.url === 'index'` → `/`；否则 `/${url}`。
- `section` 生成规则：取 `PageInfo.dir` 的目录段，`stripOrdinal` 去掉序号前缀后，顶层 + 末级用 ` · ` 连接；只有一级时只显示一级。
  - `02.学习笔记/06.强化学习基础` → `学习笔记 · 强化学习基础`
  - `01.组会材料` → `组会材料`
- `pageData.connections` 对没有正文或没有关系的页面也写入空结构 `{ backlinks: [], related: [] }`，保证客户端读取时类型稳定。

## 4. 链接提取（与渲染器对齐）

扫描对象：每篇 md 的正文（`gray-matter` 剥离 frontmatter 之后的内容）。逐篇生成有向边 `source.rel → target.rel`。

### 4.1 预处理

1. 剔除围栏代码块：行首 0-3 个空格 + ` ``` ` 或 `~~~`，闭合要求同字符且长度不小于开栏、行尾无 info string（与 `obsidianEmbed.js` 的 `demoteHeadings` 同一套判定）。
2. 剔除行内代码：成对的单反引号或多反引号 `` `...` `` 内容（先于 wiki 扫描，避免把示例语法当链接）。
3. 不剔除 4 空格缩进行中的行内链接：实测全库只有 3 处 `[[` 出现在缩进行，且都在围栏代码里；按“围栏 + 行内代码”两级过滤已足够，额外跳过缩进行会误伤列表内容。

### 4.2 独立行嵌入（`![[...]]`）

仅当整行满足以下条件时计入（与 `createEmbedRule` 一致，见 `obsidianEmbed.js:150`）：

- 行首空格少于 4 个（渲染器按“相对块缩进”计算；扫描器按绝对缩进近似，实测库内独立行嵌入都不在列表缩进中）；
- `line.trim()` 完全匹配 `^!\[\[([^\]\n]+)\]\]$`。

行中出现的 `![[...]]`（如 `前文 ![[Alpha]] 后文`）在渲染器里保持原文，**不计入**。

### 4.3 行内链接（`[[...]]`）

- 扫描 `[[` 到最近的 `]]`，目标为中间文本 `trim()` 后非空且不含换行；
- 若 `[[` 前一个字符是 `!`（即行中嵌入）则跳过；
- 目标含 `|` 或 `#` 时，渲染器会把它当作目标去解析并失败、保持原文，因此扫描同样**不命中、不计入**（不要自作主张剥离别名或标题）。

### 4.4 解析与去重

- 对每个目标调用 `resolveNote(target, sourceRel)`；`hostPath` 传相对 docs 的源路径即可（解析器内部会 `pathResolve(docsRoot, dirname(hostPath), ...)`）。
- 命中后取 `relPath`，在 `PAGES` 中查 `PageInfo`；查不到（目标被 `srcExclude` / 被排除目录）则忽略。
- 同一源页对同一目标多次引用只计一次。
- 自引用忽略。

### 4.5 范围限制

- **不递归展开嵌入**：组会页嵌入的论文笔记内部如果还有 `[[...]]`，不传播为组会页的出链。理由是渲染层的递归展开有深度上限与循环检测，构建期若跟随会引入同等复杂度，且会把“论文内部的引用”误算成“组会页的引用”。这是一条显式取舍，记录在此。
- 未命中目标不重复告警（渲染器已经会在页面上告警），构建期静默跳过。

## 5. 反链与相关度

### 5.1 反链

- 边的目标页即获得一条反链，来源信息取 `PAGES` 的 `title` / `section`。
- **来源门槛**：正文 `trim()` 后非空即可（即排除 123 个只有 frontmatter 的空壳页），同时来源必须是正文页：`frontmatter.article !== false` 且 `layout` 为空或 `'doc'`。
  - 这样组会页（正文只有几十个字符的嵌入行）仍然可以作为“引用者”，这是本功能最有价值的来源。
- 排序：frontmatter `date` 倒序；无 `date` 或日期非法的页面排在有日期的页面之后，同组内按 `rel` 升序。日期统一用 `new Date(value)` 解析，`NaN` 视为缺失。
- 数据不截断；展示层控制折叠。

### 5.2 相关笔记

候选页必须同时满足：

1. 在 `PAGES` 中；
2. 是正文页：`article !== false` 且 `layout` 为空或 `'doc'`；
3. **自有正文**（剔除独立行 `![[...]]` 后）`trim()` 长度 > 100，避免把空壳页和纯嵌入的组会页推荐成“相关笔记”；
4. 不是自己；
5. 至少满足以下之一：共同标签 > 0、同目录、直接 `[[...]]` 关联。

评分：

```text
score = 4.0 × 直接引用（任一方向）
      + Σ_tag 1 / ln(1 + df(tag))        // df = 全站含该标签的页数
      + 2.0 × 同分类（categories 有交集）
      + 1.5 × 同目录（PageInfo.dir 相同）
      + 0.5 × 同顶层分区（rel 第一段相同）
```

- IDF 的作用：`机器人操作`（59 篇）权重约 0.24，`双臂操作`（19 篇）约 0.34，`数据生成`（15 篇）约 0.37，避免大标签主导；罕见标签天然更强。
- 排序：`score` 降序 → `date` 降序 → `title` 本地化升序；取前 5。
- `reason` 取值优先级：
  1. 直接引用：双向 → `互相引用`；本页引用候选 → `本页引用`；候选引用本页 → `引用了本页`；
  2. 有共同标签 → `共同标签：<IDF 得分最高的那个标签>`；
  3. 同目录 → `同目录`。
- frontmatter 的 `tags` / `categories` 既可能是字符串也可能是数组，统一归一为字符串数组后再做交集与 `df` 统计。
- 同分类只加权、不作为入选条件：`论文笔记` 有 89 篇，单靠分类会把任意两篇论文笔记判为相关。

## 6. 构建期注入

`config.ts` 顶部（`PAGES` 之后）：

```ts
const KNOWLEDGE = buildKnowledgeGraph(DOCS_ROOT, PAGES)
```

导出签名：

```ts
export function buildKnowledgeGraph(
  docsRoot: string,
  pages: PageInfo[],
): Map<string, Connections>
```

`buildKnowledgeGraph` 内部用 try/catch 包住扫描；异常时 `console.warn` 并返回空 Map，**绝不让索引失败阻断整站构建**（降级为“没有知识网络区块”）。

`transformPageData`：

```ts
transformPageData(pageData) {
  return {
    connections: KNOWLEDGE.get(pageData.relativePath) ?? EMPTY_CONNECTIONS,
  }
}
```

- `pageData.relativePath` 是相对 `srcDir` 的源路径，与 `PageInfo.rel` 同口径。
- 不修改 frontmatter，避免污染 teek 的文章列表、RSS 等消费方。
- dev 与 build 走同一条路径；索引在配置加载时计算一次，**dev 下新增/删除链接需要重启**，与 `obsidianEmbed` 的文件清单索引行为一致。

体积预估：每页最多 5 条相关 + 若干反链，约 0.6–1.5KB，365 页合计新增不到 0.5MB 构建产物。

## 7. 展示组件

`docs/.vitepress/theme/components/ArticleConnections.vue`，注册到 `doc-after` 插槽。

### 7.1 显示条件

- `frontmatter.article !== false`；
- `frontmatter.layout` 不存在或为 `'doc'`（排除 home/page）；
- `@pages` 下的功能页（留言板、友链、个人中心等）天然满足不了上一条，无需额外判断；
- `connections.backlinks` 与 `connections.related` 都为空时，整个组件渲染为空（`v-if` 在根节点）。

### 7.2 结构

```vue
<nav v-if="related.length || backlinks.length" class="na-knowledge" aria-label="知识网络">
  <section v-if="related.length">
    <h2 class="na-knowledge__title">相关笔记</h2>
    <ul class="na-knowledge__list">
      <li v-for="item in related">
        <a :href="item.url">{{ item.title }}</a>
        <span class="na-knowledge__meta">{{ item.section }}</span>
        <span class="na-knowledge__reason">{{ item.reason }}</span>
      </li>
    </ul>
  </section>
  <section v-if="backlinks.length">
    <h2 class="na-knowledge__title">被引用 <span class="na-knowledge__count">· {{ backlinks.length }}</span></h2>
    <ul class="na-knowledge__list">
      <li v-for="item in visibleBacklinks">…</li>
    </ul>
    <details v-if="backlinks.length > 5">
      <summary>展开其余 {{ backlinks.length - 5 }} 篇</summary>
      <ul>…</ul>
    </details>
  </section>
</nav>
```

- 反链默认显示前 5 条，其余收进原生 `<details>`：无 JS 也可用，SSR 结果一致。
- 标题用 `<h2>`；组件内的标题不会进入 teek 的右侧目录（目录只读 markdown 标题）。
- 链接直接使用数据里的 `url`；`target` 不加 `_blank`（站内导航）。

### 7.3 读取数据

```ts
const page = useData().page
const connections = computed<Connections>(() =>
  (page.value as any).connections ?? { backlinks: [], related: [] },
)
const related = computed(() => connections.value.related)
const backlinks = computed(() => connections.value.backlinks)
const visibleBacklinks = computed(() => backlinks.value.slice(0, 5))
```

- 用 `computed` 跟随 SPA 路由切换；VitePress 导航时会替换 `page.value`。
- 读取处集中做一次类型断言，组件其余部分保持类型安全。

### 7.4 样式

- scoped CSS，复用 teek/VitePress 变量：`--vp-c-divider`、`--vp-c-bg-soft`、`--vp-c-text-1/2`、`--vp-c-brand-1`；
- 与正文之间用 `margin-top: 32px` + 顶部分隔线区分；
- 列表项：标题一行，元信息（分区、原因）一行，小字号、弱化颜色；
- 移动端单列；不做折叠动画。

## 8. 失败与边界

| 场景 | 行为 |
|---|---|
| `buildKnowledgeGraph` 抛错 | `console.warn`，空图，站点正常构建 |
| 目标笔记不存在 / 不是页面 | 该边忽略，无告警（渲染器负责告警） |
| 目标在代码块或行内代码里 | 不计入 |
| 带别名的 `[[...]]`、带 `#` 锚点的 `[[...]]` | 不计入（与渲染器一致：渲染器把整段当目标去解析，失败后保持原文） |
| 行中 `![[...]]` | 不计入（与渲染器一致） |
| 自引用 | 忽略 |
| 空壳页（仅 frontmatter） | 不作为反链来源，也不作为相关候选 |
| 纯嵌入的组会页 | 可作为反链来源，不作为相关候选 |
| 页面无任何关系 | 组件不输出 DOM |
| teek 升级导致 `doc-after` 消失 | 组件只是不被渲染，不报错（fail-open） |
| dev 下新增链接 | 需重启 dev server 才生效 |

## 9. 测试

新增 `tests/knowledge-graph.test.mjs`，用临时目录构造最小 vault（参考现有 `tests/helpers.mjs` 的用法），覆盖：

1. 裸名 `[[Alpha]]` 与相对路径 `[[./sub/Beta]]` 都能解析成边；
2. 独立行 `![[Alpha]]` 计入；行中 `![[Alpha]]` 不计入；
3. `[[Alpha|别名]]`、`[[Alpha#小节]]`、`[[Alpha\n下一行]]` 不计入；
4. 围栏代码块与行内代码里的 `[[Alpha]]` 不计入；
5. 同页多次引用只生成一条；
6. 自引用被忽略；
7. 空壳页不作为反链来源；只有嵌入行的组会页**可以**作为来源；
8. 只有嵌入行的页面不作为相关候选（自有正文 ≤ 100）；
9. IDF 生效：共同罕见标签的候选排在共同大标签之前；
10. `reason` 优先级：直接引用 > 共同标签 > 同目录；
11. URL 复用 `collectPages` 的 permalink，`index` 首页映射为 `/`；
12. 无关页面返回 `{ backlinks: [], related: [] }`。

构建级验证（手动，写入 PR 说明）：

- `pnpm test` 全绿；
- `pnpm docs:build` 成功；
- 抽 3 类页面检查 dist HTML：有反链的论文笔记、只有相关笔记的文章、完全没有关系的页面；
- 确认 `na-knowledge` 出现在 SSR HTML 中、浏览器控制台无 hydration 警告；
- 检查预览站 `/preview/` 与 PWA 离线页正常（不新增资源请求）。

## 10. 不在本设计内

- 系列导航 / 上一篇下一篇；
- /graph 图谱页；
- Markdown 链接反链（全站仅 6 处）；
- 正文内高亮出处、悬浮预览；
- 自动推荐“该链接但没链接”的笔记；
- 基于全文嵌入的语义相关（属于方向 B）。

## 11. 风险与取舍

| 风险 | 说明 | 缓解 |
|---|---|---|
| 反链长期稀疏 | 目前只有 43 篇出链，多数文章“被引用”区块不显示 | 空则整块隐藏；相关笔记承担主要价值；后续可通过写作规范/工具慢慢补链接 |
| 大标签噪声 | `机器人操作` 59 篇 | IDF 加权 + 同目录/直接引用加分 + 同分类仅加权 |
| 索引与真实渲染不一致 | 自写扫描器可能漏判代码块/别名 | 规则逐条对齐 `obsidianEmbed.js`，并有单测覆盖 |
| pageData 体积 | 每页多约 1KB | 可接受；若未来反链暴增，改为只存前 N 条 |
| 与 teek 插槽耦合 | 插槽名升级可能变化 | 组件独立、fail-open，升级时只需改插槽注册 |
| dev 索引不热更 | 改链接后页面不立即反映 | 与现有 resolver 行为一致，接受；重启成本低 |

## 12. 后续方向（不在本次实现）

- 系列导航：复用 `PageInfo.dir` 排序，成本低；
- /graph：复用本索引额外输出 JSON；
- 「链接健康度」：统计无出链/无入链的页面，配合方向 C 的 `/status` 面板。
