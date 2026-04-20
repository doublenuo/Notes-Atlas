import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import markdownItKatex from 'markdown-it-katex';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listMarkdownFiles(relativeDir) {
  const dir = path.join(docsRoot, relativeDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
}

function toItems(relativeDir, baseRoute) {
  return listMarkdownFiles(relativeDir).map((name) => ({
    text: name.replace(/\.md$/i, ''),
    link: `${baseRoute}${name.replace(/\.md$/i, '')}`
  }));
}

export default defineConfig({
  title: 'Notes-Atlas',
  description: 'A long-term evolving knowledge base built with VitePress.',
  lang: 'zh-CN',
  base: '/',
  cleanUrls: true,
  lastUpdated: true,
  rewrites: {
    'README.md': 'index.md',
  },
  markdown: {
    config: (md) => {
      md.use(markdownItKatex);
    }
  },
  themeConfig: {
    logo: '/static/images/logo.svg',
    nav: [
      { text: '首页', link: '/' },
      { text: '论文笔记', link: '/meet/' },
      { text: '学习笔记', link: '/study/' },
      { text: '工具与资源', link: '/tools/'},
      { text: '归档资源', link: '/archive/' }
    ],
    search: {
      provider: 'local'
    },
    sidebar: {
      '/meet/': [
        {
          text: '论文笔记',
          items: toItems('meet/docs', '/meet/docs/')
        }
      ],
      '/study/': [
        {
          text: '学习导航',
          items: [
            { text: '总览', link: '/study/' },
            { text: '深度学习', link: '/study/dl/docs/transformer' },
            { text: '强化学习', link: '/study/rl/docs/overview' },
            { text: '具身智能', link: '/study/embody-ai/' },
            { text: 'ROS 系统', link: '/study/ros/docs/install' }
          ]
        }
      ],

      '/tools/': [
        {
          text: '常用工具',
          items: [
            { text: '面试资源', link: '/tools/interview/' }
          ]
        }
      ],
      '/others/': [
        {
          text: '其他资源',
          items: [{ text: '目录', link: '/others/' }, ...toItems('others/docs', '/others/docs/')]
        }
      ]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/doublenuo/Notes-Atlas' }, ],
    footer: {
      message: '持续更新的中文知识库',
      copyright:
        '© 2026 Notes-Atlas · <a href="https://github.com/doublenuo/Notes-Atlas" target="_blank" rel="noopener noreferrer">GitHub</a>'
    }
  }
});
