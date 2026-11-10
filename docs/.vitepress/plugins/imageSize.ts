/**
 * markdown 图片尺寸注入插件：为图片 <img> 注入 width/height 属性，消除图片加载时的
 * 布局偏移（CLS）。
 *
 * 两类图片：
 *  1. 本地 public 图片（/images/...）：构建期从文件头解析（PNG/JPEG/GIF/WebP）。
 *  2. 远程图片（阿里云 OSS/CDN、腾讯 COS 等）：从 image-dimensions.json 查表。
 *     该 JSON 由 scripts/cache-image-sizes.mjs 用 HTTP Range 只读文件头生成，
 *     构建本身不访问网络；新增图片后运行 `pnpm images:sizes` 更新即可。
 *
 * 已有显式 width/height 的图片不覆盖；查不到尺寸时静默跳过，保持原渲染。
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { MarkdownRenderer } from "vitepress";
import { imageUrl } from "./imageSource.js";
import { decodeImageSize } from "./imageDimensions.js";

type Dim = { width: number; height: number };

const DIMENSIONS_FILE = fileURLToPath(new URL("../image-dimensions.json", import.meta.url));

/** 读取构建期尺寸缓存；文件不存在或格式错误时返回空 Map，不阻断构建。 */
export function loadImageDimensions(file = DIMENSIONS_FILE): Map<string, Dim> {
  const result = new Map<string, Dim>();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    for (const [url, value] of Object.entries(parsed?.images ?? {})) {
      if (Array.isArray(value) && value.length >= 2) {
        const width = Number(value[0]);
        const height = Number(value[1]);
        if (width > 0 && height > 0) result.set(url, { width, height });
      } else if (value && typeof value === "object") {
        const { width, height } = value as Dim;
        if (width > 0 && height > 0) result.set(url, { width, height });
      }
    }
  } catch {
    // 缓存缺失/损坏：退回仅本地图片尺寸，不影响构建
  }
  return result;
}

/** 同一个远程 URL 可能有 HTML 实体、编码、协议相对等写法，逐个尝试查表。 */
function remoteCandidates(src: string): string[] {
  const raw = src.replace(/&amp;/g, "&").trim();
  const keys = new Set<string>([raw]);
  try {
    keys.add(new URL(raw).href);
  } catch {
    // 非绝对 URL，交给下面的协议相对/解码分支
  }
  try {
    keys.add(decodeURI(raw));
  } catch {
    // 含非法 % 转义时忽略
  }
  if (raw.startsWith("//")) {
    try {
      keys.add(new URL(`https:${raw}`).href);
    } catch {
      // 忽略
    }
  }
  return [...keys];
}

export function imageSizePlugin(
  md: MarkdownRenderer,
  publicDir: string,
  remoteDimensions: Map<string, Dim> = loadImageDimensions(),
) {
  const cache = new Map<string, Dim | null>();

  const dimsFor = (src: string): Dim | null => {
    if (cache.has(src)) return cache.get(src) ?? null;
    let dim: Dim | null = null;
    try {
      if (src.startsWith("/") && !src.startsWith("//")) {
        // 本地 public 图片：读文件头
        const file = join(publicDir, src);
        if (existsSync(file)) dim = decodeImageSize(readFileSync(file));
      } else if (/^https?:\/\//i.test(src) || src.startsWith("//")) {
        // 远程图片：查构建期缓存
        for (const key of remoteCandidates(src)) {
          const hit = remoteDimensions.get(key);
          if (hit) {
            dim = hit;
            break;
          }
        }
      }
    } catch {
      // 读文件/解析失败则不注入，保持原渲染
    }
    cache.set(src, dim);
    return dim;
  };

  const rawImage = md.renderer.rules.image;
  const rawHtmlBlock = md.renderer.rules.html_block;
  const rawHtmlInline = md.renderer.rules.html_inline;

  /** 把本地 /images/... 过一遍 imageUrl（当前是恒等，保留扩展点）。 */
  const rewriteSrc = (html: string) =>
    html.replace(/(\bsrc\s*=\s*["'])((?:\/images\/)[^"']+)(["'])/g, (_match, prefix, src, suffix) => {
      return `${prefix}${imageUrl(src)}${suffix}`;
    });

  /** 给 HTML 片段里的 <img> 补 width/height（已有尺寸或查不到则原样返回）。 */
  const injectHtmlImages = (html: string) =>
    rewriteSrc(html).replace(/<img\b[^>]*>/gi, (tag) => {
      const src = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
      if (!src) return tag;
      if (/(\s|^)width\s*=/i.test(tag) || /(\s|^)height\s*=/i.test(tag)) return tag;
      const dim = dimsFor(src);
      if (!dim) return tag;
      return tag.replace(/\s*(\/?)>$/, ` width="${dim.width}" height="${dim.height}"$1>`);
    });

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet("src") ?? "";
    const dim = dimsFor(src);
    token.attrSet("src", imageUrl(src));
    if (dim && token.attrGet("width") === null && token.attrGet("height") === null) {
      token.attrSet("width", String(dim.width));
      token.attrSet("height", String(dim.height));
    }
    if (token.attrGet("decoding") === null) token.attrSet("decoding", "async");
    return rawImage ? rawImage(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.html_block = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    token.content = injectHtmlImages(token.content);
    return rawHtmlBlock ? rawHtmlBlock(tokens, idx, options, env, self) : token.content;
  };

  if (rawHtmlInline) {
    md.renderer.rules.html_inline = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      token.content = injectHtmlImages(token.content);
      return rawHtmlInline(tokens, idx, options, env, self) ?? token.content;
    };
  }
}
