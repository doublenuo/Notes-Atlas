/**
 * 生成「标题用 MiSans」子集字体。
 *
 * 背景：站点原来把 MiSans Regular/Semibold 的 112 个 cn-font-split 分片全量引入，
 * 浏览器按正文用字下载，长文页会拉 40–50 个 woff2、约 1.3–1.5MB。
 * 现改为：正文使用系统中文栈，只有标题/品牌文案用 MiSans。
 * 本脚本从 MiSans VF 可变字体中抽出标题实际用到的字，按使用频率切成 3 片，
 * 并生成带 unicode-range 的 CSS；常见页面只会命中第 1 片（约 116KB）。
 *
 * 前置：
 *   1. 下载 MiSansVF.ttf（约 20MB）：
 *      https://raw.githubusercontent.com/luyanci/MisansVF/main/MiSansVF.ttf
 *      原字体为小米 MiSans，Apache-2.0，详见同目录 LICENSE。
 *   2. 安装 fonttools + brotli：pip install fonttools brotli
 *
 * 用法：
 *   MISANS_VF=/path/to/MiSansVF.ttf node scripts/build-heading-font.mjs
 *   # 可用 PYFTSUBSET 指定 pyftsubset 路径，默认 .venv/bin/pyftsubset
 *
 * 产物：
 *   docs/.vitepress/theme/fonts/misans/MiSans-Heading-{0,1,2}.woff2
 *   docs/.vitepress/theme/fonts/misans/MiSans-Heading.css
 *
 * 注意：标题新增了极冷僻字且不在子集内时，浏览器会逐字回退到系统字体；
 * 新增大量标题后可重跑本脚本。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DOCS = join(ROOT, 'docs')
const OUT_DIR = join(DOCS, '.vitepress', 'theme', 'fonts', 'misans')
const CHUNKS = 3
const VF = process.env.MISANS_VF
const PYFTSUBSET = process.env.PYFTSUBSET || join(ROOT, '.venv', 'bin', 'pyftsubset')

if (!VF || !existsSync(VF)) {
  console.error('[font] 找不到 MiSansVF.ttf，请设置 MISANS_VF=/path/to/MiSansVF.ttf')
  process.exit(1)
}
if (!existsSync(PYFTSUBSET)) {
  console.error(`[font] 找不到 pyftsubset：${PYFTSUBSET}，请先 pip install fonttools brotli`)
  process.exit(1)
}

/** 基础字符：ASCII 与中英文常用标点，保证标题里的数字/英文/符号也有字形。 */
const BASE_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  '，。！？：；、“”‘’（）《》【】—…·,.!?:;()[]{}-+*/=<>%#@&|~'

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

/** 收集正文一级标题（h1）与配置里的品牌/导航中文文案，并按出现频率计数。 */
function collectFrequency() {
  const freq = new Map()
  const add = (text, weight = 1) => {
    for (const ch of String(text)) {
      if (!ch.trim()) continue
      freq.set(ch, (freq.get(ch) ?? 0) + weight)
    }
  }

  for (const file of walkMarkdown(DOCS)) {
    const raw = readFileSync(file, 'utf8')
    const content = matter(raw).content
    for (const match of content.matchAll(/^#\s+(.+)$/gm)) add(match[1])
  }

  // 站点文案（banner 描述、导航、页脚等）也使用标题字体
  for (const file of [join(DOCS, '.vitepress', 'config.ts'), join(DOCS, '.vitepress', 'teekConfig.ts')]) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/["'`]([^"'`\n]*[\u3400-\u9fff][^"'`\n]*)["'`]/g)) add(match[1])
  }

  // 基础字符必须进第 1 片，给最高权重
  for (const ch of BASE_CHARS) add(ch, 1_000_000)

  return [...freq.entries()]
    .filter(([ch]) => ch.codePointAt(0) > 0x1f)
    .sort((a, b) => b[1] - a[1] || a[0].codePointAt(0) - b[0].codePointAt(0))
    .map(([ch]) => ch)
}

/** 把码点压成 unicode-range 段，例如 U+4E00-4E03,U+4E09。 */
function toUnicodeRange(chars) {
  const cps = [...new Set(chars.map((ch) => ch.codePointAt(0)))].sort((a, b) => a - b)
  const parts = []
  let start = cps[0]
  let prev = cps[0]
  for (const cp of cps.slice(1)) {
    if (cp === prev + 1) {
      prev = cp
      continue
    }
    parts.push(start === prev ? `U+${start.toString(16).toUpperCase()}` : `U+${start.toString(16).toUpperCase()}-${prev.toString(16).toUpperCase()}`)
    start = prev = cp
  }
  parts.push(start === prev ? `U+${start.toString(16).toUpperCase()}` : `U+${start.toString(16).toUpperCase()}-${prev.toString(16).toUpperCase()}`)
  return parts.join(',')
}

const chars = collectFrequency()
const per = Math.ceil(chars.length / CHUNKS)
const chunks = Array.from({ length: CHUNKS }, (_, i) => chars.slice(i * per, (i + 1) * per))
mkdirSync(OUT_DIR, { recursive: true })

const css = [
  '/* 由 scripts/build-heading-font.mjs 生成，请勿手改。',
  ' * MiSans VF 子集：只覆盖标题/品牌文案用字，正文走系统中文栈。',
  ' * 字体来源：小米 MiSans（Apache-2.0），见同目录 LICENSE。',
  ' */',
]

chunks.forEach((chunk, i) => {
  const textFile = join(OUT_DIR, `.heading-chars-${i}.txt`)
  const fontFile = join(OUT_DIR, `MiSans-Heading-${i}.woff2`)
  writeFileSync(textFile, chunk.join(''), 'utf8')
  execFileSync(PYFTSUBSET, [
    VF,
    `--text-file=${textFile}`,
    '--flavor=woff2',
    `--output-file=${fontFile}`,
    '--layout-features=*',
    '--no-hinting',
    '--desubroutinize',
  ])
  rmSync(textFile)

  const size = statSync(fontFile).size
  console.log(`[font] MiSans-Heading-${i}.woff2  ${chunk.length} 字  ${(size / 1024).toFixed(1)} KB`)
  css.push(
    '@font-face {',
    '  font-family: "MiSans Heading";',
    '  font-style: normal;',
    '  font-weight: 150 700;', // MiSans VF 的 wght 轴范围
    '  font-display: swap;',
    `  src: url("./MiSans-Heading-${i}.woff2") format("woff2");`,
    `  unicode-range: ${toUnicodeRange(chunk)};`,
    '}',
    '',
  )
})

writeFileSync(join(OUT_DIR, 'MiSans-Heading.css'), css.join('\n'))
console.log(`[font] 共 ${chars.length} 字，写入 ${CHUNKS} 个分片与 MiSans-Heading.css`)
