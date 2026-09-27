# 设计:手机端(≤768px)首页大图壁纸 → 网格壁纸

- 日期:2026-09-27
- 状态:已批准(用户选定方案 A:纯 CSS 媒体查询变换)
- 关联:首页 Banner 主题 `vitepress-theme-teek@1.5.6`

## 1. 背景与问题

`docs/.vitepress/teekConfig.ts` 配置 `banner.bgStyle: "fullImg"`(大图壁纸):

- 背景 `100vh` 全屏大图 `bg_compressed.jpg`(`cover` 裁剪),导航栏透明悬浮白字,底部波浪纹。
- 手机竖屏(≤768px)下宽图被 cover 裁剪后**主体丢失/糊**,这是用户唯一的抱怨点
  (文字大小、首屏高度经确认**不在**范围;标题 `3.4rem` 保持不动)。

验收标准:**≤768px 显示主题内置的"网格壁纸"观感;>768px 桌面端像素级不变。**

"网格壁纸" = 主题的 `bgStyle: "partImg"` 且无图时的渲染:
`--tk-bg-img-default`(`#28282d` + 网格点阵 PNG)、`min-height:450px`、内容叠在图案上、
无遮罩、无波浪纹、导航不悬浮。

## 2. 方案选型(已批准)

| 方案 | 结论 |
|---|---|
| **A. 纯 CSS 媒体查询变换** | ✅ 选定:首屏即正确(CSS 与 HTML 同步到达,零闪烁)、零水合风险、配置不动(全屏壁纸按钮仍能读到 `imgSrc`)、桌面在 media 外零影响 |
| B. 运行时 `teekConfigContext` 切配置 | ✗ 否决:SSR 首屏闪大图、水合子树重渲染、清 `imgSrc` 会让手机端全屏壁纸按钮失去图源 |
| C. 换竖屏专用壁纸图 | ✗ 否决:不符合已定需求,仍需 A/B 机制且多一张素材 |

## 3. 改动点(架构)

- **新增** `docs/.vitepress/theme/styles/banner-mobile.scss`,在 `theme/index.ts` 中
  import(排在主题 CSS 之后,靠加载顺序实现覆盖——与站点现有 `tk-*` 覆盖惯例一致)。
- **不改** `teekConfig.ts`、**不改** 主题 JS 渲染逻辑、**不改** 任何导航 JS。

依赖的主题类名(内部实现,主题大版本升级需复查):
`.tk-banner.is-full-img`、`.tk-banner-bg-image.full`、`.tk-banner__content`、
`.tk-banner-waves`、`.tk-layout .VPNavBar.home.full-img-nav-bar`。

## 4. 核心设计(≤768px 生效的媒体查询)

```scss
@media (max-width: 768px) {
  // 1) 背景与内容堆叠同一格,格高取两者较大者(等价 partImg「内容在图内」,内容再长也不溢出)
  .tk-banner.is-full-img { display: grid; grid-template-areas: "stack"; }
  .tk-banner.is-full-img > * { grid-area: stack; }

  // 2) 背景图 → 主题默认网格点阵(唯一必须 !important:压过内联 style 的图片变量)
  .tk-banner-bg-image.full {
    position: relative; top: auto; height: auto; min-height: 450px;
    --tk-banner-img-bg: var(--tk-bg-img-default) !important;
  }

  // 3) 大图专属装饰:遮罩、波浪纹隐藏
  .tk-banner-bg-image.full .mask, .tk-banner-waves { display: none; }

  // 4) 内容区回落 part 排版(height:100vh→auto,底部 15vh→10vh)
  //    .no-feature 选择器与主题特异性持平(4 类),靠本文件后加载取胜
  .tk-banner.is-full-img .tk-banner__content,
  .tk-banner.is-full-img .tk-banner__content.no-feature { height: auto; padding-bottom: 10vh; }

  // 5) 导航栏兜底(见 §5):实底 #28282d + !important
  .tk-layout .VPNavBar.home.full-img-nav-bar:not(.screen-open) {
    background-color: #28282d !important;
  }
}
```

**不改动** `.tk-banner.is-full-img` 的 `margin-top: -nav-height`(沿用主题 fullImg 现有几何,零风险)。

## 5. 隐藏坑:导航栏白字(必须一并处理)

主题 HomeBanner 的 JS 只看**配置**决定导航样式:配置仍为 `fullImg` → 滚动监听会给
`.VPNavBar` 加 `full-img-nav-bar` 类(**透明底 + 一整套白字规则**:菜单/标题/搜索/汉堡按钮),
且移除时机按 `scrollTop + 100 < clientHeight`(100vh 前提)计算。

banner 缩到 450px 后,该类的存续区间(≈ `clientHeight - 100`)远大于 banner 实际高度,
出现"导航白字浮在浅色文章列表上"的滚动区间(浅色模式不可读)。

**对策**:手机端将该状态导航改为**实底 `#28282d`**(与网格底色同色):
- 顶部:与网格无缝相接,白字可读;
- 滚动越过 banner 后:深色实底条上白字依然可读;
- 类被移除后(滚远):回退到 VitePress 默认导航,正常。

## 6. 边界条件

| 场景 | 行为 |
|---|---|
| 全屏壁纸按钮 | 不受影响(独立组件 `HomeFullscreenWallpaper`,照常读 `imgSrc` 显示真图) |
| 深/浅色模式 | 网格底色恒 `#28282d`,两种模式表现一致 |
| 横竖屏/拖窗 | media query 自动跟随,无需 JS 监听 |
| 移动端菜单展开(`screen-open`) | 主题规则本就 `:not(.screen-open)`,回退 VitePress 默认,正常 |
| 桌面端 >768px | media 外,像素级不变 |
| 标题字号 | 不改(用户明确不在范围) |

## 7. 验证

1. `npm test` 37 用例保持绿;`npm run docs:build` exit 0。
2. 浏览器实测(≤768 视口):网格点阵背景、450px 高、无遮罩/波浪、导航可读、滚动到底导航仍可读。
3. 浏览器实测(>768 视口):大图 + 波浪 + 透明导航,与改动前一致。
4. 全屏壁纸按钮手机端可打开且显示真图;深/浅色各看一遍。

## 8. 明确不做(YAGNI)

- 不做运行时配置切换、不监听 `matchMedia`、不改主题 JS;
- 不调标题/描述字号;
- 不为其他断点(640/960)提供中间态;
- 不动桌面端任何样式。
