import { defineTeekConfig } from "vitepress-theme-teek/config";
import { version } from "vitepress-theme-teek/es/version";

const formatNumericTitle = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (/^\d{8}$/.test(text)) {
    return text.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  }
  return text;
};

export const teekConfig = defineTeekConfig({
  teekTheme: true,
  teekHome: true,
  vpHome: true,
  loading: true,
  anchorScroll: true,
  sidebarTrigger: true,
  pageStyle: "default",
  themeSize: "default",
  homeCardListPosition: "right",
  homeCardSort: ["topArticle", "category", "tag", "friendLink", "docAnalysis"],
  viewTransition: {
    enabled: true,
    mode: "out-in",
    duration: 400,
    easing: "ease-in-out",
  },
  themeEnhance: {
    enabled: true,
    position: "top",
    layoutSwitch: {
      defaultMode: "bothWidthAdjustable",
      defaultDocMaxWidth: 88,
      defaultPageMaxWidth: 94,
    },
    themeColor: {
      defaultColorName: "vp-default",
      defaultSpread: true,
    },
    spotlight: {
      defaultStyle: "aside",
      defaultValue: true,
    },
  },
  author: {
    name: "doublenuo",
    link: "https://github.com/doublenuo",
  },
  banner: {
    enabled: true,
    name: "NotesAtlas",
    bgStyle: "fullImg",
    imgSrc: ["/bg.png"],
    imgWaves: true,
    mask: true,
    maskBg: "rgba(15, 23, 42, 0.55)",
    textColor: "#f8fafc",
    titleFontSize: "3.4rem",
    descFontSize: "1.1rem",
    descStyle: "types",
    description: [
      "把论文、学习与工具资料整理成可复用的知识地图。",
      "围绕机器人、具身智能、深度学习与工程实践持续积累。",
      "从碎片记录走向结构化归档，降低检索、回顾与复用成本。",
    ],
    typesInTime: 100,
    typesOutTime: 50,
    typesNextTime: 1200,
    features: [
      {
        title: "结构化入口",
        details: "通过分区首页、目录、分类和侧边栏快速定位内容",
        link: "/study/",
      },
      {
        title: "持续沉淀",
        details: "围绕论文、课程和工具链持续建立可回顾的知识脉络",
        link: "/meet/",
      },
      {
        title: "工程复用",
        details: "把零散记录沉淀为后续检索、复习和分享都能复用的资产",
        link: "/tools/",
      },
    ],
  },
  wallpaper: {
    enabled: false,
    hideBanner: false,
    hideMask: false,
  },
  blogger: {
    name: "NotesAtlas",
    slogan: "把短期输入沉淀成长期可复用的知识地图。",
    avatar: "/favicon.svg",
    shape: "circle",
    circleSize: 96,
    color: "#ffffff",
  },
  topArticle: {
    enabled: true,
    title: "${icon}最近内容",
    emptyLabel: "暂无文章",
    limit: 6,
  },
  category: {
    enabled: true,
    path: "/categories",
    pageTitle: "${icon}全部分类",
    homeTitle: "${icon}内容分类",
    moreLabel: "更多 ...",
    emptyLabel: "暂无分类",
    limit: 8,
  },
  tag: {
    enabled: true,
    path: "/tags",
    pageTitle: "${icon}全部标签",
    homeTitle: "${icon}常用标签",
    moreLabel: "更多 ...",
    emptyLabel: "暂无标签",
    limit: 24,
  },
  friendLink: {
    enabled: true,
    title: "${icon}相关资源",
    emptyLabel: "暂无相关链接",
    limit: 5,
    list: [
      {
        name: "GitHub",
        desc: "站点源码仓库",
        avatar: "/favicon.svg",
        link: "https://github.com/doublenuo/Notes-Atlas",
      },
      {
        name: "VitePress",
        desc: "静态文档站点生成器",
        avatar: "https://vitepress.dev/vitepress-logo-mini.svg",
        link: "https://vitepress.dev/",
      },
      {
        name: "Teek Theme",
        desc: "当前使用的 VitePress 主题",
        avatar: "https://vp.teek.top/teek-logo-mini.svg",
        link: "https://vp.teek.top/",
      },
    ],
  },
  post: {
    postStyle: "list",
    excerptPosition: "top",
    showMore: true,
    moreLabel: "阅读全文 >",
    emptyLabel: "暂无文章",
    coverImgMode: "full",
    showCapture: true,
    splitSeparator: false,
    transition: true,
    transitionName: "tk-slide-fade",
    listStyleTitleTagPosition: "right",
    cardStyleTitleTagPosition: "left",
    defaultCoverImg: [],
  },
  page: {
    pageSize: 12,
    pagerCount: 7,
    layout: "prev, pager, next, jumper, ->, total",
    size: "default",
    background: false,
    hideOnSinglePage: false,
  },
  docAnalysis: {
    enabled: true,
    createTime: "2025-10-20",
    wordCount: true,
    readingTime: true,
    statistics: {
      provider: "busuanzi",
    },
  },
  social: [
    {
      icon: "github",
      name: "GitHub",
      link: "https://github.com/doublenuo/Notes-Atlas",
    },
  ],
  footerInfo: {
    topMessage: "专注内容沉淀，而不是重复找资料",
    theme: {
      name: `Theme By Teek@${version}`,
    },
    copyright: {
      createYear: 2025,
      suffix: "NotesAtlas",
    },
    bottomMessage: "Powered by VitePress",
  },
  codeBlock: {
    copiedDone: (TkMessage) => TkMessage.success("复制成功！"),
  },
  articleAnalyze: {
    enabled: true,
    wordCount: true,
    readingTime: true,
    showInfo: true,
  },
  articleShare: {
    enabled: true,
  },
  articleUpdate: {
    enabled: true,
    limit: 6,
  },
  breadcrumb: {
    enabled: true,
  },
  vitePlugins: {
    autoFrontmatter: true,
    fileContentLoaderIgnore: [
      "**/index.md",
      "**/sidebar.md",
      "**/navbar.md",
    ],
    autoFrontmatterOption: {
      categories: true,
      coverImg: false,
      permalink: true,
      transform(frontmatter) {
        if (frontmatter.title !== undefined) {
          return {
            title: formatNumericTitle(frontmatter.title),
          };
        }
      },
    },
    sidebarOption: {
      initItems: false,
      ignoreList: ["**/论文pptx/**"],
    }
  },
});
