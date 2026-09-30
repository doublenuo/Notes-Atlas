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
  const store = createTabStore({ storage, ...extra });
  store._storage = storage;
  return store;
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