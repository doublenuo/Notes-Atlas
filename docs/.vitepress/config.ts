import { defineConfig } from 'vitepress'

import lightbox from "vitepress-plugin-lightbox"
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'

export default defineConfig({
  lang: 'zh-CN',
  base: "/Notes-Atlas/",
  title: "NotesAtlas",
  description: "NotesAtlas",
  cleanUrls: true,
  themeConfig: {
    logo: '/static/images/logo.svg',
    outline: [2, 3],
    editLink: {
      pattern: 'https://github.com/doublenuo/Notes-Atlas/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页面'
    },
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'long',
        timeStyle: 'medium'
      }
    },

    search: {
      provider: 'local'
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
      { text: '归档资源', link: '/archive/' }
    ],

    sidebar: {

      '/meet/': [
        {
          text: '组会论文',
          // collapsed: true,
          items: [
            { text: '2025-10-20', link: '/meet/docs/20251020.md' },
            { text: '2025-10-27', link: '/meet/docs/20251027.md' },
            { text: '2025-11-11', link: '/meet/docs/20251111.md' },
            { text: '2025-11-18', link: '/meet/docs/20251118.md' },
            { text: '2025-11-25', link: '/meet/docs/20251125.md' },
            { text: '2025-12-02', link: '/meet/docs/20251202.md' },
            { text: '2025-12-09', link: '/meet/docs/20251209.md' },
            { text: '2025-12-16', link: '/meet/docs/20251216.md' },
            { text: '2025-12-23', link: '/meet/docs/20251223.md' },
            { text: '2025-12-30', link: '/meet/docs/20251230.md' },
            { text: '2026-01-06', link: '/meet/docs/20260106.md' },
            { text: '2026-01-13', link: '/meet/docs/20260113.md' },
            { text: '2026-01-20', link: '/meet/docs/20260120.md' },
            { text: '2026-02-03', link: '/meet/docs/20260203.md' },
            { text: '2026-03-08', link: '/meet/docs/20260308.md' },
            { text: '2026-03-17', link: '/meet/docs/20260317.md' },
            { text: '2026-03-23', link: '/meet/docs/20260323.md' },
            { text: '2026-03-31', link: '/meet/docs/20260331.md' },
            { text: '2026-04-08', link: '/meet/docs/20260408.md' },
            { text: '2026-04-15', link: '/meet/docs/20260415.md' },
            { text: '2026-04-22', link: '/meet/docs/20260422.md' }
          ]
        },
        {
          text: '其他论文',
          items: [
            { text: 'RoboTwin', link: '/meet/self/RoboTwin.md' }
          ]
        }
      ],

      // ==================== Study ====================
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
          text: 'Linux',
          items: [
            // { text: '首页', link: '/tools/linux/index.md' },
            // { text: '文档总览', link: '/tools/linux/docs/docs.md' },
            { text: 'Windows安装Ubuntu双系统', link: '/tools/linux/docs/dualboot.md' },
            { text: 'Ubuntu常用软件', link: '/tools/linux/docs/software.md' },
            { text: 'Ubuntu装机必备工具', link: '/tools/linux/docs/tools.md' },
            { text: 'Windows安装虚拟机', link: '/tools/linux/docs/virtual.md' },
            // { text: 'VirtualBox', link: '/tools/linux/docs/virtual-virtualbox.md' },
            // { text: 'VMware', link: '/tools/linux/docs/virtual-vmware.md' },
            { text: 'Windows安装WSL教程', link: '/tools/linux/docs/wsl.md' }
          ]
        },
        {
          text: '工具和资源',
          items: [
            { text: 'Git', link: '/tools/git.md' },
            { text: 'Docker', link: '/tools/docker.md' },
          ]
        },
        {
          text: '面试题',
          items: [
            { text: '首页', link: '/tools/interview/index.md' },
            { text: '基础', link: '/tools/interview/docs/base.md' },
            { text: 'Transformer', link: '/tools/interview/docs/transformer.md' }
          ]
        }
      ],

      // ==================== Archive ====================
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
    footer: {
      message: '📚 构建你的知识地图 · 持续学习，持续记录',
      copyright: '© 2026 NotesAtlas · Powered by VitePress'
    }
  },
  markdown: {
    math: true,
    image: {
      lazyLoading: true
    },
    config(md) {
      md.use(lightbox, {});
      md.use(footnote);
      md.use(taskLists, {
        enabled: true,
        label: true,
        labelAfter: true
      })
    }
  },
})
