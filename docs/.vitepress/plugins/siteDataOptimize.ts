/**
 * 站点数据瘦身（configResolved 时 teek/doc-analysis 均已注入完成）。
 *
 * metadata chunk（__VP_SITE_DATA__）每页急切加载，teek 把 342 篇文章的 posts 数据
 * 复制了 8 份变体（allPosts/originPosts/sortPostsByDate 系/groupPosts 系），本文只做
 * 无损或视觉无损的裁剪：
 *  1. posts.capture 截断到 150 字符 —— 仅首页卡片摘要用，CSS line-clamp 下视觉无差；
 *     注意 ConfigProvider:96 运行时会遍历 allPosts（layout 页定位），allPosts 必须保留
 *  2. docAnalysisInfo.eachFileWords 删 fileInfo.filePath —— 绝对服务器路径，
 *     三个消费方（ArticleAnalyze/ArticleOverviewPage/HomeDocAnalysisCard）全部按
 *     relativePath 匹配，且泄漏服务器目录结构给访客
 */
export function siteDataOptimize() {
  let themeConfig = null;
  return {
    name: "na-site-data-optimize",
    config(config) {
      const vp = config?.vitepress;
      if (vp?.site?.themeConfig) themeConfig = vp.site.themeConfig;
    },
    configResolved() {
      if (!themeConfig) return;

      const CAPTURE_MAX = 150;
      const posts = themeConfig.posts;
      if (posts) {
        const trim = (arr) =>
          Array.isArray(arr) &&
          arr.forEach((p) => {
            if (typeof p.capture === "string" && p.capture.length > CAPTURE_MAX) {
              p.capture = p.capture.slice(0, CAPTURE_MAX).trimEnd() + "…";
            }
          });
        [
          posts.allPosts,
          posts.originPosts,
          posts.sortPostsByDateAndSticky,
          posts.sortPostsByDate,
          posts.groupPostsByYear,
          posts.groupPostsByYearMonth,
          posts.groupPosts,
          posts.groupCards,
        ].forEach(arr => Array.isArray(arr) && trim(arr));
      }

      const info = themeConfig.docAnalysisInfo;
      if (Array.isArray(info?.eachFileWords)) {
        for (const entry of info.eachFileWords) {
          if (entry.fileInfo) delete entry.fileInfo.filePath;
        }
      }
    },
  };
}
