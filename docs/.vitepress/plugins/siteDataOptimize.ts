import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import matter from "gray-matter";
import { createResolver } from "./obsidianEmbed.js";
import { expandEmbeds } from "./docAnalysisEmbed.ts";

const EMBED_PATTERN = /(^|\n)\s*!\[\[[^\]\n]+\]\]\s*(?=\n|$)/;

function getCaptureText(source: string, count = 120) {
  const content = matter(source).content;
  return content
    .replace(/^#+\s+.*/gm, "")
    .replace(/#/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[\[TOC\]\]/g, "")
    .replace(/:::.*?(\n|$)/g, "")
    .replace(/<!-- more -->/g, "")
    .split("\n")
    .filter((v) => !!v)
    .join("\n")
    .replace(/>(.*)/, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
    .slice(0, count);
}

/**
 * 首页卡片的 capture 由 FileContentLoader 从原始 Markdown 生成，
 * 不会经过 obsidianEmbed 的 Markdown 渲染规则。展开嵌入后再生成摘要，
 * 避免组会文章首页只显示 `![[论文名]]`。
 */
export function patchPostCaptures(posts, docsRoot) {
  if (!Array.isArray(posts)) return;
  const resolveNote = createResolver(docsRoot);
  for (const post of posts) {
    try {
      const sourcePath = resolvePath(
        docsRoot,
        String(post.relativePath ?? "").replace(/^\/+/, "").replace(/\/$/, "") + ".md",
      );
      const source = typeof post.src === "string" ? post.src : readFileSync(sourcePath, "utf8");
      if (!EMBED_PATTERN.test(source)) continue;
      const expanded = expandEmbeds(source, resolveNote, sourcePath);
      post.capture = getCaptureText(expanded);
    } catch {
      // 保留 FileContentLoader 已生成的摘要，不能因单篇嵌入异常阻断构建。
    }
  }
}

/**
 * 站点数据瘦身（configResolved 时 teek/doc-analysis 均已注入完成）。
 *
 * metadata chunk（__VP_SITE_DATA__）每页急切加载，teek 把 342 篇文章的 posts 数据
 * 复制了 8 份变体（allPosts/originPosts/sortPostsByDate 系/groupPosts 系），本文只做
 * 无损或视觉无损的裁剪：
 *  1. posts.capture 截断到 150 字符 —— 仅首页卡片摘要用，CSS line-clamp 下视觉无差；
 *     注意 ConfigProvider:96 运行时会遍历 allPosts（layout 页定位），allPosts 必须保留
 *  2. docAnalysisInfo.eachFileWords 删 fileInfo.filePath —— 绝对服务器路径，
 *     三个消费方（ArticleAnalyze/ArticleOverviewPage/HomeDocAnalysisCard）全部按
 *     relativePath 匹配，且泄漏服务器目录结构给访客
 */
export function siteDataOptimize() {
  let themeConfig = null;
  let srcDir = "";
  return {
    name: "na-site-data-optimize",
    config(config) {
      const vp = config?.vitepress;
      if (vp?.site?.themeConfig) {
        themeConfig = vp.site.themeConfig;
        srcDir = vp.srcDir ?? process.cwd();
      }
    },
    configResolved() {
      if (!themeConfig) return;

      const CAPTURE_MAX = 150;
      const posts = themeConfig.posts;
      if (posts) {
        patchPostCaptures(posts.allPosts, srcDir);
        const trim = (arr) =>
          Array.isArray(arr) &&
          arr.forEach((p) => {
            if (typeof p.capture === "string" && p.capture.length > CAPTURE_MAX) {
              p.capture = p.capture.slice(0, CAPTURE_MAX).trimEnd() + "…";
            }
          });
        [
          posts.allPosts,
          posts.originPosts,
          posts.sortPostsByDateAndSticky,
          posts.sortPostsByDate,
          posts.groupPostsByYear,
          posts.groupPostsByYearMonth,
          posts.groupPosts,
          posts.groupCards,
        ].forEach(arr => Array.isArray(arr) && trim(arr));
      }

      const info = themeConfig.docAnalysisInfo;
      if (Array.isArray(info?.eachFileWords)) {
        for (const entry of info.eachFileWords) {
          if (entry.fileInfo) delete entry.fileInfo.filePath;
        }
      }
    },
  };
}
