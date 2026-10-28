import { defineConfig } from 'vitepress'

import { teekConfig } from './teekConfig'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { fileURLToPath } from 'node:url'
import { collectPages, buildRewrites, buildSidebar } from './permalinks'
import { obsidianEmbed } from './plugins/obsidianEmbed.js'
import { docAnalysisEmbed } from './plugins/docAnalysisEmbed'
import { seo, buildHead } from './plugins/seo'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site'

const DOCS_ROOT = fileURLToPath(new URL('..', import.meta.url))

// 有 permalink 的用它；没有的用文档标题派生 slug。详见 ./permalinks.ts
const PAGES = collectPages(DOCS_ROOT)

export default withMermaid(defineConfig({
  extends: teekConfig,
  lang: 'zh-CN',
  base: process.env.VITEPRESS_BASE ?? "/",
  title: SITE_NAME,
  titleTemplate: `:title | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
    // 预连接外部资源，减少 DNS/TLS 握手延迟
    ['link', { rel: 'preconnect', href: 'https://www.googletagmanager.com', crossorigin: 'anonymous' }],
    ['link', { rel: 'preconnect', href: 'https://www.google-analytics.com', crossorigin: 'anonymous' }],
    ['link', { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: 'anonymous' }],
    // 内联 @page 规则：直接写入 HTML <head>，避免外部 CSS 打包顺序导致 Chrome headless 忽略
    ['style', { type: 'text/css' }, '@page { size: A4; margin: 15mm; }'],
  ],
  // canonical / og / twitter / description。buildHead 复用 permalinks 的 URL 体系，
  // 保证 permalink 页的 og:url 与实际地址一致（plugins 里的 transformHead 不会被 VitePress 调用）
  transformHead: ({ pageData }) => buildHead(pageData, SITE_URL, DOCS_ROOT),
  cleanUrls: true,
  rewrites: buildRewrites(PAGES),
  srcExclude: ["superpowers/**"],
  // 打包构建优化
  vite: {
    // 文档分析(字数/阅读时长)按嵌入展开后重算,覆盖 doc-analysis 的原始源码口径
    plugins: [
      docAnalysisEmbed(),
      seo({ siteUrl: SITE_URL }),
      // vitepress-plugin-mermaid 会把 mermaid 的传递依赖硬编码进 optimizeDeps.include，
      // 其中 debug 是旧版 mermaid 的依赖，mermaid 11 已不再使用、依赖树里不存在，
      // 导致 dev 启动时反复报 "Failed to resolve dependency: debug"。这里从 include 中剔除。
      {
        name: 'drop-stale-mermaid-dep',
        config(config) {
          const include = config.optimizeDeps?.include
          if (Array.isArray(include)) {
            config.optimizeDeps.include = include.filter((id) => id !== 'debug')
          }
        },
      },
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
            if (id.includes('node_modules/mermaid')) return 'mermaid'
            if (id.includes('node_modules/mathjax')) return 'mathjax'
            if (id.includes('node_modules/@giscus')) return 'giscus'
            if (id.includes('node_modules/monaco')) return 'monaco'
          },
          // 资源文件命名
          chunkFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
      // 内联小资源，减少 HTTP 请求
      assetsInlineLimit: 4096,             // 4KB 以下资源内联为 base64
      chunkSizeWarningLimit: 3000,         // mermaid/mathjax 等大依赖已手动分割，无需警告
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
    logo: '/favicon.svg',
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
    search: {
      provider: 'local',
      // provider: 'algolia',
      // options: {
      //   appId: 'QG9ZLZ5K7X',
      //   apiKey: 'd9c8b1e5c0a7f2b3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5',
      //   indexName: 'notes-atlas',
      //   placeholder: '搜索文档...',
      // }
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    nav: [
      { text: '首页', link: '/' },
      // 全站已统一走 permalink（见 ./permalinks.ts），这些前缀都由真实页面提供。
      // 组会材料分区下三类内容：/materials/meet/* 组会记录、
      // /materials/paper/* 论文笔记、/materials/reproduction/* 论文复现。
      { text: '组会材料', link: '/materials' },
      { text: '学习笔记', link: '/study' },
      { text: '工具和资源', link: '/tools' },
      {
        text: '快速访问', items: [
          { text: "文章清单", link: "/articles" },
          { text: "归档资源", link: "/archives" },
          { text: "文章分类", link: "/categories" },
          { text: "标签云", link: "/tags" }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/doublenuo/Notes-Atlas' }
    ],
  },
  markdown: {
    math: true,
    config(md) {
      // Obsidian 式 ! [[]] 嵌入与 [[]] 站内链接
      // 规格：docs/superpowers/specs/2026-09-23-obsidian-embed-design.md
      obsidianEmbed(md, DOCS_ROOT)
    },
  },
}))
