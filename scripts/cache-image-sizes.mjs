/**
 * 生成远程图片尺寸缓存（docs/.vitepress/image-dimensions.json）。
 *
 * 图片都在阿里云 OSS / CDN（少量历史腾讯 COS），支持 HTTP Range：
 * 只读每个文件的前 64KB 解析 PNG/JPEG/GIF/WebP 文件头，不下载整图。
 * 构建期由 imageSize.ts 查表注入 width/height，构建本身不访问网络。
 *
 * 用法：
 *   pnpm images:sizes          # 增量：只请求缓存里没有的 URL
 *   pnpm images:sizes --force  # 全部重新请求（图片被替换/尺寸变了时用）
 *
 * 新增或删除文章图片后重跑即可；脚本同时会报告 alt 为空的图片位置。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { decodeImageSize } from '../docs/.vitepress/plugins/imageDimensions.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DOCS = join(ROOT, 'docs')
const CACHE_FILE = join(DOCS, '.vitepress', 'image-dimensions.json')
const FORCE = process.argv.includes('--force')
const CONCURRENCY = 6
const RANGE_BYTES = 64 * 1024
const RETRY_BYTES = 1024 * 1024

/** @param {string} dir @param {string[]} out */
function walkMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['.vitepress', 'node_modules', 'dist', 'public', 'superpowers'].includes(entry.name)) continue
      walkMarkdown(full, out)
    } else if (entry.name.endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

/** @param {string} raw */
function normalizeUrl(raw) {
  let url = raw.trim().replace(/^<|>$/g, '').replace(/&amp;/g, '&')
  if (url.startsWith('//')) url = `https:${url}`
  if (!/^https?:\/\//i.test(url)) return null
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

/**
 * 扫描 Markdown 图片与 HTML <img>，返回 URL → 出现位置；同时收集空 alt。
 * @returns {{ urls: Map<string, { file: string, line: number }>, emptyAlt: { file: string, line: number, url: string }[] }}
 */
function scanImages() {
  const urls = new Map()
  const emptyAlt = []

  for (const file of walkMarkdown(DOCS)) {
    const raw = readFileSync(file, 'utf8')
    const content = matter(raw).content
    const offset = raw.length - content.length
    const rel = relative(ROOT, file)
    const lineAt = (index) => raw.slice(0, index + offset).split('\n').length

    // ![alt](url "title")
    for (const match of content.matchAll(/!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g)) {
      const url = normalizeUrl(match[2])
      if (!url) continue
      if (!urls.has(url)) urls.set(url, { file: rel, line: lineAt(match.index ?? 0) })
      if (!match[1].trim()) emptyAlt.push({ file: rel, line: lineAt(match.index ?? 0), url })
    }

    // HTML <img src="...">
    for (const match of content.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
      const url = normalizeUrl(match[1])
      if (!url) continue
      if (!urls.has(url)) urls.set(url, { file: rel, line: lineAt(match.index ?? 0) })
      const alt = match[0].match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? ''
      if (!alt.trim()) emptyAlt.push({ file: rel, line: lineAt(match.index ?? 0), url })
    }
  }

  return { urls, emptyAlt }
}

function readCache() {
  try {
    const parsed = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    return new Map(Object.entries(parsed?.images ?? {}))
  } catch {
    return new Map()
  }
}

async function fetchDimensions(url, bytes) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${bytes - 1}` },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    return decodeImageSize(buf)
  } finally {
    clearTimeout(timer)
  }
}

async function resolveDimensions(url) {
  for (const bytes of [RANGE_BYTES, RETRY_BYTES]) {
    try {
      const dim = await fetchDimensions(url, bytes)
      if (dim) return [dim.width, dim.height]
    } catch {
      // 小 Range 失败时用更大 Range 再试一次；仍失败由调用方记录
    }
  }
  return null
}

const { urls, emptyAlt } = scanImages()
const cache = readCache()
const target = [...urls.keys()].sort()
console.log(`[image-sizes] 扫描到 ${target.length} 个远程图片 URL，缓存已有 ${cache.size} 条`)

let fetched = 0
let reused = 0
const failed = []

for (let i = 0; i < target.length; i += CONCURRENCY) {
  const batch = target.slice(i, i + CONCURRENCY)
  await Promise.all(
    batch.map(async (url) => {
      if (!FORCE && cache.has(url)) {
        reused++
        return
      }
      const dim = await resolveDimensions(url)
      if (dim) {
        cache.set(url, dim)
        fetched++
      } else {
        failed.push(url)
        if (cache.has(url)) console.warn(`[image-sizes] 使用旧尺寸（本次请求失败）：${url}`)
      }
    }),
  )
  process.stdout.write(`\r[image-sizes] 进度 ${Math.min(i + CONCURRENCY, target.length)}/${target.length}`)
}
process.stdout.write('\n')

// 只保留当前引用的 URL，避免缓存随删图无限增长
const images = {}
for (const url of target) {
  const dim = cache.get(url)
  if (dim) images[url] = dim
}
writeFileSync(CACHE_FILE, `${JSON.stringify({ version: 1, images }, null, 2)}\n`)
console.log(`[image-sizes] 写入 ${Object.keys(images).length} 条 → ${relative(ROOT, CACHE_FILE)}（新请求 ${fetched}，复用 ${reused}）`)

if (failed.length) {
  console.warn(`[image-sizes] ${failed.length} 个 URL 解析失败（对应图片不会注入尺寸）：`)
  for (const url of failed.slice(0, 20)) console.warn(`  - ${url}`)
  if (failed.length > 20) console.warn(`  ... 其余 ${failed.length - 20} 个省略`)
}

if (emptyAlt.length) {
  console.warn(`[image-sizes] ${emptyAlt.length} 张图片 alt 为空：`)
  for (const item of emptyAlt.slice(0, 30)) console.warn(`  - ${item.file}:${item.line}  ${item.url}`)
  if (emptyAlt.length > 30) console.warn(`  ... 其余 ${emptyAlt.length - 30} 个省略`)
}
