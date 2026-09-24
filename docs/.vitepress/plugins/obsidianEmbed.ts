/**
 * Obsidian 风格 wiki 语法插件：
 * - `![[目标]]`（独立成行）→ 全文嵌入为卡片
 * - `[[目标]]`（行内）→ 站内链接
 * 规格：docs/superpowers/specs/2026-09-23-obsidian-embed-design.md
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve as pathResolve, relative, basename, sep } from "node:path";
import matter from "gray-matter";

export const PAPER_NOTES_DIR = "01.组会材料/02.论文笔记";
const EXCLUDED_DIRS = new Set([".vitepress", "node_modules", "dist", "public", "@fragment"]);

/** 创建带缓存的文件解析器：(target) => { absPath, relPath } | null */
export function createResolver(docsRoot) {
  const cache = new Map();

  function walk(dir, out = []) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (EXCLUDED_DIRS.has(e.name)) continue;
        walk(join(dir, e.name), out);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push(join(dir, e.name));
      }
    }
    return out;
  }

  return function resolveNote(target) {
    const key = target.replace(/\.md$/i, "");
    if (cache.has(key)) return cache.get(key);

    let result = null;
    const toRel = (absPath) => {
      const relPath = relative(docsRoot, absPath);
      return relPath.startsWith("..") ? null : { absPath, relPath };
    };

    if (key.includes("/")) {
      const abs = pathResolve(docsRoot, key + ".md");
      if (existsSync(abs)) result = toRel(abs);
    } else {
      const inPapers = pathResolve(docsRoot, PAPER_NOTES_DIR, key + ".md");
      if (existsSync(inPapers)) {
        result = toRel(inPapers);
      } else {
        const matches = walk(docsRoot)
          .filter((f) => basename(f) === key + ".md")
          .sort();
        if (matches.length > 1) {
          console.warn(`[obsidianEmbed] "${target}" 有 ${matches.length} 个同名文件，取第一个：${matches[0]}`);
        }
        if (matches.length) result = toRel(matches[0]);
      }
    }
    cache.set(key, result);
    return result;
  };
}
