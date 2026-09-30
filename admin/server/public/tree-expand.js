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