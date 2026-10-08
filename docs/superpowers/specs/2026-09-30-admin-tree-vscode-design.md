---
date: 2026-10-01 21:57:10
title: 2026-09-30-admin-tree-vscode-design
---
# VSCode 式文件树设计规格

**日期：** 2026-09-30
**状态：** 待审查

## 1. 背景与目标

左侧文件树当前只有最基本的展开/折叠与打开能力：`renderTree` 按 `tree` 端点渲染，点目录行切换折叠、点文件行打开标签。新建文件/目录靠侧栏头部的 `prompt()` 弹窗输入**完整路径**（无法「在指定目录下新建」），重命名/删除只对**活动标签**的文件生效（编辑器工具栏按钮），目录无法重命名/删除，没有「全部折叠/展开全部」，展开态每次 `loadTree` 就丢失。

目标：升级为 VSCode 资源管理器的交互形态——

1. 在**指定目录**下新建文件、新建文件夹
2. 树内重命名（文件 + 文件夹）
3. 树内删除（文件 + 文件夹，非空目录二次确认走 force）
4. 侧栏「全部折叠」与「展开全部」一键操作
5. 展开/折叠状态跨刷新持久化
6. 树内行内输入（VSCode 式），替代 `prompt()`

服务端 `files` 模块与 `/admin/api` 端点已完整支持全部操作（`POST /file`、`DELETE /file`、`POST /dir`、`DELETE /dir?force=1`、`POST /rename`、`GET /tree`）且已被 `tests/admin/*.test.mjs` 全覆盖。**本功能服务端零改动。**

## 2. 决策摘要

| 项 | 决策 |
|---|---|
| 交互形态 | 右键菜单 + 悬停图标（VSCode 完全体），双通道 |
| 操作范围 | 新建文件/文件夹（指定目录）、重命名（文件+文件夹）、删除（文件+文件夹）、全部折叠、展开全部 |
| 展开态 | localStorage 持久化（collapsed-set 模型） |
| 输入交互 | 树内行内输入框（Enter 确认、Esc/空失焦取消、行内错误提示） |
| 实现结构 | 方案 A+：`app.js` 直改 + 新增 `tree-expand.js` 纯逻辑模块（同 `tabs.js` 模式，可 `node --test`） |
| 服务端 | 零改动 |

## 3. 约束

- 工作区有 **102 个无关未提交改动**（docs 笔记、`.obsidian/`、`admin/server/src/app.js` 的 `@fastify/static` hunk、`docs/.vitepress/*` 等）。**绝对禁止** `git add -A` / `git add .` / `git commit -a`；每个 commit 用显式文件路径 `git add`。`admin/server/public/app.js` 与带无关改动的 `admin/server/src/app.js` 是不同文件。
- 当前在 `main` 分支，**不要** `git push`。
- 纯逻辑放 `tree-expand.js`，零 DOM 零 fetch（同 `tabs.js` 纪律），可独立单测。
- `tree-expand.js` 必须同时被浏览器 `<script type="module">`（经由 `app.js` 的 import）与 `node --test` 使用——保持纯 ESM、无浏览器专有 API（localStorage 读写以注入 storage 的方式实现，同 `tabs.js` 的 `storage` 参数模式）。
- `renderTree` 现有 XSS 纪律保持：文件名/路径一律 `textContent`，不拼 `innerHTML`。
- 现有树行为不破坏：点目录名折叠/展开、点文件行打开标签、`highlightActive` 高亮。

## 4. 架构

```
admin/server/public/
├── tree-expand.js    新增:纯逻辑(路径工具/展开态集合/renameMap),无 DOM 无 fetch
├── tabs.js           零改动(目录重命名同步由前端遍历 store.rename 完成)
├── app.js            树渲染扩展、悬停操作、右键菜单、行内输入状态机、标签同步
├── style.css         新增树交互样式
└── index.html        侧栏头部按钮调整为 5 个图标
```

### 4.1 `tree-expand.js`（新增，纯函数模块）

导出接口：

```js
// 路径工具
pathDir(p)            // "notes/a.md" → "notes"; "a.md" → ""
pathBase(p)           // "notes/a.md" → "a.md"
pathJoin(dir, name)   // "notes" + "b.md" → "notes/b.md"; "" + "b.md" → "b.md"
defaultName('file')   // "未命名.md"
defaultName('dir')    // "新建文件夹"
findConflict(nodes, fullPath) // 在树 nodes 中按 path 精确匹配查找 fullPath,
                              // 找到返回 {name,path,type},未找到返回 null
                              // (前端预检;最终一致性与 409 兜底由服务端 safeResolve 保证)

// 展开态:collapsed-set 模型。storage 注入(同 tabs.js 的 storage 参数)。
createCollapsedSet()            // 空 Set
setFromTree(tree, mode)         // mode='collapseAll' → 全部目录 path 的 Set;'expandAll' → 空 Set
prune(set, allDirPaths)         // 返回新 Set:仅保留集合中仍存在于 allDirPaths 的路径(目录被删/改名后清理)
saveCollapsed(set, storage)     // JSON 数组写 storage,key 'admin.tree.collapsed.v1'
loadCollapsed(storage)          // 读回 Set;非法 JSON/缺 key → 空 Set
isCollapsed(set, dirPath)       // 缺省=false(默认展开)

// 目录重命名映射
renameMap(oldDir, newDir, paths) // [{from,to}]:paths 中以 oldDir+"/" 为前缀者
                                // 映射为 newDir 前缀;oldDir 本身(根即空串)不进表
```

**关键决策（collapsed-set 模型）：** 持久化「折叠」集合，**缺省 = 展开**。新目录（不在集合中）默认展开；「全部折叠」→ 集合=当前全部目录并写盘；「展开全部」→ 集合=空并写盘。`loadTree` 渲染时按集合隐藏对应 `.tree-children`。`loadCollapsed` 后不立即 prune——prune 与「当前树」绑定，应在每次渲染前执行。

### 4.2 `app.js` 改动

- **渲染**：`renderTree` 节点结构改为
  ```
  .tree-row(data-path, data-type)
  ├── .tree-item              (icon + name;既有点击语义保留)
  │   ├── .tree-actions       (悬停操作组,dir 4 个 / file 2 个)
  ├── .tree-children[hidden]  (折叠时 hidden)
  ```
- **右键菜单**：新增 `.tree-menu` 固定定位浮层，复用批量关闭 `.tab-menu` 的定位/翻转/Esc/点外收起机制（同一套辅助逻辑，独立 DOM 与菜单项）。菜单项：
  - 目录：新建文件、新建文件夹、重命名、删除
  - 文件：新建文件、新建文件夹（作用于所在目录）、重命名、删除
  - 树空白区：新建文件(根)、新建文件夹(根)、— 分隔线 —、展开全部、全部折叠
- **悬停图标**：仅 CSS `:hover` 显示 `.tree-actions`；目录悬停显示 新建文件/新建文件夹/重命名/删除，文件悬停显示 重命名/删除，`title` 齐备。
- **行内输入**：单例输入行状态机（同一时刻至多一个可见输入行）：
  - 新建：目标目录 children 顶部（根目录则树顶部）插入 `<input class="tree-input">`，预填 `defaultName` 并全选
  - 重命名：将 `.tree-item` 的 name span 替换为输入框，预填原名，选中不含扩展名的部分
  - Enter → 客户端校验 → 调 API；校验失败或服务端错误（409/400/404）→ 输入行下方显示 `.tree-error` 行内红字，**不销毁输入，可继续改**；Esc 或空值失焦 → 取消
- **标签同步**：
  - 重命名文件：调 `POST /rename` 成功后若该 id 在标签页 → `store.rename(id, newPath)`
  - 重命名目录：`renameMap` 结果逐条 `store.rename`（内容/`dirty`/`missing` 均保留，仅改 `path`/`id`）
  - 删除文件：若在标签页 → `store.remove`（强关）
  - 删除目录：所有以 `旧目录/` 为前缀的标签 → `store.remove`
- **新增待办交互前** `persistSoon()` 保持标签持久化纪律（`store.rename`/`store.remove` 后）。

### 4.3 `index.html` / `style.css` / CSS 变量

- 侧栏头部按钮组（紧凑图标按钮，`title` 齐备）：`+`(新建文件) `+D`(新建文件夹) `⤒`(展开全部) `⤓`(全部折叠) `⟳`(刷新)。沿用现有 `sidebar-actions` 容器与按钮风格。
- 新增样式：`.tree-row`（多行结构）、`.tree-actions`（`opacity:0`，行 `:hover` 时显示；图标按钮小尺寸）、`.tree-input`（行内输入框，复用现有输入框变量）、`.tree-error`（行内红字，复用 `--danger`）、`.tree-menu`（固定定位、z-index 1000、暗色变量，参照 `.tab-menu`）。
- `--bg-secondary` / `--bg-tertiary` / `--danger` / `--text-muted` 等变量均已存在，不新增变量。

## 5. 交互契约

### 5.1 新建文件/文件夹（指定目录）

| 场景 | 行为 |
|---|---|
| 目录上触发 | 输入行出现在该目录 children 顶部；成功 → `loadTree`，目录保持展开（新建目录自动从折叠集移除） |
| 文件上触发 | 作用于文件所在目录（`pathDir`），输入行出现在该目录 children 顶部 |
| 空白区/侧栏按钮 | 输入行出现在树顶部（根目录） |
| Enter 成功 | `loadTree()`；新建文件成功后调用 `openTab(path)` 打开（VSCode 行为） |
| Enter 校验失败 | `.md` 后缀缺失 / 非空名缺失 / 同级重名 / 根级重名 → 行内红字，保留输入 |
| 服务端 409 等 | 行内红字展示服务端 message，保留输入 |
| Esc / 空失焦 | 取消并销毁输入行 |

### 5.2 重命名

| 场景 | 行为 |
|---|---|
| 文件重命名成功 | `store.rename` 同步（若打开）；`loadTree` |
| 目录重命名成功 | `renameMap` 逐条 `store.rename`；`loadTree`；目录保持展开（去折叠集） |
| 目标已存在 / 父目录缺失 / 非法 | 服务端 message 行内红字，保留输入 |
| 与服务端/标签一致性 | `from` 恒为操作前完整路径；to 仅 basename 段由用户编辑，目录部分继承原路径 |

### 5.3 删除

| 场景 | 行为 |
|---|---|
| 文件 | `confirm('确定删除 filePath?')` → `DELETE /file` → 标签 `store.remove` → `loadTree` |
| 目录(空) | `DELETE /dir`（无 force） |
| 目录(非空) | `confirm('目录含 N 项内容,确定连同内容一并删除?')` → `DELETE /dir?force=1` |
| 目录删除后 | 前缀匹配标签全部 `store.remove` → `loadTree` → prune 展开态集 |
| 取消 confirm | 无任何请求发出 |

### 5.4 展开态

| 操作 | 效果 |
|---|---|
| 点目录名 | toggle 折叠/展开，写入集合并 `saveCollapsed` |
| 全部折叠 | 集合 = 当前全部目录 path，`saveCollapsed`，渲染全部折叠 |
| 展开全部 | 集合 = 空，`saveCollapsed`，渲染全部展开 |
| `loadTree` 后/新目录出现 | 缺省展开（不在集合中）；渲染前 `prune` 清理失效路径 |
| 目录被删除/改名 | 集合中的旧路径被 prune（不报错、不留脏数据） |

## 6. 错误处理与安全

- 服务端所有失败均返回结构化 `{statusCode, message}`（fastify 既有的 `httpError` + `setErrorHandler` 收口），前端捕获后转行内 `.tree-error` 红字或 `alert`（删除/确认流）。**不静默吞错。**
- 路径注入：`tree` 树数据由服务端 `walk` 生成（已跳 `.` 开头与 `EXCLUDE_DIRS`）；新建/重命名路径由 `pathDir/pathJoin` 在**客户端已展开的真实目录**上生成，服务端 `safeResolve` 单点校验兜底（0 信任前端）。
- XSS：name/path 一律 `textContent`。
- 根目录保护：树根不是节点，UI 不出现「删除根/重命名根」；服务端 `removeDir` 对根返回 400 双保险。
- 并发：行内输入单例，Enter 期间禁用重复提交（防连点）——同一输入行在请求 pending 时 Enter 不触发第二次请求。

## 7. 测试

### 7.1 单元测试（`tests/admin/tree-expand.test.mjs`，纯 `node --test`）

| # | 用例 |
|---|---|
| 1 | `pathDir/pathBase/pathJoin` 常规与根级（`"a.md"` → dir `""`） |
| 2 | `defaultName` 文件/目录 |
| 3 | `findConflict`：路径精确命中、同 basename 不同路径（子目录同名）不命中、根级命中 |
| 4 | `setFromTree('collapseAll')` 得全部目录；`('expandAll')` 得空 |
| 5 | `isCollapsed` 缺省 false；加入后 true |
| 6 | `saveCollapsed/loadCollapsed` 注入假 storage 往返；非法 JSON → 空 Set |
| 7 | `prune` 移除失效路径、保留有效路径（返回新 Set 不可变原 Set） |
| 8 | `renameMap`：目录下两文件映射、非前缀文件不映射、根级(`""`)不映射、变 `from/to` 完整路径正确 |
| 9 | `renameMap` 空目录/无匹配 → `[]` |

新增 `tree-expand.test.mjs` 后全量 **131 → 140**。

### 7.2 Headless E2E（临时副本，不入库）

沿用批量关闭的临时副本 + 假 fetch + `--dump-dom` 验收模式：

1. 右键目录 → `.tree-menu` 出现、项集合正确、锚点路径正确；右键文件 → 含新建(所在目录)项；空白区 → 根新建 + 展开/折叠项
2. 右键菜单定位：右下角开菜单不出视口（翻转）；Esc / 点外收起
3. 悬停 `.tree-actions` 存在且项数正确（dir 4 / file 2）
4. 行内新建文件：Enter 成功→`POST /file` 被假 fetch 记录；重名 → 显示 `.tree-error` 且输入保留；Esc → 输入行销毁
5. 重命名文件：`POST /rename`、已打开标签 `store` id 变为新路径（断言 `getState()`）
6. 重命名目录：`renameMap` 全覆盖、打开标签前缀同步断言
7. 删除目录（非空）→ confirm 文案正确；取消无请求；确认 → `force=1` 请求参数断言
8. 展开全部/全部折叠 → 全量 children hidden 状态断言
9. **展开态跨刷新持久化**：`--user-data-dir` 共享 profile 两次 dump——第一次折叠某目录并 dump，第二次刷新后断言仍折叠
10. console error 0

另需确认头部的 5 个按钮 `title` 与可点性（`new-file-btn`/`new-dir-btn` 语义改为「根级新建」，行为与空白区菜单一致）。

## 8. 部署与回归

- 部署文件：`admin/server/public/{tree-expand.js, app.js, style.css, index.html}`（4 个，`tabs.js` 不变）
- 部署纪律沿用：rsync `--exclude docker-compose.yml` → md5 三层核对 → 回滚标签 → `docker compose up -d --build` → 容器内 md5 → 线上 HTTP 抽查
- 回归：`npm test` 全量 140；批量关闭右键菜单（tab-menu）与新建 tree-menu 互不干扰；预览/保存/删除/重命名/切标签/刷新恢复不回归

## 9. 验收清单（人工，`https://blogs.lovetulin.cn/admin/`）

1. 右键任意目录 → 四项菜单；悬停目录 → 4 个操作图标；悬停文件 → 2 个
2. 目录右键「新建文件」→ 行内输入、Enter 创建并打开；重名报行内红字可改
3. 目录右键「新建文件夹」→ 行内输入、Enter 创建，目录自动展开露出结果
4. 右键文件重命名 → 行内输入、保存后标签标题同步变
5. 右键目录重命名 → 其下已打开的标签全部同步
6. 删除文件/空目录/非空目录 → confirm 文案正确，非空目录二次确认项数
7. 「全部折叠」「展开全部」生效；刷新页面后折叠状态保持
8. 空白区右键出现「新建(根)/展开全部/全部折叠」
9. 场景回归：保存、删除、重命名、切标签、批量关闭、预览开关、刷新恢复均不回归