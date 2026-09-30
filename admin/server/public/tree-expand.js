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
