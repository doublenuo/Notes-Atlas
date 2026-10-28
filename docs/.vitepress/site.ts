/**
 * 站点级常量：域名、名称、默认描述。
 *
 * 单点维护，供 SEO head 注入、canonical、og:url、sitemap 复用，
 * 避免同一串 URL 散落在 config.ts / permalinks.ts / sitemap 里改漏。
 */

/** 生产域名。与 .github/workflows/deploy.yml 的健康检查保持一致。 */
export const SITE_URL = 'https://blogs.lovetulin.cn'

/** 站点名，用于 og:site_name / 标题后缀。 */
export const SITE_NAME = 'NotesAtlas'

/** 全站兜底描述：多数文章 frontmatter 没写 desc 时使用。 */
export const SITE_DESCRIPTION =
  'NotesAtlas：记录学习、研究与生活的个人知识库，汇聚组会材料、学习笔记、工具资源与随笔沉淀。'

/** 社交分享配图直接使用站点 favicon，兼容站点品牌视觉。 */
export const OG_IMAGE = '/favicon.svg'