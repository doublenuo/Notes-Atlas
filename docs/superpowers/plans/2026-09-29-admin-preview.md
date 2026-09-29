---
date: 2026-09-29 19:57:35
title: 2026-09-29-admin-preview
---
# 后台 Markdown 实时预览 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 `/admin/` 编辑器加上左右分栏的 Markdown 实时预览，`![[嵌入]]`/`[[双链]]` 真实展开，支持 mermaid 图表与数学公式。

**架构：** 新增 `POST /admin/api/preview`，服务端用 markdown-it 单例渲染（复用 obsidianEmbed 插件做嵌入/双链解析）；前端 300ms 防抖拉取，KaTeX/Mermaid 在浏览器侧二次排版。obsidianEmbed 移至 `admin/server/shared/` 成为站点与预览的单一事实来源。

**技术栈：** Fastify 5、markdown-it 14（新增运行时依赖）、KaTeX 0.16.47、mermaid 11（vendor 到 public/）、`node --test`

**规格：** `docs/superpowers/specs/2026-09-29-admin-preview-design.md`

**基线：** `npm test` = 96 pass / 0 fail（2026-09-29 实测）。每个任务结束时必须仍全绿。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `admin/server/shared/obsidianEmbed.js` | 嵌入/双链 markdown-it 插件，站点与预览共用 | 新建（从 `docs/.vitepress/plugins/obsidianEmbed.ts` 移动） |
| `docs/.vitepress/plugins/obsidianEmbed.ts` | — | 删除 |
| `admin/server/src/preview.js` | markdown-it 单例 + `render(content, relPath)` | 新建 |
| `admin/server/src/app.js` | 装配 `POST /admin/api/preview` 路由 | 修改 |
| `admin/server/src/index.js` | 创建并注入 preview 渲染器 | 修改 |
| `admin/server/package.json` | 新增 `markdown-it` 运行时依赖 | 修改 |
| `admin/server/package-lock.json` | 锁 markdown-it 14 | 重新生成 |
| `admin/server/Dockerfile` | `COPY shared ./shared` | 修改 |
| `admin/server/scripts/fetch-vendor.mjs` | 从根 node_modules 生成 `public/vendor/` | 新建 |
| `admin/server/public/vendor/` | mermaid UMD + katex（js/css/woff2） | 生成物 |
| `admin/server/public/index.html` | `.split` 分栏结构 + vendor `<script>` | 修改 |
| `admin/server/public/style.css` | 分栏 flex + 预览排版 + 嵌入卡片样式 | 修改 |
| `admin/server/public/app.js` | 防抖渲染、竞态保护、分隔条拖动、KaTeX/Mermaid | 修改 |
| `tests/admin/preview.test.mjs` | preview 渲染器 + 路由契约测试 | 新建 |
| `tests/helpers.mjs` 等 3 个测试 | import 路径改指新位置 | 修改 |
| `docs/.vitepress/config.ts`、`docAnalysisEmbed.ts` | import 路径改指新位置 | 修改 |

---

### 任务 1：obsidianEmbed 移位到 admin/server/shared/

纯机械移动 + 改 import。**回归护栏是现有 96 个用例**——移位后必须全绿，否则说明有隐式依赖。

- [ ] **步骤 1：移动文件**

```bash
cd /home/weno/works/Notes-Atlas
mkdir -p admin/server/shared
git mv docs/.vitepress/plugins/obsidianEmbed.ts admin/server/shared/obsidianEmbed.js
```

- [ ] **步骤 2：改 5 处 import**

```bash
cd /home/weno/works/Notes-Atlas
# 站点配置
sed -i "s#from './plugins/obsidianEmbed'#from '../../admin/server/shared/obsidianEmbed.js'#" docs/.vitepress/config.ts
sed -i "s#from \"./obsidianEmbed.ts\"#from '../../../admin/server/shared/obsidianEmbed.js'#" docs/.vitepress/plugins/docAnalysisEmbed.ts
# 测试
sed -i "s#'../docs/.vitepress/plugins/obsidianEmbed.ts'#'../admin/server/shared/obsidianEmbed.js'#" tests/resolver.test.mjs tests/doc-analysis.test.mjs
sed -i 's#"../docs/.vitepress/plugins/obsidianEmbed.ts"#"../admin/server/shared/obsidianEmbed.js"#' tests/helpers.mjs
```

验证 5 处都改到：

```bash
cd /home/weno/works/Notes-Atlas
grep -rn "obsidianEmbed" --include='*.ts' --include='*.mjs' . 2>/dev/null | grep -v node_modules | grep -i "import\|from"
```

预期：5 行，全部指向 `admin/server/shared/obsidianEmbed.js`；不再有任何 `docs/.vitepress/plugins/obsidianEmbed` 引用。

- [ ] **步骤 3：给共享模块补一行说明注释**

在 `admin/server/shared/obsidianEmbed.js` 文件头注释里追加（放在现有 `规格:` 行后）：

```js
 * 本模块是 admin 预览与 VitePress 站点的**单一事实来源**——两端共用同一份，
 * 复制副本会导致预览与线上表现静默漂移。位置在 admin/server/shared/ 是因为
 * preview.js 以 `../shared/obsidianEmbed.js` 引入，该相对路径在本地仓库与
 * 容器镜像（包根 /app）中都成立。
```

- [ ] **步骤 4：跑全量用例确认无回归**

运行：`cd /home/weno/works/Notes-Atlas && npm test`
预期：`tests 96`、`pass 96`、`fail 0`

- [ ] **步骤 5：Commit**

```bash
cd /home/weno/works/Notes-Atlas
git add admin/server/shared/obsidianEmbed.js docs/.vitepress/config.ts docs/.vitepress/plugins/docAnalysisEmbed.ts tests/resolver.test.mjs tests/helpers.mjs tests/doc-analysis.test.mjs
git rm --cached docs/.vitepress/plugins/obsidianEmbed.ts 2>/dev/null || true
git commit -m "refactor(shared): obsidianEmbed 移至 admin/server/shared,消除预览与站点的双份漂移

预览需复用嵌入/双链解析,而该插件依赖 node:fs 遍历 vault,浏览器端不可行。
移位而非复制,保证两端永远同源;96 个现有用例全绿作为回归护栏。

位置选择:preview.js 以 ../shared/obsidianEmbed.js 引入,该相对路径在本地
包根(admin/server/)与容器包根(/app)下同时成立。"
```

---

### 任务 2：preview 渲染器（TDD）

- [ ] **步骤 1：添加 markdown-it 运行时依赖**

```bash
cd /home/weno/works/Notes-Atlas/admin/server
npm install markdown-it@^14.1.0
```

预期：`package.json` 的 `dependencies` 出现 `"markdown-it": "^14.1.0"`，`package-lock.json` 同步更新。
（`npm ci --omit=dev` 依赖 lock 与 package.json 一致，漏掉 lock 会让镜像构建失败。）

验证：

```bash
cd /home/weno/works/Notes-Atlas/admin/server && node -p "require('./package.json').dependencies['markdown-it']"
```

预期输出：`^14.1.0`

- [ ] **步骤 2：编写失败的测试**

创建 `tests/admin/preview.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPreviewRenderer } from "../../admin/server/src/preview.js";

const PAPER_DIR = ["01.组会材料", "02.论文笔记"];

/** 临时 vault：论文目录放嵌入目标,根目录放互相引用的循环对 */
function mkVault() {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "na-preview-"));
  const docsDir = path.join(siteDir, "docs");
  const paperDir = path.join(docsDir, ...PAPER_DIR);
  fs.mkdirSync(paperDir, { recursive: true });
  fs.writeFileSync(path.join(paperDir, "ADAPT.md"), "---\ntitle: ADAPT 论文\n---\n# 原始标题\n\n正文甲。\n");
  fs.writeFileSync(path.join(docsDir, "LoopA.md"), "![[LoopB]]\n");
  fs.writeFileSync(path.join(docsDir, "LoopB.md"), "![[LoopA]]\n");
  fs.writeFileSync(path.join(docsDir, "index.md"), "---\ntitle: 首页\n---\n# 首页\n");
  return { docsDir };
}

test("1 剥 frontmatter,只渲染正文", () => {
  const { docsDir } = mkVault();
  const r = createPreviewRenderer({ docsDir });
  const out = r.render("---\ntitle: T\n---\n# 正文标题\n", "index.md");
  assert.match(out.html, /<h1>正文标题<\/h1>/);
  assert.doesNotMatch(out.html, /title: T/, "frontmatter 原文不得进入预览");
  assert.equal(out.title, "T");
});

test("2 html:false —— 原文 HTML 被转义,不得产生可执行标签", () => {
  const { docsDir } = mkVault();
  const r = createPreviewRenderer({ docsDir });
  const out = r.render('<img src=x onerror=alert(1)>\n\n<script>alert(2)</script>\n', "index.md").html;
  assert.doesNotMatch(out, /<img[^>]*onerror/i);
  assert.doesNotMatch(out, /<script/i);
  assert.match(out, /&lt;img/);
});

test("3 [[双链]] → 站内链接", () => {
  const { docsDir } = mkVault();
  const r = createPreviewRenderer({ docsDir });
  const out = r.render("见 [[ADAPT]]。\n", "index.md").html;
  assert.match(out, /<a href="\/[^"]*ADAPT">/);
});

test("4 ![[嵌入]] → na-embed 卡片,目标标题降级为 h2", () => {
  const { docsDir } = mkVault();
  const r = createPreviewRenderer({ docsDir });
  const out = r.render("![[ADAPT]]\n", "index.md").html;
  assert.match(out, /class="na-embed"/);
  assert.match(out, /📎 论文笔记 · ADAPT 论文/);
  assert.match(out, /<h2>原始标题<\/h2>/, "目标笔记标题应 +1 级降级");
  assert.match(out, /正文甲。/);
});

test("5 循环嵌入 → 告警块,不栈溢出", () => {
  const { docsDir } = mkVault();
  const r = createPreviewRenderer({ docsDir });
  const out = r.render("![[LoopA]]\n", "index.md").html;
  assert.match(out, /嵌入循环/);
});

test("6 未命中目标 → 告警块而非抛错", () => {
  const { docsDir } = mkVault();
  const r = createPreviewRenderer({ docsDir });
  const out = r.render("![[不存在的笔记XYZ]]\n", "index.md").html;
  assert.match(out, /未找到嵌入笔记/);
});

test("7 畸形 frontmatter → 不抛,退回渲染全文", () => {
  const { docsDir } = mkVault();
  const r = createPreviewRenderer({ docsDir });
  const out = r.render("---\ntitle: [未闭合\n---\n# 仍要显示\n", "index.md");
  assert.match(out.html, /仍要显示/);
});
```

- [ ] **步骤 3：运行测试验证失败**

运行：`cd /home/weno/works/Notes-Atlas && node --test tests/admin/preview.test.mjs`
预期：FAIL，报错 `Cannot find module '../../admin/server/src/preview.js'`

- [ ] **步骤 4：实现最少代码**

创建 `admin/server/src/preview.js`：

```js
import MarkdownIt from "markdown-it";
import { obsidianEmbed } from "../shared/obsidianEmbed.js";
import { parseDoc } from "./frontmatter.js";

/**
 * 预览渲染器:markdown-it 单例 + obsidianEmbed(真实展开 ![[嵌入]] 与 [[双链]])。
 *
 * - html:false —— 与站点默认一致;parser 不生成 html token,原文 HTML 一律实体化。
 *   插件自建的 html_block token 属可信内容,插件内部已对 href/label 调 escapeHtml。
 * - resolver 跨请求复用:createResolver 的全库 walk() 索引只建一次,之后每次渲染
 *   只 readNote 实际嵌入的目标文件。MAX_EMBED_DEPTH 与循环检测由插件保证。
 * - 公式不装服务端插件:markdown-it 原样透传,KaTeX 在浏览器侧扫描排版。
 */
export function createPreviewRenderer({ docsDir }) {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
  obsidianEmbed(md, docsDir);

  return {
    render(content, relPath = "") {
      let body = content;
      let title = "";
      try {
        const parsed = parseDoc(content);
        body = parsed.body;
        title = typeof parsed.frontmatter.title === "string" ? parsed.frontmatter.title : "";
      } catch {
        // 畸形 frontmatter:退回渲染全文(可见降级,语义同 obsidianEmbed 的 readNote)
      }
      return { html: md.render(body, { relativePath: relPath }), title };
    },
  };
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`cd /home/weno/works/Notes-Atlas && node --test tests/admin/preview.test.mjs`
预期：`pass 7`、`fail 0`

- [ ] **步骤 6：跑全量确认无回归**

运行：`cd /home/weno/works/Notes-Atlas && npm test`
预期：`pass 96`（+7 = 103）、`fail 0`

- [ ] **步骤 7：Commit**

```bash
cd /home/weno/works/Notes-Atlas
git add admin/server/src/preview.js admin/server/package.json admin/server/package-lock.json tests/admin/preview.test.mjs
git commit -m "feat(admin): 预览渲染器 preview.js

markdown-it 单例(html:false)复用 obsidianEmbed,真实展开嵌入与双链。
resolver 跨请求复用,全库索引只建一次。畸形 frontmatter 退回全文不抛。
公式透传给浏览器侧 KaTeX,不引入 mathjax-full(8.9MB)。"
```

---

### 任务 3：/admin/api/preview 路由与鉴权契约

路由挂在现有 `onRequest` 钩子下（路径以 `/admin/api/` 开头即命中 cookie 校验），**不新增任何鉴权代码**。

- [ ] **步骤 1：编写失败的测试**

在 `tests/admin/preview.test.mjs` **追加**（需先改 import 与顶部 helper）：

把文件头的 import 块替换为：

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPreviewRenderer } from "../../admin/server/src/preview.js";
import { buildApp } from "../../admin/server/src/app.js";
import { createAuth, hashPassword } from "../../admin/server/src/auth.js";
import { createFiles } from "../../admin/server/src/files.js";
import { createBuildQueue } from "../../admin/server/src/build.js";
```

在文件末尾追加：

```js
const PASS = "pw-preview-123";
const HASH = hashPassword(PASS);

function mkApp() {
  const { docsDir } = mkVault();
  const siteDir = path.dirname(docsDir);
  const auth = createAuth({ secret: "preview-test-secret", user: "admin", passHash: HASH, stateDir: path.join(siteDir, ".state") });
  const files = createFiles({ docsDir, siteDir, execGit: async () => "abc1234" });
  const queue = createBuildQueue({ runBuild: async () => "ok", publish: async () => {}, debounceMs: 1 });
  const preview = createPreviewRenderer({ docsDir });
  return buildApp({ auth, files, queue, preview, config: { cookieSecure: true } });
}

async function loginPair(app) {
  const res = await app.inject({ method: "POST", url: "/admin/api/login", payload: { user: "admin", pass: PASS } });
  assert.equal(res.statusCode, 204);
  return res.headers["set-cookie"][0].split(";")[0];
}

test("8 未登录 POST /preview → 401 {code,message}", async () => {
  const app = mkApp();
  const res = await app.inject({ method: "POST", url: "/admin/api/preview", payload: { content: "# x" } });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().code, "UNAUTHENTICATED");
});

test("9 已登录 POST /preview → 200 {html,title}", async () => {
  const app = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({
    method: "POST",
    url: "/admin/api/preview",
    headers: { cookie },
    payload: { content: "---\ntitle: 我的笔记\n---\n# 正文\n", path: "index.md" },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.match(body.html, /<h1>正文<\/h1>/);
  assert.equal(body.title, "我的笔记");
});

test("10 已登录但 body 缺 content → 不 500,按空串渲染", async () => {
  const app = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({ method: "POST", url: "/admin/api/preview", headers: { cookie }, payload: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.json().html, "string");
});

test("11 GET /preview → 404(仅接受 POST)", async () => {
  const app = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({ method: "GET", url: "/admin/api/preview", headers: { cookie } });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().code, "NOT_FOUND");
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd /home/weno/works/Notes-Atlas && node --test tests/admin/preview.test.mjs`
预期：测试 8 PASS（鉴权钩子已覆盖），测试 9/10 FAIL（404 `NOT_FOUND`），测试 11 PASS

- [ ] **步骤 3：装配路由**

修改 `admin/server/src/app.js`。第 22 行的函数签名加入 `preview`：

```js
export function buildApp({ auth, files, queue, preview, config = {} }) {
```

在 `app.get("/admin/api/tree", ...)` **之前**插入路由：

```js
  // 预览渲染:html:false 防 XSS(规格 §7),解析失败经既有 setErrorHandler 收口为 INTERNAL
  app.post("/admin/api/preview", async (req) => {
    const r = preview.render(req.body?.content ?? "", req.body?.path ?? "");
    return { html: r.html, title: r.title };
  });

```

- [ ] **步骤 4：注入渲染器**

修改 `admin/server/src/index.js`。在 `const files = ...` 之后、`const app = ...` 之前插入：

```js
const preview = createPreviewRenderer({ docsDir: path.join(SITE, "docs") });
```

在文件顶部 import 区加入：

```js
import { createPreviewRenderer } from "./preview.js";
```

并把 `buildApp` 调用改为：

```js
const app = buildApp({ auth, files, queue, preview, config: { cookieSecure: process.env.COOKIE_SECURE !== "0" } });
```

- [ ] **步骤 5：修正既有 app 测试的构造调用**

`tests/admin/app.test.mjs` 的 `mkApp()` 需传入 `preview`。现有 16 个用例都没有调用
`/admin/api/preview`，所以**不会**因此报错；但不注入会让该文件的 `buildApp` 调用与
`index.js` 的真实装配不一致，日后有人在此文件加预览用例就会踩 `preview is not a function`。

在文件顶部 import 区加入：

```js
import { createPreviewRenderer } from "../../admin/server/src/preview.js";
```

在 `mkApp` 内 `const app = buildApp({ auth, files, queue, config: { cookieSecure: true } });` 之前插入：

```js
  const preview = createPreviewRenderer({ docsDir });
```

并把该行改为：

```js
  const app = buildApp({ auth, files, queue, preview, config: { cookieSecure: true } });
```

- [ ] **步骤 6：运行测试验证通过**

运行：`cd /home/weno/works/Notes-Atlas && node --test tests/admin/preview.test.mjs tests/admin/app.test.mjs`
预期：`pass 25`（preview 11 + app 16 减去重叠计数，以实际为准）、`fail 0`；重点确认无 FAIL

- [ ] **步骤 7：跑全量确认无回归**

运行：`cd /home/weno/works/Notes-Atlas && npm test`
预期：`fail 0`，总数 = 96 + 11 = 107

- [ ] **步骤 8：Commit**

```bash
cd /home/weno/works/Notes-Atlas
git add admin/server/src/app.js admin/server/src/index.js tests/admin/preview.test.mjs tests/admin/app.test.mjs
git commit -m "feat(admin): POST /admin/api/preview 路由

路径以 /admin/api/ 开头即命中既有 onRequest 鉴权钩子,不新增鉴权代码;
错误统一走既有 setErrorHandler 与 SEMANTIC 白名单。缺 content 按空串渲染不 500。"
```

---

### 任务 4：vendor 依赖落地

从根 `node_modules` 生成，不手抄。mermaid 的 `dist/` 整包 75MB/217 个 ESM chunk 不可整体 vendor，只取自包含 UMD 单文件。

- [ ] **步骤 1：编写生成脚本**

创建 `admin/server/scripts/fetch-vendor.mjs`：

```js
/**
 * 从仓库根 node_modules 生成 admin 前端预览所需的浏览器库到 public/vendor/。
 * 版本以根 package.json 的 devDependencies 为准(mermaid ^11.15.0 / katex 0.16.x)。
 * 不手抄:升级根依赖后重跑本脚本即可。
 *
 * 只取 woff2 字体(20 个 ttf/woff 是给旧浏览器的回退,现代浏览器不需要)。
 * mermaid 只取 dist/mermaid.min.js:该 UMD 末尾执行
 * globalThis["mermaid"] = ... ,自包含单文件;整包 dist 有 217 个 ESM chunk/75MB。
 */
import { copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NM = resolve(HERE, "..", "..", "..", "node_modules"); // 仓库根 node_modules
const OUT = join(HERE, "..", "public", "vendor");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "katex"), { recursive: true });

copyFileSync(join(NM, "mermaid/dist/mermaid.min.js"), join(OUT, "mermaid.min.js"));
copyFileSync(join(NM, "katex/dist/katex.min.js"), join(OUT, "katex/katex.min.js"));
copyFileSync(join(NM, "katex/dist/katex.min.css"), join(OUT, "katex/katex.min.css"));
copyFileSync(join(NM, "katex/dist/contrib/auto-render.min.js"), join(OUT, "katex/auto-render.min.js"));
cpSync(join(NM, "katex/dist/fonts"), join(OUT, "katex/fonts"), {
  recursive: true,
  filter: (src) => !/\.(ttf|woff|eot|svg)$/.test(src),
});

console.log(`vendor 已生成 → ${OUT}`);
```

- [ ] **步骤 2：运行脚本**

运行：`cd /home/weno/works/Notes-Atlas && node admin/server/scripts/fetch-vendor.mjs`
预期输出：`vendor 已生成 → /home/weno/works/Notes-Atlas/admin/server/public/vendor`

- [ ] **步骤 3：验证产物完整且体积合理**

运行：

```bash
cd /home/weno/works/Notes-Atlas/admin/server/public/vendor
ls -la mermaid.min.js katex/katex.min.js katex/katex.min.css katex/auto-render.min.js
echo "--- 字体(应只有 woff2) ---"; ls katex/fonts | sed 's/.*\.//' | sort -u
echo "--- 总计 ---"; du -sh .
```

预期：
- `mermaid.min.js` ≈ 3.3MB（3,312,967 字节）
- `katex.min.js` ≈ 280KB，`katex.min.css` ≈ 23KB，`auto-render.min.js` 存在
- 字体扩展名只有 `woff2`
- 总体积 ≈ 4MB（**不应接近 75MB**——若接近说明 filter 没生效）

- [ ] **步骤 4：验证 mermaid UMD 确实挂上全局**

运行：`cd /home/weno/works/Notes-Atlas && tail -c 200 admin/server/public/vendor/mermaid.min.js | grep -o 'globalThis\["mermaid"\]'`
预期输出：`globalThis["mermaid"]`

- [ ] **步骤 5：Commit**

```bash
cd /home/weno/works/Notes-Atlas
git add admin/server/scripts/fetch-vendor.mjs admin/server/public/vendor
git commit -m "build(admin): vendor 预览所需的 mermaid + katex

从根 node_modules 生成而非手抄,升级根依赖后重跑 fetch-vendor.mjs 即可。
mermaid 只取自包含 UMD(整包 dist 75MB/217 chunk 不可整体 vendor);
katex 字体只保留 woff2。不引 CDN:避免供应链风险 + 境内网络不可达。"
```

---

### 任务 5：前端分栏结构与样式

**注意**：本任务是上一个 UI bug 的高发区。`min-width:0` / `min-height:0` / `flex-shrink:0` 必须显式写出——上次「文档内容挤在左上角」正是因为缺这些属性，textarea 退回默认 20×2 固有尺寸。

- [ ] **步骤 1：改 HTML 结构**

修改 `admin/server/public/index.html`。

把 `</head>` 前的 vendor 引入（第 7 行 `<link>` 之后）替换为：

```html
  <link rel="stylesheet" href="/admin/style.css">
  <link rel="stylesheet" href="/admin/vendor/katex/katex.min.css">
```

把 `</body>` 前的 script 引入（第 75 行）替换为：

```html
  <script src="/admin/vendor/mermaid.min.js"></script>
  <script src="/admin/vendor/katex/katex.min.js"></script>
  <script src="/admin/vendor/katex/auto-render.min.js"></script>
  <script src="/admin/app.js"></script>
```

把 `#editor-content` 内部（第 55-69 行，从 `<div id="editor-content" class="hidden">` 到其配对 `</div>`）替换为：

```html
          <div id="editor-content" class="hidden">
            <div class="split" id="split">
              <div class="pane pane-source">
                <div class="editor-header">
                  <input type="text" id="file-path" readonly>
                  <div class="editor-actions">
                    <button id="save-btn" class="btn-primary">保存</button>
                    <button id="delete-btn" class="btn-danger">删除</button>
                    <button id="rename-btn" class="btn-secondary">重命名</button>
                  </div>
                </div>
                <div class="editor-info">
                  <span id="file-mtime"></span>
                  <span id="parse-error" class="error"></span>
                </div>
                <textarea id="editor" spellcheck="false"></textarea>
              </div>
              <div class="divider" id="divider" role="separator" aria-orientation="vertical" title="拖动调整宽度"></div>
              <div class="pane pane-preview">
                <div class="preview-body" id="preview"></div>
              </div>
            </div>
          </div>
```

- [ ] **步骤 2：改 CSS**

修改 `admin/server/public/style.css`。在文件末尾（滚动条样式之后）追加：

```css
/* ===== 预览分栏 =====
   flex 布局的三个必备属性(min-width:0 / min-height:0 / flex-shrink:0)显式声明,
   否则子元素会退回内容固有尺寸——这正是"内容挤在左上角"事故的根因。 */
.split {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 100%;
  --split: 50%;
}

.pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pane-source {
  flex: 0 0 var(--split);
}

.divider {
  flex: 0 0 6px;
  cursor: col-resize;
  background: var(--border);
  transition: background 0.15s;
}

.divider:hover,
.divider.dragging {
  background: var(--accent);
}

.pane-preview {
  flex: 1;
  overflow-y: auto;
  background: var(--bg);
}

.preview-body {
  padding: 1.25rem 1.5rem;
  line-height: 1.75;
  font-size: 0.95rem;
  overflow-wrap: break-word;
}

.preview-body > :first-child { margin-top: 0; }
.preview-body h1 { font-size: 1.6rem; margin: 1.2em 0 0.6em; }
.preview-body h2 { font-size: 1.3rem; margin: 1.2em 0 0.5em; }
.preview-body h3 { font-size: 1.1rem; margin: 1em 0 0.4em; }
.preview-body p { margin: 0.7em 0; }
.preview-body a { color: var(--accent); }
.preview-body ul, .preview-body ol { padding-left: 1.5em; margin: 0.6em 0; }
.preview-body blockquote {
  margin: 0.8em 0;
  padding: 0.3em 1em;
  border-left: 3px solid var(--border);
  color: var(--text-muted);
}
.preview-body code {
  background: var(--bg-tertiary);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.88em;
  font-family: "JetBrains Mono", "Fira Code", monospace;
}
.preview-body pre {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.9em 1em;
  overflow-x: auto;
  margin: 0.8em 0;
}
.preview-body pre code { background: none; padding: 0; }
.preview-body img { max-width: 100%; border-radius: 4px; }
.preview-body table {
  border-collapse: collapse;
  margin: 0.8em 0;
  display: block;
  overflow-x: auto;
}
.preview-body th, .preview-body td {
  border: 1px solid var(--border);
  padding: 0.4em 0.8em;
}
.preview-body th { background: var(--bg-secondary); }
.preview-body hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }

/* 嵌入卡片(移植自 docs/.vitepress/theme/styles/embed.scss) */
.preview-body .na-embed {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 1em 0;
  overflow: hidden;
  background: var(--bg-secondary);
}
.preview-body .na-embed-source {
  display: block;
  padding: 0.5em 0.9em;
  background: var(--bg-tertiary);
  color: var(--accent);
  font-size: 0.85rem;
  text-decoration: none;
  font-weight: 600;
}
.preview-body .na-embed-body { padding: 0.2em 1em; }
.preview-body .na-embed-warning {
  border: 1px solid var(--warning);
  background: rgba(224, 175, 104, 0.12);
  color: var(--warning);
  padding: 0.5em 0.9em;
  border-radius: 6px;
  margin: 0.8em 0;
  font-size: 0.9rem;
}

.preview-error {
  color: var(--danger);
  background: rgba(247, 118, 142, 0.1);
  border: 1px solid var(--danger);
  border-radius: 6px;
  padding: 0.6em 0.9em;
  font-size: 0.9rem;
}

.preview-empty { color: var(--text-muted); }
```

同时把原文件第 269-275 行的 `#editor-content` 块改为——**去掉 `height: 100%`**，
改用 `min-height: 0`，让内部 `.split` 的 `height: 100%` 生效且不撑破容器：

```css
#editor-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
```

`.editor-header` / `.editor-info` 原有的 `flex-shrink: 0` **保留不动**（在 `.pane-source`
这个新的 flex 容器里依然正确且必要）。`#editor-content.hidden { display: none; }` 也保留。

- [ ] **步骤 3：人工核对结构自闭合**

运行：`cd /home/weno/works/Notes-Atlas && node -e "
const h=require('fs').readFileSync('admin/server/public/index.html','utf8');
const open=(h.match(/<div/g)||[]).length, close=(h.match(/<\/div>/g)||[]).length;
console.log('div open',open,'close',close, open===close?'✅ 配平':'❌ 不配平');
console.log('split', h.includes('class=\"split\"')?'✅':'❌');
console.log('divider', h.includes('id=\"divider\"')?'✅':'❌');
console.log('preview', h.includes('id=\"preview\"')?'✅':'❌');
console.log('vendor css', h.includes('katex.min.css')?'✅':'❌');
console.log('vendor js', h.includes('mermaid.min.js')&&h.includes('auto-render.min.js')?'✅':'❌');
"`

预期：`div open N close N ✅ 配平`，其余四项全 ✅

- [ ] **步骤 4：Commit**

```bash
cd /home/weno/works/Notes-Atlas
git add admin/server/public/index.html admin/server/public/style.css
git commit -m "feat(admin): 编辑区改为左右分栏,显式声明 flex 尺寸约束

显式写 min-width:0 / min-height:0 / flex-shrink:0 —— 上次'内容挤在左上角'
事故的根因就是缺这些属性导致 textarea 退回 20x2 固有尺寸。
预览排版样式 + 移植 embed.scss 的 na-embed 卡片样式。引入 vendor 的 katex css/js。"
```

---

### 任务 6：前端防抖渲染 + 竞态保护 + KaTeX/Mermaid

- [ ] **步骤 1：在 app.js 顶部加 DOM 引用与状态**

修改 `admin/server/public/app.js`。在 `const lastCommit = $('last-commit');` 之后追加：

```js
const previewEl = $('preview');
const split = $('split');
const divider = $('divider');

// 防抖 + 竞态:序号只增,过期响应直接丢弃,避免连续打字时预览内容倒退
let previewTimer = null;
let previewSeq = 0;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
```

- [ ] **步骤 2：追加渲染逻辑**

在 `admin/server/public/app.js` 文件末尾追加：

```js
// ===== 预览 =====

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 300);
}

async function renderPreview() {
  const seq = ++previewSeq;
  const content = editor.value;
  const path = currentFile || '';
  if (!content.trim()) {
    previewEl.innerHTML = '<p class="preview-empty">（空文档）</p>';
    return;
  }
  try {
    const data = await api('/preview', {
      method: 'POST',
      body: JSON.stringify({ content, path }),
    });
    if (seq !== previewSeq) return; // 过期响应,丢弃
    previewEl.innerHTML = data.html;
    renderMath();
    renderMermaid();
  } catch (err) {
    if (seq !== previewSeq) return;
    previewEl.innerHTML = `<p class="preview-error">预览渲染失败：${escapeHtml(err.message)}</p>`;
  }
}

// KaTeX 纯客户端排版:markdown-it 未装数学插件,公式原样透传
// 定界符与站点 markdown-it-mathjax3 一致(含单 $ —— 全库真实笔记有 146 处)
function renderMath() {
  if (typeof renderMathInElement !== 'function') return;
  try {
    renderMathInElement(previewEl, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false, // 解析失败退回原文,不中断整篇
    });
  } catch (err) {
    console.error('公式排版失败:', err);
  }
}

async function renderMermaid() {
  if (!window.mermaid) return;
  const nodes = previewEl.querySelectorAll('.language-mermaid:not([data-processed])');
  if (!nodes.length) return;
  try {
    await window.mermaid.run({ nodes });
  } catch (err) {
    // 单图语法错只坏该图,mermaid 会把错误写进该节点
    console.error('mermaid 渲染失败:', err);
  }
}

editor.addEventListener('input', schedulePreview);

// 分隔条拖动:clamp 20%~80%,避免任一侧被压到不可用
let dragging = false;
divider.addEventListener('mousedown', (e) => {
  dragging = true;
  divider.classList.add('dragging');
  e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const r = split.getBoundingClientRect();
  const pct = ((e.clientX - r.left) / r.width) * 100;
  split.style.setProperty('--split', Math.min(80, Math.max(20, pct)) + '%');
});
window.addEventListener('mouseup', () => {
  dragging = false;
  divider.classList.remove('dragging');
});
```

- [ ] **步骤 3：打开文件时立即渲染一次**

修改 `openFile` 函数。在 `highlightActive(path);` 之后追加：

```js
    // 打开即渲染一次,不等用户输入
    schedulePreview();
```

- [ ] **步骤 4：语法自检**

运行：`cd /home/weno/works/Notes-Atlas && node --check admin/server/public/app.js`
预期：无输出（退出码 0）

若报 `Cannot use import statement` 之类，说明文件被当 ESM 解析——本文件是普通脚本，
不应出现 import/export。检查是否误加了 import。

- [ ] **步骤 5：确认 vendor 文件在部署上下文中存在**

运行：

```bash
cd /home/weno/works/Notes-Atlas
for f in admin/server/public/vendor/mermaid.min.js admin/server/public/vendor/katex/katex.min.js admin/server/public/vendor/katex/katex.min.css admin/server/public/vendor/katex/auto-render.min.js; do
  test -f "$f" && echo "✅ $f" || echo "❌ 缺失 $f"
done
```

预期：四行全 ✅

- [ ] **步骤 6：Commit**

```bash
cd /home/weno/works/Notes-Atlas
git add admin/server/public/app.js
git commit -m "feat(admin): 预览防抖渲染 + 竞态保护 + KaTeX/Mermaid + 分隔条拖动

300ms 防抖;请求序号丢弃过期响应,连续打字时预览不倒退。
公式用 KaTeX auto-render(含单 \$ 定界符,真实笔记有 146 处),
throwOnError:false 使误判退回原文;mermaid 单图失败不影响其余内容。
预览失败只显示在预览区,不阻断源码编辑与保存。"
```

---

### 任务 7：部署与线上验证

**关键**：`docker compose up -d` 不带 `--build` 会复用旧镜像——这正是上次「源码已修、线上未修」的事故根因。

- [ ] **步骤 1：本地冒烟（不部署也能验证接口）**

运行：

```bash
cd /home/weno/works/Notes-Atlas
SITE_DIR=/opt/notes-atlas \
ADMIN_USER=admin \
ADMIN_PASS_HASH='$2a$10$abcdefghijklmnopqrstuv' \
TOKEN_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
node --input-type=module -e "
import { createPreviewRenderer } from './admin/server/src/preview.js';
const r = createPreviewRenderer({ docsDir: '/home/weno/works/Notes-Atlas/docs' });
const out = r.render('![[ADAPT]]\n\n行内公式 \$E=mc^2\$ 与图表：\n\n\`\`\`mermaid\ngraph TD;A-->B;\n\`\`\`\n', 'index.md');
console.log('含嵌入卡片:', out.html.includes('na-embed'));
console.log('含公式定界符(交由 KaTeX):', out.html.includes('E=mc^2'));
console.log('含 mermaid 代码块:', out.html.includes('language-mermaid'));
"
```

预期输出三行全为 `true`。若第一行为 false，检查 `docs/01.组会材料/02.论文笔记/ADAPT.md` 是否存在。

- [ ] **步骤 2：同步到服务器构建上下文**

```bash
cd /home/weno/works/Notes-Atlas
rsync -av --delete \
  --exclude node_modules --exclude .state --exclude .env \
  admin/server/ web:/data/stacks/admin/
```

预期：输出中出现 `shared/obsidianEmbed.js`、`public/vendor/mermaid.min.js`

- [ ] **步骤 3：核对服务器构建上下文完整性**

```bash
ssh web 'cd /data/stacks/admin && ls shared/ public/vendor/ && md5sum shared/obsidianEmbed.js'
```

预期：两处各列出文件，`obsidianEmbed.js` 有 md5

**必须核对**（避免再次出现镜像与源码不符）：

```bash
ssh web 'cd /data/stacks/admin && md5sum src/app.js src/index.js src/preview.js public/index.html public/style.css public/app.js'
ssh web 'cd /home/weno/works/Notes-Atlas && md5sum admin/server/src/app.js admin/server/src/index.js admin/server/src/preview.js admin/server/public/index.html admin/server/public/style.css admin/server/public/app.js'
```

两组 md5 **必须逐行一致**。

- [ ] **步骤 4：打回滚标签**

```bash
ssh web 'docker tag admin-admin:latest admin-admin:rollback-$(date +%Y%m%d-%H%M%S) && docker images admin-admin --format "{{.Repository}}:{{.Tag}}  {{.ID}}"'
```

预期：输出含新 `rollback-` 标签与 `latest`

- [ ] **步骤 5：重建并重启（必须带 --build）**

```bash
ssh web 'cd /data/stacks/admin && docker compose up -d --build 2>&1 | tail -15'
```

预期：`COPY public` / `COPY shared` 层不是 `CACHED`（内容变了应重建），容器 `Started`

- [ ] **步骤 6：验证容器内文件与源码一致**

```bash
ssh web 'docker exec admin-admin-1 sh -c "cd /app && md5sum src/preview.js shared/obsidianEmbed.js public/index.html public/app.js && ls public/vendor"'
```

预期：md5 与步骤 3 本地一致；`public/vendor` 列出 `mermaid.min.js` 与 `katex`

- [ ] **步骤 7：验证线上接口与静态资源**

```bash
curl -s -o /dev/null -w "GET  /admin/            -> %{http_code}\n" https://blogs.lovetulin.cn/admin/
curl -s -o /dev/null -w "GET  /admin/style.css   -> %{http_code}\n" https://blogs.lovetulin.cn/admin/style.css
curl -s -o /dev/null -w "GET  /admin/vendor/mermaid.min.js -> %{http_code}\n" https://blogs.lovetulin.cn/admin/vendor/mermaid.min.js
curl -s -o /dev/null -w "GET  /admin/vendor/katex/katex.min.css -> %{http_code}\n" https://blogs.lovetulin.cn/admin/vendor/katex/katex.min.css
curl -s -o /dev/null -w "POST /admin/api/preview -> %{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{"content":"# x"}' https://blogs.lovetulin.cn/admin/api/preview
```

预期：前四项 `200`；`POST` 返回 `401`（未带 cookie，鉴权钩子拦截）

- [ ] **步骤 8：验证容器日志无异常**

```bash
ssh web 'docker logs --tail 20 admin-admin-1 2>&1'
```

预期：出现 `[admin] notes-admin listening on 0.0.0.0:8477 (site=/opt/notes-atlas)`，无 stack trace

- [ ] **步骤 9：人工验收（需登录）**

浏览器打开 `https://blogs.lovetulin.cn/admin/`，登录后打开一篇含 `![[...]]` 嵌入的笔记
（如 `01.组会材料/01.组会内容/20251020.md`），逐项确认：

1. 左右分栏显示，分隔条可拖动
2. 预览区**撑满右半边**（不是缩在左上角的小框）
3. `![[论文]]` 展开为带边框的卡片，显示「📎 论文笔记 · 标题」
4. 点击文件树展开 `[[双链]]` 渲染为可点链接
5. 含公式的笔记（`0002.transformer架构.md`）公式排版正常
6. 含 mermaid 的笔记（`第二章：Docker底层实现原理.md`）图表渲染，`<br/>` 节点标签正常
7. 连续打字时预览不倒退、不闪烁
8. 点「保存」正常，构建状态条走完

任一项不符 → 停止并排查，**不要**继续下一个任务。

- [ ] **步骤 10：Commit 部署记录**

```bash
cd /home/weno/works/Notes-Atlas
git add -A
git commit -m "chore(admin): 预览功能部署上线

docker compose up -d --build 显式带 --build,避免复用过期镜像
(上次 UI 事故的根因)。已核对构建上下文与容器内 md5 与本地一致。"
```

---

## 完成标准

- [ ] `npm test` 全绿（96 + 11 = 107 用例，0 fail）
- [ ] `node --check admin/server/public/app.js` 通过
- [ ] 线上 `/admin/api/preview` 未登录 401、已登录 200
- [ ] 线上 vendor 资源 200
- [ ] 任务 7 步骤 9 的 8 项人工验收全部通过
- [ ] 构建上下文与容器内文件 md5 与本地一致

## 遗留项（不在本计划范围，建议后续单独处理）

1. `admin/server/public/` 整个目录未被 git 跟踪——本计划会把它纳入版本控制，但根因是历史遗留，建议复查 `.gitignore`
2. `.github/workflows/deploy.yml` 的 "Upload admin frontend" 步骤推到不存在的 `/data/stacks/blogs/admin/`，且 `paths:` 不含 `admin/**` → 改 admin 不会触发 CI，实际部署靠手工同步。建议删除该无效步骤并补 `admin/**` 触发路径
