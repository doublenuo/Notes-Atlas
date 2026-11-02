/**
 * 脚注支持：markdown-it-footnote + 脚注区「参考资料」二级标题注入。
 *
 * 正文 [^1] 引用 + 文末 [^1]: 定义 → 文末生成 <section class="footnotes">，
 * section_open 之后注入 <h2 id="footnotes-heading">参考资料</h2>；
 * 无脚注的页面该 section 不存在，自动跳过。
 *
 * 「参考资料」标题用覆盖 footnote_block_open 渲染规则实现：v4 的该规则把
 * hr + <section> + <ol> 一起输出且无标题配置项，token 级插入只会落进 <ol> 内部
 * （非法 HTML）。供站点构建（config.ts）与测试（tests/helpers.mjs）共用，
 * 勿复制副本以免表现漂移。
 */
import footnotePlugin from "markdown-it-footnote";

export function footnotes(md) {
  md.use(footnotePlugin);

  md.renderer.rules.footnote_block_open = () =>
    '<hr class="footnotes-sep">\n' +
    '<section class="footnotes">\n' +
    '<h2 id="footnotes-heading">参考资料</h2>\n' +
    '<ol class="footnotes-list">\n';
}
