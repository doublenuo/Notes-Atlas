import Teek, { teekConfigContext, TkMessage, usePosts, useTeekConfig } from "vitepress-theme-teek";
import type { TeekConfig } from "vitepress-theme-teek";
import ThemeConfig, { type ChangeType } from "./components/ThemeConfig.vue";
import NotFound from "./components/404.vue";
import { useRibbon } from "./composables/useRibbon";

import { defineComponent, defineAsyncComponent, provide, h, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import "vitepress-theme-teek/index.css";
import "vitepress-theme-teek/theme-chalk/tk-code-block-mobile.css"; // 移动端代码块样式优化
import "vitepress-theme-teek/theme-chalk/tk-sidebar.css"; // 侧边栏优化
import "vitepress-theme-teek/theme-chalk/tk-nav.css"; // 导航栏优化
import "vitepress-theme-teek/theme-chalk/tk-aside.css"; // 右侧目栏录文字悬停和激活样式
import "vitepress-theme-teek/theme-chalk/tk-doc-h1-gradient.css"; // 一级标题渐变色
import "vitepress-theme-teek/theme-chalk/tk-table.css"; // 表格样式调整，去掉单元格之间的线条
import "vitepress-theme-teek/theme-chalk/tk-mark.css"; // <mark></mark> 样式
import "vitepress-theme-teek/theme-chalk/tk-blockquote.css"; // > 引用块样式
import "vitepress-theme-teek/theme-chalk/tk-index-rainbow.css"; // 首页图片彩虹动画
import "vitepress-theme-teek/theme-chalk/tk-banner-desc-gradient.css"; // 博客风格 Banner 描述渐变样式
import "vitepress-theme-teek/theme-chalk/tk-home-card-hover.css"; // 首页卡片悬停效果
import "vitepress-theme-teek/theme-chalk/tk-fade-up-animation.css"; // 首次加载的动画效果
import "katex/dist/katex.min.css"; // 数学公式（构建期 KaTeX 输出，字体由 Vite 自托管）
import ArticleExportPdf from "./components/ArticleExportPdf.vue";
import ArticleSponsor from "./components/ArticleSponsor.vue";
import MomentsTimeline from "./components/MomentsTimeline.vue";
import FriendLinksPage from "./components/FriendLinksPage.vue";
import GuestbookPage from "./components/GuestbookPage.vue";
import RiskLinkPage from "./components/RiskLinkPage.vue";
import ScrollDownArrow from "./components/ScrollDownArrow.vue";
import ReloadPrompt from "./components/ReloadPrompt.vue";

import { useData, useRoute } from "vitepress";

// 贡献图（含 echarts）只在归档页的 slot 渲染时才拉取对应 chunk，避免全站预加载 ~365KB gzip
const ContributeChart = defineAsyncComponent(() => import("./components/ContributeChart.vue"));

import "./styles/code-bg.scss";
import "./styles/theme-color.scss"; // 主题色板区块：对齐 teek 官网观感（色块不带文字）
import "./styles/homepage.scss";
import "./styles/home-card.scss";
import "./styles/fonts.scss"; // 字体栈显式化与中文排版（须在主题 CSS 之后）
import "./styles/search.scss"; // Pagefind 搜索按钮与导航栏样式对齐
// MiSans VF 标题子集（只覆盖标题/品牌用字，正文走系统中文栈）
import "./fonts/misans/MiSans-Heading.css";
import "./styles/iframe.scss";
import "./styles/embed.scss";
import "./styles/image.scss";
import "./styles/math.scss"; // KaTeX 公式横向滚动/打印修正（须在 katex.min.css 之后）
import "./styles/banner-mobile.scss"; // 手机端首页 Banner 网格壁纸变换（须在主题 CSS 之后）
import "./styles/banner-feature-card.scss"; // 首页 Banner 特性区卡片化（须在主题 CSS 之后）
import "./styles/mobile-home.scss"; // 手机端首页/分类/标签/归档：信息密度与响应式布局（须在主题 CSS 之后）
import "./styles/print.scss"; // 打印样式：导出 PDF 时只输出正文（须在主题 CSS 之后）

export default {
  extends: Teek,
  enhanceApp({ app }) {
    // mermaid 只在真正出现图表时加载，避免全站每页预加载 2.8MB
    app.component("Mermaid", defineAsyncComponent(() => import("./components/Mermaid.vue")));
  },
  Layout: defineComponent({
    name: "LayoutProvider",
    setup() {
      const { isDark, page } = useData();
      const route = useRoute();
      // 右上角设置面板 →「主题配置」区块：通过 teekConfigContext 做运行时主题配置覆盖
      const teekConfig = ref<TeekConfig>({});
      provide(teekConfigContext, teekConfig);
      const { getTeekConfig } = useTeekConfig();

      // 首页卡片栏「精选文章」「友情链接」按有无数据自动显隐：
      // 主题默认在无数据时渲染「暂无精选文章 / 暂无友情链接」占位，这里改为整张卡片不显示。
      // 精选文章的数据源是文章 frontmatter 的 top 字段，友情链接的数据源是配置里的 friendLink.list。
      // 注意只覆盖 enabled，其余字段（title / limit 等）仍取主题配置。
      const posts = usePosts();
      const hasTopArticle = computed(() =>
        (posts.value?.sortPostsByDateAndSticky ?? []).some((post) => (post.frontmatter as { top?: boolean })?.top)
      );
      const hasFriendLink = Boolean(getTeekConfig("friendLink", { list: [] }).list?.length);
      teekConfig.value.topArticle = { ...getTeekConfig("topArticle"), enabled: hasTopArticle.value };
      teekConfig.value.friendLink = { ...getTeekConfig("friendLink"), enabled: hasFriendLink };

      // 手机端 Banner 描述改为静态首句（桌面端保留打字机）：
      // types 模式每删完一句会留 typesNextTime（1.2s）的空白态，只剩一个灰色胶囊 + 竖线；
      // 打字/删字过程中胶囊宽度持续变化，移动端观感像加载失败，也带来无谓的布局抖动。
      let bannerDescStyle: "default" | "types" = "types";
      let bannerMediaQuery: MediaQueryList | undefined;
      const syncBannerDescStyle = () => {
        const next = bannerMediaQuery?.matches ? "default" : "types";
        if (bannerDescStyle === next) return;
        bannerDescStyle = next;
        teekConfig.value.banner = { ...teekConfig.value.banner, descStyle: next };
      };
      onMounted(() => {
        bannerMediaQuery = window.matchMedia("(max-width: 768px)");
        syncBannerDescStyle();
        bannerMediaQuery.addEventListener("change", syncBannerDescStyle);
      });
      onBeforeUnmount(() => {
        bannerMediaQuery?.removeEventListener("change", syncBannerDescStyle);
      });

      // 「主题配置」→ 彩带背景开关（默认关闭，仅在首页渲染）
      // 这里不用 useRibbon 的 immediate，改为自行控制，避免与下面的路由监听重复初始化
      const { start: startRibbon, stop: stopRibbon } = useRibbon({ immediate: false, clickReRender: true });
      const ribbonEnabled = ref(false);
      // 顶层 index.md 即站点首页，判断方式与 permalinks.ts 保持一致
      const isHomePage = computed(() => page.value.relativePath === "index.md");
      // frontmatter.moments === true 的页面（朋友圈 /moments）在 page-top 挂载时间线，
      // 页面 md 因此可以只保留 frontmatter，不含任何 script/组件标签
      // （数据源是 04.随笔/02.moments/ 下的碎片，用法见该目录 README.md）
      const isMomentsPage = computed(
        () => (page.value.frontmatter as { moments?: boolean } | undefined)?.moments === true,
      );
      // frontmatter.links === true 的页面（友链 /contact）在 page-top 挂载友链页组件，
      // 页面 md 只保留 frontmatter，数据在 data/friendLinks.ts 中维护
      const isLinksPage = computed(
        () => (page.value.frontmatter as { links?: boolean } | undefined)?.links === true,
      );
      // frontmatter.guestbook === true 的页面（/guestbook）由自绘留言板接管，
      // 评论也走组件内自己的 Twikoo 请求，不再渲染 Teek 默认评论区
      const isGuestbookPage = computed(
        () => (page.value.frontmatter as { guestbook?: boolean } | undefined)?.guestbook === true,
      );
      let ribbonActive = false;
      // 记录当前是否已渲染，防止 start 重复调用：initRibbon 在 canvas 已存在时会返回空清理函数，
      // 会覆盖掉真正的清理函数，导致后续 stop 无法移除 canvas
      const syncRibbon = () => {
        const shouldRender = ribbonEnabled.value && isHomePage.value;
        if (shouldRender === ribbonActive) return;
        if (shouldRender) startRibbon();
        else stopRibbon();
        ribbonActive = shouldRender;
      };
      // 不在 setup 里同步：站点是 SSG，构建时 setup 跑在服务端，initRibbon 会被 isClient 守卫跳过，
      // 但 ribbonActive 已被置 true，客户端 hydration 时 isHomePage 不再变化就再也不会补上 canvas。
      // 首次同步放到 onMounted，后续由路由变化驱动。
      onMounted(syncRibbon);
      watch(isHomePage, syncRibbon);

      const handleThemeConfigChange = (config: TeekConfig, type: ChangeType) => {
        // 首页壁纸模式
        if (type === "bannerWallpaper") {
          teekConfig.value.teekHome = config.teekHome;
          teekConfig.value.vpHome = config.vpHome;
          teekConfig.value.banner = { ...teekConfig.value.banner, ...config.banner };
          teekConfig.value.bodyBgImg = { ...teekConfig.value.bodyBgImg, ...config.bodyBgImg };
        }
        // 首页描述切换模式 / 首页壁纸波浪纹
        else if (type === "bannerDescStyle" || type === "bannerImgWaves") {
          teekConfig.value.banner = { ...teekConfig.value.banner, ...config.banner };
        }
        // 首页文章布局 / 首页文章封面图模式
        else if (type === "postStyle" || type === "postCoverImgMode") {
          teekConfig.value.post = { ...teekConfig.value.post, ...config.post };
        }
        // 首页卡片栏布局
        else if (type === "homeCardListPosition") {
          teekConfig.value.homeCardListPosition = config.homeCardListPosition;
        }
        // 文章页背景风格
        else if (type === "pageStyle") {
          teekConfig.value.pageStyle = config.pageStyle;
          teekConfig.value.themeEnhance = { ...teekConfig.value.themeEnhance, ...config.themeEnhance };
        }
        // 首页尺寸
        else if (type === "themeSize") teekConfig.value.themeSize = config.themeSize;
        // 路由加载动画
        else if (type === "loading") teekConfig.value.loading = config.loading;
        // Twikoo 评论区
        else if (type === "comment") teekConfig.value.comment = config.comment;
        // 彩带背景（仅首页渲染，非首页切换只记录开关状态）
        else if (type === "ribbon") {
          ribbonEnabled.value = Boolean(config);
          syncRibbon();
        }

        TkMessage.success({ message: "切换配置成功！", customClass: "antd" });
      };

      return () => h(Teek.Layout, null, {
        "teek-archives-top-before": () => h(ContributeChart),
        // 右上角设置弹层底部注入「主题配置」区块
        "teek-theme-enhance-bottom": () => h(ThemeConfig, { onChange: handleThemeConfigChange }),
        // 放在「在 GitHub 上编辑此页面」和「最后更新于」之前
        "doc-footer-before": () => h(ArticleSponsor),
        // 「分享此页面」右侧的「导出 PDF」按钮
        "teek-article-share-after": () => h(ArticleExportPdf),
        // 首页 Banner 特性区下方的「向下滚动」箭头（点击平滑滚动到内容区）
        "teek-home-banner-feature-after": () => h(ScrollDownArrow),
        // 手机端首页尾部的「一些句子」小标题：桌面端隐藏，仅用于给
        // VitePress 默认 features（index.md 里的书摘卡片）一个章节入口。
        // 分类/标签页同样使用 teek 首页布局，必须只在真正的站点首页渲染。
        "teek-home-after": () => (isHomePage.value ? h("h2", { class: "home-quotes-heading" }, "一些句子") : null),
        // 外链安全提示页（frontmatter.riskLinkPage === true）由自定义页面接管样式
        "teek-risk-link-page": () => h(RiskLinkPage),
        // 朋友圈时间线（frontmatter.moments === true 时生效）
        // 友链页（frontmatter.links === true 时生效）
        "page-top": () =>
          isMomentsPage.value
            ? h(MomentsTimeline)
            : isLinksPage.value
              ? h(FriendLinksPage)
              : isGuestbookPage.value
                ? h(GuestbookPage)
                : null,
        // PWA：新版本 / 离线就绪提示（组件内部SSR安全，仅在客户端注册 SW）
        "layout-bottom": () => h(ReloadPrompt),
        "not-found": () => h(NotFound),
      });
    },
  })
};
