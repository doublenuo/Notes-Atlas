# MiSans 标题子集

这里只保留一级标题/品牌文案使用的 MiSans 可变字体子集，正文不再加载中文 webfont。

## 文件

- `MiSans-Heading-0.woff2` ~92KB：ASCII、常用标点和高频 h1 用字（大多数页面只会命中这一片）
- `MiSans-Heading-1.woff2` ~94KB：中频 h1 用字
- `MiSans-Heading-2.woff2` ~92KB：低频 h1 用字
- `MiSans-Heading.css`：三个 `@font-face`，用 `unicode-range` 按字分片
- `LICENSE`：MiSans 的 Apache-2.0 许可

字体来源：小米 MiSans VF（[官方字体页](https://hyperos.mi.com/font/zh/download/)）。
本仓库使用的 VF 文件来自 [luyanci/MisansVF](https://github.com/luyanci/MisansVF)（20MB，仅用于生成子集，不提交）。

## 重新生成

当一级标题新增了大量生僻字时：

```bash
# 1. 安装工具（项目已有 .venv）
.venv/bin/pip install fonttools brotli

# 2. 下载 MiSansVF.ttf 到任意位置
curl -L https://raw.githubusercontent.com/luyanci/MisansVF/main/MiSansVF.ttf -o /tmp/MiSansVF.ttf

# 3. 扫描 docs 标题 + 站点文案，重新生成 3 个分片与 CSS
MISANS_VF=/tmp/MiSansVF.ttf node scripts/build-heading-font.mjs
```

生成脚本会：

1. 扫描所有 Markdown 的一级标题（`#`），以及 `config.ts` / `teekConfig.ts` 里的中文文案；
2. 按字符出现频率切成 3 片（ASCII/常用标点强制进第 1 片）；
3. 用 `pyftsubset` 输出 woff2，并生成 `MiSans-Heading.css`。

## 注意

- `h2–h6` 不使用 MiSans：它们数量多，几乎每页都会命中全部 3 片（约 360KB），交给系统中文栈更划算。
- `h1` 中出现子集外的极冷僻字时，会逐字回退到系统中文栈（苹方/鸿蒙/思源/雅黑），不会出豆腐块。
- 不要把这些分片误用于正文：正文用系统字体是刻意选择，可以避免每页额外下载 0.7–1.5MB。
