# VSCode 式文件树实现计划

> **面向 AI 代理的工作者:**必需子技能:使用 superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框(`- [ ]`)语法来跟踪进度。

**目标:**把 `/admin/` 左侧文件树升级为 VSCode 资源管理器交互:指定目录新建文件/文件夹、树内重命名与删除(文件+文件夹)、全部折叠/展开全部、行内输入、展开态 localStorage 持久化。

**架构:**服务端零改动(六个端点已就绪且被 `tests/admin/app.test.mjs` 覆盖)。新增 `tree-expand.js` 纯逻辑模块(路径工具/collapsed 集合/renameMap,零 DOM 零 fetch,可 `node --test`);`app.js` 只做 DOM 与交互——渲染骨架、悬停操作、右键菜单、行内输入状态机、标签 store 同步;`style.css` 树交互样式(菜单浮层复用 `.tab-menu` 现成样式);`index.html` 侧栏头部 5 按钮。

**技术栈:**纯 JS ESM(`admin/server/` 为 `"type":"module"`)、`node --test` + 注入假 storage、headless Chrome(`--dump-dom` + 假 fetch + `--user-data-dir` 跨刷新持久化验收)、rsync → docker compose 部署。

---

## 警告(必须遵守)

- **预验证(2026-09-30):**树纯逻辑 `tree-expand.js` 全部 9 个函数与测试已在 `/tmp/opencode/plan-tree-vscode/` 实测 **9/9 通过**,任务 1–3 的代码可直接照抄,勿改逻辑。
- 工作区有 **102 个无关未提交改动**。**绝对禁止** `git add -A` / `git add .` / `git commit -a`。每个 commit 用显式文件路径 `git add`。`app.js` 指 `admin/server/public/app.js`,与带无关改动的 `admin/server/src/app.js` 是不同文件。
- 当前在 `main` 分支。**不要** `git push`。
- 测试基线:全量 131 pass(108 既有 + 23 标签页)。本功能新增 9 例 → 目标 **140**。
- `admin/server/public/index.html` 上轮零改动,但那是该功能的约束,本功能明确要改它(侧栏头部按钮)。

---

### 任务 1:`tree-expand.js` 路径工具 + defaultName + findConflict(用例 1–3)

**文件:**
- 创建:`admin/server/public/tree-expand.js`
- 创建:`tests/admin/tree-expand.test.mjs`

- [ ] **步骤 1:写失败的测试**(模块尚不存在,导入即红)

创建 `tests/admin/tree-expand.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
// 命名空间导入:缺失导出在运行时是 undefined,测试能逐个报红(而非整个文件导入失败)
import * as te from '../../admin/server/public/tree-expand.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test("1 路径工具:dir/base/join 常规与根级", () => {
  assert.equal(te.pathDir("notes/a.md"), "notes");
  assert.equal(te.pathDir("a.md"), "");
  assert.equal(te.pathDir("a/b/c.md"), "a/b");
  assert.equal(te.pathBase("notes/a.md"), "a.md");
  assert.equal(te.pathBase("a.md"), "a.md");
  assert.equal(te.pathJoin("notes", "b.md"), "notes/b.md");
  assert.equal(te.pathJoin("", "b.md"), "b.md");
  assert.equal(te.pathJoin("a/b", "c.md"), "a/b/c.md");
});

test("2 defaultName 文件/目录", () => {
  assert.equal(te.defaultName("file"), "未命名.md");
  assert.equal(te.defaultName("dir"), "新建文件夹");
});

test("3 findConflict 路径精确命中;同 basename 不同路径不命中;根级命中;空树 null", () => {
  const tree = [
    { type: "dir", name: "notes", path: "notes", children: [{ type: "file", name: "b.md", path: "notes/b.md" }] },
    { type: "file", name: "a.md", path: "a.md" },
  ];
  assert.equal(te.findConflict(tree, "notes/b.md").path, "notes/b.md");
  assert.equal(te.findConflict(tree, "b.md"), null);
  assert.equal(te.findConflict(tree, "notes/other.md"), null);
  assert.equal(te.findConflict(tree, "a.md").type, "file");
  assert.equal(te.findConflict(tree, "zzz.md"), null);
  assert.equal(te.findConflict([], "x.md"), null);
});
```

- [ ] **步骤 2:运行确认失败**

运行:`node --test tests/admin/tree-expand.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (tests|pass|fail)"`
预期:`tests 1`、`pass 0`、`fail 1`,报错 `Cannot find module ... tree-expand.js`

- [ ] **步骤 3:实现最少代码**

创建 `admin/server/public/tree-expand.js`:

```js
// ===== 文件树纯逻辑:路径工具、展开态折叠集合、目录重命名映射 =====
// 零 DOM、零 fetch,可被 node --test 与浏览器共用(storage 注入模式,同 tabs.js)。

// ---- 路径工具 ----
export function pathDir(p) {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

export function pathBase(p) {
  const i = p.lastIndexOf('/');
  return i < 0 ? p : p.slice(i + 1);
}

export function pathJoin(dir, name) {
  return dir ? `${dir}/${name}` : name;
}

export function defaultName(type) {
  return type === 'file' ? '未命名.md' : '新建文件夹';
}

// 树上按 path 精确查找:命中返回该节点,否则 null
export function findConflict(nodes, fullPath) {
  for (const n of nodes) {
    if (n.path === fullPath) return n;
    if (n.type === 'dir' && n.children) {
      const hit = findConflict(n.children, fullPath);
      if (hit) return hit;
    }
  }
  return null;
}
```

- [ ] **步骤 4:运行确认通过**

运行:`node --test tests/admin/tree-expand.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
预期:`tests 3`、`pass 3`、`fail 0`

- [ ] **步骤 5:Commit**

```bash
git add admin/server/public/tree-expand.js tests/admin/tree-expand.test.mjs
git commit -m "feat(admin): tree-expand.js 路径工具 + findConflict

新增纯逻辑模块(零 DOM 零 fetch,同 tabs.js 纪律):pathDir/pathBase/
pathJoin/defaultName 路径工具与 findConflict 树上路径精确查找(前端预检,
服务端 safeResolve + 409 兜底)。命名空间导入使缺失导出按例报红,便于 TDD。"
```

---

### 任务 2:`tree-expand.js` 展开态折叠集合(用例 4–7)

**文件:**
- 修改:`admin/server/public/tree-expand.js`(末尾追加)
- 修改:`tests/admin/tree-expand.test.mjs`(末尾追加)

- [ ] **步骤 1:追加 4 个失败测试**

追加到 `tests/admin/tree-expand.test.mjs` 末尾:

```js
test("4 setFromTree:collapseAll 得全部目录路径;expandAll 得空", () => {
  const tree = [
    { type: "dir", name: "a", path: "a", children: [{ type: "dir", name: "b", path: "a/b", children: [] }, { type: "file", name: "f.md", path: "a/f.md" }] },
    { type: "file", name: "g.md", path: "g.md" },
  ];
  assert.deepEqual([...te.setFromTree(tree, "collapseAll")].sort(), ["a", "a/b"]);
  assert.deepEqual([...te.setFromTree(tree, "expandAll")], []);
});

test("5 isCollapsed 缺省 false;createCollapsedSet 为空;加入后 true", () => {
  const s = te.createCollapsedSet();
  assert.equal(s.size, 0);
  assert.equal(te.isCollapsed(s, "a"), false);
  s.add("a");
  assert.equal(te.isCollapsed(s, "a"), true);
});

test("6 saveCollapsed/loadCollapsed 往返;非法 JSON/非数组/缺 key → 空集", () => {
  const st = fakeStorage();
  te.saveCollapsed(new Set(["a", "b/c"]), st);
  assert.deepEqual([...te.loadCollapsed(st)].sort(), ["a", "b/c"]);
  const st2 = fakeStorage();
  st2.setItem(te.COLLAPSED_KEY, "not-json");
  assert.equal(te.loadCollapsed(st2).size, 0);
  const st3 = fakeStorage();
  st3.setItem(te.COLLAPSED_KEY, JSON.stringify({ a: 1 }));
  assert.equal(te.loadCollapsed(st3).size, 0);
  assert.equal(te.loadCollapsed(fakeStorage()).size, 0);
});

test("7 prune 只保留仍存在的目录;不修改原集合", () => {
  const s = new Set(["a", "gone", "a/b"]);
  const pruned = te.prune(s, ["a", "a/b", "c"]);
  assert.deepEqual([...pruned].sort(), ["a", "a/b"]);
  assert.equal(s.has("gone"), true);
});
```

- [ ] **步骤 2:运行确认失败**

运行:`node --test tests/admin/tree-expand.test.mjs 2>&1 | grep -E "te.createCollapsedSet is not a function|^ℹ (tests|pass|fail)"`
预期:`tests 7`、`pass 3`、`fail 4`,报错 `te.setFromTree is not a function` 等

- [ ] **步骤 3:实现展开态集合**(追加到 `tree-expand.js` 末尾)

```js
// ---- 展开态:collapsed-set 模型,缺省=展开 ----
export const COLLAPSED_KEY = "admin.tree.collapsed.v1";

export function createCollapsedSet() {
  return new Set();
}

export function isCollapsed(set, dirPath) {
  return set.has(dirPath);
}

export function setFromTree(tree, mode) {
  const out = new Set();
  if (mode === "collapseAll") collectDirs(tree, out);
  return out;
}

function collectDirs(nodes, out) {
  for (const n of nodes) {
    if (n.type === "dir") {
      out.add(n.path);
      collectDirs(n.children || [], out);
    }
  }
  return out;
}

// 返回新 Set:仅保留集合中仍存在于 allDirPaths 的路径(目录被删/改名后清理)
export function prune(set, allDirPaths) {
  const keep = new Set(allDirPaths);
  const out = new Set();
  for (const p of set) if (keep.has(p)) out.add(p);
  return out;
}

export function saveCollapsed(set, storage) {
  try {
    storage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {
    /* 隐私模式等写入失败:静默,仅本次会话丢失持久化 */
  }
}

export function loadCollapsed(storage) {
  try {
    const raw = storage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
```

- [ ] **步骤 4:运行确认通过**

运行:`node --test tests/admin/tree-expand.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
预期:`tests 7`、`pass 7`、`fail 0`

- [ ] **步骤 5:Commit**

```bash
git add admin/server/public/tree-expand.js tests/admin/tree-expand.test.mjs
git commit -m "feat(admin): tree-expand.js 展开态折叠集合

collapsed-set 模型、缺省展开:setFromTree(collapseAll 全集/expandAll 空),
prune 清理失效路径(返回新 Set 不侵原集),save/load 注入 storage(localStorage
key admin.tree.collapsed.v1),非法 JSON/非数组/缺 key 一律回退空集。"
```

---

### 任务 3:`tree-expand.js` renameMap + 全量回归(用例 8–9)

**文件:**
- 修改:`admin/server/public/tree-expand.js`(末尾追加)
- 修改:`tests/admin/tree-expand.test.mjs`(末尾追加)

- [ ] **步骤 1:追加 2 个失败测试**

```js
test("8 renameMap:目录下命中、非前缀不命中、from/to 完整路径正确", () => {
  const paths = ["notes/a.md", "notes/b.md", "other/c.md", "notes/sub/d.md"];
  assert.deepEqual(te.renameMap("notes", "docs", paths), [
    { from: "notes/a.md", to: "docs/a.md" },
    { from: "notes/b.md", to: "docs/b.md" },
    { from: "notes/sub/d.md", to: "docs/sub/d.md" },
  ]);
});

test("9 renameMap:空目录/根级/空列表/无匹配 → []", () => {
  assert.deepEqual(te.renameMap("", "docs", ["notes/a.md"]), []);
  assert.deepEqual(te.renameMap("notes", "", ["notes/a.md"]), []);
  assert.deepEqual(te.renameMap("notes", "docs", []), []);
  assert.deepEqual(te.renameMap("notes", "docs", ["other.md"]), []);
});
```

- [ ] **步骤 2:运行确认失败**

运行:`node --test tests/admin/tree-expand.test.mjs 2>&1 | grep -E "te.renameMap is not a function|^ℹ (tests|pass|fail)"`
预期:`tests 9`、`pass 7`、`fail 2`,报错 `te.renameMap is not a function`

- [ ] **步骤 3:实现 renameMap**(追加到 `tree-expand.js` 末尾)

```js
// ---- 目录重命名映射:paths(标签 id)中以 oldDir/ 为前缀者映射到 newDir ----
export function renameMap(oldDir, newDir, paths) {
  if (!oldDir || !newDir) return [];
  const prefix = oldDir + "/";
  const out = [];
  for (const p of paths) {
    if (p.startsWith(prefix)) out.push({ from: p, to: newDir + "/" + p.slice(prefix.length) });
  }
  return out;
}
```

- [ ] **步骤 4:全量回归**

运行:`npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
预期:`tests 140`、`pass 140`、`fail 0`

- [ ] **步骤 5:Commit**

```bash
git add admin/server/public/tree-expand.js tests/admin/tree-expand.test.mjs
git commit -m "feat(admin): tree-expand.js renameMap 前缀映射

目录重命名时把打开标签的 id(即 path)按 oldDir/ 前缀映射到 newDir,供
前端逐条 store.rename 同步。根级/空参数/无匹配 → []。全量 131→140。"
```

---

### 任务 4:`index.html` 侧栏按钮 + `style.css` 树交互样式

**文件:**
- 修改:`admin/server/public/index.html`(sidebar-actions)
- 修改:`admin/server/public/style.css`(tab-menu 选择器分组 + 追加树样式)

- [ ] **步骤 1:`index.html` 头部按钮组改成 5 个**

把 `admin/server/public/index.html` 中:

```html
            <div class="sidebar-actions">
              <button id="new-file-btn" title="新建文件">+</button>
              <button id="new-dir-btn" title="新建目录">+D</button>
              <button id="refresh-btn" title="刷新">⟳</button>
            </div>
```

改为:

```html
            <div class="sidebar-actions">
              <button id="new-file-btn" title="新建文件">+</button>
              <button id="new-dir-btn" title="新建文件夹">+D</button>
              <button id="expand-all-btn" title="展开全部">⤒</button>
              <button id="collapse-all-btn" title="全部折叠">⤓</button>
              <button id="refresh-btn" title="刷新">⟳</button>
            </div>
```

- [ ] **步骤 2:`style.css` 树菜单浮层复用 `.tab-menu` 容器样式**

`admin/server/public/style.css` 中把 `.tab-menu {` 与 `.tab-menu[hidden] {` 选择器分组(树菜单复用 `.tab-menu-item`/`.tab-menu-sep`,这两个**不要**动):

- `.tab-menu {` → `.tab-menu, .tree-menu {`
- `.tab-menu[hidden] {` → `.tab-menu[hidden], .tree-menu[hidden] {`

- [ ] **步骤 3:`style.css` 追加树交互样式**

在 `admin/server/public/style.css` 末尾追加:

```css
/* ===== 文件树交互 ===== */
.tree-row {
  position: relative;
}

.tree-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-actions {
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  margin-left: auto;
}

.tree-item:hover .tree-actions,
.tree-item.active .tree-actions {
  opacity: 1;
}

.tree-action {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  padding: 1px 3px;
  cursor: pointer;
  line-height: 1;
  border-radius: 3px;
}

.tree-action:hover {
  color: var(--text);
  background: var(--bg-secondary);
}

.tree-input {
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: 0.9rem;
  padding: 1px 4px;
  border: 1px solid var(--accent);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
}

.tree-error {
  color: var(--danger);
  font-size: 0.75rem;
  padding: 2px 0.5rem;
}

.tree-inline-row {
  padding: 0.1rem 0;
}
```

- [ ] **步骤 4:验证 CSS 选择器与按钮 id 齐备**

```bash
grep -c "tree-menu" admin/server/public/style.css
grep -c 'id="expand-all-btn"' admin/server/public/index.html
grep -c 'id="collapse-all-btn"' admin/server/public/index.html
node --check admin/server/public/app.js && echo "app.js 语法 OK(未依赖新按钮前也过)"
```

预期:三个 grep 均为 `1`;`app.js 语法 OK`(此时 app.js 尚未改,仍是旧按钮行为,无碍)

- [ ] **步骤 5:Commit**

```bash
git add admin/server/public/index.html admin/server/public/style.css
git commit -m "feat(admin): 文件树侧栏按钮与树交互样式

侧栏头部 5 按钮:+新建文件 +D新建文件夹 ⤒展开全部 ⤓全部折叠 ⟳刷新。
.tree-menu 浮层复用 .tab-menu 容器样式(选择器分组);新增 .tree-row/
.tree-name/.tree-actions/.tree-action/.tree-input/.tree-error。新按钮 id
expand-all-btn / collapse-all-btn 需在任务 5 接事件。"
```

---

### 任务 5:`app.js` 渲染骨架 + 悬停 + 右键菜单 + 展开态(含 headless smoke)

**文件:**
- 修改:`admin/server/public/app.js`

- [ ] **步骤 1:导入 + 展开态状态**

`admin/server/public/app.js` 第 2 行后追加 import:

```js
import {
  pathDir, pathBase, pathJoin, defaultName, findConflict,
  createCollapsedSet, isCollapsed, setFromTree, prune, saveCollapsed, loadCollapsed,
  renameMap,
} from './tree-expand.js';
```

`let treeData = [];` 之后追加:

```js
// 展开态:折叠集合(缺省=展开),localStorage 持久化
let collapsedSet = loadCollapsed(localStorage);
```

- [ ] **步骤 2:`loadTree` 加 prune**

把 `loadTree` 的函数体改为(在 `renderTree` 前清洗折叠集):

```js
async function loadTree() {
  try {
    const data = await api('/tree');
    treeData = data.nodes;
    // 渲染前清理失效路径:目录被删/改名后,折叠集里的旧路径不再匹配任何节点
    collapsedSet = prune(collapsedSet, setFromTree(treeData, 'collapseAll'));
    renderTree(treeData, fileTree);
  } catch (err) {
    console.error('加载文件树失败:', err);
  }
}
```

- [ ] **步骤 3:重写 `renderTree` + 空白区右键**

把整个 `renderTree(nodes, container)` 函数替换为(含行结构、悬停操作、折叠渲染、行级右键):

```js
function renderTree(nodes, container) {
  container.innerHTML = '';
  for (const node of nodes) {
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.dataset.path = node.path;
    row.dataset.type = node.type;

    const item = document.createElement('div');
    item.className = 'tree-item';
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = node.type === 'dir' ? '📁' : '📄';
    const name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = node.name;
    item.append(icon, name);
    item.append(hoverActions(node.path, node.type));
    row.append(item);

    if (node.type === 'file') {
      item.addEventListener('click', () => openTab(node.path));
    } else {
      const children = document.createElement('div');
      children.className = 'tree-children';
      renderTree(node.children || [], children);
      children.hidden = isCollapsed(collapsedSet, node.path);
      item.addEventListener('click', (e) => {
        if (e.target.closest('.tree-actions')) return; // 点操作按钮不切换折叠
        toggleDir(node.path, children);
      });
      row.append(children);
    }

    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openTreeMenu(node, e.clientX, e.clientY);
    });
    container.append(row);
  }
}

// 树空白区右键:根级菜单(点不在行上才算空白)
fileTree.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.tree-row')) return;
  e.preventDefault();
  openTreeMenu(null, e.clientX, e.clientY);
});
```

- [ ] **步骤 4:`highlightActive` 选择器修复**

原来用 `el.querySelector('span:last-child')`——新结构里 name 后有 `.tree-actions`,取到的不再是名称。改为:

```js
function highlightActive(path) {
  document.querySelectorAll('.tree-item').forEach(el => {
    el.classList.remove('active');
    const nameEl = el.querySelector('.tree-name');
    if (nameEl && path.endsWith(nameEl.textContent)) {
      el.classList.add('active');
    }
  });
}
```

- [ ] **步骤 5:插入树交互段**

在 `tabbarScroll.addEventListener('scroll', closeTabMenu, true);` 之后、`function requestClose(id) {` 之前插入:

```js
// ===== 树交互:悬停操作、右键菜单、展开态 =====
function hoverActions(path, type) {
  const acts = document.createElement('span');
  acts.className = 'tree-actions';
  const mk = (title, text, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tree-action';
    b.title = title;
    b.textContent = text;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  };
  if (type === 'dir') {
    acts.append(mk('新建文件', '＋', () => startInlineCreate(path, 'file')));
    acts.append(mk('新建文件夹', '▣', () => startInlineCreate(path, 'dir')));
  }
  acts.append(mk('重命名', '✎', () => startInlineRename(path, type)));
  acts.append(mk('删除', '🗑', () => delNode(path, type)));
  return acts;
}

function toggleDir(dirPath, childrenEl) {
  if (childrenEl.hidden) {
    childrenEl.hidden = false;
    collapsedSet.delete(dirPath);
  } else {
    childrenEl.hidden = true;
    collapsedSet.add(dirPath);
  }
  saveCollapsed(collapsedSet, localStorage);
}

function expandDirByPath(dirPath) {
  const children = document.querySelector(`.tree-row[data-path="${CSS.escape(dirPath)}"] .tree-children`);
  if (children && children.hidden) {
    children.hidden = false;
    collapsedSet.delete(dirPath);
    saveCollapsed(collapsedSet, localStorage);
  }
}

function setAllExpanded(toCollapsed) {
  collapsedSet = setFromTree(treeData, toCollapsed ? 'collapseAll' : 'expandAll');
  saveCollapsed(collapsedSet, localStorage);
  renderTree(treeData, fileTree);
}

// 树右键菜单:独立浮层,复用 .tab-menu-item 样式与定位/翻转/Esc/点外收起机制
let treeMenu = null;
function ensureTreeMenu() {
  if (treeMenu) return treeMenu;
  treeMenu = document.createElement('div');
  treeMenu.className = 'tree-menu';
  treeMenu.hidden = true;
  document.body.append(treeMenu);
  return treeMenu;
}

function closeTreeMenu() {
  if (treeMenu) treeMenu.hidden = true;
}

function openTreeMenu(node, x, y) {
  const menu = ensureTreeMenu();
  closeTabMenu(); // 同一时刻只开一个菜单
  menu.textContent = '';
  const mk = (action, label) => {
    const b = document.createElement('button');
    b.className = 'tab-menu-item';
    b.dataset.action = action;
    b.textContent = label;
    b.addEventListener('click', () => onTreeMenuAction(action));
    return b;
  };
  const sep = () => {
    const s = document.createElement('div');
    s.className = 'tab-menu-sep';
    return s;
  };
  if (node && node.type === 'dir') {
    menu._ctx = { kind: 'dir', path: node.path };
    menu.append(mk('new-file', '新建文件'));
    menu.append(mk('new-dir', '新建文件夹'));
    menu.append(sep());
    menu.append(mk('rename', '重命名'));
    menu.append(mk('delete', '删除'));
  } else if (node && node.type === 'file') {
    menu._ctx = { kind: 'file', path: node.path, dir: pathDir(node.path) };
    menu.append(mk('new-file', '新建文件'));
    menu.append(mk('new-dir', '新建文件夹'));
    menu.append(sep());
    menu.append(mk('rename', '重命名'));
    menu.append(mk('delete', '删除'));
  } else {
    menu._ctx = { kind: 'root' };
    menu.append(mk('new-file', '新建文件'));
    menu.append(mk('new-dir', '新建文件夹'));
    menu.append(sep());
    menu.append(mk('expand-all', '展开全部'));
    menu.append(mk('collapse-all', '全部折叠'));
  }
  // 定位与翻转:与标签右键菜单同一套(右/下溢出回移,不出视口)
  menu.hidden = false;
  menu.style.left = '0px';
  menu.style.top = '0px';
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  menu.style.left = (x + mw + 4 > vw ? vw - mw - 4 : x) + 'px';
  menu.style.top = (y + mh + 4 > vh ? vh - mh - 4 : y) + 'px';
}

function onTreeMenuAction(action) {
  const ctx = treeMenu && treeMenu._ctx;
  closeTreeMenu();
  if (!ctx) return;
  if (action === 'new-file') {
    const dir = ctx.kind === 'dir' ? ctx.path : ctx.kind === 'file' ? ctx.dir : '';
    return startInlineCreate(dir, 'file');
  }
  if (action === 'new-dir') {
    const dir = ctx.kind === 'dir' ? ctx.path : ctx.kind === 'file' ? ctx.dir : '';
    return startInlineCreate(dir, 'dir');
  }
  if (action === 'rename') return startInlineRename(ctx.path, ctx.kind === 'file' ? 'file' : 'dir');
  if (action === 'delete') return delNode(ctx.path, ctx.kind === 'file' ? 'file' : 'dir');
  if (action === 'expand-all') return setAllExpanded(false);
  if (action === 'collapse-all') return setAllExpanded(true);
}

// 树菜单收起:点外 / Esc
document.addEventListener('click', (e) => {
  if (treeMenu && !treeMenu.hidden && !treeMenu.contains(e.target)) closeTreeMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTreeMenu();
});
```

- [ ] **步骤 6:头部按钮事件**

把 `new-file-btn` / `new-dir-btn` 两个 handler 的函数体替换为根级行内新建(去掉 `prompt`):

```js
$('new-file-btn').addEventListener('click', () => startInlineCreate('', 'file'));
$('new-dir-btn').addEventListener('click', () => startInlineCreate('', 'dir'));
```

在 `$('refresh-btn').addEventListener('click', loadTree);` 之后追加:

```js
// 展开全部 / 全部折叠
$('expand-all-btn').addEventListener('click', () => setAllExpanded(false));
$('collapse-all-btn').addEventListener('click', () => setAllExpanded(true));
```

- [ ] **步骤 7:语法 + headless smoke 验收**

```bash
cd /home/weno/works/Notes-Atlas
node --check admin/server/public/app.js && echo "语法 OK"
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
rm -rf /tmp/opencode/tree-smoke && mkdir -p /tmp/opencode/tree-smoke/admin
cp admin/server/public/app.js admin/server/public/index.html admin/server/public/style.css admin/server/public/tabs.js admin/server/public/tree-expand.js /tmp/opencode/tree-smoke/admin/
ln -s /home/weno/works/Notes-Atlas/admin/server/public/vendor /tmp/opencode/tree-smoke/admin/vendor
```

把下面的验收脚本追加到 `/tmp/opencode/tree-smoke/admin/app.js` 末尾:

```js
// ===== 树交互 smoke(仅临时副本,不入库) =====
(async function () {
  const R = { errors: [], rows: {}, actions: {}, menu: {}, buttons: {}, esc: {} };
  const origErr = console.error;
  console.error = (...a) => { R.errors.push(a.map(String).join(' ')); origErr.apply(console, a); };
  window.onerror = (m) => { R.errors.push('onerror: ' + m); };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const TREE = [
    { type: "dir", name: "A", path: "A", children: [
      { type: "dir", name: "B", path: "A/B", children: [{ type: "file", name: "x.md", path: "A/B/x.md" }] },
      { type: "file", name: "a.md", path: "A/a.md" },
    ] },
    { type: "file", name: "root.md", path: "root.md" },
  ];
  window.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/tree')) return json({ nodes: TREE });
    if (u.includes('/file?path=')) return json({ content: '内容', mtime: null, parseError: '' });
    return json({ message: 'not found' }, 404);
  };
  try {
    localStorage.removeItem('admin.tree.collapsed.v1'); // 干净起点
    const $ = (id) => document.getElementById(id);
    $('login-view').classList.add('hidden');
    $('main-view').classList.remove('hidden');
    await loadTree();
    const rows = () => document.querySelectorAll('.tree-row:not(.tree-inline-row)');
    const rowsByPath = (p) => document.querySelector(`.tree-row[data-path="${CSS.escape(p)}"]`);
    // 1. 渲染:5 行、data 属性、默认全展开
    R.rows.count = rows().length;
    R.rows.A = !!rowsByPath('A') && rowsByPath('A').dataset.type === 'dir';
    R.rows.expandedDefault = !rowsByPath('A').querySelector('.tree-children').hidden && !rowsByPath('A/B').querySelector('.tree-children').hidden;
    // 2. 悬停操作组:dir 4 个 / file 2 个
    R.actions.dir4 = rowsByPath('A').querySelectorAll('.tree-action').length === 4;
    R.actions.file2 = rowsByPath('A/a.md').querySelectorAll('.tree-action').length === 2;
    // 3. 右键菜单:目录 5 项(ctx.path=A) / 文件 4 项+ctx.dir / 空白 5 项
    rowsByPath('A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    const m = () => document.querySelector('.tree-menu');
    R.menu.dirItems = document.querySelectorAll('.tree-menu .tab-menu-item').length;
    R.menu.dirSep = !!document.querySelector('.tree-menu .tab-menu-sep');
    R.menu.dirCtx = m()._ctx && m()._ctx.path === 'A';
    closeTreeMenu();
    rowsByPath('A/a.md').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    R.menu.fileCtxDir = m()._ctx && m()._ctx.dir === 'A';
    closeTreeMenu();
    fileTree.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    R.menu.rootItems = document.querySelectorAll('.tree-menu .tab-menu-item').length;
    // 4. 全部折叠/展开:按钮 id 存在且可点
    R.buttons.ids = !!$('expand-all-btn') && !!$('collapse-all-btn');
    $('collapse-all-btn').click();
    R.buttons.collapsedBoth = rowsByPath('A').querySelector('.tree-children').hidden && rowsByPath('A/B').querySelector('.tree-children').hidden;
    R.buttons.saved = JSON.parse(localStorage.getItem('admin.tree.collapsed.v1')).sort().join(',') === 'A,A/B';
    $('expand-all-btn').click();
    R.buttons.expandedAll = !rowsByPath('A').querySelector('.tree-children').hidden && !rowsByPath('A/B').querySelector('.tree-children').hidden;
    R.buttons.savedEmpty = JSON.stringify(JSON.parse(localStorage.getItem('admin.tree.collapsed.v1') || '[]')) === '[]';
    // 5. 点目录名 toggle + 持久化
    rowsByPath('A').querySelector('.tree-item').click();
    R.buttons.toggledCollapsed = rowsByPath('A').querySelector('.tree-children').hidden;
    R.buttons.toggledSaved = JSON.parse(localStorage.getItem('admin.tree.collapsed.v1')).includes('A');
    // 6. Esc 关菜单 + 点外关菜单
    rowsByPath('A/B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    R.esc.closed = m().hidden === true;
    rowsByPath('A/B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    document.body.click();
    R.esc.outside = m().hidden === true;
    // 7. 翻转:右下角开菜单不出视口
    const vw = window.innerWidth, vh = window.innerHeight;
    rowsByPath('root.md').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: vw - 5, clientY: vh - 5 }));
    const r = m().getBoundingClientRect();
    R.esc.flip = r.right <= vw + 1 && r.bottom <= vh + 1 && r.left >= -1 && r.top >= -1;
  } catch (e) {
    R.errors.push('probe-crash: ' + (e && e.stack || e));
  }
  const pre = document.createElement('pre');
  pre.id = 'geom';
  pre.textContent = JSON.stringify(R, null, 2);
  document.body.appendChild(pre);
})();
```

跑 smoke:

```bash
cd /tmp/opencode/tree-smoke && (python3 -m http.server 8737 --bind 127.0.0.1 >/dev/null 2>&1 &) && sleep 1
timeout 90 google-chrome --headless --disable-gpu --no-sandbox --window-size=1600,900 --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:8737/admin/index.html" 2>/dev/null > /tmp/opencode/tree-smoke/dom.html
python3 - << 'PY_EOF'
import re
dom = open('/tmp/opencode/tree-smoke/dom.html').read()
m = re.search(r'<pre id="geom">(.*?)</pre>', dom, re.S)
print(m.group(1) if m else 'geom 未找到')
PY_EOF
```

预期:所有布尔字段全为 `true`(含 `rows.A`、`esc.flip`);`rows.count` 为 `5`;`menu.dirItems`/`menu.rootItems` 为 `5`、`menu.fileCtxDir` 为 `true`。若有 `false`,对照本任务代码逐项修到全绿再 commit。

> 已知陷阱:`rows().length` 会统计到 `tree-inline-row`(此时还没有,无碍);`rowsByPath` 用 `CSS.escape` 防 `/` 与 `.`。`loadTree` 是 async,smoke 里必须 `await loadTree()` 后再断言(顺序照抄)。

- [ ] **步骤 8:Commit**

```bash
git add admin/server/public/app.js
git commit -m "feat(admin): 文件树渲染骨架 + 悬停操作 + 右键菜单 + 展开态

renderTree 改为 tree-row 结构(data-path/data-type),悬停操作组 dir4 项
file2 项;目录点击 toggle 折叠并持久化;行级与空白区右键菜单(复用 tab-menu
定位/翻转/Esc/点外收起);expand-all/collapse-all 按钮;loadTree 渲染前
prune 折叠集;highlightActive 改 .tree-name 选择器(原 span:last-child 被
tree-actions 破坏)。headless smoke 全绿。"
```

---

### 任务 6:`app.js` 行内输入 + 操作流 + 标签同步(含 headless smoke)

**文件:**
- 修改:`admin/server/public/app.js`

- [ ] **步骤 1:插入行内输入与树操作段**

在任务 5 插入的树交互段**末尾**(`document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTreeMenu(); });` 之后)追加:

```js
// ===== 行内输入与树操作 =====
let inline = null;

function cancelInline() {
  if (!inline) return;
  const r = inline;
  inline = null;
  if (r.restore) r.restore();
}

function showInlineErr(r, msg) {
  r.err.textContent = msg;
  r.err.hidden = false;
  r.input.focus();
}

function wireInline() {
  if (!inline) return;
  const r = inline;
  r.input.addEventListener('keydown', (e) => {
    if (r.pending) { e.preventDefault(); return; }
    if (e.key === 'Enter') { e.preventDefault(); submitInline(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelInline(); }
  });
  r.input.addEventListener('input', () => { r.err.hidden = true; r.err.textContent = ''; });
  r.input.addEventListener('blur', () => {
    if (inline && !r.pending && !r.input.value.trim()) cancelInline();
  });
}

function startInlineCreate(dirPath, type) {
  cancelInline();
  if (dirPath) expandDirByPath(dirPath); // 折叠目录里新建先展开,让用户看到输入行
  const container = dirPath
    ? document.querySelector(`.tree-row[data-path="${CSS.escape(dirPath)}"] .tree-children`)
    : fileTree;
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'tree-row tree-inline-row';
  const input = document.createElement('input');
  input.className = 'tree-input';
  input.value = defaultName(type);
  const err = document.createElement('div');
  err.className = 'tree-error';
  err.hidden = true;
  row.append(input, err);
  container.prepend(row);
  inline = { mode: 'create', type, dirPath, input, err, pending: false, restore: () => row.remove() };
  input.focus();
  input.select();
  wireInline();
}

function startInlineRename(path, type) {
  cancelInline();
  const row = document.querySelector(`.tree-row[data-path="${CSS.escape(path)}"]`);
  if (!row) return;
  const nameEl = row.querySelector('.tree-name');
  const oldName = nameEl.textContent;
  const input = document.createElement('input');
  input.className = 'tree-input';
  input.value = oldName;
  const dot = oldName.lastIndexOf('.');
  input.setSelectionRange(0, dot > 0 ? dot : oldName.length);
  const err = document.createElement('div');
  err.className = 'tree-error';
  err.hidden = true;
  nameEl.replaceWith(input);
  input.after(err);
  inline = { mode: 'rename', path, type, input, err, pending: false, restore: () => { input.replaceWith(nameEl); err.remove(); } };
  input.focus();
  wireInline();
}

async function submitInline() {
  const r = inline;
  if (!r || r.pending) return;
  const name = r.input.value.trim();
  if (!name) { showInlineErr(r, '名称不能为空'); return; }
  if (r.mode === 'create') {
    if (r.type === 'file' && !name.endsWith('.md')) { showInlineErr(r, '仅支持 .md 文件'); return; }
    const fullPath = pathJoin(r.dirPath, name);
    if (findConflict(treeData, fullPath)) { showInlineErr(r, '同名文件或目录已存在'); return; }
    r.pending = true;
    try {
      await api(r.type === 'file' ? '/file' : '/dir', { method: 'POST', body: JSON.stringify({ path: fullPath }) });
    } catch (err) {
      r.pending = false;
      showInlineErr(r, err.message);
      return;
    }
    cancelInline();
    await loadTree();
    if (r.type === 'file') openTab(fullPath);
    // 新建目录:缺省展开,loadTree 后自然可见
  } else {
    // rename
    const to = pathJoin(pathDir(r.path), name);
    if (r.type === 'file' && !name.endsWith('.md')) { showInlineErr(r, '仅支持 .md 文件'); return; }
    if (to === r.path) { cancelInline(); return; }
    if (findConflict(treeData, to)) { showInlineErr(r, '同名文件或目录已存在'); return; }
    r.pending = true;
    try {
      await api('/rename', { method: 'POST', body: JSON.stringify({ from: r.path, to }) });
    } catch (err) {
      r.pending = false;
      showInlineErr(r, err.message);
      return;
    }
    // 标签同步:文件改 id;目录用 renameMap 覆盖所有打开的前缀标签
    if (r.type === 'file') {
      if (store.get(r.path)) store.rename(r.path, to);
    } else {
      for (const m of renameMap(r.path, to, store.getState().tabs.map((t) => t.id))) {
        store.rename(m.from, m.to);
      }
    }
    cancelInline();
    persistSoon();
    await loadTree();
  }
}

async function delNode(path, type) {
  if (type === 'file') {
    if (!confirm(`确定删除 ${path}?`)) return;
    try {
      await api(`/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
    } catch (err) {
      alert('删除失败: ' + err.message);
      return;
    }
    if (store.get(path)) { store.remove(path); persistSoon(); }
  } else {
    const node = findConflict(treeData, path);
    const n = node ? descendantCount(node) : 0;
    if (!confirm(`目录 ${path} 含 ${n} 项内容,确定连同内容一并删除?`)) return;
    try {
      await api(`/dir?path=${encodeURIComponent(path)}&force=1`, { method: 'DELETE' });
    } catch (err) {
      alert('删除失败: ' + err.message);
      return;
    }
    const prefix = path + '/';
    for (const t of [...store.getState().tabs]) { // 快照遍历:remove 会 splice 改动原数组
      if (t.id.startsWith(prefix)) { store.remove(t.id); }
    }
    persistSoon();
  }
  await loadTree();
}

// 子树节点总数(不含自身),文件为 0 —— 删除确认文案用的「N 项内容」
function descendantCount(node) {
  let n = 0;
  const walk = (ls) => { for (const x of ls) { n++; if (x.children) walk(x.children); } };
  walk(node && node.children ? node.children : []);
  return n;
}
```

- [ ] **步骤 2:语法检查**

```bash
node --check admin/server/public/app.js && echo "语法 OK"
```

预期:`语法 OK`

- [ ] **步骤 3:headless smoke(行内输入与操作流)**

```bash
cd /home/weno/works/Notes-Atlas
rm -rf /tmp/opencode/tree-op && mkdir -p /tmp/opencode/tree-op/admin
cp admin/server/public/app.js admin/server/public/index.html admin/server/public/style.css admin/server/public/tabs.js admin/server/public/tree-expand.js /tmp/opencode/tree-op/admin/
ln -s /home/weno/works/Notes-Atlas/admin/server/public/vendor /tmp/opencode/tree-op/admin/vendor
```

把下面的脚本追加到 `/tmp/opencode/tree-op/admin/app.js` 末尾:

```js
// ===== 行内输入与操作流 smoke(仅临时副本,不入库) =====
(async function () {
  const R = { errors: [], create: {}, dup: {}, renameF: {}, renameD: {}, delF: {}, delD: {} };
  const origErr = console.error;
  console.error = (...a) => { R.errors.push(a.map(String).join(' ')); origErr.apply(console, a); };
  window.onerror = (m) => { R.errors.push('onerror: ' + m); };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const TREE = [
    { type: "dir", name: "A", path: "A", children: [
      { type: "dir", name: "B", path: "A/B", children: [{ type: "file", name: "x.md", path: "A/B/x.md" }] },
      { type: "file", name: "a.md", path: "A/a.md" },
    ] },
    { type: "file", name: "root.md", path: "root.md" },
  ];
  const calls = [];
  window.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || 'GET', body: opts.body });
    if (u.endsWith('/tree')) return json({ nodes: TREE });
    if (u.includes('/file?path=') && !opts.method) return json({ content: '内容', mtime: null, parseError: '' });
    if (opts.method === 'DELETE') return json(null, 204);
    if (u.endsWith('/file') || u.endsWith('/dir') || u.endsWith('/rename')) return json(null, 204);
    return json({ message: 'not found' }, 404);
  };
  function objEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  try {
    localStorage.removeItem('admin.tree.collapsed.v1');
    const $ = (id) => document.getElementById(id);
    $('login-view').classList.add('hidden');
    $('main-view').classList.remove('hidden');
    await loadTree();
    const rowP = (p) => document.querySelector(`.tree-row[data-path="${CSS.escape(p)}"]`);
    const menuItem = (action) => document.querySelector(`.tree-menu [data-action="${action}"]`);
    const type = (input, val) => { input.value = val; input.dispatchEvent(new Event('input', { bubbles: true })); };
    const press = (input, key) => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

    // 1. 目录 A 右键 → 新建文件 → 行内输入 → Enter → POST /file + openTab
    rowP('A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    menuItem('new-file').click();
    const inp1 = document.querySelector('.tree-input');
    R.create.prefilled = inp1.value === '未命名.md';
    type(inp1, 'new.md');
    press(inp1, 'Enter');
    await new Promise((r) => setTimeout(r, 60));
    R.create.posted = calls.some((c) => c.url.endsWith('/file') && c.body && objEqual(JSON.parse(c.body), { path: 'A/new.md' }));
    R.create.opened = !!store.get('A/new.md');
    // 2. 重复名:再开新建输入,改名 a.md → 行内红字且输入保留
    rowP('A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    menuItem('new-file').click();
    const inp2 = document.querySelector('.tree-input');
    type(inp2, 'a.md');
    press(inp2, 'Enter');
    await new Promise((r) => setTimeout(r, 60));
    const err = document.querySelector('.tree-error');
    R.dup.shown = !err.hidden && /同名/.test(err.textContent);
    R.dup.stillOpen = document.querySelector('.tree-input') !== null;
    press(document.querySelector('.tree-input'), 'Escape');
    R.dup.escCancelled = document.querySelector('.tree-input') === null;
    // 2b. 目录新建:目录 B 右键 → 新建文件夹 → Enter → POST /dir
    rowP('A/B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    menuItem('new-dir').click();
    const inpB = document.querySelector('.tree-input');
    R.create.dirPrefilled = inpB.value === '新建文件夹';
    type(inpB, 'n');
    press(inpB, 'Enter');
    await new Promise((r) => setTimeout(r, 60));
    R.create.dirPosted = calls.some((c) => c.url.endsWith('/dir') && c.body && objEqual(JSON.parse(c.body), { path: 'A/B/n' }));
    // 3. 重命名文件 a.md → b.md:POST /rename,标签同步
    rowP('A/a.md').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    menuItem('rename').click();
    const inp3 = document.querySelector('.tree-input');
    type(inp3, 'b.md');
    press(inp3, 'Enter');
    await new Promise((r) => setTimeout(r, 60));
    R.renameF.posted = calls.some((c) => c.url.endsWith('/rename') && objEqual(JSON.parse(c.body), { from: 'A/a.md', to: 'A/b.md' }));
    // 4. 重命名目录 B → C:打开 A/B/x.md 标签后再改,断言 id 同步
    store.open({ path: 'A/B/x.md', content: 'x' });
    store.setActive('A/B/x.md');
    rowP('A/B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    menuItem('rename').click();
    const inp4 = document.querySelector('.tree-input');
    type(inp4, 'C');
    press(inp4, 'Enter');
    await new Promise((r) => setTimeout(r, 60));
    R.renameD.posted = calls.some((c) => c.url.endsWith('/rename') && objEqual(JSON.parse(c.body), { from: 'A/B', to: 'A/C' }));
    R.renameD.tabSynced = !!store.get('A/C/x.md') && !store.get('A/B/x.md');
    // 5. 删除文件:confirm 文案 + DEL
    window.confirm = (msg) => { R.delF.msg = msg; return true; };
    rowP('root.md').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    menuItem('delete').click();
    await new Promise((r) => setTimeout(r, 60));
    R.delF.posted = calls.some((c) => c.url === '/admin/api/file?path=root.md');
    // 6. 删除目录 A(非空):confirm 含计数 3,请求带 force=1
    window.confirm = (msg) => { R.delD.msg = msg; return true; };
    rowP('A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    menuItem('delete').click();
    await new Promise((r) => setTimeout(r, 60));
    R.delD.count3 = /含 3 项内容/.test(R.delD.msg || '');
    R.delD.force = calls.some((c) => c.url.includes('/dir?path=') && c.url.includes('force=1') && c.url.includes('path=A'));
  } catch (e) {
    R.errors.push('probe-crash: ' + (e && e.stack || e));
  }
  const pre = document.createElement('pre');
  pre.id = 'geom';
  pre.textContent = JSON.stringify(R, null, 2);
  document.body.appendChild(pre);
})();
```

跑 smoke:

```bash
cd /tmp/opencode/tree-op && (python3 -m http.server 8738 --bind 127.0.0.1 >/dev/null 2>&1 &) && sleep 1
timeout 90 google-chrome --headless --disable-gpu --no-sandbox --window-size=1600,900 --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:8738/admin/index.html" 2>/dev/null > /tmp/opencode/tree-op/dom.html
python3 - << 'PY_EOF'
import re
dom = open('/tmp/opencode/tree-op/dom.html').read()
m = re.search(r'<pre id="geom">(.*?)</pre>', dom, re.S)
print(m.group(1) if m else 'geom 未找到')
PY_EOF
```

预期:所有布尔字段全为 `true`(含 `dup.stillOpen`、`create.dirPosted`、`renameF.posted`/`renameD.posted`/`delF.posted`/`delD.force`、`create.dirPrefilled`);`errors: []`。若有 `false`,对照任务 6 代码排查(常见原因:`loadTree` 未 await、`confirm` 拦截时机、fetch stub 未覆盖某端点返回 404 导致 `store.rename` 被跳过)。全绿后 commit。

- [ ] **步骤 4:Commit**

```bash
git add admin/server/public/app.js
git commit -m "feat(admin): 树内行内输入与操作流

新建/重命名走行内输入(Enter 提交、Esc 与空失焦取消、服务端 409/400 转
行内红字保留输入、pending 防连点);新建文件成功即打开,新建目录自动展开;
重命名同步打开标签(文件单条 / 目录 renameMap 前缀批量,内容与 dirty 保留);
删除文件单确认、目录二次确认带子树计数走 force=1,相关标签快照遍历强关。
headless smoke 全绿。"
```

---

### 任务 7:headless 全链路 E2E(含跨刷新持久化)

**文件:**
- 临时副本(不入库)

- [ ] **步骤 1:准备一次性副本**

```bash
cd /home/weno/works/Notes-Atlas
rm -rf /tmp/opencode/tree-e2e && mkdir -p /tmp/opencode/tree-e2e/admin
cp admin/server/public/app.js admin/server/public/index.html admin/server/public/style.css admin/server/public/tabs.js admin/server/public/tree-expand.js /tmp/opencode/tree-e2e/admin/
ln -s /home/weno/works/Notes-Atlas/admin/server/public/vendor /tmp/opencode/tree-e2e/admin/vendor
```

把**单个相位切换探查**追加到 `/tmp/opencode/tree-e2e/admin/app.js` 末尾(双跑共用一份副本):

```js
// ===== E2E:run1 折叠并持久化 / run2 验证跨刷新恢复(仅临时副本) =====
// 相位由 localStorage 是否已有折叠 key 判定:run1 全新 profile 无 key → 折叠并写入;
// run2 同 profile 已有 key → 不动 localStorage,只断言模块启动时已恢复折叠态。
// 注意:sessionStorage 每次 Chrome 启动都清空,不能用来区分两次运行。
(async function () {
  const R = { errors: [], phase: '' };
  const origErr = console.error;
  console.error = (...a) => { R.errors.push(a.map(String).join(' ')); origErr.apply(console, a); };
  window.onerror = (m) => { R.errors.push('onerror: ' + m); };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const TREE = [
    { type: "dir", name: "A", path: "A", children: [{ type: "dir", name: "B", path: "A/B", children: [{ type: "file", name: "x.md", path: "A/B/x.md" }] }] },
    { type: "file", name: "root.md", path: "root.md" },
  ];
  window.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/tree')) return json({ nodes: TREE });
    if (u.includes('/file?path=')) return json({ content: '内容', mtime: null, parseError: '' });
    return json({ message: 'not found' }, 404);
  };
  try {
    const $ = (id) => document.getElementById(id);
    const rowP = (p) => document.querySelector(`.tree-row[data-path="${CSS.escape(p)}"]`);
    // 模块加载时(本脚本之前)collapsedSet = loadCollapsed(localStorage) 已执行——run2 的恢复点就在那里
    const hadCollapsed = localStorage.getItem('admin.tree.collapsed.v1') !== null;
    R.phase = hadCollapsed ? '2' : '1';
    $('login-view').classList.add('hidden');
    $('main-view').classList.remove('hidden');
    if (!hadCollapsed) {
      // run1:清库 → 渲染应全展开 → 全部折叠 → 持久化
      localStorage.removeItem('admin.tree.collapsed.v1');
      await loadTree();
      R.defaultExpanded = !rowP('A').querySelector('.tree-children').hidden;
      $('collapse-all-btn').click();
      R.collapsedA = rowP('A').querySelector('.tree-children').hidden;
      R.persisted = JSON.parse(localStorage.getItem('admin.tree.collapsed.v1') || '[]').includes('A');
    } else {
      // run2:不动 localStorage,断言启动恢复
      await loadTree();
      R.fromStorage = JSON.parse(localStorage.getItem('admin.tree.collapsed.v1') || '[]').includes('A');
      R.stillCollapsed = rowP('A').querySelector('.tree-children').hidden;
    }
  } catch (e) {
    R.errors.push('probe-crash: ' + (e && e.stack || e));
  }
  const pre = document.createElement('pre');
  pre.id = 'geom';
  pre.textContent = JSON.stringify(R, null, 2);
  document.body.appendChild(pre);
})();
```

- [ ] **步骤 2:双跑(共享 `--user-data-dir`,跨「刷新」持久化)**

```bash
cd /tmp/opencode/tree-e2e && (python3 -m http.server 8739 --bind 127.0.0.1 >/dev/null 2>&1 &) && sleep 1
rm -rf /tmp/opencode/tree-uprofile
timeout 90 google-chrome --headless --disable-gpu --no-sandbox --user-data-dir=/tmp/opencode/tree-uprofile --window-size=1600,900 --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:8739/admin/index.html" 2>/dev/null > /tmp/opencode/tree-e2e/run1.html
timeout 90 google-chrome --headless --disable-gpu --no-sandbox --user-data-dir=/tmp/opencode/tree-uprofile --window-size=1600,900 --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:8739/admin/index.html" 2>/dev/null > /tmp/opencode/tree-e2e/run2.html
python3 - << 'PY_EOF'
import re
for f in ['run1.html', 'run2.html']:
    dom = open(f'/tmp/opencode/tree-e2e/{f}').read()
    m = re.search(r'<pre id="geom">(.*?)</pre>', dom, re.S)
    print('====', f, '====')
    print(m.group(1) if m else 'geom 未找到')
PY_EOF
```

预期(两份 geom 各只有一份,靠 `phase` 字段区分):
- run1:`phase: "1"`、`defaultExpanded: true`、`collapsedA: true`、`persisted: true`、`errors: []`
- run2:`phase: "2"`、`fromStorage: true`、`stillCollapsed: true`、`errors: []`(关键证据:第二个实例**未做任何点击**,模块启动时 `loadCollapsed(localStorage)` 已恢复折叠态,`loadTree` 渲染即隐藏)

若 run2 的 `phase` 仍是 `"1"`,说明 `rm -rf` 后 profile 里残留了 localStorage(检查命令行 `--user-data-dir` 是否两次一致、中途有没有别的 Chrome 进程占用同一 profile 写入);若 `stillCollapsed: false` 而 `fromStorage: true`,检查 `renderTree` 是否真的按 `isCollapsed(collapsedSet, node.path)` 渲染,或 `loadTree` 里 prune 误删了集合。

- [ ] **步骤 3:回归确认**

```bash
cd /home/weno/works/Notes-Atlas && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

预期:`tests 140`、`pass 140`、`fail 0`

- [ ] **步骤 4:Commit(本任务无 repo 改动可略;若有排查修正则按 4 个目标文件显式 add)**

若排查期间改了 repo 文件:

```bash
git add admin/server/public/app.js admin/server/public/style.css admin/server/public/index.html admin/server/public/tree-expand.js
git commit -m "fix(admin): 树交互 E2E 排查修正"
```

否则跳过本步,直接进任务 8。

---

### 任务 8:全量回归 + 部署

**文件:**
- 无仓库改动(仅部署)

- [ ] **步骤 1:最终回归与工作区核对**

```bash
cd /home/weno/works/Notes-Atlas
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
git status --porcelain | wc -l
git log --oneline -8
```

预期:`tests 140`、`pass 140`、`fail 0`;未提交改动数仍为 **102**(无关改动,与本功能无关);最近 commit 含计划文档与 7 个功能 commit。

- [ ] **步骤 2:rsync + md5(排除 `docker-compose.yml`)**

```bash
cd /home/weno/works/Notes-Atlas
rsync -av --delete --exclude node_modules --exclude .state --exclude .env --exclude docker-compose.yml admin/server/ web:/data/stacks/admin/
files=(public/tree-expand.js public/tabs.js public/app.js public/style.css public/index.html)
L=$(cd admin/server && md5sum "${files[@]}")
R=$(ssh web "cd /data/stacks/admin && md5sum ${files[*]}")
[ "$L" = "$R" ] && echo "5 个文件 md5 全部一致" || { echo "不一致!"; diff <(printf '%s\n' "$L") <(printf '%s\n' "$R"); }
```

预期:`5 个文件 md5 全部一致`。注意新文件 `tree-expand.js` 也在比对清单里。

- [ ] **步骤 3:打回滚标签 + 重建容器(必须 `--build`)**

```bash
ssh web 'docker tag admin-admin:latest admin-admin:rollback-$(date +%Y%m%d-%H%M%S) && cd /data/stacks/admin && docker compose up -d --build 2>&1 | tail -3'
```

预期:`Container admin-admin-1 Started`;记录回滚标签名供故障回退。

- [ ] **步骤 4:容器内 md5 + 日志**

```bash
ssh web "docker exec admin-admin-1 sh -c 'cd /app && md5sum public/tree-expand.js public/tabs.js public/app.js public/style.css public/index.html' && echo '--- log ---' && docker logs --tail 5 admin-admin-1"
```

预期:五个 md5 与本机一致;日志 `listening on 0.0.0.0:8477`、无报错。

- [ ] **步骤 5:线上 HTTP 抽查**

```bash
for p in "/admin/tree-expand.js" "/admin/tabs.js" "/admin/app.js" "/admin/style.css" "/admin/index.html"; do
  printf "%-26s -> %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://blogs.lovetulin.cn$p)"
done
curl -s -o /dev/null -w "MIME tree-expand.js: %{content_type}\n" https://blogs.lovetulin.cn/admin/tree-expand.js
```

预期:五个均 `200`;tree-expand.js MIME `text/javascript` 或 `application/javascript`。

- [ ] **步骤 6:完成报告 + 人工验收清单**

报告完成后列出人工验收项(需用户登录 `https://blogs.lovetulin.cn/admin/`):

1. 右键任意目录 → 新建文件/新建文件夹/重命名/删除;悬停目录 4 图标、悬停文件 2 图标
2. 目录右键「新建文件」→ 行内输入、Enter 创建并打开;重名报行内红字可继续改
3. 目录右键「新建文件夹」→ 行内输入、Enter 创建,目录自动展开露出结果
4. 右键文件重命名 → 行内输入、保存后标签标题同步变;右键目录重命名 → 其下已打开标签全部同步
5. 删除文件/空目录/非空目录 → confirm 文案正确,非空目录二次确认显示子树计数
6. 「全部折叠」「展开全部」生效;刷新页面后折叠状态保持
7. 空白区右键出现「新建(根)/展开全部/全部折叠」;Esc / 点外关菜单
8. 场景回归:保存、删除、重命名、切标签、批量关闭(tab 右键菜单)、预览开关、刷新恢复均不回归