---
date: 2026-09-29 23:05:00
title: 2026-09-29-admin-tabs
---
# 后台编辑器标签页管理 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 给 `/admin/` 后台编辑器加标签页，每次打开一篇笔记成为一个标签，可来回切换；刷新后连同未保存内容一起恢复。

**架构：** 单编辑面（唯一 `<textarea>` + 唯一预览面板）+ 独立纯状态模块 `public/tabs.js`。`tabs.js` 零 DOM 零 fetch，因此能直接 `import` 进 `node --test` 测；所有 DOM 写入留在 `app.js`，通过 `onChange(state, meta)` 的 `meta.reason` 决定做什么。顺带修掉既有静默数据丢失：`openFile` 直接覆写 `editor.value` 且无脏状态跟踪。

**技术栈：** 原生 ES module（浏览器侧，无构建）、`node --test`（测试侧）、sessionStorage 持久化、headless Chrome 几何验收。

**规格：** `docs/superpowers/specs/2026-09-29-admin-tabs-design.md`

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `admin/server/public/tabs.js`（新建，约 200 行） | 纯状态：tabs 数组、activeId、previewOn、splitPct；标题消歧；序列化/恢复/容量降级。**零 DOM、零 fetch。** |
| `tests/admin/tabs.test.mjs`（新建） | 9 个用例，注入假 storage，纯 node，不需要浏览器 |
| `admin/server/public/app.js`（修改，400 → 约 600 行） | 改 ES module；引入 store；`openTab` 取代 `openFile`；标签栏渲染；文件操作与 beforeunload 接 store |
| `admin/server/public/index.html`（修改） | 新增 `.tabbar` 结构；`app.js` 的 `<script>` 加 `type="module"` |
| `admin/server/public/style.css`（修改） | 标签栏样式；**修 `.split` 的高度约束**（见下） |

### ⚠️ 两条会静默出错的前提，实现前必读

1. **`.split` 当前是 `height: 100%`**，在它上面插入 `.tabbar` 后必须改成 `flex: 1` + `min-height: 0` 并**删掉 `height: 100%`**，`.tabbar` 必须 `flex-shrink: 0`。这与 2026-09-29「内容挤在左上角」事故同源——缺尺寸约束时 flex 子项退回内容固有尺寸，**不报错**。任务 4 必须用 headless Chrome 量几何验收。
2. **本仓库有 102 个与本功能无关的未提交改动**（绝大多数是 `docs/` 笔记内容）。**绝对禁止** `git add -A` / `git add .` / `git commit -a`。每个任务只 add 自己列出的文件，并用 `git status --porcelain | wc -l` 核对基线 **102**。

> **计划编写期已做的预验证：** 任务 1–3 的 `tabs.js` 与测试已抽出在仓库外单独跑过——**13 pass / 0 fail**，并用 5 个变异（去掉 dirty 守卫、放大 `PERSIST_LIMIT`、非法 JSON 不 `removeItem`、`markMissing` 取反、`open` 不去重）确认测试真的对被测逻辑敏感，5 个全部变红。
>
> 这个过程抓出了一个**计划自身的 bug**：`remove()` 原先在 `splice` **之后**才算下一个激活标签，而 `splice` 会让右侧元素左移一位，导致关掉 `[a,b,c]` 里的 `b` 后激活 `a` 而非 `c`。已修正（先算归属再删）。**所以任务 1 步骤 4 那一跑不要跳。**

---

### 任务 1：`tabs.js` 核心状态机

**文件：**
- 创建：`admin/server/public/tabs.js`
- 创建：`tests/admin/tabs.test.mjs`

- [ ] **步骤 1：编写失败的测试**

创建 `tests/admin/tabs.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createTabStore } from "../../admin/server/public/tabs.js";

function mkStore(extra = {}) {
  const storage = {
    data: new Map(),
    getItem(k) {
      return this.data.has(k) ? this.data.get(k) : null;
    },
    setItem(k, v) {
      this.data.set(k, v);
    },
    removeItem(k) {
      this.data.delete(k);
    },
  };
  return createTabStore({ storage, ...extra });
}

test("1 打开同一文件两次只产生一个 tab,第二次是激活", () => {
  const s = mkStore();
  s.open({ path: "a.md", content: "A" });
  s.open({ path: "a.md", content: "A" });
  const st = s.getState();
  assert.equal(st.tabs.length, 1);
  assert.equal(st.activeId, "a.md");
});

test("2 updateContent 置 dirty,markSaved 清除,setView 记录光标与滚动位置", () => {
  const s = mkStore();
  s.open({ path: "a.md", content: "A" });
  assert.equal(s.getState().tabs[0].dirty, false);
  s.updateContent("a.md", "AB");
  assert.equal(s.getState().tabs[0].dirty, true);
  assert.equal(s.getState().tabs[0].content, "AB");
  s.setView("a.md", { cursor: 7, scrollTop: 120 });
  assert.equal(s.get("a.md").cursor, 7);
  assert.equal(s.get("a.md").scrollTop, 120);
  s.markSaved("a.md", { mtime: "2026-09-29T00:00:00Z" });
  assert.equal(s.getState().tabs[0].dirty, false);
  assert.equal(s.getState().tabs[0].mtime, "2026-09-29T00:00:00Z");
});

test("3 关闭 dirty tab 被拒且不真删", () => {
  const s = mkStore();
  s.open({ path: "a.md", content: "A" });
  s.updateContent("a.md", "AB");
  const r = s.close("a.md");
  assert.deepEqual(r, { ok: false, reason: "dirty" });
  assert.equal(s.getState().tabs.length, 1);
});

test("4 关闭活动标签优先激活右侧相邻,无右侧取左侧", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  s.open({ path: "c.md" });
  s.setActive("b.md");
  assert.equal(s.close("b.md").ok, true);
  assert.equal(s.getState().activeId, "c.md"); // 优先右侧
  s.setActive("c.md");
  s.close("c.md");
  assert.equal(s.getState().activeId, "a.md"); // 无右侧取左侧
});

test("5 关掉最后一个标签清空 activeId", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  assert.equal(s.close("a.md").ok, true);
  const st = s.getState();
  assert.equal(st.activeId, null);
  assert.equal(st.tabs.length, 0);
});

test("6 rename 后 id 同步,open 新 path 激活而非新建", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.rename("a.md", "dir/b.md");
  const st = s.getState();
  assert.equal(st.tabs.length, 1);
  assert.equal(st.tabs[0].id, "dir/b.md");
  assert.equal(st.tabs[0].path, "dir/b.md");
  assert.equal(st.activeId, "dir/b.md");
  s.open({ path: "dir/b.md" });
  assert.equal(s.getState().tabs.length, 1);
});

test("7 remove 强制关闭,绕过 dirty 检查", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.updateContent("a.md", "AB");
  assert.equal(s.remove("a.md").ok, true);
  assert.equal(s.getState().tabs.length, 0);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd /home/weno/works/Notes-Atlas && node --test tests/admin/tabs.test.mjs`

预期：FAIL，报错 `Cannot find module '.../admin/server/public/tabs.js'`

- [ ] **步骤 3：实现最少代码让测试通过**

创建 `admin/server/public/tabs.js`：

```js
/**
 * 后台编辑器的标签页状态机。纯状态:零 DOM、零 fetch、零定时器。
 * 所有 DOM 写入留在 app.js,通过 onChange(state, meta) 回调通知。
 *
 * 这样切分是刻意的:本文件能直接被 node --test import 测试,不需要浏览器
 * 也不需要 DOM shim,而标签逻辑(脏标记/归属规则/容量降级)恰是最需要单测的部分。
 *
 * id 即 path:path 在 vault 内天然唯一,省掉一层自增 id 与 path 的映射,
 * 代价是重命名时要同步改 id(见 rename)。
 */

const KEY = "admin.tabs.v1";

/** 关闭一个 tab 后该激活谁:优先右侧相邻,无右侧取左侧。 */
function nextActiveId(tabs, closedIdx) {
  if (closedIdx < 0) return null;
  const right = tabs[closedIdx + 1];
  if (right) return right.id;
  const left = tabs[closedIdx - 1];
  return left ? left.id : null;
}

export function createTabStore({ storage, onChange = () => {} }) {
  const state = { tabs: [], activeId: null, previewOn: false, splitPct: 50 };

  const emit = (reason, id = null) => onChange(getState(), { reason, id });

  function getState() {
    return { ...state, tabs: state.tabs.map((t) => ({ ...t })) };
  }

  function get(id) {
    return state.tabs.find((t) => t.id === id) || null;
  }

  function active() {
    return state.activeId ? get(state.activeId) : null;
  }

  function open({ path, content = "", mtime = null, parseError = "", dirty = false, missing = false }) {
    const existing = get(path);
    if (existing) {
      // 已打开:只激活,不重复拉取,也不动缓冲区(否则会丢弃未保存内容)
      if (state.activeId === path) return { ok: true, created: false };
      state.activeId = path;
      emit("activate", path);
      return { ok: true, created: false };
    }
    state.tabs.push({ id: path, path, content, mtime, parseError, cursor: 0, scrollTop: 0, dirty, missing });
    state.activeId = path;
    emit("open", path);
    return { ok: true, created: true };
  }

  function setActive(id) {
    if (!get(id) || state.activeId === id) return;
    state.activeId = id;
    emit("activate", id);
  }

  /** 关闭。dirty 时拒绝并让调用方弹确认;missing 的 tab 不弹(文件已不存在)。 */
  function close(id) {
    const t = get(id);
    if (!t) return { ok: false, reason: "not-found" };
    if (t.dirty && !t.missing) return { ok: false, reason: "dirty" };
    return remove(id);
  }

  /** 强制关闭,绕过 dirty 检查。删除文件后用这个。 */
  function remove(id) {
    const idx = state.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return { ok: false, reason: "not-found" };
    const wasActive = state.activeId === id;
    // 归属必须在 splice 之前算:splice 会让右侧元素左移一位,
    // 之后按 idx 取右边会拿到「原本右两个」的元素(关 b 于 [a,b,c] 会得到 a 而非 c)。
    // 这个 bug 是用例 4 抓出来的——写完实现后先跑一遍测试,别直接往下走。
    const nextId = wasActive ? nextActiveId(state.tabs, idx) : null;
    state.tabs.splice(idx, 1);
    if (wasActive) state.activeId = nextId;
    emit("close", id);
    return { ok: true };
  }

  function updateContent(id, content) {
    const t = get(id);
    if (!t) return;
    t.content = content;
    t.dirty = true;
    emit("content", id);
  }

  /** 记录光标与滚动位置。刻意提供方法而非让调用方直接改字段:get() 返回的是活引用,靠引用改字段能碰巧生效,但那是没有声明的契约。 */
  function setView(id, { cursor, scrollTop }) {
    const t = get(id);
    if (!t) return;
    if (typeof cursor === "number") t.cursor = cursor;
    if (typeof scrollTop === "number") t.scrollTop = scrollTop;
  }

  function markSaved(id, { mtime = null } = {}) {
    const t = get(id);
    if (!t) return;
    t.dirty = false;
    if (mtime) t.mtime = mtime;
    emit("saved", id);
  }

  function rename(id, newPath) {
    const t = get(id);
    if (!t) return { ok: false, reason: "not-found" };
    if (get(newPath)) return { ok: false, reason: "duplicate" };
    t.path = newPath;
    t.id = newPath;
    if (state.activeId === id) state.activeId = newPath;
    emit("rename", newPath);
    return { ok: true };
  }

  return { getState, get, active, open, setActive, close, remove, updateContent, setView, markSaved, rename };
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`cd /home/weno/works/Notes-Atlas && node --test tests/admin/tabs.test.mjs`

预期：7 pass / 0 fail

- [ ] **步骤 5：Commit**

```bash
cd /home/weno/works/Notes-Atlas
git add admin/server/public/tabs.js tests/admin/tabs.test.mjs
git commit -m "feat(admin): tabs.js 标签页状态机核心

纯状态:零 DOM 零 fetch 零定时器,故能直接被 node --test import 测试——
标签逻辑(脏标记/关闭归属/重命名 id 同步)恰是最需要单测的部分。

id 即 path,不引自增 id:path 在 vault 内天然唯一,省掉一层映射。
open 对已存在的 path 只激活不重拉,否则会丢弃该文件的未保存内容。
close 遇 dirty 拒绝(让调用方弹确认),remove 强制关闭供删除文件用。"
```

---

### 任务 2：标签标题消歧

**文件：**
- 修改：`admin/server/public/tabs.js`
- 修改：`tests/admin/tabs.test.mjs`

**背景：** vault 里有 3 组同名文件（`index.md`、`0010.openai api.md`、`0000.目录.md`）。标签只显示 basename 会分不清哪个是哪个。

- [ ] **步骤 1：编写失败的测试**

在 `tests/admin/tabs.test.mjs` 末尾追加：

```js
test("8 标题消歧:默认 basename,同名升级为 父目录/basename", () => {
  const s = mkStore();
  s.open({ path: "docs/学习笔记/LLM/index.md" });
  s.open({ path: "docs/参考/agent/index.md" });
  s.open({ path: "docs/单独/独有.md" });
  const t = s.titles();
  assert.equal(t.find((x) => x.id.endsWith("LLM/index.md")).text, "LLM/index.md");
  assert.equal(t.find((x) => x.id.endsWith("agent/index.md")).text, "agent/index.md");
  assert.equal(t.find((x) => x.id.endsWith("独有.md")).text, "独有.md");
});

test("9 标题消歧:同父目录名仍冲突则升级为完整相对路径", () => {
  const s = mkStore();
  s.open({ path: "docs/x/dir/index.md" });
  s.open({ path: "docs/y/dir/index.md" });
  const t = s.titles();
  assert.equal(t.find((x) => x.id.startsWith("docs/x/")).text, "docs/x/dir/index.md");
  assert.equal(t.find((x) => x.id.startsWith("docs/y/")).text, "docs/y/dir/index.md");
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/admin/tabs.test.mjs`

预期：FAIL，报错 `s.titles is not a function`

- [ ] **步骤 3：实现 `titles()`**

在 `tabs.js` 的 `createTabStore` 内，`rename` 之前插入：

```js
  /**
   * 标签标题三级降级:basename → 父目录/basename → 完整相对路径。
   * 因 vault 存在同名文件(index.md 等),只显示 basename 会分不清。
   * 纯函数,只依赖当前 tabs,不做 I/O。
   */
  function titles() {
    const base = new Map();
    for (const t of state.tabs) {
      const b = t.path.split("/").pop();
      base.set(b, (base.get(b) || 0) + 1);
    }
    return state.tabs.map((t) => {
      const parts = t.path.split("/");
      const b = parts.pop();
      const parent = parts.pop();
      let text = b;
      if (base.get(b) > 1) text = parent ? `${parent}/${b}` : b;
      // 升级后仍可能重复(不同目录下同名子目录),再冲突就上完整路径
      if (state.tabs.some((o) => o.id !== t.id && o.path.endsWith(`/${text}`))) text = t.path;
      return { id: t.id, text };
    });
  }
```

并把 `titles` 加入返回值：

```js
  return { getState, get, active, open, setActive, close, remove, updateContent, markSaved, rename, titles };
```

- [ ] **步骤 4：运行测试确认通过**

运行：`node --test tests/admin/tabs.test.mjs`

预期：9 pass / 0 fail

- [ ] **步骤 5：Commit**

```bash
git add admin/server/public/tabs.js tests/admin/tabs.test.mjs
git commit -m "feat(admin): 标签标题三级消歧

vault 里有 3 组同名文件(index.md / 0010.openai api.md / 0000.目录.md),
标签只显示 basename 分不清哪个是哪个。basename → 父目录/basename →
完整相对路径,逐级升级到无冲突为止。"
```

---

### 任务 3：持久化与容量降级

**文件：**
- 修改：`admin/server/public/tabs.js`
- 修改：`tests/admin/tabs.test.mjs`

**背景：** sessionStorage 上限约 5MB，vault 最大 `.md` 156,611 字节。超限必须降级，且**任何一档失败都不阻断编辑**。

- [ ] **步骤 1：编写失败的测试**

追加到 `tests/admin/tabs.test.mjs`：

```js
test("10 persist/restore 往返一致", () => {
  const s = mkStore();
  s.open({ path: "a.md", content: "A" });
  s.open({ path: "b.md", content: "B" });
  s.updateContent("b.md", "BB");
  s.setPreviewOn(true);
  s.setSplitPct(37);
  assert.equal(s.persist().status, "ok");

  const s2 = mkStore({ storage: s._storage });
  assert.deepEqual(s2.restore(), { ok: true, reason: "empty-tabs" });
  const st = s2.getState();
  assert.equal(st.tabs.length, 2);
  assert.equal(st.tabs[1].content, "BB");
  assert.equal(st.tabs[1].dirty, true);
  assert.equal(st.activeId, "b.md");
  assert.equal(st.previewOn, true);
  assert.equal(st.splitPct, 37);
});

test("11 容量超限时降级为无 content,但 tab 与 path 仍在", () => {
  const s = mkStore();
  s.open({ path: "a.md", content: "x".repeat(5 * 1024 * 1024) });
  s.updateContent("a.md", "y".repeat(5 * 1024 * 1024));
  const r = s.persist();
  assert.equal(r.status, "degraded");
  const raw = s._storage.getItem("admin.tabs.v1");
  assert.ok(raw.length < 1024 * 1024, "降级后不应还有 5MB 内容");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.tabs.length, 1);
  assert.equal(parsed.tabs[0].path, "a.md");
  assert.equal(parsed.tabs[0].content, "");
});

test("12 restore 遇非法 JSON 丢弃,按空状态", () => {
  const s = mkStore();
  s._storage.setItem("admin.tabs.v1", "{不是合法 JSON");
  assert.deepEqual(s.restore(), { ok: false, reason: "invalid" });
  assert.equal(s.getState().tabs.length, 0);
  assert.equal(s._storage.getItem("admin.tabs.v1"), null);
});

test("13 恢复时校验缺失文件标 missing", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "gone.md" });
  s.persist();
  const s2 = mkStore({ storage: s._storage });
  s2.restore();
  s2.markMissing(new Set(["gone.md"]));
  assert.equal(s2.get("a.md").missing, false);
  assert.equal(s2.get("gone.md").missing, true);
});
```

并在文件顶部的 `mkStore` 里暴露 storage 以便断言（**替换整个函数**）：

```js
function mkStore(extra = {}) {
  const storage = {
    data: new Map(),
    getItem(k) {
      return this.data.has(k) ? this.data.get(k) : null;
    },
    setItem(k, v) {
      this.data.set(k, v);
    },
    removeItem(k) {
      this.data.delete(k);
    },
  };
  const store = createTabStore({ storage, ...extra });
  store._storage = storage;
  return store;
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/admin/tabs.test.mjs`

预期：FAIL，报错 `s.persist is not a function`

- [ ] **步骤 3：实现持久化**

在 `tabs.js` 顶部常量区，紧跟 `KEY` 之后加入：

```js
// sessionStorage 上限约 5MB;vault 最大 .md 约 156KB,20 个大标签就可能撑爆。
// 故写入前先量长度,超 4MB 就剥离全部 content 再写;setItem 仍抛(浏览器可能
// 给更小配额)则只留 activeId/previewOn/splitPct。任何一档失败都不阻断编辑。
const PERSIST_LIMIT = 4 * 1024 * 1024;
```

在 `createTabStore` 内，`titles` 之后插入：

```js
  function setPreviewOn(v) {
    state.previewOn = !!v;
    emit("preview", null);
  }

  function setSplitPct(n) {
    state.splitPct = Math.min(80, Math.max(20, Number(n) || 50));
    emit("split", null);
  }

  /** 标记文件已不存在。app.js 在 tree 加载后核对,缺失的置 true。 */
  function markMissing(goneSet) {
    for (const t of state.tabs) t.missing = goneSet.has(t.id);
    emit("missing", null);
  }

  function toJSON() {
    return {
      activeId: state.activeId,
      previewOn: state.previewOn,
      splitPct: state.splitPct,
      tabs: state.tabs.map(({ id, path, content, mtime, cursor, scrollTop, dirty }) => ({
        id, path, content, mtime, cursor, scrollTop, dirty,
      })),
    };
  }

  /**
   * 写入 storage。返回 ok | degraded | failed。
   * degraded = 剥掉了未保存内容(标签还在,但刷新后未保存修改会丢),
   * 调用方需据此在标签栏给用户提示。
   */
  function persist() {
    const snap = toJSON();
    const full = JSON.stringify(snap);
    if (full.length > PERSIST_LIMIT) {
      const stripped = { ...snap, tabs: snap.tabs.map((t) => ({ ...t, content: "" })) };
      try {
        storage.setItem(KEY, JSON.stringify(stripped));
        return { status: "degraded" };
      } catch {
        /* 落到下面的兜底 */
      }
    } else {
      try {
        storage.setItem(KEY, full);
        return { status: "ok" };
      } catch {
        /* 落到下面的兜底 */
      }
    }
    try {
      storage.setItem(KEY, JSON.stringify({ activeId: state.activeId, previewOn: state.previewOn, splitPct: state.splitPct, tabs: [] }));
      return { status: "degraded" };
    } catch {
      return { status: "failed" };
    }
  }

  /** 从 storage 恢复。结构非法则丢弃并按空状态,不抛错阻断启动。 */
  function restore() {
    let raw = null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return { ok: false, reason: "invalid" };
    }
    if (!raw) return { ok: true, reason: "empty" };
    let snap;
    try {
      snap = JSON.parse(raw);
    } catch {
      storage.removeItem(KEY);
      return { ok: false, reason: "invalid" };
    }
    if (!snap || !Array.isArray(snap.tabs)) {
      storage.removeItem(KEY);
      return { ok: false, reason: "invalid" };
    }
    state.tabs = snap.tabs
      .filter((t) => t && typeof t.path === "string")
      .map((t) => ({
        id: t.id || t.path,
        path: t.path,
        content: typeof t.content === "string" ? t.content : "",
        mtime: t.mtime ?? null,
        parseError: "",
        cursor: Number(t.cursor) || 0,
        scrollTop: Number(t.scrollTop) || 0,
        dirty: !!t.dirty,
        missing: false,
      }));
    state.activeId = snap.tabs.some((t) => t && t.path === snap.activeId) ? snap.activeId : state.tabs[0]?.id ?? null;
    state.previewOn = !!snap.previewOn;
    state.splitPct = Math.min(80, Math.max(20, Number(snap.splitPct) || 50));
    emit("restore", state.activeId);
    return { ok: true, reason: "empty-tabs" };
  }
```

把新方法加入返回值：

```js
  return {
    getState, get, active, open, setActive, close, remove, updateContent, markSaved, rename,
    titles, setPreviewOn, setSplitPct, markMissing, toJSON, persist, restore,
  };
```

- [ ] **步骤 4：运行测试确认通过**

运行：`node --test tests/admin/tabs.test.mjs`

预期：13 pass / 0 fail

再确认模块类型可解析（`tabs.js` 位于 `admin/server/` 下，该目录 `package.json` 有 `"type": "module"`，Node 应按 ESM 加载）：

运行：`node --input-type=module -e "import('./admin/server/public/tabs.js').then(m => console.log('ESM OK', typeof m.createTabStore))"`

预期输出：`ESM OK function`

- [ ] **步骤 5：Commit**

```bash
git add admin/server/public/tabs.js tests/admin/tabs.test.mjs
git commit -m "feat(admin): 标签页持久化与容量降级

sessionStorage 上限约 5MB 而 vault 最大笔记 156KB,20 个大标签就可能撑爆。
persist() 三档降级:正常写 → 超 4MB 剥掉全部 content → setItem 仍抛则只留
activeId/previewOn/splitPct。degraded 状态由调用方在标签栏提示用户。

restore() 遇非法 JSON 丢弃并按空状态,不抛错阻断启动。parseError 不持久化,
恢复后重拉。activeId 若不在恢复出的 tabs 里则回退到第一个,不留悬空 id。

markMissing 供 app.js 在 tree 加载后核对:不做这一步会让人把已删除文件的
内容又存回磁盘。"
```

---

### 任务 4：标签栏 HTML/CSS 与几何验收

**文件：**
- 修改：`admin/server/public/index.html:56-57`（在 `.split` 之前插入 `.tabbar`）
- 修改：`admin/server/public/style.css`（`.split` 规则 + 文件末尾追加标签栏样式）

**这是最容易静默出错的任务。** `.split` 现有 `height: 100%` 是在「它是 `#editor-content` 唯一子元素」的前提下写的；插入 `.tabbar` 后必须改。

- [ ] **步骤 1：改 HTML**

把 `admin/server/public/index.html` 里这一行：

```html
          <div id="editor-content" class="hidden">
            <div class="split" id="split">
```

改为：

```html
          <div id="editor-content" class="hidden">
            <div class="tabbar" id="tabbar">
              <button class="tabbar-nav" id="tabbar-prev" title="向左滚动标签" aria-label="向左滚动标签">‹</button>
              <div class="tabbar-scroll" id="tabbar-scroll"></div>
              <button class="tabbar-nav" id="tabbar-next" title="向右滚动标签" aria-label="向右滚动标签">›</button>
            </div>
            <div class="split" id="split">
```

同时把文件末尾的：

```html
  <script src="/admin/app.js"></script>
```

改为：

```html
  <script type="module" src="/admin/app.js"></script>
```

- [ ] **步骤 2：改 CSS**

把 `style.css` 里的 `.split` 规则**整块替换**为：

```css
.split {
  display: flex;
  /* 原为 height:100%,那是在 .split 是 #editor-content 唯一子元素时的写法。
     插入 .tabbar 后必须靠 flex:1 + min-height:0 分配剩余高度,否则会溢出。
     min-height:0 不可省:缺它时 flex 子项退回内容固有尺寸且不报错——
     这正是 2026-09-29「内容挤在左上角」事故的根因。 */
  flex: 1;
  min-height: 0;
  --split: 50%;
}
```

在 `style.css` **文件末尾**追加：

```css
/* ===== 标签栏 =====
   固定宽 180px + 横向滚动:标签压缩会让文件名窄到只剩几个字,容易点错。 */
.tabbar {
  display: flex;
  align-items: stretch;
  flex-shrink: 0; /* 不可省:否则会被 .split 挤压 */
  height: 36px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.tabbar-scroll {
  display: flex;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.tabbar-scroll::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 0 0 180px;
  min-width: 0;
  padding: 0 0.5rem 0 0.7rem;
  border-right: 1px solid var(--border);
  border-bottom: 2px solid transparent;
  font-size: 0.85rem;
  cursor: pointer;
  user-select: none;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
}

.tab:hover {
  background: var(--bg-tertiary);
  color: var(--text);
}

.tab.active {
  color: var(--text);
  background: var(--bg);
  border-bottom-color: var(--accent);
}

.tab.missing .tab-title {
  text-decoration: line-through;
  opacity: 0.6;
}

.tab-dirty {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning);
}

.tab-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  line-height: 1;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.95rem;
  cursor: pointer;
}

.tab-close:hover {
  background: var(--danger);
  color: var(--bg);
}

.tabbar-nav {
  flex: 0 0 20px;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
}

.tabbar-nav:hover {
  background: var(--bg-tertiary);
  color: var(--text);
}

.tabbar-nav[hidden] {
  display: none;
}

.tabbar-note {
  flex: 0 0 auto;
  align-self: center;
  padding: 0 0.6rem;
  font-size: 0.78rem;
  color: var(--warning);
}
```

- [ ] **步骤 3：结构自检**

运行：

```bash
cd /home/weno/works/Notes-Atlas && node -e "
const h=require('fs').readFileSync('admin/server/public/index.html','utf8');
const o=(h.match(/<div/g)||[]).length,c=(h.match(/<\/div>/g)||[]).length;
console.log('div',o,c,o===c?'配平':'不配平');
for(const [k,v] of [['tabbar','id=\"tabbar\"'],['scroll','id=\"tabbar-scroll\"'],['prev','id=\"tabbar-prev\"'],['next','id=\"tabbar-next\"'],['module','type=\"module\"']])
  console.log(k, h.includes(v)?'OK':'MISSING');
"
```

预期：`div 22 22 配平`（原 19 + 新增 3），五项全 OK

- [ ] **步骤 4：headless Chrome 几何验收（核心）**

`google-chrome` 151 与 `python3` 可用。

做法：把 `admin/server/public/` 复制到临时目录（`vendor/` 可软链），在副本的 `app.js` **末尾追加测量脚本**：先给 `#editor-content` 去掉 `hidden`、给 `#editor-empty` 加上 `hidden`（模拟打开文件后的真实状态），再给 `.tabbar-scroll` 塞 3 个 `<div class="tab" style="flex:0 0 180px">`（标签由任务 5 渲染，这一步先手工塞以验证布局），量下列数值写进 `<pre id="geom">`：

- `#editor-content` 的 `h` 与 `scrollHeight`（`scrollHeight` 应等于 `clientHeight`，即**没有溢出**）
- `.tabbar` 的 `h`（应 36）与 `width`
- `.tab` 的 `width`（应 180）
- `#editor`（textarea）的 `w` / `h`（`h` 应 **> 300**）
- `.split` 的 `h`（应等于 `#editor-content.h − 36`）

然后 `python3 -m http.server` 起在临时目录，`google-chrome --headless --disable-gpu --no-sandbox --window-size=1600,900 --dump-dom` 抓 DOM，从 dump 里正则提取 `geom`。

**验收判据（必须全部满足）：**
- `.tabbar` 高 36
- `.tab` 宽 180
- `#editor` 高 **> 300**（回归检查：塌缩就是 20×2）
- `#editor-content.scrollHeight === #editor-content.clientHeight`（**无溢出**——这是 `height:100%` 未改干净的典型症状）
- `.split` 高 = `#editor-content` 高 − 36

任何一条不满足就是布局没成立，**停下来排查，不要提交**。清理时用 **PID** kill http.server（**不要用 `pkill -f`**，会杀掉调用它的 shell），删掉临时目录。

- [ ] **步骤 5：Commit**

```bash
git add admin/server/public/index.html admin/server/public/style.css
git commit -m "feat(admin): 标签栏结构与样式

标签固定 180px + 横向滚动,两端 ‹ › 按钮仅溢出时可见。脏点标未保存,
missing 加删除线。.tabbar 显式 flex-shrink:0、宽 36px。

同步修 .split:删掉 height:100% 改用 flex:1 + min-height:0。height:100%
是在 .split 为 #editor-content 唯一子元素时的写法,插入 .tabbar 后会导致
溢出。min-height:0 不可省——缺它时 flex 子项退回内容固有尺寸且不报错,
与 2026-09-29「内容挤在左上角」事故同源。已用 headless Chrome 量几何验收
(overflow 判据:editor-content.scrollHeight === clientHeight)。"
```

---

### 任务 5：`app.js` 转 module 并接入 store

**文件：**
- 修改：`admin/server/public/app.js`
- 测试：`tests/admin/tabs.test.mjs`（不新增用例，本任务验证靠 headless）

**范围：** 引入 store、创建、渲染标签栏、`openTab` 取代 `openFile`、把 `currentFile` 换成 `store.active()?.path`（共 9 处引用）。

- [ ] **步骤 1：改文件头**

把 `app.js` 开头改为：

```js
// Notes Atlas Admin Frontend
import { createTabStore } from './tabs.js';

const API = '/admin/api';

let treeData = [];

// DOM 元素
const $ = (id) => document.getElementById(id);
const loginView = $('login-view');
const mainView = $('main-view');
const loginForm = $('login-form');
const loginError = $('login-error');
const fileTree = $('file-tree');
const editorEmpty = $('editor-empty');
const previewEl = $('preview');
const split = $('split');
const divider = $('divider');
const tabbarScroll = $('tabbar-scroll');
const tabbarPrev = $('tabbar-prev');
const tabbarNext = $('tabbar-next');
```

并**删除**这一行（改由 store 提供）：

```js
let currentFile = null;
```

另需**新增**一行 const。现有的 `app.js` 全文没有 `saveBtn` 变量（`app.js:164` 一直是内联 `$('save-btn')`），而步骤 2 的 `loadActiveIntoEditor` 要禁用保存按钮。在 `const editor = $('editor');` 之后插入：

```js
const saveBtn = $('save-btn');
```

> ⚠️ 漏掉这行会得到 `ReferenceError: saveBtn is not defined`，且只在**恢复出 missing 标签时**才触发——正常打开文件走不到那条分支，本地不易发现。

- [ ] **步骤 2：创建 store 并实现 onChange**

在 `const lastCommit = $('last-commit');` 之后插入：

```js
// ===== 标签页 store =====
// onChange 的 reason 决定 DOM 工作量:activate/open/close/rename/restore 需要
// 把内容载入编辑器;content/saved 绝不能重载,否则光标与选区会被重置。
const store = createTabStore({
  storage: sessionStorage,
  onChange(state, meta) {
    renderTabBar(state);
    if (meta.reason === 'content' || meta.reason === 'saved') return;
    loadActiveIntoEditor(state);
  },
});

function loadActiveIntoEditor(state) {
  const t = state.tabs.find((x) => x.id === state.activeId) || null;
  if (!t) {
    editorContent.classList.add('hidden');
    editorEmpty.classList.remove('hidden');
    return;
  }
  editorEmpty.classList.add('hidden');
  editorContent.classList.remove('hidden');
  filePathInput.value = t.path;
  fileMtime.textContent = t.mtime ? new Date(t.mtime).toLocaleString() : '';
  parseError.textContent = t.parseError || '';
  // 内容与光标一并还原:切回来时用户还在离开时的位置
  editor.value = t.content;
  editor.setSelectionRange(t.cursor, t.cursor);
  editor.scrollTop = t.scrollTop;
  saveBtn.disabled = t.missing; // 文件已不存在则不允许写回
  schedulePreview();
}

function renderTabBar(state) {
  const titles = new Map(store.titles().map((x) => [x.id, x.text]));
  const frag = document.createDocumentFragment();
  for (const t of state.tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === state.activeId ? ' active' : '') + (t.missing ? ' missing' : '');
    el.title = t.path + (t.dirty ? '（已修改）' : '') + (t.missing ? '（文件已不存在）' : '');

    if (t.dirty) {
      const dot = document.createElement('span');
      dot.className = 'tab-dirty';
      el.append(dot);
    } else {
      // 空标签也占一个等宽位,否则标题会随脏标记出现而左右跳动
      const spacer = document.createElement('span');
      spacer.className = 'tab-dirty';
      spacer.style.background = 'transparent';
      el.append(spacer);
    }

    const title = document.createElement('span');
    // 标题走 textContent:path 来自服务端,拼 innerHTML 等于自种 XSS
    title.className = 'tab-title';
    title.textContent = titles.get(t.id) || t.id;
    el.append(title);

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = '关闭标签';
    close.addEventListener('click', (e) => {
      e.stopPropagation(); // 别连带触发切标签
      requestClose(t.id);
    });
    el.append(close);

    el.addEventListener('click', () => store.setActive(t.id));
    frag.append(el);
  }
  tabbarScroll.replaceChildren(frag);

  const overflow = tabbarScroll.scrollWidth > tabbarScroll.clientWidth;
  tabbarPrev.hidden = !overflow;
  tabbarNext.hidden = !overflow;
}

function requestClose(id) {
  const r = store.close(id);
  if (r.ok) {
    persistSoon();
    return;
  }
  // close 遇 dirty 会返回 { ok:false, reason:'dirty' } 而不真删,确认后由 remove 强制关
  if (r.reason === 'dirty' && confirm('该文件有未保存的修改，确定关闭？')) {
    store.remove(id);
    persistSoon();
  }
}
```

- [ ] **步骤 3：把 `openFile` 换成 `openTab`**

把 `openFile` 整函数替换为：

```js
// 打开一篇笔记:已在标签页里就只激活(不重拉,否则丢弃未保存内容),否则新建
async function openTab(path) {
  if (store.get(path)) {
    store.setActive(path);
    return;
  }
  try {
    const data = await api(`/file?path=${encodeURIComponent(path)}`);
    store.open({ path, content: data.content, mtime: data.mtime, parseError: data.parseError });
    loadTree();
  } catch (err) {
    alert('打开文件失败: ' + err.message);
  }
}
```

- [ ] **步骤 4：把 9 处 `currentFile` 换掉**

逐处替换（`grep -n currentFile admin/server/public/app.js` 应在替换后无输出）：

| 原 | 新 |
|---|---|
| `openTab` 里已无 | — |
| 保存：`if (!currentFile) return;` | `const t = store.active(); if (!t) return;` |
| 保存：`JSON.stringify({ path: currentFile, content: editor.value })` | `JSON.stringify({ path: t.path, content: editor.value })` |
| 删除：`if (!currentFile) return;` | `const t = store.active(); if (!t) return;` |
| 删除：`confirm(\`确定删除 ${currentFile}?\`)` | `confirm(\`确定删除 ${t.path}?\`)` |
| 删除：`api(\`/file?path=${encodeURIComponent(currentFile)}\`, ...)` | `api(\`/file?path=${encodeURIComponent(t.path)}\`, ...)` |
| 删除成功后：`currentFile = null;` + 两行 className + `loadTree()` | `store.remove(t.id); persistSoon(); loadTree();` |
| 重命名：`if (!currentFile) return;` | `const t = store.active(); if (!t) return;` |
| 重命名：`prompt('新文件名:', currentFile.split('/').pop())` | `prompt('新文件名:', t.path.split('/').pop())` |
| 重命名：`const dir = currentFile.split('/').slice(0, -1).join('/')` | `const dir = t.path.split('/').slice(0, -1).join('/')` |
| 重命名：`JSON.stringify({ from: currentFile, to: newPath })` | `JSON.stringify({ from: t.path, to: newPath })` |
| 重命名：`currentFile = newPath;` + `filePathInput.value = newPath;` | `store.rename(t.id, newPath); persistSoon();` |
| `renderPreview`：`const path = currentFile || '';` | `const path = store.active()?.path ?? '';` |

- [ ] **步骤 5：保存成功后清脏标记**

保存处理器里，`await api('/file', ...)` 之后、`fileMtime.textContent = ...` 之前插入：

```js
    store.markSaved(t.id, { mtime: new Date().toISOString() });
    persistSoon();
```

- [ ] **步骤 6：新建文件走 `openTab`**

把新建文件处理器末尾的 `openFile(path);` 改为 `openTab(path);`

- [ ] **步骤 7：`editor` 的 input 事件接上脏标记与持久化**

把 `editor.addEventListener('input', schedulePreview);` 替换为：

```js
editor.addEventListener('input', () => {
  const t = store.active();
  if (t) {
    // 走 setView 而非直接改 t.cursor:`get()` 返回的是 tab 的活引用,直接赋值
    // 能「碰巧」生效,但那是未声明的契约——哪天 get() 改成返回副本就静默失效。
    store.setView(t.id, { cursor: editor.selectionStart, scrollTop: editor.scrollTop });
    store.updateContent(t.id, editor.value);
  }
  persistSoon();
  schedulePreview();
});
```

> `setView` 在任务 1 步骤 3 已实现并有测试覆盖（用例 2 断言 `cursor` / `scrollTop` 被记录）。

- [ ] **步骤 8：语法与几何自检**

运行：`node --check admin/server/public/app.js`

预期：无输出（`node --check` 成功时静默）

再跑一次任务 4 步骤 4 的 headless 几何脚本，这次让副本里的 `app.js` 真实执行（不手工塞 `.tab`），改为在测量脚本里先 `store.open({path:'a.md',content:'A'})` 再量。判据同上，另加一条：`#editor` 的 `value` 应为 `"A"`。

- [ ] **步骤 9：Commit**

```bash
git add admin/server/public/app.js
git commit -m "feat(admin): app.js 接入标签 store,currentFile 改为从 store 取

app.js 转 ES module 并引入 tabs.js。openFile 换 openTab:已在标签页里的文件
只激活不重拉——重拉会丢弃该文件的未保存内容。9 处 currentFile 全改为
store.active()?.path。

onChange 按 reason 分流:content/saved 只重渲染标签栏不重载编辑器,否则
光标与选区会被重置;其余 reason 才载入内容并还原光标与滚动位置。

顺带修掉既有静默数据丢失:此前 openFile 直接覆写 editor.value 且无脏状态
跟踪,编辑中切换文件会无声丢弃未保存内容。标签标题走 textContent 而非
innerHTML 拼接(path 来自服务端)。"
```

---

### 任务 6：beforeunload、预览开关与分栏宽度接入 store

**文件：**
- 修改：`admin/server/public/app.js`
- 修改：`admin/server/public/index.html`（无，preview 按钮已存在）

**范围：** 让预览开关与分隔条宽度也进 store，从而一并被持久化（刷新后布局不变）；加刷新前脏检查。

- [ ] **步骤 1：替换预览开关逻辑**

把现有的 `previewOn` 声明与按钮处理器整块替换为：

```js
// 预览开关与分栏宽度已移入 store,故可随标签页一并持久化(刷新后布局不变)
$('preview-btn').addEventListener('click', () => {
  const next = !store.getState().previewOn;
  store.setPreviewOn(next);
  const btn = $('preview-btn');
  btn.textContent = next ? '收起预览' : '预览';
  btn.classList.toggle('active', next);
  btn.setAttribute('aria-pressed', String(next));
  if (next) renderPreview(); // 立即出内容,不等 300ms 防抖
  else stopPreview();
  persistSoon();
});
```

- [ ] **步骤 2：替换分隔条拖动的宽度写入**

把 `mousemove` 处理器里那行：

```js
  split.style.setProperty('--split', Math.min(80, Math.max(20, pct)) + '%');
```

替换为：

```js
  store.setSplitPct(pct);
```

并在 `onChange` 里加上宽度应用（见步骤 4）。

- [ ] **步骤 3：删除已无用的 `previewOn` 变量与残留引用**

`grep -n "previewOn" admin/server/public/app.js` 应只剩 `store.getState().previewOn` 与 `store.setPreviewOn` 两类调用。`schedulePreview` 里的 `if (!previewOn) return;` 改为 `if (!store.getState().previewOn) return;`。

- [ ] **步骤 4：扩展 onChange**

把步骤 5（任务 5）里写的 `onChange` 整块替换为：

```js
const store = createTabStore({
  storage: sessionStorage,
  onChange(state, meta) {
    // 布局态每次都应用:setSplitPct 拖动时被高频调用
    applyLayout(state);
    if (meta.reason !== 'split') renderTabBar(state);
    if (meta.reason === 'content' || meta.reason === 'saved') return;
    loadActiveIntoEditor(state);
  },
});

function applyLayout(state) {
  split.style.setProperty('--split', state.splitPct + '%');
  // ⚠️ show-preview 类不可省:CSS 靠它显示预览面板与分隔条
  // (style.css:443-448 `.split:not(.show-preview) .divider, .pane-preview { display: none }`)。
  // 漏掉这行,点了「预览」按钮文字会变但预览面板永远不出现,且不报错。
  split.classList.toggle('show-preview', state.previewOn);
  const btn = $('preview-btn');
  btn.textContent = state.previewOn ? '收起预览' : '预览';
  btn.classList.toggle('active', state.previewOn);
  btn.setAttribute('aria-pressed', String(state.previewOn));
}
```

> ⚠️ 现有实现里这行在按钮处理器内（`app.js:290`）。移到 `applyLayout` 后，`applyLayout` 成为**唯一**改布局态的地方——按钮处理器不再自己 toggle，避免两处状态打架。恢复时 `onChange` 也会跑 `applyLayout`，所以刷新后预览开关状态自动跟着 store 复原。

- [ ] **步骤 5：加 `persistSoon` 与 `beforeunload`**

在 `store` 定义之后插入：

```js
// 持久化防抖 500ms:与预览的 300ms 分开,两者时机不同
let persistTimer = null;
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const r = store.persist();
    if (r.status === 'degraded' && !$('tabbar-note')) {
      const note = document.createElement('span');
      note.id = 'tabbar-note';
      note.className = 'tabbar-note';
      note.textContent = '标签过多,未保存内容不会被保留';
      $('tabbar').append(note);
    } else if (r.status === 'failed') {
      console.warn('[admin] 标签页持久化失败,本次编辑不会跨刷新保留');
    }
  }, 500);
}

window.addEventListener('beforeunload', (e) => {
  if (store.getState().tabs.some((t) => t.dirty)) {
    e.preventDefault();
    e.returnValue = '';
  }
});
```

- [ ] **步骤 6：启动时恢复**

在文件末尾的启动 IIFE 里，`loadTree()` **之后**插入：

```js
  // 恢复标签页。必须在 tree 加载后做 missing 校验:恢复的是当时的未保存内容,
  // 而磁盘上的文件可能已被删除或改名。不校验的话,打开一个已删文件、随手一存,
  // 就会在磁盘上重新创建它。
  const restored = store.restore();
  if (restored.ok && store.getState().tabs.length) {
    const gone = new Set();
    const flat = [];
    (function walk(nodes) {
      for (const n of nodes) {
        if (n.type === 'dir') walk(n.children || []);
        else flat.push(n.path);
      }
    })(treeData);
    for (const t of store.getState().tabs) if (!flat.includes(t.path)) gone.add(t.id);
    store.markMissing(gone);
    loadActiveIntoEditor(store.getState());
  }
```

> ⚠️ `restore()` 内部会 `emit("restore")`，而此时 `onChange` 里的 `loadActiveIntoEditor` 会跑——这是期望行为（恢复即激活）。若 `loadTree` 是 await 的，确认恢复代码在它之后。

- [ ] **步骤 7：语法与测试自检**

运行：

```bash
cd /home/weno/works/Notes-Atlas
node --check admin/server/public/app.js
node --test tests/admin/tabs.test.mjs   # 期望 13 pass
npm test                                  # 期望 108 + 13 = 121 pass
```

- [ ] **步骤 8：Commit**

```bash
git add admin/server/public/app.js
git commit -m "feat(admin): 预览开关与分栏宽度入 store,加刷新前脏检查

预览开关与分隔条宽度移入 store,随标签页一并持久化,刷新后布局不变。
onChange 新增 applyLayout:split 拖动时被高频调用,需每次应用宽度,但不必
重渲染标签栏。

persistSoon 用 500ms 防抖(与预览的 300ms 分开);降级为 degraded 时在标签栏
给提示,failed 时 console.warn——两者都不阻断编辑。

beforeunload:存在 dirty 标签时交给浏览器原生提示。

启动时 restore() 必须在 loadTree() 之后做 missing 校验:恢复的是当时的未保存
内容,磁盘文件可能已被删除或改名。不校验的话,打开一个已删文件、随手一存,
就会在磁盘上重新创建它。"
```

---

### 任务 7：浏览器端整体验收

**文件：** 无（只验证，不改代码）

- [ ] **步骤 1：headless Chrome 端到端验证**

临时目录副本 + `python3 -m http.server` + `google-chrome --headless --disable-gpu --no-sandbox --window-size=1600,900 --dump-dom`。

在副本 `app.js` 末尾追加验证脚本：`window.fetch` stub 接管 `/admin/api/*`（`/file` 返回 `# 标题\n\n正文 $E=mc^2$`、`/tree` 返回两个节点 `a.md` 与 `dir/a.md`），然后按序执行并把每步结果写进 `<pre id="geom">`：

**判据 A — 打开与激活**
- 调两次 `openTab('a.md')` → 标签栏 `.tab` 数应为 **1**（不是 2）
- 调 `openTab('dir/a.md')` → `.tab` 数 **2**，且两个标题因同名而**不同**（`a.md` 与 `dir/a.md`）

**判据 B — 脏标记与持久化**
- 给 `#editor` 赋值并 `dispatchEvent(new Event('input'))` → 当前 `.tab` 应有 `.tab-dirty`，`store.getState().active().dirty === true`
- 等 600ms（>500ms 防抖）→ sessionStorage 的 `admin.tabs.v1` 应含该 tab 且 `dirty: true`

**判据 C — 切标签保持内容与光标**
- 记下切走前 `editor.value` 与 `selectionStart`
- 切到另一个 tab 再切回 → `editor.value` 与 `selectionStart` 应与切走前**完全一致**（这条是本功能的核心价值，验它）

**判据 D — 关闭确认**
- stub `window.confirm` 返回 `false` → `requestClose(有dirty的tab)` 后 `.tab` 数应**不变**
- stub 返回 `true` → 再调一次，`.tab` 数应 **减 1**

**判据 E — missing 校验**
- 让 `/tree` 只返回 `a.md`（不含 `dir/a.md`），跑恢复流程 → `dir/a.md` 的 `.tab` 应有 `missing` 类（带删除线），且 `#save-btn` 的 `disabled === true`

**判据 F — KaTeX 未被破坏**
- 打开预览后 `#preview` 内 `.katex` 数应 **≥ 1**（标签化不能破坏预览链路）

**判据 G — 无 console error**
- 整个流程 `console.error` / `window.onerror` 计数必须为 **0**

任一条不满足就停下排查，不要提交。清理用 **PID** kill，删临时目录。

- [ ] **步骤 2：确认未污染仓库**

运行：`cd /home/weno/works/Notes-Atlas && git status --porcelain | wc -l`

预期：**102**（与基线一致，验证只发生在临时副本）

---

### 任务 8：部署

**关键**：`docker compose up -d` 不带 `--build` 会复用旧镜像——这正是上次「源码已修、线上未修」的事故根因。

- [ ] **步骤 1：同步到服务器**

```bash
cd /home/weno/works/Notes-Atlas
rsync -av --delete --exclude node_modules --exclude .state --exclude .env --exclude docker-compose.yml \
  admin/server/ web:/data/stacks/admin/
```

**`--exclude docker-compose.yml` 是必须的**：本地那份在 2026-09-29 已对齐生产，但它一旦被覆盖就会打断运行中的 admin（挂载路径与端口冲突）。

- [ ] **步骤 2：核对构建上下文**

```bash
cd /home/weno/works/Notes-Atlas
FILES="public/index.html public/style.css public/app.js public/tabs.js"
L=$(cd admin/server && md5sum $=FILES)
R=$(ssh web "cd /data/stacks/admin && md5sum $FILES")
[ "$L" = "$R" ] && echo "4 个文件 md5 一致 ✓" || diff <(echo "$L") <(echo "$R")
```

- [ ] **步骤 3：打回滚标签**

```bash
ssh web 'docker tag admin-admin:latest admin-admin:rollback-$(date +%Y%m%d-%H%M%S) && docker images admin-admin --format "{{.Repository}}:{{.Tag}}  {{.ID}}"'
```

- [ ] **步骤 4：重建并重启**

```bash
ssh web 'cd /data/stacks/admin && docker compose up -d --build 2>&1 | tail -20'
```

预期：`COPY public` 层不是 `CACHED`，容器 `Started`

- [ ] **步骤 5：核对容器内文件**

```bash
ssh web 'docker exec admin-admin-1 sh -c "cd /app && md5sum public/app.js public/tabs.js public/index.html public/style.css && docker logs --tail 5 admin-admin-1"'
```

预期：md5 与步骤 2 一致；日志含 `listening on 0.0.0.0:8477`，无 stack trace

- [ ] **步骤 6：线上抽查**

```bash
for p in "/" "/app.js" "/tabs.js" "/style.css" "/vendor/mermaid.min.js"; do
  printf "GET  %-30s -> %s\n" "/admin$p" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://blogs.lovetulin.cn/admin$p)"
done
printf "POST %-30s -> %s (未登录应 401)\n" "/admin/api/preview" \
  "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST -H 'Content-Type: application/json' -d '{"content":"# x"}' https://blogs.lovetulin.cn/admin/api/preview)"
```

预期：五项全 `200`，POST `401`。**`/admin/tabs.js` 必须 200**——它不被任何 HTML 直接引用，只被 `app.js` 的 `import` 拉取，所以极易漏检。

- [ ] **步骤 7：人工验收（需登录）**

浏览器打开 `https://blogs.lovetulin.cn/admin/`，逐项确认：

1. 打开两篇笔记 → 出现两个标签
2. 切标签 → 内容与光标位置不变
3. 编辑后标签出现脏点；刷新 → 标签与未保存内容都还在
4. 关闭脏标签 → 弹确认
5. 预览按钮仍工作，刷新后预览开关与分栏宽度保持
6. 保存 / 删除 / 重命名后标签标题正确更新

任一项不符 → 停止并排查。

---

## 完成标准

- [ ] `npm test` 全绿，`tests/admin/tabs.test.mjs` 13 pass
- [ ] 任务 4 几何判据全部满足（尤其 `scrollHeight === clientHeight` 无溢出）
- [ ] 任务 7 判据 A–G 全部满足
- [ ] 构建上下文与容器内文件 md5 与本地一致
- [ ] 线上 `/admin/tabs.js` 返回 200
- [ ] 工作区改动数仍为 102，本功能所有文件均已提交

## 遗留项（不在本计划范围）

- **移动端不可用**：390px 视口下 textarea 仅 55px 宽、触屏拖不动分隔条。预览功能上线前就存在（`#sidebar` 固定 280px），非回归
- `deploy.yml` 的 `paths:` 不含 `admin/**`，本功能与预览功能均无 CI 强制
- 根 `package-lock.json` 解析 markdown-it 14.1.1，与 CI 实际使用的 `pnpm-lock.yaml`（14.1.0）不一致
- 预览接口的 `title` 字段后端仍返回、前端仍未消费
