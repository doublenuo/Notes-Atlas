/**
 * 数学公式渲染：markdown-it + KaTeX（构建期输出 HTML/MathML）。
 *
 * 为什么不用 VitePress 内置的 `markdown.math`：它固定使用 markdown-it-mathjax3，
 * 每道公式在构建期被渲染成内联 SVG，数学页 HTML 会膨胀到 1–3MB（见 2026-11 的性能审计）。
 * KaTeX 输出的是紧凑的 HTML + MathML，同一批页面体积约为原来的 1/4。
 *
 * 单点维护：站点构建（config.ts 的 markdown.config）与测试（tests/helpers.mjs）
 * 共用本文件，避免两边渲染口径漂移。
 *
 * `macros['\\*']` 是 MathJax 的扩展写法（控制符号 \*），旧笔记里存在 `x^\*`、
 * `\lambda_i^\*` 等 90+ 处。KaTeX 原生不支持，这里统一映射到 `\ast`，
 * 既不用批量改内容，也能保持原来的语义（∗）。
 *
 * `logger`：笔记里的 `\text{中文}` 会触发 unicodeTextInMathMode，
 * `$$ ... $$` 跨行会触发 newLineInDisplayMode；这些在本站都是有意为之，
 * 直接忽略，避免几十条构建警告淹没真正的错误。其余 strict 警告照常输出。
 *
 * `throwOnError: true`：KaTeX 解析失败时插件会向构建日志打印 console.error，
 * 并输出带 katex-error 的红色块；构建本身不会中断，但日志里能立刻定位到出错公式。
 * 当前 359 篇 Markdown 已全量验证为 0 错误。
 */
import { katex } from '@mdit/plugin-katex'

export function math(md) {
  md.use(katex, {
    throwOnError: true,
    output: 'htmlAndMathml',
    macros: { '\\*': '\\ast' },
    logger: (code) =>
      code === 'unicodeTextInMathMode' || code === 'newLineInDisplayMode' ? 'ignore' : 'warn',
  })
}
