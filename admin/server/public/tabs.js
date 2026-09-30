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

// sessionStorage 上限约 5MB;vault 最大 .md 约 156KB,20 个大标签就可能撑爆。
// 故写入前先量长度,超 4MB 就剥离全部 content 再写;setItem 仍抛(浏览器可能
// 给更小配额)则只留 activeId/previewOn/splitPct。任何一档失败都不阻断编辑。
const PERSIST_LIMIT = 4 * 1024 * 1024;

/** 关闭一个 tab 后该激活谁:优先右侧相邻,无右侧取左侧。 */
function nextActiveId(tabs, closedIdx) {
  if (closedIdx < 0) return null;
  const right = tabs[closedIdx + 1];
  if (right) return right.id;
  const left = tabs[closedIdx - 1];
  return left ? left.id : null;
}

/** 范围内需要确认的 dirty 数量:missing 的不计(文件已不存在,缓冲仅留作查看)。 */
function countDirty(list) {
  let n = 0;
  for (const t of list) if (t.dirty && !t.missing) n++;
  return n;
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

  /** 批量:关掉锚点以外的全部标签。锚点保留并激活(标准归属)。 */
  function closeOthers(anchorId, { force = false } = {}) {
    const anchor = get(anchorId);
    if (!anchor) return { ok: false, reason: "not-found" };
    const targets = state.tabs.filter((t) => t.id !== anchorId);
    const n = countDirty(targets);
    if (n > 0 && !force) return { ok: false, reason: "dirty", count: n };
    state.tabs = [anchor];
    state.activeId = anchorId;
    emit("close-others", anchorId);
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

  /**
   * 标签标题三级降级:basename → 父目录/basename → 完整相对路径。
   * 因 vault 存在同名文件(index.md 等),只显示 basename 会分不清。
   * 纯函数,只依赖当前 tabs,不做 I/O。
   */
  function titles() {
    const base = new Map();
    for (const t of state.tabs) {
      const b = t.path.split("/").pop();
      base.set(b, (base.get(b) || 0) + 1);
    }
    return state.tabs.map((t) => {
      const parts = t.path.split("/");
      const b = parts.pop();
      const parent = parts.pop();
      let text = b;
      if (base.get(b) > 1) text = parent ? `${parent}/${b}` : b;
      // 升级后仍可能重复(不同目录下同名子目录),再冲突就上完整路径
      if (state.tabs.some((o) => o.id !== t.id && o.path.endsWith(`/${text}`))) text = t.path;
      return { id: t.id, text };
    });
  }

  function setPreviewOn(v) {
    state.previewOn = !!v;
    emit("preview", null);
  }

  function setSplitPct(n) {
    state.splitPct = Math.min(80, Math.max(20, Number(n) || 50));
    emit("split", null);
  }

  /** 标记文件已不存在。app.js 在 tree 加载后核对,缺失的置 true。 */
  function markMissing(goneSet) {
    for (const t of state.tabs) t.missing = goneSet.has(t.id);
    emit("missing", null);
  }

  function toJSON() {
    return {
      activeId: state.activeId,
      previewOn: state.previewOn,
      splitPct: state.splitPct,
      tabs: state.tabs.map(({ id, path, content, mtime, cursor, scrollTop, dirty }) => ({
        id, path, content, mtime, cursor, scrollTop, dirty,
      })),
    };
  }

  /**
   * 写入 storage。返回 ok | degraded | failed。
   * degraded = 剥掉了未保存内容(标签还在,但刷新后未保存修改会丢),
   * 调用方需据此在标签栏给用户提示。
   */
  function persist() {
    const snap = toJSON();
    const full = JSON.stringify(snap);
    if (full.length > PERSIST_LIMIT) {
      const stripped = { ...snap, tabs: snap.tabs.map((t) => ({ ...t, content: "" })) };
      try {
        storage.setItem(KEY, JSON.stringify(stripped));
        return { status: "degraded" };
      } catch {
        /* 落到下面的兜底 */
      }
    } else {
      try {
        storage.setItem(KEY, full);
        return { status: "ok" };
      } catch {
        /* 落到下面的兜底 */
      }
    }
    try {
      storage.setItem(KEY, JSON.stringify({ activeId: state.activeId, previewOn: state.previewOn, splitPct: state.splitPct, tabs: [] }));
      return { status: "degraded" };
    } catch {
      return { status: "failed" };
    }
  }

  /** 从 storage 恢复。结构非法则丢弃并按空状态,不抛错阻断启动。 */
  function restore() {
    let raw = null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      return { ok: false, reason: "invalid" };
    }
    if (!raw) return { ok: true, reason: "empty" };
    let snap;
    try {
      snap = JSON.parse(raw);
    } catch {
      storage.removeItem(KEY);
      return { ok: false, reason: "invalid" };
    }
    if (!snap || !Array.isArray(snap.tabs)) {
      storage.removeItem(KEY);
      return { ok: false, reason: "invalid" };
    }
    state.tabs = snap.tabs
      .filter((t) => t && typeof t.path === "string")
      .map((t) => ({
        id: t.id || t.path,
        path: t.path,
        content: typeof t.content === "string" ? t.content : "",
        mtime: t.mtime ?? null,
        parseError: "",
        cursor: Number(t.cursor) || 0,
        scrollTop: Number(t.scrollTop) || 0,
        dirty: !!t.dirty,
        missing: false,
      }));
    state.activeId = snap.tabs.some((t) => t && t.path === snap.activeId) ? snap.activeId : state.tabs[0]?.id ?? null;
    state.previewOn = !!snap.previewOn;
    state.splitPct = Math.min(80, Math.max(20, Number(snap.splitPct) || 50));
    emit("restore", state.activeId);
    return { ok: true, reason: "empty-tabs" };
  }

  return {
    getState, get, active, open, setActive, close, remove, updateContent, setView, markSaved, rename,
    titles, setPreviewOn, setSplitPct, markMissing, toJSON, persist, restore,
    closeOthers,
  };
}