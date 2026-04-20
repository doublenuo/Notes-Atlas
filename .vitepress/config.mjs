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
  lastUpdated: false,
  rewrites: {
    'README.md': 'index.md',
    'meet/README.md': 'meet/index.md',
    'study/README.md': 'study/index.md',
    'linux-install/README.md': 'linux-install/index.md'
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
      { text: 'Linux 安装', link: '/linux-install/' },
      { text: '面试', link: '/interview/' },
      { text: '其他资源', link: '/others/' }
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
      '/linux-install/': [
        {
          text: 'Linux 安装教程',
          items: [
            { text: '目录', link: '/linux-install/' },
            { text: '双系统安装', link: '/linux-install/dualboot' },
            { text: '虚拟机安装 (VirtualBox)', link: '/linux-install/virtual-virtualbox' },
            { text: '虚拟机安装 (VMware)', link: '/linux-install/virtual-vmware' },
            { text: 'WSL 安装', link: '/linux-install/wsl' },
            { text: '装机必备工具', link: '/linux-install/tools' }
          ]
        }
      ],
      '/interview/': [
        {
          text: '面试',
          items: toItems('interview/docs', '/interview/docs/')
        }
      ],
      '/others/': [
        {
          text: '其他资源',
          items: [{ text: '目录', link: '/others/' }, ...toItems('others/docs', '/others/docs/')]
        }
      ]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/doublenuo/Notes-Atlas' }]
  }
});

