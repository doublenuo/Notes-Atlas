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
