---
date: 2026-09-27 22:24:11
title: 2026-09-27-mobile-grid-banner
---
# 手机端大图壁纸 → 网格壁纸 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** ≤768px 视口把首页 fullImg 大图壁纸呈现为主题"网格壁纸"观感；>768px 桌面端像素级不变。

**架构：** 纯 CSS 媒体查询变换（方案 A，已批准）：新增 `styles/banner-mobile.scss`，在 `theme/index.ts` 中排在主题 CSS 之后 import（加载顺序覆盖，与站点现有 `tk-*` 覆盖惯例一致）。不改 `teekConfig.ts`、不改主题 JS。验证两级：构建产物静态断言 + headless Chrome 双视口 computed-style 断言（先红后绿，承担 TDD 角色）。

**技术栈：** VitePress + vitepress-theme-teek@1.5.6、SCSS、`/usr/bin/google-chrome`（`--headless=new` / `--dump-dom` / `--screenshot`）、Node 内置 `node --test`（回归）。

**规格：** `docs/superpowers/specs/2026-09-27-mobile-grid-banner-design.md`（已 commit `97ffea2`）

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `docs/.vitepress/theme/styles/banner-mobile.scss` | 手机端 banner→网格的全部变换规则（唯一实现文件） | 新建 |
| `docs/.vitepress/theme/index.ts` | 挂载样式 import（主题 CSS 之后） | 修改：追加 1 行 import |
| `/tmp/opencode/wallpaper-verify/assert.js` | 双视口断言脚本（红/绿复用，不入 git） | 新建 |
| `docs/public/_verify.html` | 一次性运行时验证页（iframe 内读 computed style；放 public 才能在 `docs:build` 清空 dist 后存活并自动拷入 `/_verify.html`；**永不提交，验证后删除**） | 新建 |

不做的事（YAGNI，见规格 §8）：不改配置、不调字号、不监听 `matchMedia`、不动桌面端样式。

---

## 任务 0：前置确认与基线（只读 + 环境）

- [ ] **步骤 1：** 目标文件干净检查：

```bash
cd /home/weno/works/Notes-Atlas && git status --short -- docs/.vitepress/theme/index.ts docs/.vitepress/theme/styles/
```

预期：无输出。若有输出 → 停下，报告用户（可能是用户未提交的改动，不得覆盖）。

- [ ] **步骤 2：** 端口与预览服务器：

```bash
ss -ltn | grep 4173
```

预期：无输出（4173 空闲）。若被占用 → 停下，报告用户。

后台启动预览（当前 dist = 部署中的改前版本）：

```bash
npm run docs:preview
```

用后台模式运行（shell background=true），随后 `curl -sI http://localhost:4173/ | head -1` 预期 `HTTP/1.1 200`。

- [ ] **步骤 3：** 清理 Chrome 临时 profile 并记录桌面"改前"基线截图：

```bash
rm -rf /tmp/opencode/chrome-prof && mkdir -p /tmp/opencode/wallpaper-verify
timeout 90 google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --user-data-dir=/tmp/opencode/chrome-prof --window-size=1440,900 --virtual-time-budget=8000 \
  --screenshot=/tmp/opencode/wallpaper-verify/desktop-before.png \
  "http://localhost:4173/" 2>/dev/null
```

预期：生成 `desktop-before.png`。用 read 工具查看：应显示完整大图壁纸（改前状态）。

- [ ] **步骤 4：** 写断言脚本 `/tmp/opencode/wallpaper-verify/assert.js`（完整内容如下，之后不再改）：

```js
const fs = require("fs");
const [, , file, mode] = process.argv;
const raw = fs.readFileSync(file, "utf8");
const m = raw.match(/RESULTS=\{[\s\S]*?<\/pre>/);
if (!m) { console.error("FAIL: dump 中未找到 RESULTS（verify 页未完成或未执行）"); process.exit(1); }
const json = m[0]
  .slice("RESULTS=".length, -"</pre>".length)
  .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const j = JSON.parse(json);
const fail = [];
const ok = (c, msg) => { if (!c) fail.push(msg + "（实际: " + JSON.stringify(j[msg.split(" ")[0]] ?? j) + "）"); };

if (mode === "mobile") {
  const eq = (k, want) => { if (j[k] !== want) fail.push(k + " 应为 " + want + ", 实际 " + JSON.stringify(j[k])); };
  const has = (k, sub) => { const v = String(j[k]); if (!v.includes(sub)) fail.push(k + " 应含 " + sub + ", 实际 " + JSON.stringify(v.slice(0, 160))); };
  if (j.media768 !== true) fail.push("media768 应为 true");
  eq("bannerDisplay", "grid");
  eq("bgPosition", "relative");
  if (j.bgImage === "none" || String(j.bgImage).includes("bg_compressed")) fail.push("背景应为网格而非大图, 实际 " + String(j.bgImage).slice(0, 160));
  has("imgBgVar", "#28282d");
  if (!(j.maskDisplay === "none" || j.maskDisplay === "ABSENT")) fail.push("遮罩应隐藏, 实际 " + j.maskDisplay);
  if (!(j.wavesDisplay === "none" || j.wavesDisplay === "ABSENT")) fail.push("波浪应隐藏, 实际 " + j.wavesDisplay);
  if (!(j.bannerHeight >= 400 && j.bannerHeight <= 760)) fail.push("banner 高度应 400–760(≈450), 实际 " + j.bannerHeight);
  if (j.navHasClass !== true) fail.push("导航应带 full-img-nav-bar 类");
  eq("navBg", "rgb(40, 40, 45)");
} else {
  if (j.media768 !== false) fail.push("media768 应为 false");
  if (j.bannerDisplay === "grid") fail.push("桌面 banner 不应为 grid, 实际 " + j.bannerDisplay);
  if (!String(j.bgImage).includes("bg_compressed")) fail.push("桌面应为大图, 实际 " + String(j.bgImage).slice(0, 160));
  eq("bgPosition", "absolute");
  if (j.maskDisplay === "none") fail.push("桌面遮罩不应隐藏");
  if (j.wavesDisplay === "none") fail.push("桌面波浪不应隐藏");
  if (!(j.bannerHeight >= 850)) fail.push("桌面 banner 应≈100vh(≥850), 实际 " + j.bannerHeight);
  if (j.navBg === "rgb(40, 40, 45)") fail.push("桌面导航不应变实底暗色, 实际 " + j.navBg);
}

if (fail.length) { console.error("FAIL:\n - " + fail.join("\n - ")); process.exit(1); }
console.log("PASS " + mode + ": " + JSON.stringify(j));
```

（`mode` 取 `mobile` 或 `desktop`；JSON 输出走单行 `JSON.stringify`，dump 里位于 `<pre id="out">` 内。）

---

## 任务 1：红 — 编写失败的运行时验证

- [ ] **步骤 1：** 写 `docs/public/_verify.html`（完整内容；构建时自动拷贝为站点根的 `/_verify.html`）：

```html
<!doctype html>
<meta charset="utf-8">
<title>verify</title>
<style>html,body{margin:0}</style>
<pre id="out">PENDING</pre>
<script>
(function () {
  var f = document.createElement("iframe");
  f.style.cssText = "width:100%;height:100vh;border:0";
  f.src = "/";
  function collect() {
    try {
      var d = f.contentDocument, w = f.contentWindow;
      var q = function (s) { return d.querySelector(s); };
      var cs = function (el) { return el ? w.getComputedStyle(el) : null; };
      var banner = q(".tk-banner"), bg = q(".tk-banner-bg-image");
      var mask = q(".tk-banner-bg-image .mask"), waves = q(".tk-banner-waves");
      var nav = q(".VPNavBar");
      var bgcs = cs(bg);
      var r = {
        innerWidth: w.innerWidth,
        media768: w.matchMedia("(max-width: 768px)").matches,
        bannerDisplay: cs(banner) && cs(banner).display,
        bannerHeight: banner && banner.offsetHeight,
        bgPosition: bgcs && bgcs.position,
        bgImage: bgcs && bgcs.backgroundImage.slice(0, 220),
        imgBgVar: bgcs && (bgcs.getPropertyValue("--tk-banner-img-bg") || "").trim().slice(0, 160),
        maskDisplay: mask ? cs(mask).display : "ABSENT",
        wavesDisplay: waves ? cs(waves).display : "ABSENT",
        navHasClass: !!(nav && nav.className.indexOf("full-img-nav-bar") > -1),
        navBg: nav && cs(nav).backgroundColor
      };
      document.getElementById("out").textContent = "RESULTS=" + JSON.stringify(r);
    } catch (e) {
      document.getElementById("out").textContent = "ERROR=" + e.message;
    }
  }
  f.addEventListener("load", function () { setTimeout(collect, 2000); });
  document.body.appendChild(f);
})();
</script>
```

- [ ] **步骤 2：** 跑改前双视口（此时实现尚未存在 → mobile 必须 FAIL）。**先重启 preview**（实测：`vitepress preview` 启动时快照文件表，之后新建/变更的文件一律 404，因此每次文件变动后都要重启）——先 `pkill -f "vitepress preview"` 再后台启动 `npm run docs:preview`，等 `curl -s -o /dev/null -w '%{http_code}' http://localhost:4173/_verify.html` 返回 200：

```bash
rm -rf /tmp/opencode/chrome-prof
timeout 90 google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --user-data-dir=/tmp/opencode/chrome-prof --window-size=390,844 --virtual-time-budget=12000 \
  --dump-dom "http://localhost:4173/_verify.html" > /tmp/opencode/wallpaper-verify/mobile.dump 2>/dev/null
node /tmp/opencode/wallpaper-verify/assert.js /tmp/opencode/wallpaper-verify/mobile.dump mobile
```

预期：**FAIL**（bannerDisplay 非 grid、背景含 bg_compressed、bannerHeight≈844、navBg 非 rgb(40,40,45) 等）。记录失败输出。

- [ ] **步骤 3：** 桌面断言此时应 **PASS**（"桌面不变"这一不变量从改前就成立）：

```bash
rm -rf /tmp/opencode/chrome-prof
timeout 90 google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --user-data-dir=/tmp/opencode/chrome-prof --window-size=1440,900 --virtual-time-budget=12000 \
  --dump-dom "http://localhost:4173/_verify.html" > /tmp/opencode/wallpaper-verify/desktop.dump 2>/dev/null
node /tmp/opencode/wallpaper-verify/assert.js /tmp/opencode/wallpaper-verify/desktop.dump desktop
```

预期：`PASS desktop`。若改前就 FAIL → 断言脚本或 verify 页有误，先修正再继续（不得带病进入实现）。

---

## 任务 2：绿 — 实现样式与导入，构建断言，复跑变绿

- [ ] **步骤 1：** 新建 `docs/.vitepress/theme/styles/banner-mobile.scss`（完整内容，一次写全）：

```scss
/**
 * 手机端(≤768px)：首页大图壁纸(fullImg) → 主题网格壁纸观感
 * 设计规格：docs/superpowers/specs/2026-09-27-mobile-grid-banner-design.md
 * 依赖：本文件在主题 CSS 之后加载（theme/index.ts 的 import 顺序）
 */
@media (max-width: 768px) {
  /* 1) 背景与内容堆叠同一格，格高取两者较大者（等价 partImg「内容在图内」，内容再长也不溢出） */
  .tk-banner.is-full-img {
    display: grid;
    grid-template-areas: "stack";
  }

  .tk-banner.is-full-img > * {
    grid-area: stack;
  }

  /* 2) 背景图 → 主题默认网格点阵（唯一必须 !important：压过元素内联 style 的图片变量） */
  .tk-banner-bg-image.full {
    position: relative;
    top: auto;
    height: auto;
    min-height: 450px;
    --tk-banner-img-bg: var(--tk-bg-img-default) !important;
  }

  /* 3) 大图专属装饰：遮罩、波浪纹隐藏 */
  .tk-banner-bg-image.full .mask,
  .tk-banner-waves {
    display: none;
  }

  /* 4) 内容区回落 part 排版（height:100vh→auto；底部留白 15vh→10vh）。
   *    .no-feature 选择器与主题特异性持平（4 类），靠本文件后加载取胜 */
  .tk-banner.is-full-img .tk-banner__content,
  .tk-banner.is-full-img .tk-banner__content.no-feature {
    height: auto;
    padding-bottom: 10vh;
  }

  /* 5) 导航：主题 JS 只看配置，手机端仍会加 full-img-nav-bar（透明底+白字），
   *    且移除时机按 100vh 计算，banner 缩到 450px 后白字会浮在浅色内容上。
   *    改实底 #28282d（与网格底色同色）→ 其全部白字规则在任意滚动位置可读。 */
  .tk-layout .VPNavBar.home.full-img-nav-bar:not(.screen-open) {
    background-color: #28282d !important;
  }
}
```

- [ ] **步骤 2：** `docs/.vitepress/theme/index.ts` 追加 import（在第 29 行 `import "./styles/embed.scss";` 之后）：

```ts
import "./styles/banner-mobile.scss"; // 手机端首页 Banner 网格壁纸变换（须在主题 CSS 之后）
```

- [ ] **步骤 3：** 顺序校验（覆盖成败的关键）：

```bash
grep -n "vitepress-theme-teek/index.css\|banner-mobile" docs/.vitepress/theme/index.ts
```

预期：`vitepress-theme-teek/index.css` 行号 < `banner-mobile.scss` 行号。

- [ ] **步骤 4：** 构建 + 静态断言（在打包产物中找到只属于本变更的四段字面量）：

```bash
npm run docs:build
```

预期：exit 0。

```bash
grep -rE "\.tk-banner\.is-full-img\{display:grid" docs/.vitepress/dist/assets/*.css
grep -rE "tk-banner-img-bg: ?var\(--tk-bg-img-default\) ?!important" docs/.vitepress/dist/assets/*.css
grep -rE "full-img-nav-bar:not\(\.screen-open\)\{background-color:#28282d" docs/.vitepress/dist/assets/*.css
grep -rE "grid-template-areas: ?\"stack\"" docs/.vitepress/dist/assets/*.css
```

预期：四条各自命中至少一行。任一未命中 → minifier 输出格式差异，读实际产物行调整**断言正则**（不改实现），再跑。

- [ ] **步骤 5：** 回归测试：

```bash
npm test
```

预期：`37 pass`（既有用例不受样式改动影响）。

- [ ] **步骤 6：** **重启 preview**（构建生成了新 hash 文件，服务器启动时的文件快照里没有它们；实测不重启会 404）：`pkill -f "vitepress preview"` 后台重启 `npm run docs:preview`，等 `/_verify.html` 返回 200（public 目录已随构建拷入 dist），再复跑任务 1 的双视口断言：

```bash
rm -rf /tmp/opencode/chrome-prof
timeout 90 google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --user-data-dir=/tmp/opencode/chrome-prof --window-size=390,844 --virtual-time-budget=12000 \
  --dump-dom "http://localhost:4173/_verify.html" > /tmp/opencode/wallpaper-verify/mobile.dump 2>/dev/null
node /tmp/opencode/wallpaper-verify/assert.js /tmp/opencode/wallpaper-verify/mobile.dump mobile

rm -rf /tmp/opencode/chrome-prof
timeout 90 google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --user-data-dir=/tmp/opencode/chrome-prof --window-size=1440,900 --virtual-time-budget=12000 \
  --dump-dom "http://localhost:4173/_verify.html" > /tmp/opencode/wallpaper-verify/desktop.dump 2>/dev/null
node /tmp/opencode/wallpaper-verify/assert.js /tmp/opencode/wallpaper-verify/desktop.dump desktop
```

预期：**两条均 PASS**。任一 FAIL → 读失败信息修实现（对照规格 §4/§5），改完必须整段重跑（红→绿不得跳步）。

---

## 任务 3：视觉复核（截图肉眼比对）

- [ ] **步骤 1：** 改后双视口截图：

```bash
rm -rf /tmp/opencode/chrome-prof
timeout 90 google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --user-data-dir=/tmp/opencode/chrome-prof --window-size=390,844 --virtual-time-budget=8000 \
  --screenshot=/tmp/opencode/wallpaper-verify/mobile-after.png \
  "http://localhost:4173/" 2>/dev/null

rm -rf /tmp/opencode/chrome-prof
timeout 90 google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --user-data-dir=/tmp/opencode/chrome-prof --window-size=1440,900 --virtual-time-budget=8000 \
  --screenshot=/tmp/opencode/wallpaper-verify/desktop-after.png \
  "http://localhost:4173/" 2>/dev/null
```

若截图为全白/空白 → 把 `--virtual-time-budget` 提到 `15000` 重跑一次。

- [ ] **步骤 2：** 用 read 工具查看三张图并比对：
  - `mobile-after.png`：深色网格点阵背景 + 标题/描述居中 + 无波浪纹 ✓
  - `desktop-before.png` vs `desktop-after.png`：两者应为同一张完整大图壁纸（不可见差异）✓

---

## 任务 4：清理与提交

- [ ] **步骤 1：** 删除一次性验证页（源与 dist 副本都删：源在 public 不删会入站，dist 副本将被 rsync 部署）：

```bash
rm -f docs/public/_verify.html docs/.vitepress/dist/_verify.html
```

- [ ] **步骤 2：** 显式路径提交（只 add 这两个文件，绝不 `git add -A`）：

```bash
git add docs/.vitepress/theme/styles/banner-mobile.scss docs/.vitepress/theme/index.ts
git commit -m "feat(home): 手机端(≤768px)大图壁纸切换为网格壁纸(纯CSS变换,桌面零影响)"
git show --stat HEAD
```

预期：`git show --stat` 只列这两个文件；提交**不 push**（push 触发部署，须用户发起）。

---

## 任务 5：收尾与报告

- [ ] **步骤 1：** 停预览服务器：

```bash
pkill -f "vitepress preview"
rm -rf /tmp/opencode/chrome-prof
```

- [ ] **步骤 2：** 向用户报告，必须包含：
  1. 改动 = `banner-mobile.scss`（新建）+ `index.ts`（1 行 import），commit hash；
  2. 证据 = 红→绿断言输出、`37 pass`、build exit 0、三张截图路径；
  3. **未部署**（本地 commit 不 push，dist 也未 rsync）；上线命令待用户发起：

```bash
npm run docs:build
rsync -az --delete docs/.vitepress/dist/ web:/opt/blogs/
ssh web 'sudo docker cp /opt/blogs/. caddy:/opt/blogs/'
```

  4. 建议用户真机/浏览器手动复核 ≤768 与 >768、全屏壁纸按钮、深浅色。
