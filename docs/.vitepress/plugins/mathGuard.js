/**
 * 构建期 KaTeX 错误守卫。
 *
 * @mdit/plugin-katex 在公式解析失败时不会让构建失败：它会打印 console.error，
 * 并把公式渲染成带 `katex-error` 的红色块继续产出页面。为了不把坏公式带上线，
 * 这里在 VitePress 的 buildEnd（页面全部写完后）扫描产出的 HTML，
 * 发现 `katex-error` 就让构建失败。
 *
 * 注意不能用 Vite 插件的 closeBundle：那个时机早于 VitePress 渲染页面，
 * 扫到的是上一轮构建的旧文件，会给出假通过。
 *
 * 只扫 .html，跳过 pagefind 索引目录；扫描 40MB 级别产物耗时 < 1s。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_OUT_DIR = fileURLToPath(new URL('../dist', import.meta.url))

export function katexGuard() {
  return (siteConfig = {}) => {
    const outDir = siteConfig.outDir ?? DEFAULT_OUT_DIR
    if (!existsSync(outDir)) return

    const bad = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'pagefind') continue
          walk(full)
        } else if (entry.name.endsWith('.html')) {
          if (readFileSync(full, 'utf8').includes('katex-error')) bad.push(full)
        }
      }
    }
    walk(outDir)

    if (bad.length) {
      const rel = bad.map((f) => f.slice(outDir.length + 1)).slice(0, 10)
      throw new Error(
        `[katex] ${bad.length} 个页面存在公式渲染错误（katex-error）：\n  ${rel.join('\n  ')}\n` +
          '请根据构建日志里的 ParseError 修正对应 Markdown 中的 LaTeX。',
      )
    }
    console.log('[katex] 公式渲染检查通过（0 个 katex-error）')
  }
}
