/**
 * permalink 审计：核对全站每篇文档的 permalink 唯一性与显式声明情况。
 *
 * 复用站点自己的 collectPages（docs/.vitepress/permalinks.ts）保证口径一致，
 * 同时按同样规则重算「原始 URL」（不去重、不冲突回退），用于发现潜在撞车。
 *
 * 输出三类信息：
 *   1. 缺显式 permalink 的页面（URL 靠标题派生，改标题就会变，属隐式依赖）
 *   2. 原始 URL 撞车（多篇文档算出同一个 URL）
 *   3. 汇总：总页数 / 显式 / 派生 / 撞车数
 *
 * 退出码：0 = 全部页面均有显式且唯一的 permalink；1 = 存在缺失或撞车（CI 门禁用）。
 *
 * 用法：node scripts/audit-permalinks.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { fileURLToPath } from 'node:url'
import { collectPages } from '../docs/.vitepress/permalinks.ts'

const DOCS_ROOT = fileURLToPath(new URL('../docs', import.meta.url))

const pages = collectPages(DOCS_ROOT)

// 与 collectPages 相同的派生规则，重算原始 URL 以发现撞车
const SECTION_PREFIX = {
  '01.组会材料': 'meet',
  '02.学习笔记': 'study',
  '03.工具与资源': 'tools',
}
const SUBSECTION = {
  '02.学习笔记/02.Python': 'study/python',
  '02.学习笔记/03.深度学习': 'study/dl',
  '02.学习笔记/04.agent': 'study/agent',
  '02.学习笔记/04.LLM': 'study/LLM',
  '02.学习笔记/06.强化学习': 'study/rl',
  '02.学习笔记/09.具身智能': 'study/embody',
  '02.学习笔记/10.开发工具': 'study/tools',
  '02.学习笔记/12.ROS': 'study/ros',
  '03.工具与资源/01.Linux相关教程': 'tools/linux',
  '03.工具与资源/02.面试相关': 'tools/interview',
  '03.工具与资源/03.其他资源': 'tools/resources',
  '01.组会材料/01.组会内容': 'materials/meet',
  '01.组会材料/02.论文笔记': 'materials/paper',
  '01.组会材料/03.论文复现': 'materials/reproduction',
}
const slugify = (title) =>
  title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

const raw = new Map() // url -> [rel]
const missing = [] // { rel, derivedUrl }
for (const p of pages) {
  const abs = path.join(DOCS_ROOT, p.rel)
  let data = {}
  let content = ''
  try {
    const parsed = matter(fs.readFileSync(abs, 'utf8'))
    data = parsed.data
    content = parsed.content
  } catch {}
  const fmPermalink = typeof data.permalink === 'string' ? data.permalink.trim() : ''
  const explicit = fmPermalink.startsWith('/') && !fmPermalink.startsWith('//')

  let url
  if (p.rel === 'index.md') url = 'index'
  else if (explicit) url = fmPermalink.replace(/^\/+/, '').replace(/\/+$/, '')
  else {
    const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ''
    const title = String(data.title ?? h1 ?? path.basename(p.rel, '.md')).trim()
    const slug = slugify(title) || slugify(path.basename(p.rel, '.md'))
    let prefix = ''
    for (const [disk, u] of Object.entries(SUBSECTION)) {
      if ((p.rel === disk || p.rel.startsWith(`${disk}/`)) && disk.length > prefix.length) prefix = u
    }
    if (!prefix) prefix = SECTION_PREFIX[p.rel.split('/')[0]] ?? ''
    url = prefix ? `${prefix}/${slug}` : slug
  }
  if (!raw.has(url)) raw.set(url, [])
  raw.get(url).push(p.rel)
  if (!explicit && p.rel !== 'index.md') missing.push({ rel: p.rel, derivedUrl: p.url })
}

const collisions = [...raw.entries()].filter(([, rels]) => rels.length > 1)

console.log(`[audit] 总页面 ${pages.length}，显式 permalink ${pages.length - missing.length - 1}（不含首页），派生 ${missing.length}`)
if (collisions.length) {
  console.log(`\n[audit] 发现 ${collisions.length} 组 URL 撞车：`)
  for (const [url, rels] of collisions) console.log(`  x ${url}\n      <- ${rels.join('\n      <- ')}`)
} else {
  console.log('[audit] 无 URL 撞车')
}
if (missing.length) {
  console.log(`\n[audit] ${missing.length} 个页面缺显式 permalink（当前靠标题派生）：`)
  for (const m of missing.sort((a, b) => a.rel.localeCompare(b.rel))) {
    console.log(`  ${m.rel}\n      -> /${m.derivedUrl}/`)
  }
}

if (collisions.length || missing.length) {
  console.log('\n[audit] 未通过：运行 pnpm backfill:permalink 可自动回填缺失项')
  process.exit(1)
}
console.log('[audit] 通过：所有页面均有显式且唯一的 permalink')
