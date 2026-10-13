import Teek, { giscusContext, teekConfigContext, TkMessage, usePosts, useTeekConfig } from "vitepress-theme-teek";
import type { TeekConfig } from "vitepress-theme-teek";
import TeekLayoutProvider from "./components/TeekLayoutProvider.vue";
import ThemeConfig, { type ChangeType } from "./components/ThemeConfig.vue";
import { useRibbon } from "./composables/useRibbon";

import { defineComponent, provide, h, ref, computed, watch, onMounted } from 'vue'
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
import ContributeChart from "./components/ContributeChart.vue";
import ArticleExportPdf from "./components/ArticleExportPdf.vue";

import Giscus from "@giscus/vue";
import { useData, useRoute } from "vitepress";

import "./styles/code-bg.scss";
import "./styles/theme-color.scss"; // 主题色板区块：对齐 teek 官网观感（色块不带文字）
import "./styles/homepage.scss";
import "./styles/home-card.scss";
import "./styles/iframe.scss";
import "./styles/embed.scss";
import "./styles/banner-mobile.scss"; // 手机端首页 Banner 网格壁纸变换（须在主题 CSS 之后）
import "./styles/print.scss"; // 打印样式：导出 PDF 时只输出正文（须在主题 CSS 之后）

export default {
  extends: Teek,
  Layout: defineComponent({
    name: "LayoutProvider",
    setup() {
      const { isDark, page } = useData();
      const route = useRoute();
      provide(giscusContext, () => Giscus);

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

      // 「主题配置」→ 彩带背景开关（默认开启，仅在首页渲染）
      // 这里不用 useRibbon 的 immediate，改为自行控制，避免与下面的路由监听重复初始化
      const { start: startRibbon, stop: stopRibbon } = useRibbon({ immediate: false, clickReRender: true });
      const ribbonEnabled = ref(true);
      // 顶层 index.md 即站点首页，判断方式与 permalinks.ts 保持一致
      const isHomePage = computed(() => page.value.relativePath === "index.md");
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
        // Giscus 评论区
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
        // 「分享此页面」右侧的「导出 PDF」按钮
        "teek-article-share-after": () => h(ArticleExportPdf),
      });
    },
  })
};
