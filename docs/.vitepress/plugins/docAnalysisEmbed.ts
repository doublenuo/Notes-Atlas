/**
 * 文档分析(字数/阅读时长)感知嵌入的补丁层。
 *
 * 背景:vitepress-plugin-doc-analysis 在 config() 钩子里按原始 .md 源码统计,
 * 组会页源码几乎只有 ![[论文]] 壳行,嵌入未展开 → 全部兜底成 1m/个位数字数。
 * 本插件在其后用同一公式(字数口径、时长格式逐字一致)重算:统计前把
 * 独立成行的 ![[目标]] 按渲染语义(围栏/缩进感知、循环与 3 层深度守卫、
 * readNote 去 frontmatter 与标题降级)展开后再计数。
 * 规格:docs/superpowers/specs/2026-09-23-obsidian-embed-design.md(嵌入语义)
 */
import { readFileSync } from "node:fs";
import matter from "gray-matter";
import { createResolver, readNote } from '../../../admin/server/shared/obsidianEmbed.js';
// 带 .ts 扩展名：node --test 直接加载本插件时不做扩展名补全
import { collectPages } from "../permalinks.ts";

/** 字数口径:与 vitepress-plugin-doc-analysis getCounter 逐字一致([中文字数, 英文词数]) */
export function countWords(content) {
  const cn = (content.match(/[\u4E00-\u9FA5]/g) || []).length;
  const en = (
    content.replace(/[\u4E00-\u9FA5]/g, "").match(
      /[a-zA-Z0-9_\u0392-\u03c9\u0400-\u04FF]+|[\u4E00-\u9FFF\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\uac00-\ud7af\u0400-\u04FF]+|[\u00E4\u00C4\u00E5\u00C5\u00F6\u00D6]+|\w+/g
    ) || []
  ).length;
  return [cn, en];
}

/** 时长格式:与 getReadTime 分支逐字一致(formatReadingTime(cn, en),cn=300/分、en=160/词,不足 1 分钟兜底 1m) */
export function formatReadingTime(cn, en) {
  const readingTime = cn / 300 + en / 160;
  if (readingTime > 60 && readingTime < 60 * 24) {
    const hour = Math.trunc(readingTime / 60);
    const minute = Math.trunc(readingTime - hour * 60);
    if (minute === 0) return hour + "h";
    return hour + "h" + minute + "m";
  } else if (readingTime > 60 * 24) {
    const day = Math.trunc(readingTime / (60 * 24));
    const hour = Math.trunc((readingTime - day * 24 * 60) / 60);
    if (hour === 0) return day + "d";
    return day + "d" + hour + "h";
  }
  return (readingTime < 1 ? "1" : Math.trunc(readingTime * 10) / 10) + "m";
}

const MAX_EMBED_DEPTH = 3; // 与渲染管线一致:第 4 层不展开

/**
 * 字符串级展开独立成行的 ![[目标]](仅用于计数,不产 HTML):
 * 围栏/≥4 缩进/非独立成行保持原样;未命中、循环、超深层保持原样(渲染处为告警块,字数近似)。
 */
export function expandEmbeds(src, resolveNote) {
  return expandCore(src, [], resolveNote);
}

function expandCore(src, stack, resolveNote) {
  const lines = src.split("\n");
  let fence = null;
  const out = [];
  for (const line of lines) {
    const fm = line.match(/^ {0,3}(`{3,}|~{3})(.*)$/);
    if (fm) {
      const char = fm[1][0];
      const len = fm[1].length;
      if (!fence) {
        if (char === "~" || !fm[2].includes("`")) fence = { char, len };
        out.push(line);
        continue;
      }
      if (char === fence.char && len >= fence.len && fm[2].trim() === "") fence = null;
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    const m = line.match(/^([ \t]*)!\[\[([^\]\n]+)\]\][ \t]*$/);
    if (!m || m[1].replace(/\t/g, "    ").length >= 4) {
      out.push(line);
      continue;
    }
    const found = resolveNote(m[2].trim());
    if (!found || stack.includes(found.absPath) || stack.length >= MAX_EMBED_DEPTH) {
      out.push(line);
      continue;
    }
    const note = readNote(found.absPath, "docAnalysis");
    out.push(expandCore(note.content, [...stack, found.absPath], resolveNote));
  }
  return out.join("\n");
}

/**
 * permalink 转主题查找用的相对路径:主题按 "/" + relativePath 去匹配文章 url,
 * 而本站文章 url 由 permalinks.ts 的 rewrites 落地(有 frontmatter.permalink 用它,
 * 否则用 分区前缀 + 标题 slug,撞车还会退回磁盘路径),两者对不上 → 字数显示为 "-"。
 * 这里把真实 URL 反推成 relativePath,供下方生成镜像条目使用。
 */
function urlToRelativePath(url) {
  const raw = String(url).split("#")[0].split("?")[0].trim();
  const rel = raw.replace(/^\/+/, "").replace(/\/+$/, "");
  return rel ? rel + ".md" : null;
}

/**
 * 用嵌入展开后的口径覆盖 doc-analysis 注入的 eachFileWords 与 totalFileWords,
 * 再按站点真实 URL 追加镜像条目,修掉文章清单页的字数/阅读时长恒为 "-"。
 * info 或 eachFileWords 缺失时安全返回;单文件读失败保持该条原值不炸 build。
 */
export function patchDocAnalysisInfo(info, docsRoot) {
  if (!info || !Array.isArray(info.eachFileWords)) return;
  const resolveNote = createResolver(docsRoot);
  let total = 0;
  for (const entry of info.eachFileWords) {
    try {
      const raw = readFileSync(entry.fileInfo?.filePath ?? "", "utf-8").replace(/\r\n?/g, "\n");
      const body = matter(raw).content;
      const len = countWords(expandCore(body, [], resolveNote));
      entry.wordCount = len[0] + len[1];
      entry.readingTime = formatReadingTime(len[0], len[1]);
    } catch {
      // 读失败:保留 doc-analysis 的原始统计值
    }
    total += entry.wordCount || 0;
  }
  info.totalFileWords = total;

  // 镜像条目:主题 v1.5.6 / v1.6.2 的文章清单页都用 "/"+relativePath 匹配文章 url,
  // 对走 rewrites 的永久链接站点必然失配(主题自身缺陷,升级无法修复)。
  // 用 permalinks 的真实 URL 反推 relativePath 生成副本即可命中;原条目保留,
  // ArticleAnalyze 按 filePath 匹配用的是原条目,不受影响。
  let urlByRel;
  try {
    urlByRel = new Map(collectPages(docsRoot).map((page) => [page.rel, page.url]));
  } catch (e) {
    console.warn(`[doc-analysis] 读取 permalinks 失败,文章清单页字数可能显示为 "-":${e?.message ?? e}`);
    return;
  }
  const taken = new Set(info.eachFileWords.map((entry) => entry.fileInfo?.relativePath));
  const mirrors = [];
  for (const entry of info.eachFileWords) {
    const rel = entry.fileInfo?.relativePath;
    const url = rel ? urlByRel.get(rel) : undefined;
    const mirrorRel = url ? urlToRelativePath(url) : null;
    // URL 与磁盘路径同源时原条目本就能命中,无需镜像
    if (!mirrorRel || mirrorRel === rel || taken.has(mirrorRel)) continue;
    taken.add(mirrorRel);
    mirrors.push({ ...entry, fileInfo: { ...entry.fileInfo, relativePath: mirrorRel } });
  }
  info.eachFileWords = [...info.eachFileWords, ...mirrors];
  if (mirrors.length) {
    console.log(`[doc-analysis] 为 ${mirrors.length} 篇文章追加了 URL 镜像条目(文章清单页字数显示)`);
  }
}

/**
 * Vite 插件:config() 捕获 themeConfig 引用,configResolved()(所有 config 钩子
 * 之后,doc-analysis 已注入完成)执行覆盖。dev 与 build 同路径。
 */
export function docAnalysisEmbed() {
  let themeConfig = null;
  let srcDir = "";
  return {
    name: "na-doc-analysis-embed",
    config(config) {
      const vp = config?.vitepress;
      if (vp?.site?.themeConfig) {
        themeConfig = vp.site.themeConfig;
        srcDir = vp.srcDir ?? process.cwd();
      }
    },
    configResolved() {
      if (themeConfig?.docAnalysisInfo) patchDocAnalysisInfo(themeConfig.docAnalysisInfo, srcDir);
    },
  };
}
