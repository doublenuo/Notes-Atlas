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
  async function commit(op, rel) {
    try {
      await execGit(["add", "-A", "docs"]);
      await execGit(["commit", "-m", `admin(${op}): ${rel}`]);
    } catch (e) {
      // 重复保存同一内容:git 把 "nothing to commit" 打在 stdout(promisify(execFile) 的 message 不含 stdout),三处合判视为成功
      const out = [e.stdout, e.stderr, e.message].map(String).join("\n");
      if (!/nothing to commit/i.test(out)) throw e;
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
