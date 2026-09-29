---
date: 2026-09-29 22:40:00
title: 2026-09-29-admin-tabs-design
---
# 设计:后台编辑器标签页管理

- 日期:2026-09-29
- 状态:已批准(按需预览已上线,本设计在其之上叠加标签页)
- 分支:`feature/admin-preview`

## 1. 目标与动机

给 `/admin/` 后台编辑器加标签页:每次打开一篇笔记成为一个标签页,可来回切换。

本功能顺带修掉一个**既有的静默数据丢失**:`openFile` 直接覆写 `editor.value`,全文无脏状态跟踪(`grep -E "dirty|未保存|beforeunload"` 无命中)。当前在编辑 A 时点开 B,A 的未保存修改直接消失且无任何提示。标签页为每个文件持有独立缓冲区,该问题随之消失。

不做:标签拖拽排序、标签分组、跨窗口/跨浏览器同步、键盘快捷键(`Ctrl+W` 是浏览器关闭标签页的快捷键,接管它等于提供一个关掉整个后台窗口的按钮,收益为负)。

## 2. 已确认的决策

| 决策项 | 结论 | 理由 |
|---|---|---|
| 刷新后恢复 | 完全恢复,含未保存内容 | 你已确认。需配容量降级,见 §6 |
| 预览开关 | 全局共享一个开关 | 你已确认。切标签只换内容不换布局,行为可预测 |
| 关闭带修改的标签 | `confirm` 弹窗确认 | 你已确认。误关即销毁缓冲内容 |
| 标签过多时 | 固定宽 + 横向滚动 | 你已确认。压缩会让标签窄到只剩几个字,容易点错 |
| 代码组织 | 单编辑面 + 抽出 `tabs.js` 独立模块 | 你已确认方案 C。`app.js` 将从 400 行涨到约 600 行,六件事挤一个文件会超出可读边界,而标签状态恰好边界干净、纯逻辑、可单测 |

## 3. 现状约束(实现前必须知道)

- **`currentFile` 有 9 处引用**:`openFile`、保存、删除、重命名、`renderPreview` 的 `path` 参数等。全部改为 `store.active()?.path`。
- **vault 里有 3 组同名文件**:`index.md`、`0010.openai api.md`、`0000.目录.md`。标签标题必须能消歧,见 §5。
- **`sessionStorage` 此前未被使用**,无 key 冲突。
- **`.split` 当前是 `height: 100%`**。在 `.split` 之上插入 `.tabbar` 后必须改为 `flex: 1` + `min-height: 0`。这与 2026-09-29「内容挤在左上角」事故同源(缺尺寸约束属性导致 flex 子项退回内容固有尺寸),必须显式声明并用 headless Chrome 量几何验收,不能只读 CSS。
- **保存/删除/重命名都是围绕 `currentFile` 的内联事件处理器**,没有独立函数。标签化时需要它们回调 store。
- vault 最大 `.md` 156,611 字节;sessionStorage 上限约 5MB。这是容量降级必须存在的原因。

## 4. 模块边界

新增 `admin/server/public/tabs.js`:**纯状态,零 DOM、零 fetch**。

```js
export function createTabStore({ storage, onChange })
```

- `storage`:注入 `{ getItem, setItem, removeItem }`,测试时塞假对象
- `onChange(state, meta)`:状态变化回调,`meta.reason` 告诉调用方需要做哪些 DOM 工作
- 内部状态:`{ tabs, activeId, previewOn, splitPct }`
- 方法:`open` `close` `setActive` `updateContent` `setView` `markSaved` `rename` `remove` `active` `get` `getState` `titles` `toJSON` `persist` `restore` `setPreviewOn` `setSplitPct` `markMissing`

**所有 DOM 写入留在 `app.js`。** `tabs.js` 只回答「哪些文件开着、各自什么状态、切过去」。

这一条边界是选方案 C 的主要回报:`tabs.js` 能在 `node --test` 里直接 import 测试,不需要浏览器、不需要 DOM shim。

`app.js` 改为 `<script type="module">`,用 `import { createTabStore } from './tabs.js'` 引入。执行时机从同步变为 defer,对现有代码无影响——所有 `$()` 引用都指向 `<body>` 底部的元素。

### 4.1 `onChange` 的 reason 契约

`app.js` 侧按 `meta.reason` 决定 DOM 工作:

| reason | 重渲染标签栏 | 载入编辑器内容 |
|---|---|---|
| `open` / `activate` / `close` / `rename` / `restore` | 是 | 是 |
| `content` / `saved` | 是 | **否** |

`content` / `saved` 必须不重载编辑器,否则会重置光标与选区。这是 reason 机制存在的原因。

## 5. 数据模型

```js
{
  id,          // === path。path 天然唯一,重命名时同步更新
  path,
  content,     // 缓冲区当前内容(含未保存修改)
  mtime,       // 磁盘 mtime,恢复后用于比对
  parseError,  // 不持久化,恢复后重拉
  cursor,      // 光标位置
  scrollTop,   // 编辑器滚动位置
  dirty,       // 显式布尔标志
  missing,     // 恢复后校验发现文件已不存在
}
```

**`dirty` 用显式标志,不用 `content !== savedContent`。** 后者需要在每个标签里留一份内容副本;20 个标签就是双倍内存,而 5MB 的 sessionStorage 本来就紧张。显式标志只有一处风险——必须保证所有改变 `content` 的路径都正确置位,这些路径是封闭的:`input` 事件置 `true`,`open`(载入磁盘内容)与 `markSaved`(保存成功)置 `false`。

`missing` 是「完全恢复未保存内容」的直接后果,见 §6.2。

### 5.1 标签标题消歧

因 vault 存在同名文件,三级降级:

1. 默认 `basename`(如 `20251111.md`)
2. 若同一 store 内有多个已开标签的 `basename` 相同 → 升级为 `父目录/basename`
3. 若仍相同(不同父目录下的同名文件)→ 用完整相对路径

`titles()` 是纯函数,只依赖当前 tabs,不做 I/O。

### 5.2 关闭标签后的归属

- 关闭非活动标签:活动标签不变
- 关闭活动标签:优先激活其**右侧**相邻标签;没有右侧则取左侧;两侧都没有则清空 `activeId`
- 关掉最后一个标签:`activeId = null`,`#editor-content` 加回 `hidden`、`#editor-empty` 去掉 `hidden`,回到「选择或创建一个文件开始编辑」。这条与 `delete` 的空态处理是同一条规则,`close` 与 `remove` 共用
- 关闭 `missing` 的标签:不弹 dirty 确认(缓冲内容对应文件已不存在,留着的价值只是查看)

## 6. 持久化与恢复

### 6.1 写入

- key:`admin.tabs.v1`
- 值:`{ activeId, previewOn, splitPct, tabs: [{id, path, content, mtime, cursor, scrollTop, dirty}] }`
- **不存 `parseError`**,恢复后重新拉取
- 写入时机:`input` 防抖 500ms(与预览的 300ms 防抖分开,两者时机不同)、切标签、关标签、`beforeunload`

### 6.2 容量降级

sessionStorage 约 5MB,vault 最大笔记 156KB。写入前先 `JSON.stringify` 量长度:

1. 正常写
2. 超 4MB → 剥离所有 tab 的 `content`(只留 path 与元数据)后写
3. `setItem` 仍抛(浏览器可能给更小的配额)→ 只写 `{ activeId, previewOn, splitPct }`

全程 `try/catch` + `console.warn`,**任何一档失败都不阻断编辑功能**。降级发生时在标签栏给一个提示,让用户知道未保存内容不会被保留。

### 6.3 恢复与文件校验

启动时读 sessionStorage 恢复。若 JSON 解析失败或结构不合法 → 丢弃并 `removeItem`,按空状态启动,不抛错阻断启动。

**恢复后必须校验文件是否仍存在。** 恢复的是「当时的未保存内容」,而磁盘上的文件可能已被删除或改名(例如期间在服务器上 `git pull` 过)。tree 加载完成后核对每个 tab 的 `path`:

- 不在 tree 里 → 置 `missing: true`
- 标题加删除线、保存按钮禁用、关闭时不提示 dirty、预览仍可显示(缓冲内容还在)

不做这一步的后果很具体:你会打开一个已被删除的文件,看到有内容,随手一存,就在磁盘上重新创建了它。

## 7. UI

```
#editor-content
├── .tabbar
│   ├── .tabbar-scroll   (overflow-x: auto)
│   │   └── .tab × N     固定 180px, flex: 0 0 180px
│   └── .tabbar-nav     ‹ ›   仅横向溢出时出现
└── .split
    ├── .pane-source
    ├── .divider
    └── .pane-preview
```

- 单个 tab:脏点(仅 `dirty` 时)+ 文件名(超宽省略)+ `×`
- 活动 tab:accent 色下边框
- 横向滚动:`.tabbar-scroll` 用 `overflow-x: auto`;两端 `‹ ›` 按钮 `scrollBy`,仅在 `scrollWidth > clientWidth` 时显示
- `.tabbar` 本身需 `flex-shrink: 0`,否则会被 `.split` 挤压——与 §3 同源的坑
- `title` 属性显示完整相对路径与「已修改」状态,便于同名文件辨认

## 8. 错误处理

| 场景 | 行为 |
|---|---|
| 打开文件 fetch 失败 | 不创建 tab,`alert` 提示(与现有 `openFile` 一致) |
| 关闭 dirty tab | `confirm` 取消则中止;确认则关闭 |
| 删除文件成功 | 强制关掉对应 tab(`remove`,不走 dirty 确认),归属规则见 §5.2 |
| 重命名成功 | `store.rename(id, newPath)` 更新 id 与 path,标题重算,立即重写 sessionStorage |
| sessionStorage 写失败 | `console.warn`,功能不受影响 |
| 恢复的结构非法 | 丢弃,按空状态启动 |
| `beforeunload` 存在 dirty tab | 交给浏览器原生提示 |
| 容量降级发生 | 标签栏给提示,说明未保存内容不会被保留 |

## 9. 与现有代码的整合

| 现有位置 | 改法 |
|---|---|
| `let currentFile = null`(全局) | 删除,改由 `store.active()?.path` 提供 |
| `openFile(path)` | 改为 `openTab(path)`:store 已有该 path 则激活,否则 fetch 后 `store.open(...)` |
| 保存处理器 | `store.active()?.path` + `editor.value`;成功后 `store.markSaved(id, { mtime })` |
| 删除处理器 | 成功后 `store.remove(id)` |
| 重命名处理器 | 成功后 `store.rename(id, newPath)` |
| `renderPreview` 的 `path` | `store.active()?.path ?? ''` |
| `highlightActive(path)` | 跟随活动 tab |
| 分隔条拖动 | `splitPct` 收进 store(不再只写 CSS 变量),从而可持久化 |
| 预览开关 | 移入 store,与 `previewOn` 一同持久化 |
| 新增 | `beforeunload` 脏检查 |
| `index.html` | 新增 `.tabbar`;`app.js` 的 `<script>` 加 `type="module"` |

## 10. 测试

新增 `tests/admin/tabs.test.mjs`,纯 `node --test` + 注入假 storage,13 个用例:

1. 打开同一文件两次只产生一个 tab,第二次是激活而非新建
2. `updateContent` 置 `dirty`,`markSaved` 清除,`setView` 记录光标与滚动位置
3. 关闭 dirty tab 返回 `{ ok: false, reason: 'dirty' }` 且不真删
4. 关闭活动标签优先激活右侧相邻,无右侧取左侧
5. 关掉最后一个标签清空 `activeId`(§5.2)
6. `rename` 后 id 同步更新,且 `open(新path)` 能激活而非新建
7. `remove` 强制关闭,绕过 dirty 检查
8. 同名文件的标题消歧(三级降级,2 个用例)
9. `persist`/`restore` 往返一致,含 `previewOn` 与 `splitPct`
10. 容量超限时降级为无 `content`,但 tab 与 path 仍在
11. 恢复非法 JSON 不抛,丢弃并按空状态
12. 恢复时 path 缺失 → 标 `missing: true`

全量目标:`108 + 13 = 121` pass / 0 fail。

浏览器侧另需 headless Chrome 量几何验收(§3 的 `.split` 高度改动),判据:活动 tab 宽度 180px、`#editor` 高度 > 300px、切标签后 `#editor` 内容与光标位置正确、`missing` tab 有删除线样式。

## 11. 部署

沿用 2026-09-29 预览功能已验证的流程:rsync(排除 `docker-compose.yml`)→ md5 逐文件核对 → 打回滚标签 → `docker compose up -d --build`(**必须带 `--build`**)→ 容器内 md5 核对 → 线上 HTTP 与 MIME 抽查。

改动落在 `admin/server/public/`,会被 `COPY public ./public` 层带入,不需要改 Dockerfile(本分支已含 `COPY shared ./shared`)。

## 12. 遗留项(不在本设计范围)

- **移动端不可用**:390px 视口下 textarea 仅 55px 宽、触屏拖不动分隔条。这是预览功能上线前就存在的问题(`#sidebar` 固定 280px),非回归
- `deploy.yml` 的 `paths:` 不含 `admin/**`,故本功能与预览功能均无 CI 强制,「测试通过」目前只是本地事实
- 根 `package-lock.json` 解析 markdown-it 14.1.1,与 `pnpm-lock.yaml` 的 14.1.0 不一致;CI 用 pnpm,该 npm lockfile 实为遗留
- `title` 字段后端仍在返回、前端未消费,属契约遗留
