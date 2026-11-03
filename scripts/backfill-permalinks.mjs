/**
 * permalink 回填：给所有靠标题派生 URL 的页面补上显式 permalink。
 *
 * 动机：派生 URL 是隐式契约 —— 改一次标题，URL 就变，外链/RSS/sitemap 全断。
 * 本脚本把每页当前的最终 URL 固化成 frontmatter 里的显式 permalink，
 * URL 本身不变（零链接破坏），只是把「隐式」变「显式」。
 *
 * 做法：
 *   1. 用站点自己的 collectPages 取每页最终 URL（与构建口径一致）
 *   2. 筛出 frontmatter 没有显式 permalink 的页面（首页除外，它的 URL 固定是 /）
 *   3. 在 frontmatter 的 title 行后插入 permalink: /<url>（与仓库现有
 *      date/title/permalink 键序一致）
 *   4. 写入前断言全站 URL 唯一；写入后可复跑 audit-permalinks.mjs 验证
 *
 * 用法：node scripts/backfill-permalinks.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { fileURLToPath } from 'node:url'
import { collectPages } from '../docs/.vitepress/permalinks.ts'

const DOCS_ROOT = fileURLToPath(new URL('../docs', import.meta.url))

const pages = collectPages(DOCS_ROOT)

// 1. 全站 URL 唯一性前置断言（collectPages 已去重，这里确认没有触发过回退）
const urlCount = new Map()
for (const p of pages) urlCount.set(p.url, (urlCount.get(p.url) ?? 0) + 1)
const dupes = [...urlCount.entries()].filter(([, n]) => n > 1)
if (dupes.length) {
  console.error(`[backfill] 终止：${dupes.length} 个 URL 不唯一，先解决撞车再回填`)
  for (const [url] of dupes) console.error(`  x ${url}`)
  process.exit(1)
}

// 2. 找出缺显式 permalink 的页面
const targets = []
for (const p of pages) {
  if (p.rel === 'index.md') continue // 首页 URL 固定为 /，无需显式声明
  const raw = fs.readFileSync(path.join(DOCS_ROOT, p.rel), 'utf8')
  const data = matter(raw).data
  const fm = typeof data.permalink === 'string' ? data.permalink.trim() : ''
  const explicit = fm.startsWith('/') && !fm.startsWith('//')
  if (!explicit) targets.push({ ...p, raw })
}

if (!targets.length) {
  console.log('[backfill] 所有页面均已有显式 permalink，无需处理')
  process.exit(0)
}

// 3. 插入 permalink 行（title 行后；无 title 行则 frontmatter 开头）
let changed = 0
const urlMapBefore = new Map(pages.map((p) => [p.rel, p.url]))
for (const t of targets) {
  const permalink = `/${t.url}`
  const lines = t.raw.split('\n')
  // frontmatter 必须首行开始
  if (lines[0].trim() !== '---') {
    console.error(`[backfill] 跳过（frontmatter 缺失）：${t.rel}`)
    continue
  }
  const titleIdx = lines.findIndex((l, i) => i > 0 && /^title:/.test(l))
  const insertAt = titleIdx !== -1 ? titleIdx + 1 : 1
  lines.splice(insertAt, 0, `permalink: ${permalink}`)
  fs.writeFileSync(path.join(DOCS_ROOT, t.rel), lines.join('\n'))
  changed++
}
console.log(`[backfill] 已为 ${changed} 个页面写入显式 permalink`)

// 4. 复算：URL 映射必须与回填前完全一致（保证零链接破坏），且仍无撞车
const after = collectPages(DOCS_ROOT)
const urlCountAfter = new Map()
for (const p of after) urlCountAfter.set(p.url, (urlCountAfter.get(p.url) ?? 0) + 1)
const dupesAfter = [...urlCountAfter.entries()].filter(([, n]) => n > 1)
if (dupesAfter.length) {
  console.error(`[backfill] 严重：回填后出现 URL 撞车 ${dupesAfter.length} 组，请检查`)
  process.exit(1)
}
let drift = 0
for (const p of after) {
  if (urlMapBefore.get(p.rel) !== p.url) {
    console.error(`[backfill] URL 漂移：${p.rel} ${urlMapBefore.get(p.rel)} -> ${p.url}`)
    drift++
  }
}
if (drift) process.exit(1)
console.log(`[backfill] 验证通过：${after.length} 个页面 URL 全部唯一且与回填前一致`)
