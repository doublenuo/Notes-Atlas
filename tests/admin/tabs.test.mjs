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