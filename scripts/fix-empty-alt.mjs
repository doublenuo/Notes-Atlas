/**
 * 为空 alt 的 Markdown 图片补一个可用的替代文本。
 *
 * 策略：用图片上方最近的一级/二级/三级标题作为 alt；同一标题下有多张图时
 * 追加「（图 N）」，避免屏幕阅读器重复朗读同一个标签。只处理空 alt 的
 * `![](...)`，已有 alt 的图片不动；跳过代码围栏。
 *
 * 用法：
 *   node scripts/fix-empty-alt.mjs          # 只预览，不写文件
 *   node scripts/fix-empty-alt.mjs --write  # 实际写入
 *
 * 自动生成的 alt 只是兜底，真正有信息量的截图仍建议手动改成更具体的描述。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DOCS = join(ROOT, 'docs')
const WRITE = process.argv.includes('--write')

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

function cleanHeading(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~[\]\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

let changedFiles = 0
let changedImages = 0

for (const file of walkMarkdown(DOCS)) {
  const raw = readFileSync(file, 'utf8')
  const parsed = matter(raw)
  const body = parsed.content
  const lines = body.split('\n')
  let inFence = false
  let fence = ''
  let heading = ''
  let imageNo = 0
  let fileImages = 0
  let fileChanged = false

  const next = lines.map((line) => {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/)
    if (fenceMatch) {
      if (!inFence) {
        inFence = true
        fence = fenceMatch[1][0]
      } else if (fenceMatch[1][0] === fence) {
        inFence = false
      }
      return line
    }
    if (inFence) return line

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      heading = cleanHeading(headingMatch[1])
      imageNo = 0
      return line
    }

    if (!/!\[\s*\]\(/.test(line)) return line
    imageNo++
    const alt = `${heading || '配图'}${imageNo > 1 ? `（图 ${imageNo}）` : ''}`.replace(/]/g, '\\]')
    fileChanged = true
    fileImages++
    changedImages++
    return line.replace(/!\[\s*\]\(/g, `![${alt}](`)
  })

  if (fileChanged) {
    changedFiles++
    const nextBody = next.join('\n')
    console.log(`${WRITE ? 'write' : 'dry  '} ${relative(ROOT, file)}  ${fileImages} 张`)
    // 只替换正文，保留原始 frontmatter 的键序/引号/日期格式
    if (WRITE) writeFileSync(file, raw.slice(0, raw.length - body.length) + nextBody)
  }
}

console.log(`[alt] ${changedFiles} 个文件、${changedImages} 张空 alt 图片${WRITE ? '已写入' : '待写入（加 --write）'}`)
