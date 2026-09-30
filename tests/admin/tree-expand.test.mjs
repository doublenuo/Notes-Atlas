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