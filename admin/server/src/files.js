import fs from "node:fs/promises";
import path from "node:path";
import { EXCLUDE_DIRS, httpError, safeResolve } from "./paths.js";
import { buildTemplate } from "./frontmatter.js";

const nowStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const isDir = async (p) => {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
};
const exists = async (p) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

/**
 * docsDir 内一切文件操作的唯一入口。
 * execGit(args) → Promise<string>,由装配层绑定 cwd=siteDir 的 git。
 * 每次落盘类改动:git add -A docs && git commit -m "admin(<op>): <path>"。
 */
export function createFiles({ docsDir, siteDir, execGit }) {
  // 最近一次 push 的结果,供 /build/status 一并返回给 UI。
  // null = 尚未推送过(进程刚起)
  let pushState = null;

  async function commit(op, rel) {
    let didCommit = false;
    try {
      await execGit(["add", "-A", "docs"]);
      await execGit(["commit", "-m", `admin(${op}): ${rel}`]);
      didCommit = true;
    } catch (e) {
      // 重复保存同一内容:git 把 "nothing to commit" 打在 stdout(promisify(execFile) 的 message 不含 stdout),三处合判视为成功
      const out = [e.stdout, e.stderr, e.message].map(String).join("\n");
      if (!/nothing to commit/i.test(out)) throw e;
    }
    if (!didCommit) return; // 无新提交,不推送
    // 推送 GitHub → 触发站点 CI 重建(保存即上线)。非致命:失败不阻断文件操作,内容已本地提交。
    // 但必须把失败暴露给 UI —— 否则保存按钮"看起来成功了",用户却发现改动根本没上线,
    // 只能去翻服务端日志(这是「点击没反应」的根因之一)。
    try {
      // 先 fetch:本地长期运行,远端常有其它来源的提交(你在本机改代码、或 GitHub
      // 上直接编辑)。不先同步就 push,必然被拒(non-fast-forward)并静默失败。
      await execGit(["fetch", "origin"]);
      const behind = Number((await execGit(["rev-list", "--count", "HEAD..origin/main"])).trim()) || 0;
      if (behind > 0) {
        // 远端有新提交:先 rebase 到最新,再推。冲突时 rebase 会非零退出,
        // 由下面的 catch 捕获并如实上报,不做危险的强推。
        await execGit(["rebase", "origin/main"]);
      }
      await execGit(["push", "origin", "main"]);
      pushState = { ok: true, at: Date.now(), message: "" };
    } catch (e) {
      const out = [e.stdout, e.stderr, e.message].map(String).join("\n");
      // 只留尾部,git 的 hint 可能有几十行
      pushState = { ok: false, at: Date.now(), message: out.trim().split("\n").slice(-3).join(" ") };
      console.error(`[admin] git push 失败(内容已本地提交,可在宿主机手动同步): ${out}`);
    }
  }

  async function walk(dir, relBase) {
    const out = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".") || EXCLUDE_DIRS.has(e.name)) continue;
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        out.push({ type: "dir", name: e.name, path: rel, children: await walk(path.join(dir, e.name), rel) });
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push({ type: "file", name: e.name, path: rel });
      }
    }
    return out;
  }

  return {
    tree: () => walk(docsDir, ""),

    async read(rel) {
      const abs = safeResolve(docsDir, rel);
      try {
        const st = await fs.stat(abs);
        if (!st.isFile()) throw httpError(400, "NOT_A_FILE", "不是文件");
        return { content: await fs.readFile(abs, "utf8"), mtime: st.mtimeMs };
      } catch (e) {
        if (e.status) throw e;
        if (e.code === "ENOENT" || e.code === "ENOTDIR") throw httpError(404, "NOT_FOUND", "文件不存在");
        throw e;
      }
    },

    async create(rel) {
      const abs = safeResolve(docsDir, rel); // 单点校验前置:rel 非法/undefined 一律 400 INVALID_PATH(而非 TypeError 500)
      if (!rel.endsWith(".md")) throw httpError(400, "BAD_EXT", "仅支持 .md 文件");
      if (await exists(abs)) throw httpError(409, "EXISTS", "已存在");
      if (!(await isDir(path.dirname(abs)))) throw httpError(404, "PARENT_MISSING", "父目录不存在");
      await fs.writeFile(abs, buildTemplate(path.basename(rel), nowStr()), "utf8");
      await commit("create", rel);
    },

    async write(rel, content) {
      const abs = safeResolve(docsDir, rel); // 单点校验前置,同 create:先判路径合法再判 content/扩展
      if (typeof content !== "string") throw httpError(400, "BAD_BODY", "content 必须是字符串");
      if (!rel.endsWith(".md")) throw httpError(400, "BAD_EXT", "仅支持 .md 文件");
      if (!(await isDir(path.dirname(abs)))) throw httpError(404, "PARENT_MISSING", "父目录不存在");
      await fs.writeFile(abs, content, "utf8");
      await commit("write", rel);
    },

    async removeFile(rel) {
      const abs = safeResolve(docsDir, rel);
      if (!(await exists(abs))) throw httpError(404, "NOT_FOUND", "文件不存在");
      const st = await fs.stat(abs);
      if (!st.isFile()) throw httpError(400, "NOT_A_FILE", "是目录,请用目录删除");
      await fs.unlink(abs);
      await commit("delete", rel);
    },

    async createDir(rel) {
      const abs = safeResolve(docsDir, rel);
      if (await exists(abs)) throw httpError(409, "EXISTS", "已存在");
      if (!(await isDir(path.dirname(abs)))) throw httpError(404, "PARENT_MISSING", "父目录不存在");
      await fs.mkdir(abs);
      // 空目录 git 不追踪:不提交(文件落入后由 create/write 提交)
    },

    async removeDir(rel, force) {
      const abs = safeResolve(docsDir, rel);
      if (path.resolve(abs) === path.resolve(docsDir)) throw httpError(400, "INVALID_PATH", "拒绝操作根目录");
      if (!(await isDir(abs))) throw httpError(404, "NOT_FOUND", "目录不存在");
      const entries = await fs.readdir(abs);
      if (entries.length && !force) throw httpError(409, "NOT_EMPTY", "目录非空,需 force=1");
      if (entries.length) {
        await fs.rm(abs, { recursive: true });
        await commit("delete", rel);
      } else {
        await fs.rmdir(abs);
      }
    },

    async rename(from, to) {
      const a = safeResolve(docsDir, from);
      const b = safeResolve(docsDir, to);
      if (!(await exists(a))) throw httpError(404, "NOT_FOUND", "源不存在");
      if (await exists(b)) throw httpError(409, "EXISTS", "目标已存在");
      if (!(await isDir(path.dirname(b)))) throw httpError(404, "PARENT_MISSING", "父目录不存在");
      await fs.rename(a, b);
      await commit("rename", `${from} -> ${to}`);
    },

    /** 最近一次 push 结果:null=未推送过,{ok,at,message}。UI 用它提示「已保存但未上线」。 */
    pushStatus() {
      return pushState;
    },

    /** 状态条展示用:最后一次 commit 摘要,无仓库/无提交返回 null。 */
    async lastCommit() {
      try {
        const out = await execGit(["log", "-1", "--format=%h %s"]);
        return String(out || "").trim() || null;
      } catch {
        return null;
      }
    },
  };
}
