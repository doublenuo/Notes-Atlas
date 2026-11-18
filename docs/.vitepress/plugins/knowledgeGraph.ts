/**
 * 构建期知识网络索引：反向链接与相关笔记。
 * 规格：docs/superpowers/specs/2026-11-18-knowledge-graph-design.md
 */

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * 行内代码：开闭反引号 run 必须等长，且 run 两侧都不能紧邻反引号。
 * 只按最大 run 配对，避免单反引号去匹配 `` 开栏的前缀，
 * 把“未配对反引号 + 真实 [[链接]]”误当代码吞掉。
 * 该 g 正则只用于 String.replace：replace 会重置 lastIndex，跨行调用无状态。
 */
const CODE_SPAN_RE = /(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g;

/** 剔除行内代码（含多反引号），用等长空格占位，避免后续误判为链接 */
function stripInlineCode(line: string): string {
  return line.replace(CODE_SPAN_RE, (match) => " ".repeat(match.length));
}

/** 提取正文中的 wiki 目标（与 obsidianEmbed 渲染规则对齐；去重与自引用由调用方处理） */
export function extractWikiLinks(src: string): string[] {
  const targets: string[] = [];
  let fence: { char: string; len: number } | null = null;

  // CRLF 会让围栏正则的 `$` 锚点失配（`\r` 留在行尾），统一成 LF 再逐行扫描
  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const fenceMatch = raw.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (fence) {
        // 闭栏：同字符、长度 ≥ 开栏、行尾无 info string
        if (char === fence.char && len >= fence.len && fenceMatch[2].trim() === "") {
          fence = null;
        }
        continue; // 围栏内（含长度不足的伪闭栏）整行跳过
      }
      // 开栏：``` 的 info string 不得含反引号（CommonMark）；不算开栏时按普通正文继续扫描
      if (char === "~" || !fenceMatch[2].includes("`")) {
        fence = { char, len };
        continue;
      }
    }
    if (fence) continue;

    const line = stripInlineCode(raw);
    const re = /(!?)\[\[([^\[\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const target = match[2].trim();
      // 别名/锚点不是渲染器可解析目标，一律不计；ownProseLength 按行剥离的口径
      // 更宽（含别名/锚点的独立嵌入也会被剔除），这一差异是刻意的。
      if (!target || target.includes("|") || target.includes("#")) continue;
      const indent = raw.match(/^ */)?.[0].length ?? 0;
      const standalone = indent < 4 && raw.trim() === match[0];
      if (match[1] === "!" && !standalone) continue;
      targets.push(target);
    }
  }
  return targets;
}

/**
 * 自有正文长度：剔除独立行 ![[...]] 后 trim 的 UTF-16 码元数。
 * 这里按行剥离、不校验目标内容，因此 `![[A|别名]]` / `![[A#锚点]]`
 * 也会被剔除；extractWikiLinks 会跳过这类目标，两者口径不同是刻意的。
 */
export function ownProseLength(src: string): number {
  return src
    .split("\n")
    .filter((line) => !/^ {0,3}!\[\[[^\]\n]+\]\]\s*$/.test(line))
    .join("\n")
    .trim().length;
}
