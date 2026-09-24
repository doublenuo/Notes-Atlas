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

  // 文件清单索引：进程内建一次，与正结果缓存同生命周期（任务3质量结转#5，裁决接受语义代价）——
  // 索引建立后 dev 新建的非论文目录笔记需重启才可被裸目标命中；
  // 论文目录（level-2 existsSync）与带 / 的路径目标始终实时，不受索引影响
  let fileIndex = null;
  const getIndex = () => (fileIndex ??= walk(docsRoot));

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
        const matches = getIndex()
          .filter((f) => basename(f) === key + ".md")
          .sort();
        if (matches.length > 1) {
          console.warn(`[obsidianEmbed] "${target}" 有 ${matches.length} 个同名文件，取第一个：${matches[0]}`);
        }
        if (matches.length) result = toRel(matches[0]);
      }
    }
    if (result) cache.set(key, result); // 正结果缓存；负结果不逐键缓存（论文目录/带路径目标实时；全库裸目标经文件清单索引，语义代价见上）
    return result;
  };
}

/** 读笔记：CRLF 归一、剥 frontmatter（畸形不炸）、围栏感知标题降级（行首 ATX +1 级，H6 不变）、取 title/permalink；context 为宿主页 relativePath，仅用于读失败告警归因 */
export function readNote(absPath, context) {
  let raw;
  try {
    raw = readFileSync(absPath, "utf-8").replace(/\r\n?/g, "\n");
  } catch {
    // 读失败（TOCTOU 删除/权限）：空笔记降级，不炸 build
    console.warn(`[obsidianEmbed] 读取嵌入笔记失败，已降级为空笔记：${absPath}（页面：${context ?? "unknown"}）`);
    return { title: basename(absPath, ".md"), permalink: "", content: "" };
  }
  let data = {};
  let content = raw;
  try {
    ({ data, content } = matter(raw));
  } catch {
    // 畸形 frontmatter：保留原文渲染，可见降级优于 build 崩溃
    content = raw;
  }
  return {
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : basename(absPath, ".md"),
    permalink: typeof data.permalink === "string" ? data.permalink.trim() : "",
    content: demoteHeadings(content),
  };
}

/** ATX 标题降级：仅代码围栏（``` / ~~~，行首 0-3 空格）之外的行首 #；围栏按同字符、长度 ≥ 开栏、行尾无 info string 配对闭合 */
function demoteHeadings(src) {
  let fence = null; // { char, len } | null
  return src
    .split("\n")
    .map((line) => {
      const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (m) {
        const char = m[1][0];
        const len = m[1].length;
        if (!fence) {
          // 开栏：``` 的 info string 不得含反引号（CommonMark）
          if (char === "~" || !m[2].includes("`")) fence = { char, len };
          return line;
        }
        // 闭栏：同字符、长度 ≥ 开栏、行尾无 info string
        if (char === fence.char && len >= fence.len && m[2].trim() === "") {
          fence = null;
          return line;
        }
        return line; // 栏内内容（含混标记行）原样
      }
      return fence ? line : line.replace(/^(#{1,5})([ \t]+)/, "#$1$2");
    })
    .join("\n");
}

/** 回链地址：permalink 优先（仅接受 / 开头的站内绝对路径），否则源路径（cleanUrls，无 .html） */
export function noteHref(relPath, permalink) {
  if (permalink && permalink.startsWith("/")) return encodeURI(permalink);
  return encodeURI("/" + relPath.replace(/\.md$/i, "").split(sep).join("/"));
}

const MAX_EMBED_DEPTH = 3;

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

    const target = m[1].trim();
    const esc = md.utils.escapeHtml;
    const warn = (text) => {
      const token = state.push("html_block", "", 0);
      token.content = `<div class="na-embed na-embed-warning">${esc(text)}</div>`;
      console.warn(`[obsidianEmbed] ${text}（页面：${state.env.relativePath ?? "unknown"}）`);
      state.line = startLine + 1;
      return true;
    };

    const found = resolveNote(target);
    if (!found) return warn(`⚠️ 未找到嵌入笔记：${target}`);

    const stack = state.env.naEmbedStack || [];
    if (stack.includes(found.absPath)) return warn(`⚠️ 嵌入循环：${target}`);
    if (stack.length >= MAX_EMBED_DEPTH) return warn(`⚠️ 嵌入层级超过 ${MAX_EMBED_DEPTH} 层：${target}`);

    const note = readNote(found.absPath, state.env.relativePath);
    const open = state.push("na_embed_open", "", 0);
    open.meta = {
      href: noteHref(found.relPath, note.permalink),
      label: `📎 论文笔记 · ${note.title}`,
    };
    const embedded = [];
    md.block.parse(
      note.content,
      md,
      { ...state.env, naEmbedStack: [...stack, found.absPath] },
      embedded
    );
    for (const t of embedded) state.tokens.push(t);
    state.push("na_embed_close", "", 0);
    state.line = startLine + 1;
    return true;
  };
}

/** 注册插件到 md 实例 */
export function obsidianEmbed(md, docsRoot) {
  const resolveNote = createResolver(docsRoot);

  md.block.ruler.before("paragraph", "na_embed", createEmbedRule(md, resolveNote), {
    alt: ["paragraph"],
  });

  md.inline.ruler.before("link", "na_wikilink", createWikilinkRule(resolveNote));

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

/** 行内 [[目标]] → 站内链接：命中 → link_open（noteHref 回链，文本取 target）；未命中/|别名/#标题/跨行/前导 ! → 保持原文（回退文本取原始切片，保留空格） */
function createWikilinkRule(resolveNote) {
  return function naWikilink(state, silent) {
    const { src, pos } = state;
    if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false; // 需要 `[[`
    if (pos > 0 && src.charCodeAt(pos - 1) === 0x21) return false; // `![[`：行中嵌入保持原文
    const end = src.indexOf("]]", pos + 2);
    if (end < 0) return false;
    const target = src.slice(pos + 2, end).trim();
    if (!target || target.includes("\n")) return false;
    if (silent) return true;

    const found = resolveNote(target);
    if (found) {
      const note = readNote(found.absPath, state.env.relativePath);
      const linkOpen = state.push("link_open", "a", 1);
      linkOpen.attrs = [["href", noteHref(found.relPath, note.permalink)]];
      const text = state.push("text", "", 0);
      text.content = target;
      state.push("link_close", "a", -1);
    } else {
      const text = state.push("text", "", 0);
      text.content = src.slice(pos, end + 2);
    }
    state.pos = end + 2;
    return true;
  };
}
