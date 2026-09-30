/**
 * 后台编辑器的标签页状态机。纯状态:零 DOM、零 fetch、零定时器。
 * 所有 DOM 写入留在 app.js,通过 onChange(state, meta) 回调通知。
 *
 * 这样切分是刻意的:本文件能直接被 node --test import 测试,不需要浏览器
 * 也不需要 DOM shim,而标签逻辑(脏标记/归属规则/容量降级)恰是最需要单测的部分。
 *
 * id 即 path:path 在 vault 内天然唯一,省掉一层自增 id 与 path 的映射,
 * 代价是重命名时要同步改 id(见 rename)。
 */

const KEY = "admin.tabs.v1";

/** 关闭一个 tab 后该激活谁:优先右侧相邻,无右侧取左侧。 */
function nextActiveId(tabs, closedIdx) {
  if (closedIdx < 0) return null;
  const right = tabs[closedIdx + 1];
  if (right) return right.id;
  const left = tabs[closedIdx - 1];
  return left ? left.id : null;
}

export function createTabStore({ storage, onChange = () => {} }) {
  const state = { tabs: [], activeId: null, previewOn: false, splitPct: 50 };

  const emit = (reason, id = null) => onChange(getState(), { reason, id });

  function getState() {
    return { ...state, tabs: state.tabs.map((t) => ({ ...t })) };
  }

  function get(id) {
    return state.tabs.find((t) => t.id === id) || null;
  }

  function active() {
    return state.activeId ? get(state.activeId) : null;
  }

  function open({ path, content = "", mtime = null, parseError = "", dirty = false, missing = false }) {
    const existing = get(path);
    if (existing) {
      // 已打开:只激活,不重复拉取,也不动缓冲区(否则会丢弃未保存内容)
      if (state.activeId === path) return { ok: true, created: false };
      state.activeId = path;
      emit("activate", path);
      return { ok: true, created: false };
    }
    state.tabs.push({ id: path, path, content, mtime, parseError, cursor: 0, scrollTop: 0, dirty, missing });
    state.activeId = path;
    emit("open", path);
    return { ok: true, created: true };
  }

  function setActive(id) {
    if (!get(id) || state.activeId === id) return;
    state.activeId = id;
    emit("activate", id);
  }

  /** 关闭。dirty 时拒绝并让调用方弹确认;missing 的 tab 不弹(文件已不存在)。 */
  function close(id) {
    const t = get(id);
    if (!t) return { ok: false, reason: "not-found" };
    if (t.dirty && !t.missing) return { ok: false, reason: "dirty" };
    return remove(id);
  }

  /** 强制关闭,绕过 dirty 检查。删除文件后用这个。 */
  function remove(id) {
    const idx = state.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return { ok: false, reason: "not-found" };
    const wasActive = state.activeId === id;
    // 归属必须在 splice 之前算:splice 会让右侧元素左移一位,
    // 之后按 idx 取右边会拿到「原本右两个」的元素(关 b 于 [a,b,c] 会得到 a 而非 c)
    const nextId = wasActive ? nextActiveId(state.tabs, idx) : null;
    state.tabs.splice(idx, 1);
    if (wasActive) state.activeId = nextId;
    emit("close", id);
    return { ok: true };
  }

  function updateContent(id, content) {
    const t = get(id);
    if (!t) return;
    t.content = content;
    t.dirty = true;
    emit("content", id);
  }

  /** 记录光标与滚动位置。刻意提供方法而非让调用方直接改字段:get() 返回的是活引用,靠引用改字段能碰巧生效,但那是没有声明的契约。 */
  function setView(id, { cursor, scrollTop }) {
    const t = get(id);
    if (!t) return;
    if (typeof cursor === "number") t.cursor = cursor;
    if (typeof scrollTop === "number") t.scrollTop = scrollTop;
  }

  function markSaved(id, { mtime = null } = {}) {
    const t = get(id);
    if (!t) return;
    t.dirty = false;
    if (mtime) t.mtime = mtime;
    emit("saved", id);
  }

  function rename(id, newPath) {
    const t = get(id);
    if (!t) return { ok: false, reason: "not-found" };
    if (get(newPath)) return { ok: false, reason: "duplicate" };
    t.path = newPath;
    t.id = newPath;
    if (state.activeId === id) state.activeId = newPath;
    emit("rename", newPath);
    return { ok: true };
  }

  return { getState, get, active, open, setActive, close, remove, updateContent, setView, markSaved, rename };
}