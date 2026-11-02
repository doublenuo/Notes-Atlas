/**
 * 站点级常量：域名、名称、默认描述。
 *
 * 单点维护，供 SEO head 注入、canonical、og:url、sitemap 复用，
 * 避免同一串 URL 散落在 config.ts / permalinks.ts / sitemap 里改漏。
 */

/** 生产域名。与 .github/workflows/deploy.yml 的健康检查保持一致。 */
export const SITE_URL = 'https://blogs.lovetulin.cn'

/**
 * 部署 base（与 config.ts 的 base 选项同源同值，带首尾斜杠）。
 * VitePress 只会给它自己生成的链接加 base，config.head 里的链接和
 * siteUrl + OG_IMAGE 这类手工拼接都不会 —— 需要显式带上，否则
 * 子路径部署（如 GitHub Pages 项目页）下 favicon/og:image 会 404。
 */
export const BASE = (process.env.VITEPRESS_BASE ?? '/').replace(/\/?$/, '/') || '/';

/** 站点名，用于 og:site_name / 标题后缀。 */
export const SITE_NAME = "Weno's Blog"

/** 全站兜底描述：多数文章 frontmatter 没写 desc 时使用。 */
export const SITE_DESCRIPTION =
  'Weno\'s Blog：记录学习、研究与生活的个人知识库，汇聚组会材料、学习笔记、工具资源与随笔沉淀。'

/** 社交分享配图直接使用站点统一头像，兼容站点品牌视觉。带 base，子路径部署不 404。 */
export const OG_IMAGE = `${BASE}tx.jpg`