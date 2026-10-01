import { defineConfig } from 'vitepress'

import { teekConfig } from './teekConfig'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { createRewrites } from 'vitepress-plugin-permalink'
import { fileURLToPath } from 'node:url'
import { obsidianEmbed } from '../../admin/server/shared/obsidianEmbed.js'
import { docAnalysisEmbed } from './plugins/docAnalysisEmbed'

const DOCS_ROOT = fileURLToPath(new URL('..', import.meta.url))

export default withMermaid(defineConfig({
  extends: teekConfig,
  lang: 'zh-CN',
  base: "/",
  title: "NotesAtlas",
  description: "NotesAtlas",
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
    // 预连接外部资源，减少 DNS/TLS 握手延迟
    ['link', { rel: 'preconnect', href: 'https://www.googletagmanager.com', crossorigin: 'anonymous' }],
    ['link', { rel: 'preconnect', href: 'https://www.google-analytics.com', crossorigin: 'anonymous' }],
    ['link', { rel: 'preconnect', href: 'https://busuanzi.ibruce.info', crossorigin: 'anonymous' }],
    ['link', { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: 'anonymous' }],
    // 内联 @page 规则：直接写入 HTML <head>，避免外部 CSS 打包顺序导致 Chrome headless 忽略
    ['style', { type: 'text/css' }, '@page { size: A4; margin: 15mm; }'],
  ],
  cleanUrls: true,
  srcExclude: ["superpowers/**"],
  // 用 frontmatter 的 permalink 作为实际构建路径（如 /meet/20260929）。
  // 不配这一项，permalink 会被静默忽略：产物里没有该路径、站内也无链接指向它，
  // 这类地址靠 SPA 路由"看起来能开"，一刷新就 404。
  // ignoreList 必须排除 superpowers/**：其中的文档含用于测试的非法 frontmatter
  // 片段（如 title: [未闭合），插件用 gray-matter 解析会抛异常导致构建失败。
  rewrites: createRewrites({ path: 'docs', ignoreList: ['superpowers'] }),
  // 打包构建优化
  vite: {
    // 文档分析(字数/阅读时长)按嵌入展开后重算,覆盖 doc-analysis 的原始源码口径
    plugins: [docAnalysisEmbed()],
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
      { text: '论文笔记', link: '/meet/' },
      { text: '学习笔记', link: '/study/' },
      { text: '工具和资源', link: '/tools/' },
      {
        text: '快速访问', items: [
          {
            text: "文章清单", link: "/articles"
          },
          {
            text: "归档资源", link: "/archives"
          },
          {
            text: "文章分类", link: "/categories"
          },
          {
            text: "标签云", link: "/tags"
          }
        ]
      }
    ],

    sidebar: {
      '/linux/': [
        {
          text: 'Linux',
          items: [
            { text: '首页', link: '/linux/index.md' },
            { text: '文档总览', link: '/linux/docs/docs.md' },
            { text: '双系统', link: '/linux/docs/dualboot.md' },
            { text: '软件', link: '/linux/docs/software.md' },
            { text: '工具', link: '/linux/docs/tools.md' },
            { text: '虚拟化', link: '/linux/docs/virtual.md' },
            { text: 'VirtualBox', link: '/linux/docs/virtual-virtualbox.md' },
            { text: 'VMware', link: '/linux/docs/virtual-vmware.md' },
            { text: 'WSL', link: '/linux/docs/wsl.md' }
          ]
        }
      ],
      '/meet/': [
        {
          text: '组会记录',
          collapsed: true,
        },
        {
          text: '其他论文',
          items: [
            { text: 'RoboTwin', link: '/meet/self/RoboTwin.md' }
          ]
        }
      ],
      '/study/': [
        {
          text: '深度学习 (DL)',
          collapsed: true,
          items: [
            { text: '首页', link: '/study/dl/index.md' },
            { text: 'Transformer', link: '/study/dl/docs/transformer.md' },
            { text: '线性回归', link: '/study/dl/docs/linear model/linear regression.md' },
            { text: 'Softmax 回归', link: '/study/dl/docs/linear model/softmax regression.md' }
          ]
        },

        {
          text: '强化学习 (RL)',
          collapsed: true,
          items: [
            { text: '首页', link: '/study/rl/index.md' },
            { text: '概述', link: '/study/rl/docs/overview.md' },
            { text: 'REINFORCE', link: '/study/rl/docs/reinforce.md' },
            { text: 'Actor-Critic', link: '/study/rl/docs/actor-critic.md' },
            { text: '模仿学习', link: '/study/rl/docs/imitate-learning.md' }
          ]
        },

        {
          text: 'ROS',
          collapsed: true,
          items: [
            { text: '首页', link: '/study/ros/index.md' },
            { text: '安装', link: '/study/ros/docs/install.md' },
            { text: '常用命令', link: '/study/ros/docs/command.md' }
          ]
        },

        {
          text: '具身智能',
          items: [
            { text: '首页', link: '/study/embody-ai/index.md' }
          ]
        }
      ],
      '/tools/': [
        {
          text: '工具和资源',
          items: [
            { text: 'Git', link: '/tools/git.md' }
          ]
        },
        {
          text: '面试',
          collapsed: true,
          items: [
            { text: '首页', link: '/tools/interview/index.md' },
            { text: '基础', link: '/tools/interview/docs/base.md' },
            { text: 'Transformer', link: '/tools/interview/docs/transformer.md' }
          ]
        }
      ],
      '/archive/': [
        {
          text: '归档资源',
          items: [
            { text: '首页', link: '/archive/index.md' },
            { text: 'LLM API Key', link: '/archive/docs/llm-api-key.md' }
          ]
        }
      ]
    },
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

