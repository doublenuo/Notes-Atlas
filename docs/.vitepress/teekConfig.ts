import { defineTeekConfig } from "vitepress-theme-teek/config";
import { version } from "vitepress-theme-teek/es/version";
import { categoryIcon, tagIcon, topArticleIcon, rocketIcon } from "vitepress-theme-teek/icons";

const base = "/";

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
      // 默认主题色：扩展主题色板的第一个「紫罗兰」（#7166f0）
      defaultColorName: "violet",
      defaultSpread: false,
      disabledInMobile: false,
      // 完全自定义，不使用主题内置色板：隐藏 VitePress 主题 / ElementPlus 主题两组，
      // 只显示下方的内置主题色板与扩展主题色板
      // 注意：1.5.6 该开关语义为 true=不使用内置色板（与 1.6.2 相反）
      customize: true,
      append: [
        {
          // value 沿用主题内置标识，选中后仍由主题 CSS 变量取色；此处 color 仅用于色块预览
          label: "内置主题色板",
          tip: "内置主题色板",
          options: [
            { label: "VP 预设", value: "vp-default", color: "#3451b2" },
            { label: "VP 绿", value: "vp-green", color: "#18794e" },
            { label: "VP 黄", value: "vp-yellow", color: "#915930" },
            { label: "VP 红", value: "vp-red", color: "#b8272c" },
            { label: "EP 蓝", value: "ep-blue", color: "#409eff" },
            { label: "EP 绿", value: "ep-green", color: "#67c23a" },
            { label: "EP 黄", value: "ep-yellow", color: "#e6a23c" },
            { label: "EP 红", value: "ep-red", color: "#f56c6c" },
          ],
        },
        {
          // 前 24 个与 vitepress-theme-teek 官网保持一致
          label: "扩展主题色板",
          tip: "扩展主题色板",
          options: [
            { label: "紫罗兰", value: "violet", color: "#7166f0" },
            { label: "珊瑚粉", value: "coral-pink", color: "#ff6b6b" },
            { label: "天蓝", value: "sky-blue", color: "#00bbf9" },
            { label: "蓝绿", value: "blue-green", color: "#00f5d4" },
            { label: "粉红", value: "pink", color: "#f15bb5" },
            { label: "黄绿", value: "yellow-green", color: "#8ac926" },
            { label: "橙红", value: "orange-red", color: "#ff9e6b" },
            { label: "石板灰", value: "slate-gray", color: "#708090" },
            { label: "深海蓝", value: "ocean-blue", color: "#0077be" },
            { label: "科技蓝", value: "tech-blue", color: "#0056b3" },
            { label: "靛青色", value: "indigo", color: "#4b0082" },
            { label: "炭灰色", value: "charcoal", color: "#36454f" },
            { label: "薄荷绿", value: "mint", color: "#3eb489" },
            { label: "松石绿", value: "turquoise", color: "#40e0d0" },
            { label: "橄榄绿", value: "olive-green", color: "#808000" },
            { label: "柠檬黄", value: "lemon", color: "#ffd700" },
            { label: "薰衣草", value: "lavender", color: "#967bb6" },
            { label: "玫瑰金", value: "rose-gold", color: "#b76e79" },
            { label: "豆沙红", value: "bean-paste-red", color: "#d27d7d" },
            { label: "雾霾蓝", value: "haze-blue", color: "#6699cc" },
            { label: "霓虹紫", value: "neon-purple", color: "#bc13fe" },
            { label: "极光绿", value: "aurora-green", color: "#00ff9d" },
            { label: "日落橙", value: "sunset-orange", color: "#ff7f50" },
            { label: "琥珀色", value: "amber", color: "#ffbf00" },
            // 以下为本站补充
            { label: "克莱因蓝", value: "klein-blue", color: "#3b5bdb" },
            { label: "天青蓝", value: "azure", color: "#0ea5e9" },
            { label: "冰川蓝", value: "glacier", color: "#7dd3fc" },
            { label: "孔雀蓝", value: "peacock", color: "#0891b2" },
            { label: "湖蓝", value: "lagoon", color: "#22d3ee" },
            { label: "葡萄紫", value: "grape", color: "#7c3aed" },
            { label: "丁香紫", value: "lilac", color: "#c4b5fd" },
            { label: "祖母绿", value: "emerald", color: "#10b981" },
            { label: "苔原绿", value: "moss", color: "#4d7c0f" },
            { label: "青柠绿", value: "lime", color: "#84cc16" },
            { label: "朱红", value: "vermilion", color: "#dc2626" },
            { label: "玫红", value: "rose", color: "#e11d48" },
            { label: "活力橙", value: "orange", color: "#f97316" },
            { label: "樱花粉", value: "sakura", color: "#f472b6" },
            { label: "藕荷粉", value: "dusty-rose", color: "#c08497" },
            { label: "深夜黑", value: "night", color: "#0f172a" },
            { label: "暖棕", value: "coffee", color: "#78350f" },
            { label: "黛蓝", value: "dark-navy", color: "#2c3e50" },
            { label: "胭脂", value: "rouge", color: "#a4243b" },
            { label: "蜜桃", value: "peach", color: "#ffb4a2" },
            { label: "缥碧", value: "pale-jade", color: "#8fd3b6" },
          ],
        },
      ],
    },
    spotlight: {
      disabled: false,
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
  // 风险链接提示：点击站外链接先弹提示页，确认后再跳转。
  // 对应页面 docs/@pages/riskLinkPage.md（permalink /risk-link）。
  riskLink: {
    enabled: true,
    // 白名单：命中的链接直接跳转，不做提示。
    // 判定是 href 前缀匹配（支持正则），站内邮箱、GitHub 这类高频可信来源放行。
    whitelist: ["mailto:", "https://github.com/doublenuo", "https://cnb.cool"],
    // 未设 blacklist：默认拦截所有跨域链接
  },
  author: {
    name: "doublenuo",
    link: "https://github.com/doublenuo",
  },
  banner: {
    enabled: true,
    name: "Hi, I'm weno 👋",
    bgStyle: "fullImg",
    imgSrc: ["/bg_compressed.jpg"],
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
    //     link: "/materials",
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
    name: "Weno's Blog",
    slogan: "斜杠青年 / 长期主义者 / 内向生长",
    avatar: "/tx.jpg",
    status: {
      icon: "😪",
      size: 24,
      title: "困",
    },
    shape: "circle-rotate",
    circleSize: 96,
    circleBgImg: "/bg4_compressed.jpg",
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
    splitSeparator: true,
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
      // 默认的 busuanzi 端点（busuanzi.ibruce.info）已失效（502/404），改用主题内置的 vercount
      provider: "vercount",
      siteView: true,
      pageView: true,
      // vercount 脚本加载失败时 useUvPv 会 reject 且不重置 isGet，开启重试避免整页浏览量永久失效
      tryRequest: true,
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
    {
      icon: "simple-icons:zhihu",
      name: "知乎",
      link: "https://www.zhihu.com/people/pai-da-xiao-xing-xing-7",
    },
    {
      icon: "tdesign:logo-cnb",
      name: "CNB.cool",
      link: "https://cnb.cool/u/cnb.bEVjkzoyQGA",
    },
    {
      icon: "mdi:email",
      name: "邮箱",
      link: "mailto:zwn200401@gmail.com",
    },
  ],
  footerInfo: {
    topMessage: [
      `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
          <a href="https://github.com/doublenuo" target="_blank" rel="noopener" aria-label="GitHub" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#f3f4f6;color:#1f2937;box-shadow:0 2px 6px rgba(15,23,42,0.08);text-decoration:none;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 .5A12 12 0 0 0 8.21 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.6-4.04-1.6-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.92 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6.02 0c2.29-1.55 3.29-1.23 3.29-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.82 5.61-5.5 5.9.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"/></svg>
          </a>
          <a href="/feed.xml" aria-label="RSS" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#f3f4f6;color:#1f2937;box-shadow:0 2px 6px rgba(15,23,42,0.08);text-decoration:none;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6.18 15.65A2.18 2.18 0 1 1 6.18 19a2.18 2.18 0 0 1 0-3.35Zm-3.34-7.85c.74 0 1.47.1 2.17.3A12.73 12.73 0 0 1 19.8 17.82c.2.7.3 1.43.3 2.18h-3.39a9.28 9.28 0 0 0-9.19-9.18V8.05c-.23 0-.47 0-.71.02a15.03 15.03 0 0 0-.14-1.16c.36-.08.72-.12 1.07-.12Zm0-5.1c2.86 0 5.61.57 8.1 1.68a19.06 19.06 0 0 1 12.06 12.08c1.1 2.47 1.67 5.22 1.67 8.08H20.98c0-1.94-.4-3.83-1.18-5.56A15.63 15.63 0 0 0 8.5 6.65 16 16 0 0 0 2.84 2.7V2.7Z"/></svg>
          </a>
          <a href="mailto:zwn200401@gmail.com" aria-label="Email" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#f3f4f6;color:#1f2937;box-shadow:0 2px 6px rgba(15,23,42,0.08);text-decoration:none;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm2.08-.25 6.92 5.14 6.92-5.14H5.08Zm13.17 1.5-6.06 4.5a1 1 0 0 1-1.18 0L5.75 8l-.75.75v8.5c0 .41.34.75.75.75h12.5c.41 0 .75-.34.75-.75v-8.5l-.75-.75Z"/></svg>
          </a>
          <a href="/about" aria-label="About" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#f3f4f6;color:#1f2937;box-shadow:0 2px 6px rgba(15,23,42,0.08);text-decoration:none;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2.75A9.25 9.25 0 1 1 2.75 12 9.26 9.26 0 0 1 12 2.75Zm.22 5.81a1.59 1.59 0 0 0-1.59 1.59v.13a1.59 1.59 0 0 0 1.59 1.59h.13a1.59 1.59 0 0 0 1.59-1.59v-.13a1.59 1.59 0 0 0-1.59-1.59Zm-1.02 6.2h2.6v6.09h-2.6Z"/></svg>
          </a>
        </div>
        <img src="/animals.png" alt="animals" style="display:block;width:120px;height:auto;border-radius:14px;box-shadow:0 10px 24px rgba(15,23,42,0.08);margin:0 auto;" />
      </div>
      `,
    ],
    theme: {
      show: true,
      name: `Theme By Teek@${version}`,
      link: "https://github.com/Kele-Bingtang/vitepress-theme-teek"
    },
    copyright: {
      show: true,
      createYear: 2025,
      suffix: "Weno's Blog",
    },
    icpRecord: {
      name: "赣ICP备2026011923号",
      link: "http://beian.miit.gov.cn/",
    },
    // 与备案信息同一行、紧跟备案信息的 Powered by VitePress（含小图标）
    customHtml: `<a href="https://vitepress.dev/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="vertical-align:-0.15em;" aria-hidden="true"><path d="M17.029.001a2 2 0 0 0-.187.018L4.085 1.833A1.86 1.86 0 0 0 2.518 3.94l2.56 18.457a1.846 1.846 0 0 0 2.08 1.586l12.757-1.816a1.86 1.86 0 0 0 1.567-2.106l-2.56-18.455A1.85 1.85 0 0 0 17.029 0m.127.932a.926.926 0 0 1 .853.8l2.56 18.458a.93.93 0 0 1-.782 1.053L7.03 23.058a.92.92 0 0 1-1.04-.793L3.43 3.81a.93.93 0 0 1 .783-1.053L16.97.941a1 1 0 0 1 .186-.008m-3.644 5.354L9.967 7.521a.136.136 0 0 0-.09.141l.318 3.87c.008.09.1.149.184.116l.982-.378a.136.136 0 0 1 .184.136l-.09 1.54c-.006.103.1.176.193.132l.6-.281c.093-.044.198.03.192.135l-.147 2.418c-.01.15.195.203.258.066l.04-.092L14.716 8.9c.035-.107-.066-.21-.172-.173l-1.018.351c-.095.033-.191-.049-.177-.15l.343-2.49a.137.137 0 0 0-.142-.157c-.016 0-.042.009-.037.006zm2.822.799a.3.3 0 0 0-.08.014L14 7.85l-.076.56l.455-.156a.636.636 0 0 1 .81.803l-2.13 6.449l-.053.117a.64.64 0 0 1-.738.352a.64.64 0 0 1-.473-.657l.11-1.808a.638.638 0 0 1-.948-.594l.057-.976l-.454.175a.64.64 0 0 1-.863-.543L9.453 8.6l-3.062-.123c-.23-.01-.364.255-.223.44l6.29 8.23a.27.27 0 0 0 .468-.069l3.668-9.619a.275.275 0 0 0-.26-.373"/></svg>Powered by VitePress</a>`,
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
      "**/01.组会材料/组会pptx/**",
      // 与 config.ts 的 srcExclude 配套：FileContentLoader 是独立 glob 扫描、不认 srcExclude，
      // 不加此条则 superpowers 页仍进归档/最近更新清单，而页面已不生成 → 死链
      "**/01.组会材料/03.pdfs/**",
      "**/superpowers/**"
    ],
    // teek 的 sidebar 插件（vitepress-plugin-sidebar-resolve）按**磁盘目录名**生成
    // sidebar 键。config.ts 已改用 VitePress 原生 rewrites 把页面 URL 换成 permalink，
    // 两者对不上会让全站侧边栏变空白，故关掉，改由 config.ts 的 buildSidebar 生成。
    sidebar: false,
    sidebarOption: {
      initItems: false,
      // 注意：插件按「目录/文件原始名」精确匹配（或正则），不是路径，
      // 所以要写磁盘上的真实目录名（含序号前缀）
      ignoreList: ["03.pdfs", "04. 组会pptx"],
    },
    // 同理：Proxy 模式的 permalink 插件会在客户端把 /materials/meet/20260929 改写回磁盘源路径，
    // 而 rewrites 产出的 HTML 只存在于 permalink 路径，会造成 404，故一并关掉。
    permalink: false,
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
