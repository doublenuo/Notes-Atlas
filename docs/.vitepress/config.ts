import { defineConfig } from 'vitepress'

import { teekConfig } from './teekConfig'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { collectPages, buildRewrites, buildSidebar } from './permalinks'
import { obsidianEmbed } from './plugins/obsidianEmbed.js'
import { imageSizePlugin } from './plugins/imageSize'
import { footnotes } from './plugins/footnotes.js'
import { siteDataOptimize } from './plugins/siteDataOptimize'
import { docAnalysisEmbed } from './plugins/docAnalysisEmbed'
import { seo, buildHead } from './plugins/seo'
import { rss } from './plugins/rss'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, BASE } from './site'
import { zhihuIcon, cnbIcon, emailIcon } from './socialIcons'
import { pagefindPlugin } from 'vitepress-plugin-pagefind'

const DOCS_ROOT = fileURLToPath(new URL('..', import.meta.url))

// 有 permalink 的用它；没有的用文档标题派生 slug。详见 ./permalinks.ts
const PAGES = collectPages(DOCS_ROOT)

const useLocalImages = process.env.USE_LOCAL_IMAGES === 'true'
const cosImageBase = (process.env.COS_IMAGE_BASE_URL || '').replace(/\/$/, '')

export default defineConfig({
  extends: teekConfig,
  lang: 'zh-CN',
  base: BASE,
  title: SITE_NAME,
  titleTemplate: `:title | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  head: [
    // config.head 不会被 VitePress 自动加 base（site.ts 的 BASE 注释），必须显式拼接。
    // favicon 用 ico(16/32/48) + png 双声明：个别浏览器对 PNG-in-ICO 支持不佳时自动改用 PNG；
    // 均替代原 100KB 的 1080px JPEG；touch icon / logo 见 public/
    ['link', { rel: 'icon', type: 'image/x-icon', sizes: '32x32', href: `${BASE}favicon.ico` }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${BASE}favicon-32.png` }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: `${BASE}apple-touch-icon.png` }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
    // 预连接外部资源，减少 DNS/TLS 握手延迟
    ['link', { rel: 'preconnect', href: 'https://www.googletagmanager.com', crossorigin: 'anonymous' }],
    ['link', { rel: 'preconnect', href: 'https://www.google-analytics.com', crossorigin: 'anonymous' }],
    ['link', { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: 'anonymous' }],
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css', integrity: 'sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X', crossorigin: 'anonymous' }],
    ['script', { defer: '', src: 'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js', integrity: 'sha384-g7c+Jr9ZivxKLnZTDUhnkOnsh30B4H0rpLUpJ4jAIKs4fnJI+sEnkvrMWph2EDg4', crossorigin: 'anonymous' }],
    ['script', { defer: '', src: 'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/contrib/auto-render.min.js', integrity: 'sha384-mll67QQFJfxn0IYznZYonOWZ644AWYC+Pt2cHqMaRhXVrursRwvLnLaebdGIlYNa', crossorigin: 'anonymous' }],
    ['script', { defer: '', src: 'https://stats.lovetulin.cn/recorder.js', 'data-website-id': '0406218e-b83d-4b3c-ad2f-2253eecaeb03' }],
    // 内联 @page 规则：直接写入 HTML <head>，避免外部 CSS 打包顺序导致 Chrome headless 忽略
    ['style', { type: 'text/css' }, '@page { size: A4; margin: 15mm; }'],
  ],
  // canonical / og / twitter / description。buildHead 复用 permalinks 的 URL 体系，
  // 保证 permalink 页的 og:url 与实际地址一致（plugins 里的 transformHead 不会被 VitePress 调用）
  transformHead: ({ pageData }) => buildHead(pageData, SITE_URL, DOCS_ROOT),
  cleanUrls: true,
  rewrites: buildRewrites(PAGES),
  // 朋友圈碎片只作为时间线条目被 MomentsTimeline.vue 聚合（?raw 读取），不生成独立页面；
  // 朋友圈页面本体在 @pages/momentsPage.md，02.moments/ 是纯数据目录。
  // 与 permalinks.ts 的 collectPages、teekConfig.ts 的 fileContentLoaderIgnore 三处口径一致
  srcExclude: ["superpowers/**", "04.随笔/02.moments/**"],
  // 打包构建优化
  vite: {
    // 文档分析(字数/阅读时长)按嵌入展开后重算,覆盖 doc-analysis 的原始源码口径
    plugins: [
      docAnalysisEmbed(),
      siteDataOptimize(),
      pagefindPlugin({
        btnPlaceholder: '搜索',
        placeholder: '搜索文档',
        emptyText: '没有找到相关结果',
        loadingText: '搜索中…',
        heading: '共 {{searchResult}} 条结果',
        forceLanguage: 'zh-cn',
      }),
      seo({ siteUrl: SITE_URL }),
      rss({ siteUrl: SITE_URL }),
    ],
    build: {
      target: 'es2020',                    // 现代浏览器目标，减小 polyfill 体积
      cssMinify: 'esbuild',                // 使用 esbuild 压缩 CSS（比 lightningcss 稳定）
      minify: 'esbuild',                   // 使用 esbuild 压缩 JS
      rollupOptions: {
        output: {
          // 手动代码分割：将重依赖拆分为独立 chunk，按需加载
          manualChunks(id: string) {
            if (id.includes('node_modules/echarts')) return 'echarts'
            if (id.includes('node_modules/mathjax')) return 'mathjax'
            if (id.includes('node_modules/monaco')) return 'monaco'
            // 评论系统由 Teek 内置的 Twikoo 适配器按需加载，不需要单独拆分评论依赖。
          },
          // 资源文件命名
          chunkFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
      // 内联小资源，减少 HTTP 请求
      assetsInlineLimit: 4096,             // 4KB 以下资源内联为 base64
      chunkSizeWarningLimit: 3000,         // mathjax 等大依赖已手动分割，mermaid 按需加载
    },
    // 开发服务器优化
    server: {
      warmup: {
        clientFiles: ['./**/*.md'],
      },
    },
    // CSS 处理
    css: {
      devSourcemap: false,
    },
  },
  themeConfig: {
    logo: '/logo.png',
    // teek 的 sidebar 插件按磁盘目录名生成键，开启 rewrites 后页面 URL 已是 permalink，
    // 两者对不上会让全站侧边栏变空白。故在 teekConfig 里关掉它，改用这里按 permalink 生成的。
    sidebar: buildSidebar(PAGES),
    editLink: {
      pattern: 'https://github.com/doublenuo/Notes-Atlas/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页面'
    },
    outline: [2, 4],
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'long',
        timeStyle: 'medium'
      }
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    nav: [
      { text: '🏠 首页', link: '/' },
      {
        text: '📚 文档', items: [
          { text: '👥 组会材料', link: '/materials' },
          { text: '📝 学习笔记', link: '/study' },
          { text: '🛠️ 工具与资源', link: '/tools' }
        ]
      },
      { text: '🚀 项目实践', link: '/projects' },
      {
        text: '✒️ 随笔',
        items: [
          { text: '💭 朋友圈', link: '/moments' },
          { text: '📖 读书笔记', link: '/reading-notes' },
          { text: '🗓️ 年终总结', link: '/year-review' },
        ]
      },
      {
        text: 'ℹ️ 站点信息', items: [
          { text: '🏛️ 关于本站', link: '/about' },
          { text: '👤 关于作者', link: '/author' },
          { text: '🔒 隐私政策', link: '/privacy' },
          { text: '⚠️ 免责声明', link: '/disclaimer' },
        ]
      },
      {
        text: '🔗 互动与订阅', items: [
          { text: '📡 RSS订阅', link: '/feed.xml' },
          { text: '💬 留言板', link: '/guestbook' },
          { text: '🤝 友链', link: '/contact' },
          { text: '☕ 欢迎打赏', link: '/donate' },
        ]
      },
      {
        text: '⚡ 快速访问', items: [
          { text: "📋 文章清单", link: "/articles" },
          { text: "🗂️ 归档资源", link: "/archives" },
          { text: "🗃️ 文章分类", link: "/categories" },
          { text: "🏷️ 标签云", link: "/tags" }
        ]
      }
    ],

    // 导航栏社交图标：GitHub 用 VitePress 内置 mask 图标，其余为内联 SVG
    // （数据见 socialIcons.ts，由 scripts/gen-social-icons.mjs 生成）
    socialLinks: [
      { icon: 'github', link: 'https://github.com/doublenuo/Notes-Atlas' },
      { icon: { svg: zhihuIcon }, link: 'https://www.zhihu.com/people/pai-da-xiao-xing-xing-7', ariaLabel: '知乎' },
      { icon: { svg: cnbIcon }, link: 'https://cnb.cool/u/cnb.bEVjkzoyQGA', ariaLabel: 'CNB.cool' },
      { icon: { svg: emailIcon }, link: 'mailto:zwn200401@gmail.com', ariaLabel: '邮箱' },
    ],
  },
  markdown: {
    math: true,
    // 全站约 300 张图片，开启原生懒加载（img loading="lazy"），避免首屏拉取全部图片
    image: { lazyLoading: true },
    config(md) {
      // 保持 Markdown 源文件使用本地原图路径；构建时切换到 WebP，并按开关选择 COS 或本地。
      md.core.ruler.before('normalize', 'cos-webp-image-urls', (state) => {
        state.src = state.src.replace(/(\/images\/[^\s)"'<>]+)\.(png|jpe?g|webp)(?=[?#)]|[\s"'<>]|$)/gi, (_match, path) => {
          const webpPath = `${path}.webp`
          return useLocalImages || !cosImageBase ? webpPath : `${cosImageBase}${webpPath}`
        })
      })

      // Obsidian 式 ! [[]] 嵌入与 [[]] 站内链接
      // 规格：docs/superpowers/specs/2026-09-23-obsidian-embed-design.md
      obsidianEmbed(md, DOCS_ROOT)

      // 本地图片注入 width/height（构建期解析文件头），消除 CLS
      imageSizePlugin(md, join(DOCS_ROOT, 'public'))

      // 脚注：[^1] 引用 + 文末定义，生成脚注区并注入「参考资料」二级标题
      md.use(footnotes)

      // 只输出占位组件，mermaid 本体由 Mermaid.vue 在挂载时动态加载。
      // 不要改回 withMermaid：它会在 app 入口全局注册组件并静态引入 mermaid，
      // 导致每个页面都预加载约 2.8MB 的 mermaid chunk。
      const fence = md.renderer.rules.fence
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const info = token.info.trim()
        if (info === 'mermaid' || info === 'mmd') {
          return `<ClientOnly><Mermaid id="mermaid-${idx}" class="mermaid" graph="${encodeURIComponent(token.content)}" /></ClientOnly>`
        }
        return fence(tokens, idx, options, env, self)
      }
    },
  },
})
