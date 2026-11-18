/**
 * 构建期知识网络索引：反向链接与相关笔记。
 * 规格：docs/superpowers/specs/2026-11-18-knowledge-graph-design.md
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { createResolver } from "./obsidianEmbed.js";
// 带 .ts 扩展名：node --test 直接加载本插件时不做扩展名补全
import { stripOrdinal } from "../permalinks.ts";
import type { PageInfo } from "../permalinks.ts";

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

export interface NoteRef {
  /** 相对 docs 的 posix 路径 */
  rel: string;
  /** 站内绝对路径，以 / 开头 */
  url: string;
  title: string;
  /** 人类可读分区，如「学习笔记 · 强化学习基础」 */
  section: string;
}

export interface RelatedNote extends NoteRef {
  /** 如「共同标签：强化学习」 */
  reason: string;
}

export interface Connections {
  backlinks: NoteRef[];
  related: RelatedNote[];
}

export const EMPTY_CONNECTIONS: Connections = { backlinks: [], related: [] };

interface PageMeta {
  rel: string;
  url: string;
  title: string;
  section: string;
  dir: string;
  tags: string[];
  categories: string[];
  date: number;
  isArticle: boolean;
  body: string;
  ownProse: number;
  links: Set<string>;
}

function toStringList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function toTimestamp(value: unknown): number {
  if (value === undefined || value === null || value === "") return Number.NEGATIVE_INFINITY;
  const time = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

/** 目录 → 分区名：顶层 + 末级，去掉序号前缀；只有一级时只显示一级 */
function sectionOfDir(dir: string): string {
  if (!dir || dir === ".") return "";
  const parts = dir.split("/").filter(Boolean).map(stripOrdinal);
  if (parts.length <= 1) return parts[0] ?? "";
  return parts[0] === parts[parts.length - 1] ? parts[0] : `${parts[0]} · ${parts[parts.length - 1]}`;
}

function pageUrl(url: string): string {
  return url === "index" ? "/" : `/${url}`;
}

/** 日期倒序；缺失日期（-Infinity）排在最后 */
function compareDate(a: number, b: number): number {
  if (a === b) return 0;
  const left = Number.isFinite(a) ? a : -Infinity;
  const right = Number.isFinite(b) ? b : -Infinity;
  return right - left;
}

function toNoteRef(meta: PageMeta): NoteRef {
  return { rel: meta.rel, url: meta.url, title: meta.title, section: meta.section };
}

export function buildKnowledgeGraph(docsRoot: string, pages: PageInfo[]): Map<string, Connections> {
  try {
    return build(docsRoot, pages);
  } catch (error) {
    console.warn("[knowledgeGraph] 知识网络索引构建失败，已跳过：", error);
    return new Map();
  }
}

function build(docsRoot: string, pages: PageInfo[]): Map<string, Connections> {
  const resolver = createResolver(docsRoot);
  const metas = new Map<string, PageMeta>();

  for (const page of pages) {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(docsRoot, page.rel), "utf8").replace(/\r\n?/g, "\n");
    } catch {
      continue;
    }
    let data: Record<string, unknown> = {};
    let body = raw;
    try {
      const parsed = matter(raw);
      data = parsed.data as Record<string, unknown>;
      body = parsed.content;
    } catch {
      // 畸形 frontmatter：按无元数据正文继续，索引不阻断构建
    }
    const layout = typeof data.layout === "string" ? data.layout : "";
    metas.set(page.rel, {
      rel: page.rel,
      url: pageUrl(page.url),
      title: page.title,
      section: sectionOfDir(page.dir),
      dir: page.dir,
      tags: toStringList(data.tags),
      categories: toStringList(data.categories),
      date: toTimestamp(data.date),
      isArticle: data.article !== false && (layout === "" || layout === "doc"),
      body,
      ownProse: ownProseLength(body),
      links: new Set<string>(),
    });
  }

  // 出链：只从正文页提取，目标必须是 PAGES 中的页面
  for (const meta of metas.values()) {
    if (!meta.isArticle || !meta.body.trim()) continue;
    const host = path.join(docsRoot, meta.rel);
    for (const target of extractWikiLinks(meta.body)) {
      const found = resolver(target, host);
      if (!found) continue;
      const rel = found.relPath.split(path.sep).join("/");
      if (rel !== meta.rel && metas.has(rel)) meta.links.add(rel);
    }
  }

  // 反链：来源门槛 = 正文非空 + 正文页（组会页符合）
  const backlinkSources = new Map<string, PageMeta[]>();
  for (const meta of metas.values()) {
    if (!meta.isArticle || !meta.body.trim()) continue;
    for (const rel of meta.links) {
      const sources = backlinkSources.get(rel) ?? [];
      if (!sources.includes(meta)) sources.push(meta);
      backlinkSources.set(rel, sources);
    }
  }

  const graph = new Map<string, Connections>();
  for (const meta of metas.values()) {
    const sources = (backlinkSources.get(meta.rel) ?? [])
      .slice()
      .sort((a, b) => compareDate(a.date, b.date) || a.rel.localeCompare(b.rel));
    graph.set(meta.rel, { backlinks: sources.map(toNoteRef), related: [] });
  }
  return graph;
}
