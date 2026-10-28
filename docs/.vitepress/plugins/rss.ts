import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { collectPages } from '../permalinks.ts';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../site.ts';

const DEFAULT_DOCS_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readArticle(docsRoot: string, rel: string) {
  const parsed = matter(fs.readFileSync(path.join(docsRoot, rel), 'utf8'));
  const description =
    (typeof parsed.data.description === 'string' && parsed.data.description.trim()) ||
    (typeof parsed.data.desc === 'string' && parsed.data.desc.trim()) ||
    toPlainText(parsed.content).slice(0, 240);
  const dateValue = parsed.data.date ?? parsed.data.updated ?? parsed.data.created;
  const date = dateValue ? new Date(dateValue) : fs.statSync(path.join(docsRoot, rel)).mtime;

  return {
    title: String(parsed.data.title ?? rel),
    description,
    date: Number.isNaN(date.getTime()) ? new Date(0) : date,
  };
}

function buildRss(docsRoot: string) {
  const items = collectPages(docsRoot)
    .filter(({ rel }) => rel !== 'index.md' && !rel.startsWith('@pages/'))
    .map((page) => {
      const article = readArticle(docsRoot, page.rel);
      const link = `${SITE_URL}/${page.url.replace(/^\/+|\/+$/g, '')}/`;
      return {
        date: article.date,
        xml: `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(article.description)}</description>
      <pubDate>${article.date.toUTCString()}</pubDate>
    </item>`,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ xml }) => xml);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(SITE_URL)}/</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <atom:link href="${escapeXml(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />
${items.join('\n')}
  </channel>
</rss>
`;
}

export function rss(options: { siteUrl?: string; docsRoot?: string } = {}) {
  const siteUrl = options.siteUrl ?? SITE_URL;
  const docsRoot = options.docsRoot ?? DEFAULT_DOCS_ROOT;

  return {
    name: 'na-rss',
    closeBundle() {
      const outDir = fileURLToPath(new URL('../dist', import.meta.url));
      const xml = buildRss(docsRoot).replaceAll(SITE_URL, siteUrl);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'feed.xml'), xml);
      console.log(`[rss] 已生成 feed.xml（${(xml.match(/<item>/g) ?? []).length} 篇文章）`);
    },
  };
}
