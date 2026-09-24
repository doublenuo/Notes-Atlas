import Teek, { giscusContext, teekConfigContext, TkMessage } from "vitepress-theme-teek";
import type { TeekConfig } from "vitepress-theme-teek";
import TeekLayoutProvider from "./components/TeekLayoutProvider.vue";
import ThemeConfig, { type ChangeType } from "./components/ThemeConfig.vue";
import { useRibbon } from "./composables/useRibbon";

import { defineComponent, provide, h, ref } from 'vue'
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

import Giscus from "@giscus/vue";
import { useData, useRoute } from "vitepress";

import "./styles/code-bg.scss";
import "./styles/homepage.scss";
import "./styles/iframe.scss";
import "./styles/embed.scss";

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

      // 「主题配置」→ 彩带背景开关
      const { start: startRibbon, stop: stopRibbon } = useRibbon({ immediate: false, clickReRender: true });

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
        // 彩带背景
        else if (type === "ribbon") {
          if (config) startRibbon();
          else stopRibbon();
        }

        TkMessage.success({ message: "切换配置成功！", customClass: "antd" });
      };

      return () => h(Teek.Layout, null, {
        "teek-archives-top-before": () => h(ContributeChart),
        // 右上角设置弹层底部注入「主题配置」区块
        "teek-theme-enhance-bottom": () => h(ThemeConfig, { onChange: handleThemeConfigChange }),
      });
    },
  })
};
