import { defineTeekConfig } from "vitepress-theme-teek/config";
import { version } from "vitepress-theme-teek/es/version";
import { categoryIcon, tagIcon, topArticleIcon, rocketIcon } from "vitepress-theme-teek/icons";

const base = "/Notes-Atlas";

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
  loading: "拼命加载中...",
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
      append: [
        {
          label: "博客扩展主题",
          tip: "博客扩展主题",
          options: [
            { label: "深海蓝", value: "deep-blue", color: "#1e3a8a" },
            { label: "科技蓝", value: "tech-blue", color: "#2563eb" },
            { label: "天空蓝", value: "sky-blue", color: "#38bdf8" },
            { label: "紫罗兰", value: "violet", color: "#7166f0" },
            { label: "深紫", value: "deep-purple", color: "#5b21b6" },
            { label: "薰衣草紫", value: "lavender", color: "#a78bfa" },
            { label: "祖母绿", value: "emerald", color: "#10b981" },
            { label: "薄荷绿", value: "mint", color: "#2dd4bf" },
            { label: "青色", value: "cyan", color: "#06b6d4" },
            { label: "珊瑚橙", value: "coral", color: "#fb7185" },
            { label: "活力橙", value: "orange", color: "#f97316" },
            { label: "琥珀", value: "amber", color: "#f59e0b" },
            { label: "玫红", value: "rose", color: "#e11d48" },
            { label: "樱花粉", value: "sakura", color: "#f472b6" },
            { label: "石墨灰", value: "graphite", color: "#374151" },
            { label: "深夜黑", value: "night", color: "#0f172a" }
          ]
        }
      ]
    },
    spotlight: {
      defaultStyle: "aside",
      defaultValue: true,
    },
  },
  comment: {
    provider: "giscus",
    options: {
      repo: "doublenuo/Notes-Atlas",
      repoId: "R_kgDOR25XhQ",
      category: "General",
      categoryId: "DIC_kwDOR25Xhc4C7Vch",
      lang: "zh-CN",
    }
  },
  // appreciation: {
  //   position: "doc-after-popper",
  //   options: {
  //     icon: "weChatPay",
  //     title: "打赏支持",
  //     content: `<img src='/teek-logo-large.png'>`,
  //   },
  // },
  author: {
    name: "doublenuo",
    link: "https://github.com/doublenuo",
  },
  banner: {
    enabled: true,
    name: "Hi, I'm weno 👋",
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
      "写下来，是为了更好地理解",
      "构建自己的知识索引，而不是依赖记忆",
      "长期主义者",
    ],
    typesInTime: 100,
    typesOutTime: 50,
    typesNextTime: 1200,
    // features: [
    //   {
    //     title: "结构化入口",
    //     details: "通过分区首页、目录、分类和侧边栏快速定位内容",
    //     link: "/study/",
    //   },
    //   {
    //     title: "持续沉淀",
    //     details: "围绕论文、课程和工具链持续建立可回顾的知识脉络",
    //     link: "/meet/",
    //   },
    //   {
    //     title: "工程复用",
    //     details: "把零散记录沉淀为后续检索、复习和分享都能复用的资产",
    //     link: "/tools/",
    //   },
    // ],
  },
  wallpaper: {
    enabled: true,
    hideBanner: false,
    hideMask: false,
  },
  blogger: {
    name: "小诺同学",
    slogan: "斜杠青年 / 长期主义者 / 内向生长",
    avatar: "/atavar.jpg",
    status: {
      icon: "😪",
      size: 24,
      title: "困",
    },
    shape: "circle-rotate",
    circleSize: 96,
    circleBgImg: "/bg4.png",
    circleBgMask: true,
    color: "#ffffff",
  },
  topArticle: {
    enabled: true,
    title: topArticleIcon + "精选文章",
    emptyLabel: "暂无精选文章",
    limit: 5,
    autoPage: false,
    pageSpeed: 4000,
    dateFormat: "yyyy-MM-dd hh:mm:ss",
  },
  category: {
    enabled: true,
    path: "/categories",
    pageTitle: categoryIcon + "全部分类",
    homeTitle: categoryIcon + "文章分类",
    moreLabel: "更多 ...",
    emptyLabel: "暂无分类",
    limit: 8,
    autoPage: false,
    pageSpeed: 4000,
  },
  tagColor: [
    { border: "#bfdbfe", bg: "#eff6ff", text: "#2563eb" },
    { border: "#e9d5ff", bg: "#faf5ff", text: "#9333ea" },
    { border: "#fbcfe8", bg: "#fdf2f8", text: "#db2777" },
    { border: "#a7f3d0", bg: "#ecfdf5", text: "#059669" },
    { border: "#fde68a", bg: "#fffbeb", text: "#d97706" },
    { border: "#a5f3fc", bg: "#ecfeff", text: "#0891b2" },
    { border: "#c7d2fe", bg: "#eef2ff", text: "#4f46e5" },
  ],
  tag: {
    enabled: true,
    path: "/tags",
    pageTitle: tagIcon + "全部标签",
    homeTitle: tagIcon + "常用标签",
    moreLabel: "更多 ...",
    emptyLabel: "暂无标签",
    limit: 24,
  },
  friendLink: {
    // https://vp.teek.top/reference/card-config.html#friendlink
    enabled: true,
    emptyLabel: "暂无友情链接",
    limit: 5,
    autoScroll: false,
    scrollSpeed: 2500,
    autoPage: false,
    pageSpeed: 4000,
  },
  post: {
    postStyle: "list",
    excerptPosition: "top",
    showMore: true,
    moreLabel: "阅读全文 >",
    emptyLabel: "暂无文章",
    coverImgMode: "full",
    showCapture: true,
    splitSeparator: tru e,
    transition: true,
    transitionName: "tk-slide-fade",
    listStyleTitleTagPosition: "right",
    cardStyleTitleTagPosition: "left",
    defaultCoverImg: [],
  },
  page: {
    pageSize: 12,
    pagerCount: 6,
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
      siteView: true,
      pageView: true,
      tryRequest: false,
      tryCount: 5,
      tryIterationTime: 2000,
      permalink: true,
    },
  },
  social: [
    {
      icon: "mdi:github",
      name: "GitHub",
      link: "https://github.com/doublenuo/Notes-Atlas",
    },
  ],
  footerGroup: [
    {
      title: "关于",
      links: [
        { name: "关于本站", link: base + "/about" },
        { name: "隐私政策", link: base + "/privacy" },
        { name: "免责声明", link: base + "/disclaimer" },
        { name: "赞助支持", link: base + "/sponsor" },
      ],
    },
    {
      title: "内容",
      links: [
        { name: "论文笔记", link: base + "/meet/" },
        { name: "深度学习", link: base + "/study/dl" },
        { name: "强化学习", link: base + "/study/rl" },
        { name: "ROS", link: base + "/study/ros" },
      ],
    },
    {
      title: "导航",
      links: [
        { name: "标签页", link: base + "/tags" },
        { name: "文章清单", link: base + "/articles" },
        { name: "归档资源", link: base + "/archives" },
        { name: "文章分类", link: base + "/categories" }
      ],
    },
    {
      title: "联系",
      links: [
        { name: "GitHub", link: "https://github.com/doublenuo" },
        { name: "邮箱", link: "mailto:zwn200401@gmail.com" },
        { name: "友链", link: base + "/links" },
      ],
    },
  ],
  footerInfo: {
    topMessage: ["专注内容沉淀，而不是重复找资料"],
    theme: {
      show: true,
      name: `Theme By Teek@${version}`,
      link: "https://github.com/Kele-Bingtang/vitepress-theme-teek"
    },
    copyright: {
      show: true,
      createYear: 2025,
      suffix: "NotesAtlas",
    },
    icpRecord: {
      name: "",
      link: "http://beian.miit.gov.cn/",
    },
    bottomMessage: "Powered by <a href='https://vitepress.dev/' target='_blank'>VitePress</a>",
  },
  codeBlock: {
    copiedDone: (TkMessage) => TkMessage.success("复制成功！"),
  },
  articleAnalyze: {
    showIcon: true,
    dateFormat: "yyyy-MM-dd hh:mm:ss",
    dateUTC: true,
    showInfo: true,
    showAuthor: true,
    showCreateDate: true,
    showUpdateDate: false,
    showCategory: true,
    showTag: false,
  },
  articleShare: {
    enabled: true,
    text: "分享此页面",
    copiedText: "链接已复制",
    query: false,
    hash: false,
  },
  articleUpdate: {
    enabled: true,
    limit: 3,
  },
  breadcrumb: {
    enabled: true,
    showCurrentName: false,
    separator: "/",
    homeLabel: "首页",
  },
  vitePlugins: {
    autoFrontmatter: true,
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
    fileContentLoaderIgnore: [
      "**/index.md",
      "**/sidebar.md",
      "**/navbar.md",
      "01.组会材料/论文pptx/"
    ],
    sidebar: true,
    sidebarOption: {
      initItems: false,
      ignoreList: ["01.组会材料/论文pptx/"],
    },
    permalink: true,
  },
  siteAnalytics: [
    {
      provider: "google",
      options: {
        id: "G-PZ87T8HLZJ"
      }
    }
  ]
});
