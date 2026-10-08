---
date: 2026-10-01 21:57:10
title: 2026-09-30-admin-tabs-batch-close
---
# 标签页批量关闭实现计划

> **面向 AI 代理的工作者:**必需子技能:使用 superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框(`- [ ]`)语法来跟踪进度。

**目标:**给 `/admin/` 编辑器标签栏加右键菜单:关闭 / 关闭其他标签页 / 关闭右侧标签页 / 关闭全部。批量关闭遇未保存修改先汇总确认。

**架构:**批量逻辑进 `tabs.js` 纯状态层(与现有 `close`/`remove` 成对模式一致),归属规则可被 `node --test` 直接单测;`app.js` 只加右键菜单 DOM 交互、确认弹窗与持久化复用。三个新 reason 并入现有 `RELOAD_REASONS`,`onChange` 不加分支。

**技术栈:**纯 JS ESM(`admin/server/` 有 `"type":"module"`)、`node --test` + 注入假 storage、headless Chrome(`--dump-dom` + 假 fetch + store 直调)、rsync → docker compose 部署。

---

## 警告(必须遵守)

- **预验证(2026-09-30):**本计划任务 1–3 的 store 代码与用例 14–23 已抽到 `/tmp/opencode/plan-batch-close/` 实测 **23/23 通过**。规划期预验证曾抓出用例 18 一处测试自身缺陷——`open` 会激活新开标签,测试 18 须在四次 `open` 之后显式 `s.setActive("a.md")` 才能复现「原活动在左侧」场景(计划正文已含修正,勿回退)。
- **工作区有 102 个无关未提交改动**(多数为 `docs/` 笔记、`admin/server/src/app.js` 的 `@fastify/static` hunk、`docs/.vitepress/*`)。**绝对禁止** `git add -A` / `git add .` / `git commit -a`。每个任务用显式文件路径 `git add`。`app.js` 指 `admin/server/public/app.js`,与带无关改动的 `admin/server/src/app.js` 是不同文件;若 `git add admin/server/public/app.js` 意外吸入了它,用 `git restore --staged` 撤销后 hunk 级 `git apply --cached`。
- 当前在 `main` 分支。**不要** `git push`。
- 测试基线:全量 121 pass(108 既有 + 13 标签页)。目标 131。

---

### 任务 1:`tabs.js` 加 `countDirty` + `closeOthers`(用例 14–16)

**文件:**
- 测试:`tests/admin/tabs.test.mjs`(追加)
- 修改:`admin/server/public/tabs.js`

- [ ] **步骤 1:追加 3 个失败测试**(编号延续现有 1–13)

在 `tests/admin/tabs.test.mjs` 末尾追加:

```js
test("14 closeOthers 保留锚点并激活,其余全关", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  s.open({ path: "c.md" });
  s.open({ path: "d.md" });
  assert.deepEqual(s.closeOthers("c.md"), { ok: true });
  const st = s.getState();
  assert.deepEqual(st.tabs.map((t) => t.id), ["c.md"]);
  assert.equal(st.activeId, "c.md");
});

test("15 closeOthers 遇 dirty 拒绝返回 count 且状态不变,force 后全关", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  s.open({ path: "c.md" });
  s.updateContent("b.md", "B改");
  assert.deepEqual(s.closeOthers("c.md"), { ok: false, reason: "dirty", count: 1 });
  assert.equal(s.getState().tabs.length, 3); // 未被改动
  assert.equal(s.get("b.md").content, "B改"); // 缓冲还在
  assert.deepEqual(s.closeOthers("c.md", { force: true }), { ok: true });
  assert.deepEqual(s.getState().tabs.map((t) => t.id), ["c.md"]);
  assert.equal(s.getState().activeId, "c.md");
});

test("16 closeOthers 锚点自身 dirty 保留且不计入 count", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  s.updateContent("b.md", "B改"); // 锚点是 b 且 dirty
  assert.deepEqual(s.closeOthers("b.md"), { ok: true }); // a 干净,不拒绝
  assert.deepEqual(s.getState().tabs.map((t) => t.id), ["b.md"]);
  assert.equal(s.getState().activeId, "b.md");
  assert.equal(s.get("b.md").dirty, true); // dirty 缓冲原样保留
});
```

- [ ] **步骤 2:运行确认失败**

运行:`node --test tests/admin/tabs.test.mjs 2>&1 | grep -E "closeOthers is not a function|^ℹ (tests|pass|fail)"`
预期:`tests 16`、`pass 13`、`fail 3`,报错 `TypeError: s.closeOthers is not a function`

- [ ] **步骤 3:实现 `countDirty` 与 `closeOthers`**

改 `admin/server/public/tabs.js`(在 `nextActiveId` 函数之后插 `countDirty`;在 `remove` 之后插 `closeOthers`):

```js
/** 范围内需要确认的 dirty 数量:missing 的不计(文件已不存在,缓冲仅留作查看)。 */
function countDirty(list) {
  let n = 0;
  for (const t of list) if (t.dirty && !t.missing) n++;
  return n;
}
```

```js
  /** 批量:关掉锚点以外的全部标签。锚点保留并激活(标准归属)。 */
  function closeOthers(anchorId, { force = false } = {}) {
    const anchor = get(anchorId);
    if (!anchor) return { ok: false, reason: "not-found" };
    const targets = state.tabs.filter((t) => t.id !== anchorId);
    const n = countDirty(targets);
    if (n > 0 && !force) return { ok: false, reason: "dirty", count: n };
    state.tabs = [anchor];
    state.activeId = anchorId;
    emit("close-others", anchorId);
    return { ok: true };
  }
```

- [ ] **步骤 4:运行确认通过**

运行:`node --test tests/admin/tabs.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
预期:`tests 16`、`pass 16`、`fail 0`

- [ ] **步骤 5:Commit**

```bash
git add admin/server/public/tabs.js tests/admin/tabs.test.mjs
git commit -m "feat(admin): tabs.js 批量关闭 closeOthers

关掉锚点以外全部,锚点保留并激活。范围内 countDirty>0 且未 force 时拒绝并
返回 count,不改任何状态——锚点自身 dirty 不计入(它被保留)。missing 的
dirty 永不计数。单次数组操作 + 单次 emit('close-others')。"
```

---

### 任务 2:`closeRight`(用例 17–19)

**文件:**
- 测试:`tests/admin/tabs.test.mjs`(追加)
- 修改:`admin/server/public/tabs.js`

- [ ] **步骤 1:追加 3 个失败测试**

```js
test("17 closeRight 关锚点右侧;原活动在右侧被关切锚点", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" }); // 锚点
  s.open({ path: "c.md" });
  s.setActive("c.md"); // 活动在右侧,会被关
  assert.deepEqual(s.closeRight("b.md"), { ok: true });
  const st = s.getState();
  assert.deepEqual(st.tabs.map((t) => t.id), ["a.md", "b.md"]);
  assert.equal(st.activeId, "b.md"); // 切到锚点
});

test("18 closeRight 原活动在左侧或就是锚点时保持不变", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  s.open({ path: "c.md" });
  s.open({ path: "d.md" });
  s.setActive("a.md"); // 原活动在左侧(open 会激活新开标签,必须显式设回)
  assert.deepEqual(s.closeRight("b.md"), { ok: true });
  assert.deepEqual(s.getState().tabs.map((t) => t.id), ["a.md", "b.md"]);
  assert.equal(s.getState().activeId, "a.md"); // 没被关,保持
  const s2 = mkStore();
  s2.open({ path: "a.md" });
  s2.open({ path: "b.md" });
  s2.open({ path: "c.md" });
  s2.setActive("b.md"); // 锚点即活动
  assert.deepEqual(s2.closeRight("b.md"), { ok: true });
  assert.equal(s2.getState().activeId, "b.md");
});

test("19 closeRight 锚点是最后一个:ok 且状态原封不动", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  s.open({ path: "c.md" });
  const before = JSON.stringify(s.getState());
  assert.deepEqual(s.closeRight("c.md"), { ok: true });
  assert.equal(JSON.stringify(s.getState()), before);
  const s2 = mkStore();
  s2.open({ path: "a.md" });
  assert.deepEqual(s2.closeRight("a.md"), { ok: true }); // 单标签同理
  assert.equal(s2.getState().tabs.length, 1);
});
```

- [ ] **步骤 2:运行确认失败**

运行:`node --test tests/admin/tabs.test.mjs 2>&1 | grep -E "closeRight is not a function|^ℹ (tests|pass|fail)"`
预期:`tests 19`、`pass 16`、`fail 3`,报错 `closeRight is not a function`

- [ ] **步骤 3:实现 `closeRight`**

在 `admin/server/public/tabs.js` 的 `closeOthers` 之后插:

```js
  /** 批量:关掉锚点右侧全部。左侧与锚点保留;原活动落在被关范围时切锚点,否则不变。 */
  function closeRight(anchorId, { force = false } = {}) {
    const idx = state.tabs.findIndex((t) => t.id === anchorId);
    if (idx < 0) return { ok: false, reason: "not-found" };
    const targets = state.tabs.slice(idx + 1);
    const n = countDirty(targets);
    if (n > 0 && !force) return { ok: false, reason: "dirty", count: n };
    const activeWasClosed = targets.some((t) => t.id === state.activeId);
    state.tabs = state.tabs.slice(0, idx + 1);
    if (activeWasClosed) state.activeId = anchorId;
    emit("close-right", anchorId);
    return { ok: true };
  }
```

- [ ] **步骤 4:运行确认通过**

运行:`node --test tests/admin/tabs.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
预期:`tests 19`、`pass 19`、`fail 0`

- [ ] **步骤 5:Commit**

```bash
git add admin/server/public/tabs.js tests/admin/tabs.test.mjs
git commit -m "feat(admin): tabs.js 批量关闭 closeRight

关掉锚点右侧全部,左侧与锚点保留。原活动标签落在被关范围时切到锚点,
否则保持原活动(含锚点即活动的情况)。锚点已是最后一个时 targets 为空,
无条件 ok 且状态不变。单次数组操作 + 单次 emit('close-right')。"
```

---

### 任务 3:`closeAll` + 跨方法边界(用例 20–23)

**文件:**
- 测试:`tests/admin/tabs.test.mjs`(追加)
- 修改:`admin/server/public/tabs.js`

- [ ] **步骤 1:追加 4 个失败测试**

```js
test("20 closeAll 全关:activeId 清空、tabs 空", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  assert.deepEqual(s.closeAll(), { ok: true });
  const st = s.getState();
  assert.equal(st.tabs.length, 0);
  assert.equal(st.activeId, null);
});

test("21 closeAll 遇 dirty 拒绝计数,force 后全关", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  s.updateContent("a.md", "改");
  s.updateContent("b.md", "改2");
  assert.deepEqual(s.closeAll(), { ok: false, reason: "dirty", count: 2 });
  assert.equal(s.getState().tabs.length, 2); // 未变
  assert.deepEqual(s.closeAll({ force: true }), { ok: true });
  assert.equal(s.getState().tabs.length, 0);
  assert.equal(s.getState().activeId, null);
});

test("22 三种批量对 missing 的 dirty tab 均不计数、直接关", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "gone.md", missing: true });
  s.updateContent("gone.md", "陈旧缓冲"); // dirty 但 missing
  assert.deepEqual(s.closeOthers("a.md"), { ok: true }); // gone 被关,无拒绝
  assert.deepEqual(s.getState().tabs.map((t) => t.id), ["a.md"]);

  const s2 = mkStore();
  s2.open({ path: "a.md" });
  s2.open({ path: "gone.md", missing: true });
  s2.updateContent("gone.md", "旧");
  assert.deepEqual(s2.closeRight("a.md"), { ok: true });
  assert.deepEqual(s2.getState().tabs.map((t) => t.id), ["a.md"]);

  const s3 = mkStore();
  s3.open({ path: "gone.md", missing: true });
  s3.updateContent("gone.md", "旧");
  assert.deepEqual(s3.closeAll(), { ok: true }); // 唯一标签是 missing dirty,不弹
  assert.equal(s3.getState().tabs.length, 0);
});

test("23 not-found 拒绝不改状态;批量关闭后 open/rename 仍正常", () => {
  const s = mkStore();
  s.open({ path: "a.md" });
  s.open({ path: "b.md" });
  assert.deepEqual(s.closeOthers("zzz.md"), { ok: false, reason: "not-found" });
  assert.deepEqual(s.closeRight("zzz.md"), { ok: false, reason: "not-found" });
  assert.equal(s.getState().tabs.length, 2); // 未被改动
  assert.deepEqual(s.closeOthers("a.md"), { ok: true }); // 组合回归
  assert.deepEqual(s.open({ path: "c.md" }), { ok: true, created: true });
  s.rename("c.md", "d.md");
  assert.equal(s.get("d.md").id, "d.md");
});
```

- [ ] **步骤 2:运行确认失败**

运行:`node --test tests/admin/tabs.test.mjs 2>&1 | grep -E "closeAll is not a function|^ℹ (tests|pass|fail)"`
预期:`tests 23`、`pass 19`、`fail 4`,报错 `closeAll is not a function`

- [ ] **步骤 3:实现 `closeAll` 并导出**

在 `admin/server/public/tabs.js` 的 `closeRight` 之后插:

```js
  /** 批量:关掉全部。activeId 清空,回编辑器空态(与关最后一个标签同一条规则)。 */
  function closeAll({ force = false } = {}) {
    const n = countDirty(state.tabs);
    if (n > 0 && !force) return { ok: false, reason: "dirty", count: n };
    state.tabs = [];
    state.activeId = null;
    emit("close-all", null);
    return { ok: true };
  }
```

把 return 语句改为(加 3 个导出):

```js
  return {
    getState, get, active, open, setActive, close, remove, updateContent, setView, markSaved, rename,
    titles, setPreviewOn, setSplitPct, markMissing, toJSON, persist, restore,
    closeOthers, closeRight, closeAll,
  };
```

- [ ] **步骤 4:全量回归**

运行:`npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
预期:`tests 131`、`pass 131`、`fail 0`

- [ ] **步骤 5:Commit**

```bash
git add admin/server/public/tabs.js tests/admin/tabs.test.mjs
git commit -m "feat(admin): tabs.js 批量关闭 closeAll + 跨方法边界用例

closeAll 全关清空 activeId。missing 的 dirty 永不计数不弹窗(三种批量统一),
not-found 拒绝不改状态,批量后 open/rename 组合回归。全量 121→131。"
```

---

### 任务 4:`app.js` 集成右键菜单(RELOAD_REASONS + 三函数)

**文件:**
- 修改:`admin/server/public/app.js`
- 修改:`admin/server/public/style.css`(仅任务 5 用)?否——本任务**只改 app.js**,CSS 在任务 5

- [ ] **步骤 1:`RELOAD_REASONS` 并入三个新 reason**

`admin/server/public/app.js` 中把:

```js
const RELOAD_REASONS = new Set(['open', 'activate', 'close', 'rename', 'restore', 'missing']);
```

改为:

```js
const RELOAD_REASONS = new Set(['open', 'activate', 'close', 'rename', 'restore', 'missing', 'close-others', 'close-right', 'close-all']);
```

无需改 `onChange` 主体——批量关闭与 `close` 同类,重渲染标签栏 + 载入活动编辑器。

- [ ] **步骤 2:`renderTabBar` 的 tab 挂 `contextmenu`**

在 `renderTabBar` 里 `el.addEventListener('click', () => store.setActive(t.id));` 之后追加:

```js
    // 右键打开批量关闭菜单;不改变活动标签(锚点 ≠ 活动)
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openTabMenu(t.id, e.clientX, e.clientY);
    });
```

- [ ] **步骤 3:新增菜单三函数与全局监听**

在 `renderTabBar` 函数之后、`requestClose` 之前插入(完整代码):

```js
// ===== 标签右键菜单 =====
let tabMenu = null;
function ensureTabMenu() {
  if (tabMenu) return tabMenu;
  tabMenu = document.createElement('div');
  tabMenu.className = 'tab-menu';
  tabMenu.hidden = true;
  const mk = (action, label) => {
    const b = document.createElement('button');
    b.className = 'tab-menu-item';
    b.dataset.action = action;
    b.textContent = label;
    b.addEventListener('click', () => onMenuAction(action));
    return b;
  };
  tabMenu.append(mk('close', '关闭'));
  tabMenu.append(mk('close-others', '关闭其他标签页'));
  tabMenu.append(mk('close-right', '关闭右侧标签页'));
  const sep = document.createElement('div');
  sep.className = 'tab-menu-sep';
  tabMenu.append(sep);
  tabMenu.append(mk('close-all', '关闭全部'));
  document.body.append(tabMenu);
  return tabMenu;
}

function closeTabMenu() {
  if (tabMenu) tabMenu.hidden = true;
}

function openTabMenu(anchorId, x, y) {
  const menu = ensureTabMenu();
  const tabs = store.getState().tabs;
  const idx = tabs.findIndex((t) => t.id === anchorId);
  if (idx < 0) return; // 锚点已被并发关掉,不开菜单(§7 not-found 静默)
  menu._anchorId = anchorId;
  menu.querySelector('[data-action="close-others"]').disabled = tabs.length <= 1;
  menu.querySelector('[data-action="close-right"]').disabled = tabs.length <= 1 || idx === tabs.length - 1;
  menu.hidden = false;
  // 定位后右/下溢出翻转,保证不出视口
  menu.style.left = '0px';
  menu.style.top = '0px';
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  menu.style.left = (x + mw + 4 > vw ? vw - mw - 4 : x) + 'px';
  menu.style.top = (y + mh + 4 > vh ? vh - mh - 4 : y) + 'px';
}

function onMenuAction(action) {
  const anchorId = tabMenu && tabMenu._anchorId;
  closeTabMenu();
  if (action === 'close') {
    if (anchorId) requestClose(anchorId); // requestClose 内部已 persistSoon
    return;
  }
  if (anchorId == null && action !== 'close-all') return; // 锚点丢失,静默(close-all 不依赖锚点)
  const call = (force) => {
    if (action === 'close-others') return store.closeOthers(anchorId, { force });
    if (action === 'close-right') return store.closeRight(anchorId, { force });
    return store.closeAll({ force });
  };
  const r = call(false);
  if (!r.ok && r.reason === 'dirty') {
    const label = { 'close-others': '关闭其他标签页', 'close-right': '关闭右侧标签页', 'close-all': '关闭全部标签页' }[action];
    if (!confirm(`${label}将同时关闭 ${r.count} 个未保存的标签，确定？`)) {
      return; // 取消:store 拒绝时未改任何状态,无需持久化
    }
    call(true);
  } else if (!r.ok) {
    return; // not-found 等,静默忽略
  }
  persistSoon();
}

// 全局:点菜单外收起、Esc 收起、标签栏横向滚动收起(capture 才能收到 scrollBy 触发的滚动)
document.addEventListener('click', (e) => {
  if (tabMenu && !tabMenu.hidden && !tabMenu.contains(e.target)) closeTabMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTabMenu();
});
tabbarScroll.addEventListener('scroll', closeTabMenu, true);
```

- [ ] **步骤 4:语法与残留检查**

```bash
cd /home/weno/works/Notes-Atlas
node --check admin/server/public/app.js && echo "语法 OK"
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

预期:`语法 OK`;`tests 131`、`pass 131`、`fail 0`(app.js 改动不影响 node 测试,只是确认工作区没被污染)

- [ ] **步骤 5:Commit**

```bash
git add admin/server/public/app.js
git commit -m "feat(admin): 标签右键菜单 app.js 集成

renderTabBar 的 tab 挂 contextmenu,锚点=右键标签、不改活动标签。菜单由
JS 动态创建挂 body(index.html 零改动),四项:关闭/关闭其他/关闭右侧/
关闭全部。禁用态:单标签时关闭其他与关闭右侧灰显,锚点为最后时关闭右侧
灰显。dirty 时 app 层弹一次汇总 confirm,确认后 force 重调,取消则 store
拒绝态原样。右/下溢出翻转,点外/Esc/横向滚动收起。三个新 reason 并入
RELOAD_REASONS,onChange 不加分支。"
```

---

### 任务 5:`style.css` 菜单样式 + headless 全链路验收

**文件:**
- 修改:`admin/server/public/style.css`(追加)
- 临时:headless 验收副本(不进 repo)

- [ ] **步骤 1:追加菜单样式**

在 `admin/server/public/style.css` 末尾追加:

```css
/* ===== 标签右键菜单 ===== */
.tab-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  padding: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
}

.tab-menu[hidden] {
  display: none;
}

.tab-menu-item {
  text-align: left;
  padding: 6px 10px;
  font-size: 0.85rem;
  color: var(--text);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}

.tab-menu-item:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.tab-menu-item:disabled {
  color: var(--text-muted);
  cursor: default;
  opacity: 0.5;
}

.tab-menu-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 6px;
}
```

- [ ] **步骤 2:headless 全链路验收(临时副本,不入库)**

```bash
cd /home/weno/works/Notes-Atlas
rm -rf /tmp/opencode/tabmenu-e2e && mkdir -p /tmp/opencode/tabmenu-e2e/admin
cp admin/server/public/app.js admin/server/public/index.html admin/server/public/style.css admin/server/public/tabs.js /tmp/opencode/tabmenu-e2e/admin/
ln -s /home/weno/works/Notes-Atlas/admin/server/public/vendor /tmp/opencode/tabmenu-e2e/admin/vendor
```

把下面的验收脚本追加到 `/tmp/opencode/tabmenu-e2e/admin/app.js` 末尾:

```js
// ===== 批量关闭 E2E(仅临时副本,不入库) =====
(async function () {
  const R = { errors: [], menuOpen: {}, disabled: {}, confirm: {}, closeAll: {}, cancel: {}, esc: {}, flip: {} };
  const origErr = console.error;
  console.error = (...a) => { R.errors.push(a.map(String).join(' ')); origErr.apply(console, a); };
  window.onerror = (m) => { R.errors.push('onerror: ' + m); };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  setTimeout(function () {
    try {
      window.fetch = async (url) => {
        const u = String(url);
        if (u.endsWith('/tree')) return json({ nodes: [{ type: 'file', name: 'a.md', path: 'a.md' }] });
        if (u.includes('/file?path=')) return json({ content: '内容', mtime: null, parseError: '' });
        return json({ message: 'not found' }, 404);
      };
      const $ = (id) => document.getElementById(id);
      $('login-view').classList.add('hidden');
      $('main-view').classList.remove('hidden');
      // 三个标签:b 为活动
      store.open({ path: 'a.md', content: 'A' });
      store.open({ path: 'b.md', content: 'B' });
      store.open({ path: 'c.md', content: 'C' });
      store.setActive('b.md');
      const menu = () => document.querySelector('.tab-menu');
      const tabs = () => document.querySelectorAll('.tab');
      const fire = (tabIdx, x, y) =>
        tabs()[tabIdx].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));

      // 1. 右键标签 1(a,非活动)开菜单 → 锚点=a,活动仍 b
      fire(0, 400, 200);
      R.menuOpen.opened = menu() && !menu().hidden;
      R.menuOpen.anchorIsA = menu()._anchorId === 'a.md';
      R.menuOpen.activeUnchanged = store.getState().activeId === 'b.md';
      R.menuOpen.itemCount = document.querySelectorAll('.tab-menu-item').length; // 4
      R.menuOpen.hasSep = !!document.querySelector('.tab-menu-sep');
      // 2. 禁用态:非最后锚点 + 3 标签 → close-others/close-right 均可用;锚点换到最后一个时 close-right 禁用
      R.disabled.multiEnabled = !menu().querySelector('[data-action="close-others"]').disabled && !menu().querySelector('[data-action="close-right"]').disabled;
      closeTabMenu();
      fire(2, 400, 200); // 右键最后标签 c
      R.disabled.rightDisabledWhenLast = menu().querySelector('[data-action="close-right"]').disabled === true;
      R.disabled.othersStillEnabled = menu().querySelector('[data-action="close-others"]').disabled === false;
      // 单标签场景:关掉 b、c 留 a,再开菜单 → close-others 与 close-right 都禁用
      store.remove('b.md');
      store.remove('c.md');
      closeTabMenu();
      fire(0, 400, 200);
      R.disabled.singleTabBothDisabled =
        menu().querySelector('[data-action="close-others"]').disabled === true &&
        menu().querySelector('[data-action="close-right"]').disabled === true;
      // 3. 汇总确认 + 取消:重建三标签,给 c 置 dirty,confirm=false → 点关闭其他 → 状态不变
      store.open({ path: 'b.md', content: 'B' });
      store.open({ path: 'c.md', content: 'C' });
      store.setView('c.md', { cursor: 0, scrollTop: 0 });
      store.updateContent('c.md', 'C改'); // c dirty
      let lastConfirm = '';
      window.confirm = (msg) => { lastConfirm = msg; return false; };
      closeTabMenu();
      fire(0, 400, 200); // 锚点 a
      menu().querySelector('[data-action="close-others"]').click();
      R.cancel.msg = lastConfirm; // 应含「关闭其他标签页将同时关闭 1 个未保存的标签»
      R.cancel.msgExact = lastConfirm === '关闭其他标签页将同时关闭 1 个未保存的标签，确定？';
      R.cancel.unchanged = document.querySelectorAll('.tab').length === 3 && store.getState().tabs.length === 3;
      R.cancel.dirtyKept = store.get('c.md').dirty === true;
      // 4. 确认 → closeOthers:锚点 a,count=1,force 后只剩 a,活动 a
      window.confirm = () => true;
      fire(0, 400, 200);
      menu().querySelector('[data-action="close-others"]').click();
      R.confirm.onlyAnchorRemains = document.querySelectorAll('.tab').length === 1 && store.getState().activeId === 'a.md';
      // 5. Esc 关菜单:重开菜单 → dispatch Escape
      fire(0, 400, 200);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      R.esc.closed = menu().hidden === true;
      // 6. 溢出翻转:右下角开菜单 → 不出视口
      store.open({ path: 'b.md', content: 'B' });
      store.open({ path: 'c.md', content: 'C' });
      closeTabMenu();
      const vw = window.innerWidth, vh = window.innerHeight;
      fire(0, vw - 5, vh - 5);
      const r = menu().getBoundingClientRect();
      R.flip.inside = r.right <= vw + 1 && r.bottom <= vh + 1 && r.left >= -1 && r.top >= -1;
      R.flip.reported = { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), vw, vh };
      // 7. 全部关闭:confirm=false 前有 dirty?此时 b、c 干净,direct ok;再置 dirty 验证计数文案拒绝
      store.updateContent('b.md', 'B改');
      store.updateContent('c.md', 'C改');
      window.confirm = () => false;
      closeTabMenu();
      fire(0, 400, 200);
      menu().querySelector('[data-action="close-all"]').click();
      R.closeAll.dirtyRejected = document.querySelectorAll('.tab').length === 3;
      window.confirm = () => true;
      fire(0, 400, 200);
      menu().querySelector('[data-action="close-all"]').click();
      R.closeAll.allGone = document.querySelectorAll('.tab').length === 0 && store.getState().activeId === null;
      R.errors.forEach(() => {});
    } catch (e) {
      R.errors.push('probe-crash: ' + (e && e.stack || e));
    }
    const pre = document.createElement('pre');
    pre.id = 'geom';
    pre.textContent = JSON.stringify(R, null, 2);
    document.body.appendChild(pre);
  }, 1200);
})();
```

启动临时服务并跑验收(校验所有布尔字段为 `true`、`flip.reported` 在视口内、`errors` 为空):

```bash
cd /tmp/opencode/tabmenu-e2e && python3 -m http.server 8736 --bind 127.0.0.1 >/dev/null 2>&1 &
echo $! > /tmp/opencode/tabmenu-e2e.pid
sleep 1
timeout 90 google-chrome --headless --disable-gpu --no-sandbox --window-size=1600,900 --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:8736/admin/index.html" 2>/dev/null | sed -n '/<pre id="geom"/,/<\\/pre>/p'
kill "$(cat /tmp/opencode/tabmenu-e2e.pid)" 2>/dev/null
```

预期:所有布尔字段 `true`;`flip.reported.right <= 1600` 且 `bottom <= 900`、`left/top >= -1`;`errors: []`(即 console error 0)。

> 已知事实:`store.remove` / `updateContent` / `setView` 在验收脚本中可直接调用;菜单的 `_anchorId`、`hidden`、`disabled` 均与任务 4 步骤 3 的代码一一对应。`R.cancel.msgExact` 依赖任务 4 的确认文案(含全角逗号与问号),勿改动文案后漏改此处。

- [ ] **步骤 3:Commit**

```bash
git add admin/server/public/style.css
git commit -m "feat(admin): 标签右键菜单样式 + headless 全链路验收

.tab-menu fixed 定位、z-index 1000、暗色变量、[hidden] 隐藏;菜单项灰显
禁用态;分隔线。headless E2E:锚点不改活动、四项齐全、双禁用态正确、
confirm 取消状态不变/确认后仅剩锚点、Esc 收起、右下角翻转不出视口、
close-all dirty 拒绝与 force 全关、console error 0。"
```

---

### 任务 6:全量回归 + 部署

**文件:**
- 无仓库改动(仅部署)

- [ ] **步骤 1:最终回归与工作区核对**

```bash
cd /home/weno/works/Notes-Atlas
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
git status --porcelain | wc -l
git log --oneline -6
```

预期:`tests 131`、`pass 131`、`fail 0`;未提交改动数仍为 **102**(docs/笔记等无关改动,与本功能无关);最近 6 个 commit 含本文档与 5 个功能 commit。

- [ ] **步骤 2:rsync + md5(排除 `docker-compose.yml`)**

```bash
cd /home/weno/works/Notes-Atlas
rsync -av --delete --exclude node_modules --exclude .state --exclude .env --exclude docker-compose.yml admin/server/ web:/data/stacks/admin/
files=(public/tabs.js public/app.js public/style.css)
L=$(cd admin/server && md5sum "${files[@]}")
R=$(ssh web "cd /data/stacks/admin && md5sum ${files[*]}")
[ "$L" = "$R" ] && echo "3 个文件 md5 全部一致" || echo "不一致!"
```

预期:`3 个文件 md5 全部一致`。注意 zsh 数组语法,勿写成带引号的单字符串。

- [ ] **步骤 3:打回滚标签 + 重建容器(必须 `--build`)**

```bash
ssh web 'docker tag admin-admin:latest admin-admin:rollback-$(date +%Y%m%d-%H%M%S) && cd /data/stacks/admin && docker compose up -d --build 2>&1 | tail -3'
```

预期:`Container admin-admin-1 Started`;记录回滚标签名供故障回退。

- [ ] **步骤 4:容器内 md5 + 日志**

```bash
ssh web "docker exec admin-admin-1 sh -c 'cd /app && md5sum public/tabs.js public/app.js public/style.css' && echo '--- log ---' && docker logs --tail 5 admin-admin-1"
```

预期:三个 md5 与本机一致;日志 `listening on 0.0.0.0:8477`、无报错。

- [ ] **步骤 5:线上 HTTP 抽查**

```bash
for p in "/admin/tabs.js" "/admin/app.js" "/admin/style.css"; do
  printf "%-22s -> %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://blogs.lovetulin.cn$p)"
done
curl -s -o /dev/null -w "MIME tabs.js: %{content_type}\n" https://blogs.lovetulin.cn/admin/tabs.js
```

预期:三个均 `200`;tabs.js MIME `application/javascript`。

- [ ] **步骤 6:完成报告 + 人工验收清单**

报告完成后列出人工验收项(需用户登录 `https://blogs.lovetulin.cn/admin/`):

1. 开 3 个标签,右键任一 → 菜单四项齐全,右键不切换活动标签
2. 「关闭其他标签页」→ 保留右键的那个并激活
3. 「关闭右侧标签页」→ 锚点左侧与锚点保留;原活动在右侧时切锚点
4. 「关闭全部」→ 回到「选择或创建一个文件开始编辑」空态
5. 有未保存修改时三操作各弹一次汇总 confirm;取消则一切不变
6. 单标签时「关闭其他/关闭右侧」灰显;锚点为最后一个时「关闭右侧」灰显
7. Esc / 点空白关菜单;右下角右键菜单不外溢
8. 场景回归:保存/删除/重命名/切标签/预览开关/刷新恢复均不回归