---
date: 2026-09-30 11:20:00
title: 2026-09-30-admin-tabs-batch-close-design
---
# 设计:后台编辑器标签页批量关闭

- 日期:2026-09-30
- 状态:设计已批准,待用户审查书面规格
- 分支:`main`(已合并上一轮标签页功能)

## 1. 目标与动机

标签页功能上线后,每个标签只有单个 `×` 关闭按钮。编辑器场景的常用批量关闭——**关闭其他标签页、关闭右侧标签页、全部关闭**——缺失。这些操作在笔记整理(一次开 20+ 标签,读完后批量收掉)时是刚需。

本功能只做批量关闭与入口,不做:标签拖拽排序、分组、跨窗口同步(均在已批准规格 §1 的排除清单里,此设计不推翻)。

## 2. 已确认的决策

| 决策项 | 结论 | 理由 |
|---|---|---|
| 入口形态 | 标签右键菜单 | 你已确认。Obsidian/VSCode 同款,不占标签栏宽度 |
| 批量关闭遇 dirty | 一次汇总确认后全关 | 你已确认。与单标签 confirm 决策统一,且避免 N 次弹窗 |
| 关闭后归属 | 标准归属(见表 1) | 你已确认。与 VSCode/Obsidian 行为一致 |
| `×` 按钮 | 保留 | 你已确认。常开关闭最快路径,菜单「关闭」为同义补充 |
| 实现层 | 批量逻辑进 store(方案 A) | 你已确认。归属规则纯状态可单测,一次 emit 避免 N 次重渲染 |

## 3. 现状约束(实现前必须知道)

- `tabs.js` 已有一套 `close`(带 dirty 检查)/`remove`(强制)成对模式,批量方法沿用同一约定。
- `app.js` 的 `onChange` 用 `RELOAD_REASONS = new Set(['open','activate','close','rename','restore','missing'])` 决定是否重载编辑器;`content`/`saved` 绝不重载。三个新 reason 只需并入该集合,不加新分支。
- `.tab` 元素由 `renderTabBar(state)` 全量重建(`replaceChildren`),右键监听挂在 `renderTabBar` 创建的元素上,重建后天然被清理,无内存泄漏面。
- 菜单不用 `index.html` 新结构,JS 动态创建挂 `body`。故本功能 `index.html` 零改动。
- 已上线功能:`beforeunload` 脏检查、`persistSoon` 500ms 防抖、容量三档降级——批量关闭后的状态变化直接复用这些,无新持久化逻辑。

## 4. store API:三个批量关闭方法

新增内部辅助 `countDirty(list)` → 返回列表中 `dirty && !missing` 的数量。**missing 永不计数、永不弹确认**(沿用 §5.2 现有规则:missing 的缓冲对应文件已不存在,留着的价值只是查看)。

三个方法共用同一成对模式:`force=false` 时范围内有 dirty 即拒绝并返回 `{ ok:false, reason:'dirty', count }`,且**不改任何状态**;`force=true` 时直接关闭(供 app 层确认后重调)。锚点不存在返回 `{ ok:false, reason:'not-found' }`。

### 4.1 `closeOthers(anchorId, { force = false } = {})`

- targets = 除锚点外全部 tab
- 拒绝条件:`countDirty(targets) > 0 && !force`
- 执行:`state.tabs = [anchor]`;`activeId = anchorId`(标准归属:锚点激活,无论原活动在哪)
- `emit('close-others', anchorId)`

### 4.2 `closeRight(anchorId, { force = false } = {})`

- targets = 锚点右侧全部
- 拒绝条件:`countDirty(targets) > 0 && !force`
- 执行:`state.tabs = slice(0, idx+1)`;仅当原活动落在 targets 内时 `activeId = anchorId`,否则保持不变(含原活动就是锚点或在其左侧)
- 锚点已是最后一个 → targets 为空,`countDirty` 恒 0,无条件 `{ ok:true }` 状态不变
- `emit('close-right', anchorId)`

### 4.3 `closeAll({ force = false } = {})`

- targets = 全部
- 拒绝条件:`countDirty(state.tabs) > 0 && !force`
- 执行:`state.tabs = []`;`activeId = null`(回编辑器空态,与现有关掉最后一个标签同一条规则)
- `emit('close-all', null)`

### 4.4 归属表(表 1)

| 操作 | 活动标签结果 |
|---|---|
| `closeOthers(anchor)` | 一律 `anchorId` |
| `closeRight(anchor)` | 原活动在右侧被关 → `anchorId`;否则不变 |
| `closeAll()` | `null`(空态) |

### 4.5 边界与守卫

- 锚点自身 dirty **不计入**拒绝计数(它被保留,没有数据损失风险)。此条与「拒绝不改状态」一样必须显式测试,防止把锚点也算进 count。
- missing 标签(dirty 或否)被照常关闭,不计数不弹窗。
- 三个方法都是单次数组操作 + 单次 `emit`,不逐标签触发。

## 5. onChange reason 契约扩展

| reason | 重渲染标签栏 | 载入编辑器内容 |
|---|---|---|
| `close-others` / `close-right` / `close-all` | 是 | 是 |

三个 reason 并入 `RELOAD_REASONS`,`onChange` 主体不加分支。理由:批量关闭与 `close` 一样是内容类变更——标签栏必须重画,活动标签可能被关、必须重载(重载走 `t.cursor` 恢复,语义与切标签一致)。`close-right` 即使活动标签未变也会重载编辑器,内容相同、光标按已存 `t.cursor` 恢复,无害且代码统一。

## 6. UI:右键菜单

### 6.1 触发与锚点

- `.tab` 上 `contextmenu` 事件 → `e.preventDefault()` → 以该标签 id 为**锚点**打开菜单
- 右键**不改变**活动标签(锚点 ≠ 活动,菜单操作作用于锚点)
- 菜单为 `body` 下动态创建的 `div`,`position: fixed` 定位于 `clientX/clientY`,右缘/下缘溢出时翻转

### 6.2 菜单项

```text
关闭               ← 等价 requestClose(anchor),保留 × 按钮语义
关闭其他标签页      ← closeOthers(anchor)
关闭右侧标签页      ← closeRight(anchor)
────────────────
关闭全部           ← closeAll()
```

### 6.3 禁用态(灰显不隐藏,菜单稳定)

| 菜单项 | 禁用条件 |
|---|---|
| `关闭` | 无 |
| `关闭其他标签页` | 仅 1 个标签 |
| `关闭右侧标签页` | 仅 1 个标签,或锚点已是最后一个 |
| `关闭全部` | 无(菜单开启时必 ≥1 个标签) |

### 6.4 菜单关闭时机

点菜单外空白、`Esc`、`.tabbar-scroll` 滚动、关闭/切换标签、任一菜单项执行后。

### 6.5 汇总确认

`count = 0` 不弹窗。否则:`window.confirm(...)`,三种操作各自文案:

- `关闭其他标签页将同时关闭 N 个未保存的标签，确定？`
- `关闭右侧标签页将同时关闭 N 个未保存的标签，确定？`
- `关闭全部标签页将同时关闭 N 个未保存的标签，确定？`

确认后以 `force: true` 重调用对应方法;取消则什么都不发生(菜单已关,锚点/活动/内容都不变)。

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| 锚点不存在(菜单开启后标签被并发操作关掉) | `{ ok:false, reason:'not-found' }`,`app.js` 静默忽略,不 alert |
| 批量关闭遇 dirty | 一次汇总 confirm;取消则无状态变化 |
| 菜单打开时点击了别处 | 关菜单,无副作用 |
| `Esc` 关菜单 | 同上 |
| 批量关闭后持久化 | 复用 `persistSoon()`,降级提示/失败 warn 走现有逻辑 |
| missing 标签 | 照常关闭、不计数、不弹窗 |

## 8. 与现有代码的整合

| 现有位置 | 改法 |
|---|---|
| `tabs.js` | 新增 `countDirty`、`closeOthers`、`closeRight`、`closeAll`;导出加入 3 方法 |
| `app.js` `RELOAD_REASONS` | 加入 `'close-others'`、`'close-right'`、`'close-all'` |
| `app.js` `renderTabBar` | `.tab` 元素追加 `contextmenu` 监听 |
| `app.js` 新增 | `openTabMenu(anchorId, x, y)`、`closeTabMenu()`、`batchCloseConfirm(kind, anchorId)` 三函数;菜单 DOM 与样式类 |
| `style.css` | 追加菜单样式(变量随现有暗色主题;层叠 z-index 高于 `.split`) |
| `index.html` | **零改动** |
| `beforeunload` / `persistSoon` / 容量降级 | 复用,不新增 |

## 9. 测试

`tests/admin/tabs.test.mjs` 追加 **10 个用例**(全量 121 → **131**):

1. `closeOthers` 保留锚点并激活,其余全关(tabs 仅剩锚点)
2. `closeOthers` 遇 dirty 拒绝返回 `{reason:'dirty', count}` 且状态不变;`force` 后全关
3. `closeOthers` 锚点自身 dirty 保留且不计入 count
4. `closeRight` 关掉锚点右侧;原活动在右侧 → 切锚点
5. `closeRight` 原活动在左侧或就是锚点 → 保持不变
6. `closeRight` 锚点是最后一个 → `{ok:true}` 且 tabs/activeId 原封不动
7. `closeAll` 全关 → `tabs: []`、`activeId: null`
8. `closeAll` 遇 dirty 拒绝计数,`force` 后全关
9. 三种批量对 missing 的 dirty tab 均不计数、直接关(不弹窗路径,store 层表现为不拒绝)
10. 边界与组合:`not-found` 拒绝;`closeOthers` 后 `open`/`rename` 仍正常

全量目标:`108 + 13 + 10 = 131` pass / 0 fail。

浏览器侧验收(headless Chrome,走已用过两次的假 fetch + store 直调剧本):
- 右键菜单能开、四项可点、禁用态正确(单标签时「关闭其他/关闭右侧」灰显)
- 汇总 confirm 文案正确;取消无状态变化;确认后标签数与归属符合表 1
- 菜单溢出翻转;Esc/点外关闭
- console error 计数 0

## 10. 部署

沿用已验证流程:`tabs.js`/`app.js`/`style.css` 三个文件 rsync(`--exclude docker-compose.yml`)→ md5 逐文件核对 → 打回滚标签 → `docker compose up -d --build` → 容器内 md5 核对 → 线上 HTTP/MIME 抽查(`/admin/tabs.js` 200)。改动全在 `admin/server/public/`,`COPY public ./public` 自动带入,无需改 Dockerfile。

## 11. 遗留项(不在本设计范围)

沿用上一份规格 §12:移动端不可用、`deploy.yml` 无 `admin/**` CI 强制、根 `package-lock.json` markdown-it 版本陈旧、`title` 字段后端未消费。`closeOthers` 不涉及拖拽排序,顺序按打开顺序固定。