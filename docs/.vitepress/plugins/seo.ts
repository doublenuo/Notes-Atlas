/**
 * SEO 注入：canonical / og / twitter / description + sitemap.xml + robots.txt。
 *
 * 为什么不用 vitepress-plugin-sitemap：站点 URL 由 permalinks.ts 的 rewrites 决定
 * （/study/rl/q-learning算法 这类），插件按 srcDir 扫描推导会与真实 URL 不符。
 * 这里直接复用 collectPages() 的 URL 映射，顺带把 lastmod 一起写进 sitemap。
 *
 * 每页 description 的取值优先级：
 *   1. frontmatter.desc / description（作者显式写的）
 *   2. frontmatter.description（teek 语义下同上）
 *   3. 正文首个非标题段落的纯文本（截断到 160 字符，按中英字符宽度粗略估算）
 *   4. 站点兜底描述
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';
import { buildRewrites, collectPages } from '../permalinks.ts';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, OG_IMAGE } from '../site.ts';

/** docs/ 根目录：本文件在 docs/.vitepress/plugins/ 下，上溯三层即 docs/。 */
const DEFAULT_DOCS_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const DESC_MAX = 160;

/** 去掉 markdown 标记与多余空白，得到可直接放进 meta 的纯文本。 */
function toPlainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')      // 代码块
    .replace(/`[^`]*`/g, ' ')            // 行内代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/^>\s?/gm, ' ')
    .replace(/^[#>\-*+|]+/gm, ' ')        // 标题/引用/列表符号
    .replace(/[*_~]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 从正文里取第一段像说明的话，跳过标题、空行和嵌入壳行。 */
function excerptFromMarkdown(content) {
  const body = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^#{1,6}\s/.test(p))          // 跳过标题
    .filter((p) => !/^!\[\[/.test(p))              // 跳过嵌入壳
    .filter((p) => p.length > 12);
  if (!body.length) return '';
  const text = toPlainText(body[0]);
  return text.length > DESC_MAX ? text.slice(0, DESC_MAX).trim() + '…' : text;
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const attr = (v) => (v ? String(v).replace(/"/g, '&quot;') : '');

/** 读取页面 frontmatter + 正文，供 description 与 sitemap 复用。 */
function readPage(docsRoot, rel) {
  try {
    const raw = fs.readFileSync(path.join(docsRoot, rel), 'utf8');
    const parsed = matter(raw);
    return { data: parsed.data ?? {}, content: parsed.content ?? '' };
  } catch {
    return { data: {}, content: '' };
  }
}

/** 取页面最后修改时间，作为 sitemap 的 lastmod。 */
function lastmod(docsRoot, rel) {
  try {
    const file = path.join(docsRoot, rel);
    if (!fs.existsSync(file)) return null;
    return fs.statSync(file).mtime.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * 生成 sitemap.xml。排除 /risk-link：它是点击站外链接的中转提示页，
 * 没有独立内容，收进索引只会稀释权重（且它自己会带 noindex）。
 */
function buildSitemap(docsRoot, outDir) {
  const pages = collectPages(docsRoot);
  const urls = pages.map((p) => {
    const loc = `${SITE_URL}/${p.url === 'index' ? '' : p.url}`.replace(/\/+$/, '') + '/';
    const mod = lastmod(docsRoot, p.rel);
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>${mod ? `\n    <lastmod>${mod}</lastmod>` : ''}\n  </url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml);
  return pages.length;
}

/**
 * 写入 robots.txt。public/robots.txt 会被原样拷贝到产物根，
 * 这里在构建末尾追加 Sitemap 指向，不覆盖已有的 Algolia 校验串。
 */
function patchRobots(outDir) {
  const file = path.join(outDir, 'robots.txt');
  const base = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8')
    : 'User-agent: *\nAllow: /\n';
  const cleaned = base.replace(/\n*Sitemap:.*\n?/gi, '\n');
  const withSitemap = cleaned.replace(/\n*$/, '\n') + `Sitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(file, withSitemap);
}

/**
 * 磁盘 relativePath → 最终 URL 的映射，扫描一次复用。
 *
 * 本站在 permalinks.ts 里用 rewrites 把磁盘路径改写成 permalink，transformHead
 * 收到的 pageData.relativePath 已经是**改写后**的路径（materials/meet/20251020.md），
 * pageData.url 为 undefined。因此这里以磁盘 rel 为键建映射，再反向登记改写后路径，
 * 两种形态都能查到，与 rewrites、sitemap 同源。
 */
let urlMaps = null;
/** urlByRel[磁盘 rel | rewrites 后 rel] = 最终 URL；diskByRel 反向，供读正文用。 */
function urlByRel(docsRoot) {
  if (!urlMaps) {
    try {
      const urlBy = new Map();
      const diskBy = new Map();
      const pages = collectPages(docsRoot);
      // 必须用全量页数组：buildRewrites 靠「是否存在以该 url 为前缀的其它 url」判断
      // 目录型页面（/study 与 /study/rl/… 并存 → 落成 study/index.md），
      // 传单页数组会让这个判断失效，得到与 config.ts 不同的改写结果。
      const rewrites = buildRewrites(pages);
      for (const p of pages) {
        const clean = String(p.url).replace(/^\/+|\/+$/g, '');
        // 首页映射到 /，其余补尾斜杠
        const url = clean === 'index' ? '/' : '/' + clean + '/';
        const rewritten = rewrites(p.rel);
        const norm = (k) => String(k ?? '').replace(/^\/+/, '');
        urlBy.set(norm(p.rel), url);
        urlBy.set(norm(rewritten), url);
        diskBy.set(norm(rewritten), p.rel);
      }
      urlMaps = { urlBy, diskBy };
    } catch {
      urlMaps = null;
    }
  }
  return urlMaps;
}

/**
 * 生成每页 head。导出成独立函数是为了能在 config.ts 的 transformHead 钩子里复用 ——
 * VitePress 的 transformHead 是配置项而非插件钩子，挂在 vite.plugins 下不会被调用。
 */
export function buildHead(pageData, siteUrl = SITE_URL, docsRoot = DEFAULT_DOCS_ROOT) {
  const fm = pageData?.frontmatter ?? {};
  const rel = String(pageData?.relativePath ?? 'index.md').replace(/^\/+/, '');

  const maps = urlByRel(docsRoot);
  const relUrl = maps?.urlBy.get(rel) ?? pageData?.url ?? '/';

  // 读正文取摘要要用磁盘路径：rewrites 改写后的路径在磁盘上并不存在
  const diskRel = maps?.diskBy.get(rel) ?? rel;
  const { content } = readPage(docsRoot, diskRel);

  // og:title 要与实际 <title> 一致。实际标题由 VitePress 用 frontmatter.title +
  // titleTemplate 拼出，所以这里同样尊重 titleTemplate: false（首页与提示页用了）。
  // 404.md 无 frontmatter（走自定义 404 组件），VitePress 把它的 title 定为 "404"。
  const is404 = rel === '404.md';
  const title = String(fm.title ?? SITE_NAME).trim();
  const fullTitle = is404 ? `404 | ${SITE_NAME}` : fm.titleTemplate === false ? title : `${title} | ${SITE_NAME}`;

  const description =
    (typeof fm.desc === 'string' && fm.desc.trim()) ||
    (typeof fm.description === 'string' && fm.description.trim()) ||
    excerptFromMarkdown(content) ||
    SITE_DESCRIPTION;

  // 站内相对路径转绝对 URL
  const url = siteUrl + relUrl;
  const ogImage = siteUrl + OG_IMAGE;

  // /risk-link 是点击站外链接的中转提示页，没有独立内容，不进索引
  const isRiskLink = relUrl.replace(/\/+$/, '') === '/risk-link';
  // 404 不该进索引，否则搜索引擎会收录不存在的路径
  const robots = isRiskLink || is404 ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

  // transformHead 的返回值必须是 head 数组，返回对象会报 head.some is not a function。
  // 标题不进这里：VitePress 的 title 由 frontmatter.title + config.titleTemplate 拼，
  // 在 head 里塞 <title> 会被忽略或重复。站点名后缀靠 config.titleTemplate 实现。
  const tags: [string, Record<string, string>][] = [
    ['link', { rel: 'canonical', href: url }],
    ['meta', { name: 'description', content: description }],

    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: SITE_NAME }],
    ['meta', { property: 'og:title', content: fullTitle }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:url', content: url }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],

    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: fullTitle }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: ogImage }],

    ['meta', { name: 'author', content: 'doublenuo' }],
    ['meta', { name: 'robots', content: robots }],
  ];

  return tags;
}

/**
 * Vite 插件：构建结束后生成 sitemap.xml 并给 robots.txt 追加 Sitemap 指向。
 * head 注入不在这里做 —— 见 buildHead 的说明。
 */
export function seo(options = {}) {
  const siteUrl = options.siteUrl ?? SITE_URL;
  const docsRoot = options.docsRoot ?? DEFAULT_DOCS_ROOT;

  return {
    name: 'na-seo',

    closeBundle() {
      // 产物目录同样从本文件位置推导，避免依赖 cwd（构建可能在别处执行）
      const outDir = fileURLToPath(new URL('../dist', import.meta.url));
      try {
        const n = buildSitemap(docsRoot, outDir);
        patchRobots(outDir);
        console.log(`[seo] 已生成 sitemap.xml（${n} 个 URL）与 robots.txt`);
      } catch (e) {
        console.warn(`[seo] 生成 sitemap/robots 失败：${e?.message ?? e}`);
      }
    },
  };
}