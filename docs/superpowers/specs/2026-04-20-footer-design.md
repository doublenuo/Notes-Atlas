# VitePress 页脚配置设计（Notes-Atlas）

## 1. 目标

为当前 VitePress 站点增加简洁中文页脚，并满足以下行为：

- 页脚内容为版权信息 + GitHub 链接；
- 首页不显示页脚，其它页面显示页脚；
- 最小改动，不引入额外依赖。

## 2. 方案概述

采用 VitePress 原生 `themeConfig.footer` 作为主实现，保持配置集中在 `.vitepress/config.mjs`。  
针对“首页不显示”需求，使用轻量主题样式/布局选择器，仅在路由 `/` 时隐藏页脚。

该方案避免新增自定义组件，维护成本最低，且与现有主题增强（更新时间、导出、受保护提示）解耦。

## 3. 结构与改动面

### 修改文件

- `.vitepress/config.mjs`
  - 新增 `themeConfig.footer`：
    - `message`：`Notes-Atlas`
    - `copyright`：`© 2026 Notes-Atlas · GitHub`
  - GitHub 保持可点击（通过 footer 文案内链接或现有社交链接承接）。

- `.vitepress/theme/styles.css`（仅在需要时）
  - 增加首页隐藏 footer 的最小规则；
  - 不修改其它页面 footer 样式。

## 4. 显示行为

- 路由为 `/`（首页）时：不显示 footer。
- 其它路由（如 `/study/`、`/meet/`、`/tools/` 等）时：显示 footer。
- footer 中 GitHub 链接可点击并跳转到仓库地址。

## 5. 错误处理与兼容性

- 不增加运行时异步逻辑，无网络依赖，不引入新故障点。
- 若后续修改主题 DOM 结构，仅需调整首页隐藏规则选择器，不影响文案配置本身。

## 6. 验收标准

1. 首页无页脚。
2. 任意非首页页面显示页脚。
3. 页脚显示中文简洁版权文案。
4. GitHub 链接可点击并正确跳转。

