// Notes Atlas Admin Frontend
import { createTabStore } from './tabs.js';
import {
  pathDir, pathBase, pathJoin, defaultName, findConflict,
  createCollapsedSet, isCollapsed, setFromTree, prune, saveCollapsed, loadCollapsed,
  renameMap,
} from './tree-expand.js';

const API = '/admin/api';

let treeData = [];

// 展开态:折叠集合(缺省=展开),localStorage 持久化
let collapsedSet = loadCollapsed(localStorage);

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

// 防抖 + 竞态:序号只增,过期响应直接丢弃,避免连续打字时预览内容倒退
let previewTimer = null;
let previewSeq = 0;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const editorContent = $('editor-content');
const editor = $('editor');
const saveBtn = $('save-btn');
const filePathInput = $('file-path');
const fileMtime = $('file-mtime');
const parseError = $('parse-error');
const buildStatus = $('build-status');
const lastCommit = $('last-commit');

// ===== 标签页 store =====
// onChange 的 reason 决定 DOM 工作量:
// - applyLayout:每次都要(预览开关、分栏宽度是布局态,拖分隔条时被高频调用)
// - renderTabBar:split 拖动时不必(宽度没变,重绘纯属浪费)
// - loadActiveIntoEditor:只有内容类 reason 才重载编辑器;content/saved 绝不能,
//   否则光标与选区会被重置。§4.1 行为表外的新增 reason 一律不重载。
const RELOAD_REASONS = new Set(['open', 'activate', 'close', 'rename', 'restore', 'missing', 'close-others', 'close-right', 'close-all']);
const store = createTabStore({
  storage: sessionStorage,
  onChange(state, meta) {
    applyLayout(state);
    if (meta.reason !== 'split') renderTabBar(state);
    if (!RELOAD_REASONS.has(meta.reason)) return;
    loadActiveIntoEditor(state);
  },
});

// 布局态唯一落点:预览开关视觉、show-preview 类、分栏宽度都由这里写。
// show-preview 类不可省:CSS 靠它显示预览面板与分隔条(style.css:443-448)。
function applyLayout(state) {
  split.style.setProperty('--split', state.splitPct + '%');
  split.classList.toggle('show-preview', state.previewOn);
  const btn = $('preview-btn');
  btn.textContent = state.previewOn ? '收起预览' : '预览';
  btn.classList.toggle('active', state.previewOn);
  btn.setAttribute('aria-pressed', String(state.previewOn));
}

// 持久化防抖 500ms:与预览的 300ms 分开,两者时机不同
let persistTimer = null;
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const r = store.persist();
    if (r.status === 'degraded' && !$('tabbar-note')) {
      // 降级 = 标签还在但未保存内容被剥掉,刷新后不保留,必须提示用户
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
    // 有未保存修改时交给浏览器原生「离开此页面?」提示
    e.preventDefault();
    e.returnValue = '';
  }
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
    // 右键打开批量关闭菜单;不改变活动标签(锚点 ≠ 活动)
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openTabMenu(t.id, e.clientX, e.clientY);
    });
    frag.append(el);
  }
  tabbarScroll.replaceChildren(frag);

  const overflow = tabbarScroll.scrollWidth > tabbarScroll.clientWidth;
  tabbarPrev.hidden = !overflow;
  tabbarNext.hidden = !overflow;
}

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
// 标签栏横向滚动收起菜单(capture 才能收到 scrollBy 触发的滚动)
tabbarScroll.addEventListener('scroll', closeTabMenu, true);

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

// API 请求
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    showLogin();
    throw new Error('未登录');
  }
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

// 登录
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const user = $('login-user').value;
  const pass = $('login-pass').value;
  try {
    await api('/login', {
      method: 'POST',
      body: JSON.stringify({ user, pass }),
    });
    showMain();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

// 退出
$('logout-btn').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  showLogin();
});

function showLogin() {
  mainView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

function showMain() {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');
  loadTree();
  loadStatus();
  setInterval(loadStatus, 5000);
}

// 文件树
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

function renderTree(nodes, container) {
  container.innerHTML = '';
  for (const node of nodes) {
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.dataset.path = node.path;
    row.dataset.type = node.type;

    const item = document.createElement('div');
    item.className = 'tree-item';
    // 文件名必须走 textContent:node.name 是服务端 readdir 的原始条目,未转义;
    // files.create 只校验 safeResolve + .md 后缀、不校验 basename,
    // 拼进 innerHTML 等于让任何能操作面板的人给自己种一个 XSS
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
      e.stopPropagation(); // 阻止冒泡到父行:否则嵌套行会被父行 handler 覆盖菜单上下文
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

// 打开一篇笔记:已在标签页里就只激活(不重拉,否则丢弃未保存内容),否则新建
async function openTab(path) {
  if (store.get(path)) {
    store.setActive(path);
    highlightActive(path);
    return;
  }
  try {
    const data = await api(`/file?path=${encodeURIComponent(path)}`);
    store.open({ path, content: data.content, mtime: data.mtime, parseError: data.parseError });
    loadTree();
    highlightActive(path);
  } catch (err) {
    alert('打开文件失败: ' + err.message);
  }
}

function highlightActive(path) {
  document.querySelectorAll('.tree-item').forEach(el => {
    el.classList.remove('active');
    const nameEl = el.querySelector('.tree-name');
    if (nameEl && path.endsWith(nameEl.textContent)) {
      el.classList.add('active');
    }
  });
}

// 保存
$('save-btn').addEventListener('click', async () => {
  const t = store.active();
  if (!t) return;
  try {
    await api('/file', {
      method: 'PUT',
      body: JSON.stringify({ path: t.path, content: editor.value }),
    });
    store.markSaved(t.id, { mtime: new Date().toISOString() });
    persistSoon();
    fileMtime.textContent = new Date().toLocaleString();
    parseError.textContent = '';
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
});

// 删除文件
$('delete-btn').addEventListener('click', async () => {
  const t = store.active();
  if (!t) return;
  if (!confirm(`确定删除 ${t.path}?`)) return;
  try {
    await api(`/file?path=${encodeURIComponent(t.path)}`, { method: 'DELETE' });
    store.remove(t.id); // 强制关,不走 dirty 确认:文件都删了
    persistSoon();
    loadTree();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
});

// 重命名
$('rename-btn').addEventListener('click', async () => {
  const t = store.active();
  if (!t) return;
  const newName = prompt('新文件名:', t.path.split('/').pop());
  if (!newName) return;
  const dir = t.path.split('/').slice(0, -1).join('/');
  const newPath = dir ? `${dir}/${newName}` : newName;
  try {
    await api('/rename', {
      method: 'POST',
      body: JSON.stringify({ from: t.path, to: newPath }),
    });
    store.rename(t.id, newPath); // id 即 path,重命名要同步改,否则 tab 定位会失效
    persistSoon();
    loadTree();
  } catch (err) {
    alert('重命名失败: ' + err.message);
  }
});

// 新建文件(根级行内输入)
$('new-file-btn').addEventListener('click', () => startInlineCreate('', 'file'));

// 新建目录(根级行内输入)
$('new-dir-btn').addEventListener('click', () => startInlineCreate('', 'dir'));

// 刷新
$('refresh-btn').addEventListener('click', loadTree);

// 展开全部 / 全部折叠
$('expand-all-btn').addEventListener('click', () => setAllExpanded(false));
$('collapse-all-btn').addEventListener('click', () => setAllExpanded(true));

// 构建状态
async function loadStatus() {
  try {
    const data = await api('/build/status');
    buildStatus.textContent = data.state;
    buildStatus.className = `status-badge ${data.state}`;
    if (data.lastCommit) {
      lastCommit.textContent = data.lastCommit;
    }
  } catch (err) {
    console.error('加载状态失败:', err);
  }
}

// 启动时恢复标签页
// 必须在 treeData 就绪后做 missing 校验:恢复的是当时的未保存内容,而磁盘上的
// 文件可能已被删除或改名。不校验的话,打开一个已删文件、随手一存,就会在磁盘
// 上重新创建它。因此不能放在 showMain() 的同步调用之后——那时 loadTree 还没
// 返回,treeData 是空数组,会把所有恢复出来的标签错标成 missing。
async function restoreTabs() {
  const restored = store.restore();
  if (!restored.ok) return;
  if (!store.getState().tabs.length) return;
  const flat = [];
  (function walk(nodes) {
    for (const n of nodes) {
      if (n.type === 'dir') walk(n.children || []);
      else flat.push(n.path);
    }
  })(treeData);
  const gone = new Set(
    store.getState().tabs.filter((t) => !flat.includes(t.path)).map((t) => t.id)
  );
  store.markMissing(gone); // emit('missing') -> onChange 重载活动标签,saveBtn 禁用
}

// 检查是否已登录
(async () => {
  try {
    await api('/tree');
    showMain();
    await loadTree(); // 等 treeData 就绪,restoreTabs 的 missing 校验依赖它
    restoreTabs();
  } catch {
    showLogin();
  }
})();

// ===== 预览 =====
// 预览默认关闭:纯单栏编辑,点「预览」才展开分栏。关闭期间不发起渲染请求,
// 否则每次打开文件/每次按键都会白跑一次 markdown 渲染与 KaTeX 排版。
// 开关本身在 store 里(previewOn),可随标签页一并持久化,刷新后布局不变。

function schedulePreview() {
  if (!store.getState().previewOn) return; // 预览未开启,不必渲染
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 300);
}

function stopPreview() {
  clearTimeout(previewTimer);
  previewSeq++; // 作废在途响应,避免关闭后又被旧结果填回内容
  previewEl.innerHTML = '';
}

// 预览开关与分栏宽度已移入 store,故可随标签页一并持久化(刷新后布局不变)
$('preview-btn').addEventListener('click', () => {
  const next = !store.getState().previewOn;
  store.setPreviewOn(next); // 视觉与 show-preview 类由 onChange -> applyLayout 处理
  if (next) renderPreview(); // 立即出内容,不等 300ms 防抖
  else stopPreview();
  persistSoon();
});

async function renderPreview() {
  const seq = ++previewSeq;
  const content = editor.value;
  const path = store.active()?.path ?? '';
  if (!content.trim()) {
    previewEl.innerHTML = '<p class="preview-empty">（空文档）</p>';
    return;
  }
  try {
    const data = await api('/preview', {
      method: 'POST',
      body: JSON.stringify({ content, path }),
    });
    if (seq !== previewSeq) return; // 过期响应,丢弃
    previewEl.innerHTML = data.html;
    hardenPreviewLinks();
    renderMath();
    renderMermaid();
  } catch (err) {
    if (seq !== previewSeq) return;
    previewEl.innerHTML = `<p class="preview-error">预览渲染失败：${escapeHtml(err.message)}</p>`;
  }
}

// 预览里的 [[双链]] / 外链都是裸 <a>,没有 target/rel。点一下就把 admin 页面
// 导航走,用户正在编辑但没保存的内容直接丢(数据丢失)。统一开新窗口。
// 用「设属性」而不是 click 委托 + window.open:设属性是声明式的,
// 浏览器自己处理中键/Ctrl+点击/右键新标签页,委托 + preventDefault 会把这些
// 全部劫持掉,还要自己判断 href 协议,收益不抵复杂度
function hardenPreviewLinks() {
  for (const a of previewEl.querySelectorAll('a[href]')) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
}

// KaTeX 纯客户端排版:markdown-it 未装数学插件,公式原样透传
// 定界符与站点 markdown-it-mathjax3 一致(含单 $ —— 全库真实笔记有 146 处单 $ 公式)
function renderMath() {
  if (typeof renderMathInElement !== 'function') return;
  try {
    renderMathInElement(previewEl, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false, // 解析失败退回原文,不中断整篇
    });
  } catch (err) {
    console.error('公式排版失败:', err);
  }
}

// renderMermaid 会被每次预览都调,initialize 只需一次
// 设计文档 §6.3 要求显式关掉 startOnLoad:mermaid 默认是 true,只在
// DOMContentLoaded 时自动跑一遍 run();现在无害仅因为 vendor 是 body 末尾的
// 阻塞 <script>,自动钩子已经错过——这是对脚本加载位置的隐性依赖,
// 一旦有人给它们加 defer/async 就会重复渲染
let mermaidReady = false;
async function renderMermaid() {
  if (!window.mermaid) return;
  const nodes = previewEl.querySelectorAll('.language-mermaid:not([data-processed])');
  if (!nodes.length) return;
  try {
    if (!mermaidReady) {
      window.mermaid.initialize({ startOnLoad: false });
      mermaidReady = true;
    }
    await window.mermaid.run({ nodes });
  } catch (err) {
    // 单图语法错只坏该图,mermaid 会把错误写进该节点
    console.error('mermaid 渲染失败:', err);
  }
}

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

// 分隔条拖动:clamp 20%~80%,避免任一侧被压到不可用
// endDrag 三个出口都要绑:只绑 mouseup 的话,拖出窗口 / alt-tab 失焦后 dragging
// 会一直悬挂,此后每一次无关的 mousemove 都在改宽度,分隔条也一直高亮
let dragging = false;
function endDrag() {
  if (!dragging) return;
  dragging = false;
  divider.classList.remove('dragging');
}
divider.addEventListener('mousedown', (e) => {
  dragging = true;
  divider.classList.add('dragging');
  e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const r = split.getBoundingClientRect();
  const pct = ((e.clientX - r.left) / r.width) * 100;
  // clamp 交给 store.setSplitPct(20~80),它还会 emit('split')->applyLayout 写 --split
  store.setSplitPct(pct);
});
window.addEventListener('mouseup', endDrag);
window.addEventListener('blur', endDrag);
window.addEventListener('mouseleave', endDrag);
