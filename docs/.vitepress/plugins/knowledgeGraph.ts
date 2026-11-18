/**
 * 构建期知识网络索引：反向链接与相关笔记。
 * 规格：docs/superpowers/specs/2026-11-18-knowledge-graph-design.md
 */

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** 剔除行内代码（含多反引号），用等长空格占位，避免后续误判为链接 */
function stripInlineCode(line: string): string {
  return line.replace(/(`+)([\s\S]*?)\1/g, (match) => " ".repeat(match.length));
}

/** 提取正文中的 wiki 目标（与 obsidianEmbed 渲染规则对齐；去重与自引用由调用方处理） */
export function extractWikiLinks(src: string): string[] {
  const targets: string[] = [];
  let fence: { char: string; len: number } | null = null;

  for (const raw of src.split("\n")) {
    const fenceMatch = raw.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!fence) {
        // ``` 的 info string 含反引号时按 CommonMark 不算开栏
        if (char === "~" || !fenceMatch[2].includes("`")) {
          fence = { char, len };
          continue;
        }
      } else if (char === fence.char && len >= fence.len && fenceMatch[2].trim() === "") {
        fence = null;
        continue;
      }
      if (fence) continue;
    }
    if (fence) continue;

    const line = stripInlineCode(raw);
    const re = /(!?)\[\[([^\[\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const target = match[2].trim();
      if (!target || target.includes("|") || target.includes("#")) continue;
      const indent = raw.match(/^ */)?.[0].length ?? 0;
      const standalone = indent < 4 && raw.trim() === match[0];
      if (match[1] === "!" && !standalone) continue;
      targets.push(target);
    }
  }
  return targets;
}

/** 自有正文长度：剔除独立行 ![[...]] 后 trim 的字符数 */
export function ownProseLength(src: string): number {
  return src
    .split("\n")
    .filter((line) => !/^ {0,3}!\[\[[^\]\n]+\]\]\s*$/.test(line))
    .join("\n")
    .trim().length;
}
