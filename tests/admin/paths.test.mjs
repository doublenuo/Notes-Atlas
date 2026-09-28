import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { safeResolve, EXCLUDE_DIRS } from "../../admin/server/src/paths.js";

const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "na-paths-"));

test("逃逸1:../ 相对越界 → 400", () => {
  assert.throws(() => safeResolve(mk(), "../secret.md"), (e) => e.status === 400 && e.code === "INVALID_PATH");
});

test("逃逸2:绝对路径 → 400", () => {
  assert.throws(() => safeResolve(mk(), "/etc/passwd"), (e) => e.status === 400 && e.code === "INVALID_PATH");
});

test("逃逸3:归一化后越界(a/../../x.md) → 400", () => {
  assert.throws(() => safeResolve(mk(), "a/../../x.md"), (e) => e.status === 400 && e.code === "INVALID_PATH");
});

test("逃逸4:空字节 → 400", () => {
  assert.throws(() => safeResolve(mk(), "a\0b.md"), (e) => e.status === 400 && e.code === "INVALID_PATH");
});

test("逃逸5:符号链接逃逸(realpath 复核) → 400", () => {
  const docs = mk();
  const outside = path.join(os.tmpdir(), `na-out-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(outside, "x");
  fs.symlinkSync(outside, path.join(docs, "evil.md"));
  assert.throws(() => safeResolve(docs, "evil.md"), (e) => e.status === 400 && e.code === "INVALID_PATH");
  fs.unlinkSync(outside);
});

test("正常相对路径解析到 docs 下", () => {
  const docs = mk();
  assert.equal(safeResolve(docs, "dir/note.md"), path.join(docs, "dir/note.md"));
});

test("EXCLUDE_DIRS 覆盖四类排除目录", () => {
  for (const d of [".vitepress", "public", "admin", "node_modules"]) {
    assert.ok(EXCLUDE_DIRS.has(d), `缺少 ${d}`);
  }
});
