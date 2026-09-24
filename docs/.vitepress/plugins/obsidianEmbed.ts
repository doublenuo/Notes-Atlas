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

/** 创建带缓存的文件解析器：(target) => { absPath, relPath } | null。target 为纯路径——`#标题`/`|别名` 写法属规格非目标，按字面目标解析、未命中回退原文渲染 */
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
    if (result) cache.set(key, result); // 负结果不缓存：dev 下新建笔记可被即时解析
    return result;
  };
}

/** 读笔记：剥 frontmatter、标题降级（行首 ATX +1 级，H6 不变）、取 title/permalink */
export function readNote(absPath) {
  const { data, content } = matter(readFileSync(absPath, "utf-8"));
  return {
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : basename(absPath, ".md"),
    permalink: typeof data.permalink === "string" ? data.permalink.trim() : "",
    content: content.replace(/^(#{1,5})([ \t]+)/gm, "#$1$2"),
  };
}

/** 回链地址：permalink 优先，否则源路径（cleanUrls，无 .html） */
export function noteHref(relPath, permalink) {
  if (permalink) return encodeURI(permalink);
  return encodeURI("/" + relPath.replace(/\.md$/i, "").split(sep).join("/"));
}

function createEmbedRule(md, resolveNote) {
  return function naEmbed(state, startLine, endLine, silent) {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false; // 代码块内不处理
    if (state.sCount[startLine] - state.blkIndent > 3) return false; // >3 空格缩进不处理
    const line = state.src
      .slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
      .trim();
    const m = line.match(/^!\[\[([^\]\n]+)\]\]$/);
    if (!m) return false;
    if (silent) return true;

    const found = resolveNote(m[1].trim());
    if (!found) return false; // 任务 3 替换为告警块

    const note = readNote(found.absPath);
    const open = state.push("na_embed_open", "", 0);
    open.meta = {
      href: noteHref(found.relPath, note.permalink),
      label: `📎 论文笔记 · ${note.title}`,
    };
    const embedded = [];
    md.block.parse(note.content, md, { ...state.env, naEmbedStack: [found.absPath] }, embedded);
    for (const t of embedded) state.tokens.push(t);
    state.push("na_embed_close", "", 0);
    state.line = startLine + 1;
    return true;
  };
}

/** 注册插件到 md 实例 */
export function obsidianEmbed(md, docsRoot) {
  const resolveNote = createResolver(docsRoot);

  md.block.ruler.before("paragraph", "na_embed", createEmbedRule(md, resolveNote));

  md.renderer.rules.na_embed_open = (tokens, idx) => {
    const { href, label } = tokens[idx].meta;
    return (
      `<div class="na-embed">\n` +
      `<a class="na-embed-source" href="${md.utils.escapeHtml(href)}">${md.utils.escapeHtml(label)}</a>\n` +
      `<div class="na-embed-body">\n`
    );
  };
  md.renderer.rules.na_embed_close = () => `</div>\n</div>\n`;
}
