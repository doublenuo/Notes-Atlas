---
date: 2026-09-24 00:01:59
title: 2026-09-23-obsidian-embed
---
# Obsidian 式笔记嵌入（`! [[]]` / `[[]]`）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让组会内容页的 `![[论文名]]`（独立成行）渲染为全文嵌入卡片，`[[引用]]` 渲染为站内链接。

**架构：** 自写 markdown-it 插件（零新依赖）：resolver 解析目标 → 块规则读文件、剥 frontmatter、标题降级、用同一 md 实例 parse 出 token 拼接并包卡片壳；内联规则处理 `[[]]`。发生于 markdown 管线内部，公式/锚点/高亮自动正确。规格见 `docs/superpowers/specs/2026-09-23-obsidian-embed-design.md`（已获批）。

**技术栈：** VitePress 1.6.4（`createMarkdownRenderer` 作测试入口）、markdown-it 自定义规则、gray-matter（已验证可从根 node_modules 解析）、Node v24 内置 `node --test`、Puppeteer headless 验收（工具装在 `/tmp/opencode`，不动项目依赖）。

---

## 环境前提

- dev server：`http://localhost:5173`（用户已在跑；若未跑：`npm run docs:dev -- --port 5173` 后台启动）
- headless 脚本写到 `/tmp/opencode/` 下执行（该目录已有 `puppeteer-core`，Chrome = `/usr/bin/google-chrome`）
- 所有 `git add` 用**显式路径**（仓库有大量其他未提交改动，禁止 `git add -A`）

## 文件结构

| 文件 | 职责 |
|---|---|
| 创建 `docs/.vitepress/plugins/obsidianEmbed.ts` | 插件本体：resolver + 块规则 + 内联规则 + 卡片 token 渲染 |
| 创建 `tests/helpers.mjs` | 测试公共件：`makeMd(root)`、`VAULT`、`DOCS` 路径 |
| 创建 `tests/resolver.test.mjs` | resolver 单测（任务 1） |
| 创建 `tests/embed.test.mjs` | 嵌入渲染单测（任务 2） |
| 创建 `tests/embed-errors.test.mjs` | 缺失/循环/深度告警单测（任务 3） |
| 创建 `tests/wikilink.test.mjs` | `[[]]` 链接单测（任务 4） |
| 创建 `tests/fixtures/vault/**` | 隔离测试库（10 个 md，见任务 1） |
| 修改 `package.json` | 增加 `"test": "node --test \"tests/**/*.test.mjs\""` |
| 修改 `docs/.vitepress/config.ts` | `markdown.config` 注册插件（任务 5） |
| 创建 `docs/.vitepress/theme/styles/embed.scss` | 卡片/告警样式，亮暗色（任务 5） |
| 修改 `docs/.vitepress/theme/index.ts` | 引入 `embed.scss`（任务 5） |

命名约定（全任务一致，勿改）：`createResolver(docsRoot)` → `resolveNote(target)` 返回 `{absPath, relPath} | null`；`readNote(absPath)` 返回 `{title, permalink, content}`；`noteHref(relPath, permalink)`；`obsidianEmbed(md, docsRoot)`；`createEmbedRule(md, resolveNote)`；`createWikilinkRule(resolveNote)`；`makeMd(root)`。

---

### 任务 1：测试骨架 + 文件解析器（resolver）

**文件：**
- 修改：`package.json:13-17`
- 创建：`tests/fixtures/vault/**`（15 个文件）
- 创建：`tests/resolver.test.mjs`
- 创建：`docs/.vitepress/plugins/obsidianEmbed.ts`

- [ ] **步骤 1：package.json 加测试脚本**

将：

```json
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  }
```

改为：

```json
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs",
    "test": "node --test \"tests/**/*.test.mjs\""
  }
```

注：glob 形态为必需——Node 21+ 的 `--test` 不再把裸目录当递归测试入口（会报 `Cannot find module '<dir>'`），本机 Node v24.14.0 两种形态实测后取 glob（作用域仍限 `tests/`）。

- [ ] **步骤 2：创建测试夹具库（15 个文件）**

`tests/fixtures/vault/01.组会材料/02.论文笔记/Alpha.md`：

```markdown
---
title: Alpha
date: 2026-01-01 00:00:00
---
# Alpha 大标题

## 小节标题

嵌入正文段落。

$$
E = mc^2
$$
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/有链接.md`：

```markdown
---
title: 有链接
permalink: /meet/haslink
---
# 有链接标题
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/无标题.md`：

```markdown
# 无标题内容
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/CycleA.md`：

```markdown
# CycleA 标题

A 正文。

![[CycleB]]
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/CycleB.md`：

```markdown
# CycleB 标题

![[CycleA]]
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/L1.md`：

```markdown
# L1

![[L2]]
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/L2.md`：

```markdown
# L2

![[L3]]
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/L3.md`：

```markdown
# L3

![[L4]]
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/L4.md`：

```markdown
# L4 终点
```

`tests/fixtures/vault/02.学习笔记/Alpha.md`（同名诱饵，验证论文笔记目录优先）：

```markdown
# 学习版 Alpha
```

`tests/fixtures/vault/02.学习笔记/第三章：测试.md`：

```markdown
# 第三章：测试

测试段落。
```

`tests/fixtures/vault/@fragment/Trap.md` 与 `tests/fixtures/vault/.vitepress/Trap2.md`（内容均为）：

```markdown
# 不该被找到
```

`tests/fixtures/vault/02.学习笔记/重复.md` 与 `tests/fixtures/vault/03.其他/重复.md`（同名歧义对，验证字典序取首 + 告警）：

```markdown
# 重复笔记
```

- [ ] **步骤 3：写失败的测试**

创建 `tests/resolver.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createResolver } from '../docs/.vitepress/plugins/obsidianEmbed.ts';

const VAULT = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'vault');
const resolveNote = createResolver(VAULT);

test('论文笔记目录优先于同名全局匹配', () => {
  const r = resolveNote('Alpha');
  assert.ok(r, '应能解析 Alpha');
  assert.equal(r.relPath, '01.组会材料/02.论文笔记/Alpha.md');
});

test('支持带路径的目标（相对 docs 根）', () => {
  const r = resolveNote('02.学习笔记/第三章：测试');
  assert.ok(r);
  assert.equal(r.relPath, '02.学习笔记/第三章：测试.md');
});

test('目标不存在或越界逃逸 vault 均返回 null', () => {
  assert.equal(resolveNote('压根没有这个笔记'), null);
  // vault 外真实存在的 .md：必须命中 toRel 的 `..` 防护而非 existsSync 分支
  assert.equal(resolveNote('../../../README'), null);
});

test('排除目录（@fragment、.vitepress）不参与解析', () => {
  assert.equal(resolveNote('Trap'), null);
  assert.equal(resolveNote('Trap2'), null);
});

test('可剥掉 .md 后缀', () => {
  const r = resolveNote('Alpha.md');
  assert.ok(r);
  assert.equal(r.relPath, '01.组会材料/02.论文笔记/Alpha.md');
});

test('多个同名文件取字典序第一个并告警', () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    const r = resolveNote('重复');
    assert.equal(r?.relPath, '02.学习笔记/重复.md');
    assert.ok(warnings.some((w) => w.includes('重复')), '应有同名告警');
  } finally {
    console.warn = origWarn;
  }
});
```

- [ ] **步骤 4：运行测试验证失败**

运行：`npm run test`

预期：FAIL，错误含 `Cannot find module`（指向 `docs/.vitepress/plugins/obsidianEmbed.ts`）——模块缺失时 node --test 按**文件级**报 1 fail（探针实测模式），不是逐用例计数。

- [ ] **步骤 5：编写最少实现代码**

创建 `docs/.vitepress/plugins/obsidianEmbed.ts`：

```js
/**
 * Obsidian 风格 wiki 语法插件：
 * - `![[目标]]`（独立成行）→ 全文嵌入为卡片
 * - `[[目标]]`（行内）→ 站内链接
 * 规格：docs/superpowers/specs/2026-09-23-obsidian-embed-design.md
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve as pathResolve, relative, basename, sep } from "node:path";
import matter from "gray-matter";

export const PAPER_NOTES_DIR = "01.组会材料/02.论文笔记";
const EXCLUDED_DIRS = new Set([".vitepress", "node_modules", "dist", "public", "@fragment"]);

/** 创建带缓存的文件解析器：(target) => { absPath, relPath } | null。target 为纯路径——`#标题`/`|别名` 写法属规格非目标，按字面目标解析、未命中回退原文渲染 */
export function createResolver(docsRoot) {
  const cache = new Map();

  function walk(dir, out = []) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (EXCLUDED_DIRS.has(e.name)) continue;
        walk(join(dir, e.name), out);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push(join(dir, e.name));
      }
    }
    return out;
  }

  return function resolveNote(target) {
    const key = target.replace(/\.md$/i, "");
    if (cache.has(key)) return cache.get(key);

    let result = null;
    const toRel = (absPath) => {
      const relPath = relative(docsRoot, absPath);
      return relPath.startsWith("..") ? null : { absPath, relPath };
    };

    if (key.includes("/")) {
      const abs = pathResolve(docsRoot, key + ".md");
      if (existsSync(abs)) result = toRel(abs);
    } else {
      const inPapers = pathResolve(docsRoot, PAPER_NOTES_DIR, key + ".md");
      if (existsSync(inPapers)) {
        result = toRel(inPapers);
      } else {
        const matches = walk(docsRoot)
          .filter((f) => basename(f) === key + ".md")
          .sort();
        if (matches.length > 1) {
          console.warn(`[obsidianEmbed] "${target}" 有 ${matches.length} 个同名文件，取第一个：${matches[0]}`);
        }
        if (matches.length) result = toRel(matches[0]);
      }
    }
    if (result) cache.set(key, result); // 负结果不缓存：dev 下新建笔记可被即时解析
    return result;
  };
}
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npm run test`

预期：PASS，`tests/resolver.test.mjs` 6 个用例全绿（其余测试文件尚不存在）。

- [ ] **步骤 7：Commit**

```bash
git add package.json tests/ docs/.vitepress/plugins/obsidianEmbed.ts
git commit -m "test(obsidian-embed): 测试骨架与文件解析器"
```

---

### 任务 2：`! [[]]` 块级全文嵌入

**文件：**
- 修改：`docs/.vitepress/plugins/obsidianEmbed.ts`（追加）
- 创建：`tests/helpers.mjs`
- 创建：`tests/embed.test.mjs`

- [ ] **步骤 1：写失败的测试**

创建 `tests/helpers.mjs`：

```js
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createMarkdownRenderer, disposeMdItInstance } from "vitepress";
import { obsidianEmbed } from "../docs/.vitepress/plugins/obsidianEmbed.ts";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const VAULT = join(HERE, "fixtures", "vault");
export const DOCS = join(HERE, "..", "docs");

/** 构建与站点同管线的 md 实例（注册被测插件）。vitepress md 为进程级单例，先释放再按新 root 重建 */
export async function makeMd(root) {
  disposeMdItInstance();
  return createMarkdownRenderer(root, {
    math: true,
    config(md) {
      obsidianEmbed(md, root);
    },
  });
}
```

创建 `tests/embed.test.mjs`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMd, VAULT, DOCS } from "./helpers.mjs";

test("! [[]] 全文嵌入：卡片、去 frontmatter、标题降级、公式", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[Alpha]]");

  assert.match(html, /class="na-embed"/);
  assert.match(html, /class="na-embed-source"/);
  assert.ok(!html.includes("2026-01-01"), "frontmatter 的 date 不应出现");
  assert.match(html, /<h2[^>]*>Alpha 大标题/, "H1 应降级为 H2");
  assert.match(html, /<h3[^>]*>小节标题/, "H2 应降级为 H3");
  assert.ok(!html.includes("$$"), "$$ 定界符不应残留");
  assert.ok(html.includes("mjx-container"), "公式应被 MathJax 预渲染（mjx-container）");
  assert.ok(html.includes("嵌入正文段落"), "笔记正文应出现");
  assert.equal(html.split("嵌入正文段落").length - 1, 1, "嵌入正文只应渲染一次");
  assert.equal(html.split('class="header-anchor"').length - 1, 2, "锚点不应翻倍（H1、H2 各一）");
});

test("来源条：frontmatter title + 源路径回链", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[Alpha]]");
  assert.ok(html.includes("📎 论文笔记 · Alpha"));
  assert.ok(html.includes(`href="${encodeURI("/01.组会材料/02.论文笔记/Alpha")}"`));
});

test("来源条：有 permalink 用 permalink 回链", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[有链接]]");
  assert.ok(html.includes(`href="${encodeURI("/meet/haslink")}"`));
});

test("来源条：无 title 时回退文件名", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[无标题]]");
  assert.ok(html.includes("📎 论文笔记 · 无标题"));
});

test("真实库集成：Multi-Loco 嵌入（组会页实际用法）", async () => {
  const md = await makeMd(DOCS);
  const html = md.render("![[Multi-Loco]]");
  assert.match(html, /class="na-embed"/);
  assert.ok(!html.includes("![[Multi-Loco]]"), "不应残留字面语法");
  assert.ok(
    html.includes(`href="${encodeURI("/01.组会材料/02.论文笔记/Multi-Loco")}"`) ||
      /href="\/meet\//.test(html),
    "回链应指向笔记源页或其 permalink"
  );
  assert.match(html, /<h2/, "笔记 H1 应降级为 H2");
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test`

预期：FAIL——`embed.test.mjs` 报错 `does not provide an export named 'obsidianEmbed'`（resolver 测试仍绿）。

- [ ] **步骤 3：编写最少实现代码（追加到 `obsidianEmbed.ts` 末尾）**

```js
/** 读笔记：剥 frontmatter、标题降级（行首 ATX +1 级，H6 不变）、取 title/permalink */
export function readNote(absPath) {
  const { data, content } = matter(readFileSync(absPath, "utf-8"));
  return {
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : basename(absPath, ".md"),
    permalink: typeof data.permalink === "string" ? data.permalink.trim() : "",
    content: content.replace(/^(#{1,5})([ \t]+)/gm, "#$1$2"),
  };
}

/** 回链地址：permalink 优先，否则源路径（cleanUrls，无 .html） */
export function noteHref(relPath, permalink) {
  if (permalink) return encodeURI(permalink);
  return encodeURI("/" + relPath.replace(/\.md$/i, "").split(sep).join("/"));
}

function createEmbedRule(md, resolveNote) {
  return function naEmbed(state, startLine, endLine, silent) {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false; // 代码块内不处理
    if (state.sCount[startLine] - state.blkIndent > 3) return false; // >3 空格缩进不处理
    const line = state.src
      .slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
      .trim();
    const m = line.match(/^!\[\[([^\]\n]+)\]\]$/);
    if (!m) return false;
    if (silent) return true;

    const found = resolveNote(m[1].trim());
    if (!found) return false; // 任务 3 替换为告警块

    const note = readNote(found.absPath);
    const open = state.push("na_embed_open", "", 0);
    open.meta = {
      href: noteHref(found.relPath, note.permalink),
      label: `📎 论文笔记 · ${note.title}`,
    };
    const embedded = [];
    md.block.parse(note.content, md, { ...state.env, naEmbedStack: [found.absPath] }, embedded);
    for (const t of embedded) state.tokens.push(t);
    state.push("na_embed_close", "", 0);
    state.line = startLine + 1;
    return true;
  };
}

/** 注册插件到 md 实例 */
export function obsidianEmbed(md, docsRoot) {
  const resolveNote = createResolver(docsRoot);

  md.block.ruler.before("paragraph", "na_embed", createEmbedRule(md, resolveNote));

  md.renderer.rules.na_embed_open = (tokens, idx) => {
    const { href, label } = tokens[idx].meta;
    return (
      `<div class="na-embed">\n` +
      `<a class="na-embed-source" href="${md.utils.escapeHtml(href)}">${md.utils.escapeHtml(label)}</a>\n` +
      `<div class="na-embed-body">\n`
    );
  };
  md.renderer.rules.na_embed_close = () => `</div>\n</div>\n`;
}
```

注（实测缺陷修复）：内层必须用 `md.block.parse`（vitepress 内置 markdown-it 的 4 参形态 `(str, md, env, outTokens)`，canonical 调用见其 core block 规则）而非 `md.parse`——`md.parse` 全解析后，外层 core 链的 `inline` 规则会对已有 children 的 inline token 再次解析并追加，导致嵌入正文/header-anchor 渲染翻倍；块级解析后 inline/anchor/math 交由外层 core 链恰好处理一次（块级递归仍接收内层 env，`naEmbedStack` 循环/深度检测不受影响）。`helpers.mjs` 的 `disposeMdItInstance()` 同为实测所需：vitepress 的 md 实例是进程级单例，不释放则第二次 `makeMd` 忽略新 root 直接返回旧实例。

- [ ] **步骤 4：运行测试验证通过**

运行：`npm run test`

预期：PASS，共 11 个用例（6 resolver + 5 embed）全绿。

- [ ] **步骤 5：Commit**

```bash
git add docs/.vitepress/plugins/obsidianEmbed.ts tests/helpers.mjs tests/embed.test.mjs
git commit -m "feat(obsidian-embed): ! [[]] 块级全文嵌入（卡片+标题降级+回链）"
```

---

### 任务 3：错误处理（缺失 / 循环 / 深度）

**文件：**
- 修改：`docs/.vitepress/plugins/obsidianEmbed.ts`（步骤 0 替换 `readNote`/`noteHref`；步骤 3 替换 `createEmbedRule`、新增 `MAX_EMBED_DEPTH`）
- 修改：`tests/embed.test.mjs`（步骤 0 加 2 导入 + 3 用例）
- 创建：`tests/fixtures/vault/01.组会材料/02.论文笔记/{Fence,坏头,锁定}.md`（步骤 0）
- 创建：`tests/embed-errors.test.mjs`

- [ ] **步骤 0：任务 2 质量结转（readNote 健壮性 + 围栏感知降级）**

来自任务 2 质量审查的 2 个 Important（`readNote` 无错误处理、畸形 YAML/读失败会炸全站 build；降级正则无围栏意识、会静默改写嵌入笔记代码块里的 `# 注释`）与顺手项（CRLF 归一、permalink 硬化），随本轮同批落地。

（a）追加 3 个夹具。

`tests/fixtures/vault/01.组会材料/02.论文笔记/Fence.md`：

````markdown
# Fence 标题

```bash
# 围栏内注释不降级
echo hi
```

## 外部小节
````

`tests/fixtures/vault/01.组会材料/02.论文笔记/坏头.md`：

```markdown
---
title: [未闭合
---
坏头降级正文
```

`tests/fixtures/vault/01.组会材料/02.论文笔记/锁定.md`：

```markdown
# 锁定笔记

锁定正文。
```

（b）`tests/embed.test.mjs` 顶部 import 区追加：

```js
import { chmodSync } from "node:fs";
import { join } from "node:path";
```

文件末尾追加 3 个用例：

```js
test("嵌入：围栏内 # 注释不被降级，外部标题照常降级", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[Fence]]");
  assert.ok(html.includes("# 围栏内注释不降级"), "围栏内注释应原样出现");
  assert.ok(!html.includes("## 围栏内注释不降级"), "围栏内注释不应被降级");
  assert.match(html, /<h3[^>]*>外部小节/, "外部 H2 应降级为 H3");
});

test("嵌入：畸形 frontmatter 不炸 build，原文可见降级", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[坏头]]");
  assert.match(html, /class="na-embed"/);
  assert.ok(html.includes("坏头降级正文"), "正文应可见");
});

test("嵌入：读失败降级为空笔记而非抛错", async () => {
  const p = join(VAULT, "01.组会材料", "02.论文笔记", "锁定.md");
  chmodSync(p, 0o000);
  try {
    const md = await makeMd(VAULT);
    const html = md.render("![[锁定]]");
    assert.match(html, /class="na-embed"/);
    assert.ok(!html.includes("锁定正文"), "读失败时不应有正文");
  } finally {
    chmodSync(p, 0o644);
  }
});
```

（c）`obsidianEmbed.ts` 中用以下完整新版**替换** `readNote` 与 `noteHref`（`demoteHeadings` 随之新增）：

```js
/** 读笔记：CRLF 归一、剥 frontmatter（畸形不炸）、围栏感知标题降级（行首 ATX +1 级，H6 不变）、取 title/permalink */
export function readNote(absPath) {
  let raw;
  try {
    raw = readFileSync(absPath, "utf-8").replace(/\r\n?/g, "\n");
  } catch {
    // 读失败（TOCTOU 删除/权限）：空笔记降级，不炸 build
    return { title: basename(absPath, ".md"), permalink: "", content: "" };
  }
  let data = {};
  let content = raw;
  try {
    ({ data, content } = matter(raw));
  } catch {
    // 畸形 frontmatter：保留原文渲染，可见降级优于 build 崩溃
    content = raw;
  }
  return {
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : basename(absPath, ".md"),
    permalink: typeof data.permalink === "string" ? data.permalink.trim() : "",
    content: demoteHeadings(content),
  };
}

/** ATX 标题降级：仅围栏（``` / ~~~，行首 0-3 空格）之外的行首 #，围栏内注释原样保留 */
function demoteHeadings(src) {
  let inFence = false;
  return src
    .split("\n")
    .map((line) => {
      if (/^ {0,3}(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : line.replace(/^(#{1,5})([ \t]+)/, "#$1$2");
    })
    .join("\n");
}

/** 回链地址：permalink 优先（仅接受 / 开头的站内绝对路径），否则源路径（cleanUrls，无 .html） */
export function noteHref(relPath, permalink) {
  if (permalink && permalink.startsWith("/")) return encodeURI(permalink);
  return encodeURI("/" + relPath.replace(/\.md$/i, "").split(sep).join("/"));
}
```

（d）运行：`npm run test`

预期：PASS，14 个用例（6 resolver + 8 embed）全绿。

（e）Commit：

```bash
git add docs/.vitepress/plugins/obsidianEmbed.ts tests/embed.test.mjs tests/fixtures/vault/01.组会材料/02.论文笔记/Fence.md tests/fixtures/vault/01.组会材料/02.论文笔记/坏头.md tests/fixtures/vault/01.组会材料/02.论文笔记/锁定.md
git commit -m "fix(obsidian-embed): readNote 双层降级与围栏感知降级（任务2质量结转）"
```

- [ ] **步骤 1：写失败的测试**

创建 `tests/embed-errors.test.mjs`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMd, VAULT } from "./helpers.mjs";

test("嵌入目标不存在 → 告警块，不吞错", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[压根没有]]");
  assert.match(html, /na-embed-warning/);
  assert.match(html, /未找到嵌入笔记：压根没有/);
  assert.ok(!html.includes("na-embed-source"), "不应渲染正常卡片");
});

test("嵌入循环 A→B→A → 循环告警且能终止", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[CycleA]]");
  assert.match(html, /na-embed-warning/);
  assert.match(html, /嵌入循环/);
  assert.ok(html.includes("CycleB 标题"), "B 的内容应已渲染");
});

test("嵌入深度 >3 → 层级告警，第 4 层不渲染", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("![[L1]]");
  assert.match(html, /na-embed-warning/);
  assert.match(html, /嵌入层级超过 3 层：L4/);
  assert.ok(html.includes("L3"), "第 3 层应渲染");
  assert.ok(!html.includes("L4 终点"), "第 4 层不应渲染");
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test`

预期：FAIL——用例 1 无告警类（当前渲染为字面 `![[压根没有]]`）；用例 2 因无限递归报 `RangeError: Maximum call stack size exceeded`；用例 3 检测到 `L4 终点`。其余 14 个用例仍绿。

- [ ] **步骤 3：编写实现代码**

在 `obsidianEmbed.ts` 中、`function createEmbedRule` 定义**之前**插入一行：

```js
const MAX_EMBED_DEPTH = 3;
```

然后用以下**完整新版**替换任务 2 的整个 `createEmbedRule` 函数：

```js
function createEmbedRule(md, resolveNote) {
  return function naEmbed(state, startLine, endLine, silent) {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false; // 代码块内不处理
    if (state.sCount[startLine] - state.blkIndent > 3) return false; // >3 空格缩进不处理
    const line = state.src
      .slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
      .trim();
    const m = line.match(/^!\[\[([^\]\n]+)\]\]$/);
    if (!m) return false;
    if (silent) return true;

    const target = m[1].trim();
    const esc = md.utils.escapeHtml;
    const warn = (text) => {
      const token = state.push("html_block", "", 0);
      token.content = `<div class="na-embed na-embed-warning">${esc(text)}</div>`;
      console.warn(`[obsidianEmbed] ${text}（页面：${state.env.relativePath ?? "unknown"}）`);
      state.line = startLine + 1;
      return true;
    };

    const found = resolveNote(target);
    if (!found) return warn(`⚠️ 未找到嵌入笔记：${target}`);

    const stack = state.env.naEmbedStack || [];
    if (stack.includes(found.absPath)) return warn(`⚠️ 嵌入循环：${target}`);
    if (stack.length >= MAX_EMBED_DEPTH) return warn(`⚠️ 嵌入层级超过 ${MAX_EMBED_DEPTH} 层：${target}`);

    const note = readNote(found.absPath);
    const open = state.push("na_embed_open", "", 0);
    open.meta = {
      href: noteHref(found.relPath, note.permalink),
      label: `📎 论文笔记 · ${note.title}`,
    };
    const embedded = [];
    md.block.parse(
      note.content,
      md,
      { ...state.env, naEmbedStack: [...stack, found.absPath] },
      embedded
    );
    for (const t of embedded) state.tokens.push(t);
    state.push("na_embed_close", "", 0);
    state.line = startLine + 1;
    return true;
  };
}
```

注：内层同样必须用 `md.block.parse` 4 参形态（任务 2 实测缺陷，见任务 2 步骤 3 后注记）——写回 `md.parse` 会被护栏断言（正文恰 1 次、锚点恰 2）立即拦截。

深度语义核对：宿主嵌入 L1 时 `stack=[]`（第 1 层）→ L1 内嵌 L2 时 `stack=[L1]`（第 2 层）→ L2 内嵌 L3 时 `stack=[L1,L2]`（第 3 层，允许）→ L3 内嵌 L4 时 `stack=[L1,L2,L3]`，`length 3 >= MAX_EMBED_DEPTH` → 告警，L4 不渲染。与规格「深度 ≤3」一致。

- [ ] **步骤 4：运行测试验证通过**

运行：`npm run test`

预期：PASS，共 17 个用例全绿（循环用例不再爆栈）。

- [ ] **步骤 5：Commit**

```bash
git add docs/.vitepress/plugins/obsidianEmbed.ts tests/embed-errors.test.mjs
git commit -m "feat(obsidian-embed): 嵌入缺失/循环/深度告警"
```

---

### 任务 4：`[[ ]]` 行内站内链接

**文件：**
- 修改：`docs/.vitepress/plugins/obsidianEmbed.ts`（步骤 0 替换 `demoteHeadings`、`readNote` 加告警行；步骤 3 在 `obsidianEmbed()` 内注册 + 追加规则函数）
- 修改：`tests/embed.test.mjs`（步骤 0 加 3 断言）
- 修改：`tests/fixtures/vault/01.组会材料/02.论文笔记/Fence.md`（步骤 0 栏内加混标记行）
- 创建：`tests/wikilink.test.mjs`

- [ ] **步骤 0：任务 3 质量结转（围栏配对 + 读失败可见性）**

来自任务 3 质量审查的 Minor-1/2/3（围栏状态机不校验标记字符与长度、读失败静默降级不可见、坏头用例少一条钉死断言），随本轮同批落地。无新增用例，计数链不变。

（a）`obsidianEmbed.ts` 中用以下完整新版**替换** `demoteHeadings`：

```js
/** ATX 标题降级：仅代码围栏（``` / ~~~，行首 0-3 空格）之外的行首 #；围栏按同字符、长度 ≥ 开栏、行尾无 info string 配对闭合 */
function demoteHeadings(src) {
  let fence = null; // { char, len } | null
  return src
    .split("\n")
    .map((line) => {
      const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (m) {
        const char = m[1][0];
        const len = m[1].length;
        if (!fence) {
          // 开栏：``` 的 info string 不得含反引号（CommonMark）
          if (char === "~" || !m[2].includes("`")) fence = { char, len };
          return line;
        }
        // 闭栏：同字符、长度 ≥ 开栏、行尾无 info string
        if (char === fence.char && len >= fence.len && m[2].trim() === "") {
          fence = null;
          return line;
        }
        return line; // 栏内内容（含混标记行）原样
      }
      return fence ? line : line.replace(/^(#{1,5})([ \t]+)/, "#$1$2");
    })
    .join("\n");
}
```

（b）`readNote` 读失败的 catch 内、`return` 之前插入一行：

```js
    console.warn(`[obsidianEmbed] 读取嵌入笔记失败，已降级为空笔记：${absPath}`);
```

（c）`tests/fixtures/vault/01.组会材料/02.论文笔记/Fence.md` 的 ` ```bash ` 围栏内（`echo hi` 之后、闭栏之前）插入两行：

```
~~~
# 波浪线后注释不降级
```

（d）`tests/embed.test.mjs` 两处断言追加——

用例「围栏内 # 注释不被降级，外部标题照常降级」的 `assert.match(html, /<h3[^>]*>外部小节/, ...)` 之后追加：

```js
  assert.ok(html.includes("# 波浪线后注释不降级"), "混标记栏内注释应原样");
  assert.ok(!html.includes("## 波浪线后注释不降级"), "混标记栏内注释不应被降级");
```

用例「畸形 frontmatter 不炸 build，原文可见降级」的 `assert.ok(html.includes("坏头降级正文"), "正文应可见");` 之后追加：

```js
  assert.ok(html.includes("title: [未闭合"), "坏 frontmatter 应原文可见");
```

（e）运行：`npm run test`

预期：PASS，**17 个用例**仍全绿。注意落子顺序影响中间态：(c)(d) 先落而 (a) 未落时围栏新断言必红（旧逻辑会翻转混标记行与后续栏态），(a)-(d) 全部落地后必须 17/17——若全落地后仍非 17/17 → BLOCKED 汇报，勿提交。

（f）Commit（门禁）：

```bash
git add docs/.vitepress/plugins/obsidianEmbed.ts tests/embed.test.mjs tests/fixtures/vault/01.组会材料/02.论文笔记/Fence.md
git commit -m "fix(obsidian-embed): 围栏标记配对与读失败可见性（任务3质量结转）"
```

- [ ] **步骤 1：写失败的测试**

创建 `tests/wikilink.test.mjs`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMd, VAULT, DOCS } from "./helpers.mjs";

test("[[ ]] 行内引用 → 站内链接（真实库）", async () => {
  const md = await makeMd(DOCS);
  // 与生产渲染一致：站点 cleanUrls:true；vitepress linkPlugin 对内部 link_open 必做
  // 「非 cleanUrls 时加 .html + 末尾 decodeURI」，故断言生产终态（原文中文、无 .html）
  const html = md.render("请先阅读[[第三章：Docker安装与基础配置]]再操作。", {
    cleanUrls: true,
  });
  const expected = "/02.学习笔记/10.开发工具/001.Docker/第三章：Docker安装与基础配置";
  assert.ok(html.includes(`href="${expected}"`), `链接应指向笔记源页，实际：${html}`);
  assert.ok(html.includes(">第三章：Docker安装与基础配置</a>"));
});

test("[[ ]] 目标不存在 → 保持原文", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("引用[[不存在的章节]]结束");
  assert.ok(html.includes("[[不存在的章节]]"));
});

test("行中 ! [[]] 保持原文（块规则只处理独立成行）", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("前文 ![[Alpha]] 后文");
  assert.ok(html.includes("![[Alpha]]"));
  assert.ok(!html.includes("na-embed"));
});
```

注（linkPlugin 三组对照实测）：`[[...]]` 产出的 `link_open` 必经 vitepress `linkPlugin.normalizeHref` 重写——① `env.cleanUrls` 为假时追加 `.html`（测试默认 env 无此标志，故须显式传入 `{ cleanUrls: true }`）；② 末尾必做 `decodeURI(href)`，`encodeURI` 形态的断言在该管线内永不可能命中（`decodeURI(encodeURI(x)) ≡ x`，往返无损）。故本用例断言**生产终态**（`cleanUrls:true` + 原文中文 + 无 `.html`），这比原 `encodeURI` 断言更强（原断言针对管线永不输出的形态）。嵌入卡片来源条的 `encodeURI` 断言（任务 2 用例）不受影响——渲染器模板输出裸 HTML 字符串，不经 `linkPlugin`；两类回链浏览器导航等价，仅 view-source 呈现风格不同。实现保持 `push("link_open")`——与手写 markdown 链接同管线（base 前缀、dev 死链提示等 vitepress 能力不旁路）。

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test`

预期：FAIL——用例 1 输出无 `href="/02.学习笔记/..."`（`[[...]]` 被 markdown-it 渲染为字面文本）。用例 2、3 此时可能已通过（天然行为），保留作回归护栏。其余 17 个用例仍绿。

- [ ] **步骤 3：编写实现代码**

（a）在 `obsidianEmbed()` 函数体内、`md.block.ruler.before(...)` 那一行**之后**插入：

```js
  md.inline.ruler.before("link", "na_wikilink", createWikilinkRule(resolveNote));
```

（b）追加到文件末尾：

```js
function createWikilinkRule(resolveNote) {
  return function naWikilink(state, silent) {
    const { src, pos } = state;
    if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false; // 需要 `[[`
    if (pos > 0 && src.charCodeAt(pos - 1) === 0x21) return false; // `![[`：行中嵌入保持原文
    const end = src.indexOf("]]", pos + 2);
    if (end < 0) return false;
    const target = src.slice(pos + 2, end).trim();
    if (!target || target.includes("\n")) return false;
    if (silent) return true;

    const found = resolveNote(target);
    if (found) {
      const note = readNote(found.absPath);
      const linkOpen = state.push("link_open", "a", 1);
      linkOpen.attrs = [["href", noteHref(found.relPath, note.permalink)]];
      const text = state.push("text", "", 0);
      text.content = target;
      state.push("link_close", "a", -1);
    } else {
      const text = state.push("text", "", 0);
      text.content = `[[${target}]]`;
    }
    state.pos = end + 2;
    return true;
  };
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm run test`

预期：PASS，共 20 个用例全绿（6 + 5 + 3 + 3 + 3）。

- [ ] **步骤 5：Commit**

```bash
git add docs/.vitepress/plugins/obsidianEmbed.ts tests/wikilink.test.mjs
git commit -m "feat(obsidian-embed): [[]] 行内站内链接"
```

- [ ] **步骤 6：任务 4 质量修复（段落续行中断 + 回退保真 + 边界回归锁）**

质量审查裁决：Important-1 采纳**方案 ①**——规格 §3「独立成行」按字面执行，嵌入行可中断段落（控制器已同步补记规格 §3/§5）；Minor-2/3/5/6 就地修复（断言全部**折入既有用例**，`test(` 计数保持 20，计数链不变）；Minor-4（读失败告警补页面上下文）**结转任务 5 步骤 0**；性能结论记录在案——全库行内命中仅 1 处、嵌入 65 处每 build 各读一次，**暂不加** `readNote` 缓存（阈值：行内命中 >~200 次/build 或嵌入笔记开始携带 `[[ ]]` 时，在 `obsidianEmbed()` 内加 `Map<absPath, note>`，与 resolver cache 同生命周期）。

（a）**先改测试（红相）**——`tests/wikilink.test.mjs` 三处：

用例 1 在既有两条断言之后追加（Minor-6 顺序锁，天然绿）：

```js
  assert.ok(html.indexOf("请先阅读") < html.indexOf("<a "), "正文应在链接之前");
```

用例 2 **整块替换**（标题改写 + Minor-2 空格保真 + Minor-5 非目标/跨行/反引号回归锁）：

```js
test("[[ ]] 保持原文：未命中目标、|别名/#标题非目标、跨行、反引号代码", async () => {
  const md = await makeMd(VAULT);
  const html = md.render("引用[[不存在的章节]]结束");
  assert.ok(html.includes("[[不存在的章节]]"));
  const spaced = md.render("引用[[ 不存在章节 ]]结束");
  assert.ok(spaced.includes("[[ 不存在章节 ]]"), "字面回退应保留原文空格（trim 仅用于查找）");
  const nonGoal = md.render("见[[Alpha|别名]]与[[Alpha#小节]]");
  assert.ok(nonGoal.includes("[[Alpha|别名]]"), "|别名 非目标应保持原文");
  assert.ok(nonGoal.includes("[[Alpha#小节]]"), "#标题 非目标应保持原文");
  const multiline = md.render("[[Alpha\n下一行]]");
  assert.ok(multiline.includes("[[Alpha") && multiline.includes("下一行]]"), "跨行应保持原文");
  const inCode = md.render("`[[Alpha]]`");
  assert.ok(inCode.includes("<code>[[Alpha]]</code>"), "反引号代码内应原样");
  assert.ok(!inCode.includes("na-embed"), "反引号代码内不应触发嵌入");
});
```

用例 3 在既有两条断言之后追加（Important-1 判别断言，当前必红）：

```js
  const lazy = md.render("前文行\n![[Alpha]]");
  assert.ok(lazy.includes('class="na-embed"'), "段落续行中的独立嵌入行应中断段落并嵌入");
  assert.ok(lazy.includes("<p>前文行</p>"), "前文行应独立成段");
```

运行：`npm run test` → 预期 **18 pass / 2 fail**（用例 2 红于空格保真、用例 3 红于段落吞行，其余 18 绿）。非此形态 → BLOCKED 汇报实际输出，勿提交。

（b）**再改实现（绿相）**——`docs/.vitepress/plugins/obsidianEmbed.ts` 三处：

将注册行

```js
  md.block.ruler.before("paragraph", "na_embed", createEmbedRule(md, resolveNote));
```

改为（第 4 参 options，允许嵌入行中断段落；silent 探测路径 L140 已就绪、零 I/O）：

```js
  md.block.ruler.before("paragraph", "na_embed", createEmbedRule(md, resolveNote), {
    alt: ["paragraph"],
  });
```

在 `function createWikilinkRule(resolveNote) {` 上方加 JSDoc（Minor-3，与文件其余单元注释风格一致）：

```js
/** 行内 [[目标]] → 站内链接：命中 → link_open（noteHref 回链，文本取 target）；未命中/|别名/#标题/跨行/前导 ! → 保持原文（回退文本取原始切片，保留空格） */
```

else 分支（Minor-2）将

```js
      text.content = `[[${target}]]`;
```

改为

```js
      text.content = src.slice(pos, end + 2);
```

（`src` 已在函数头解构；found 分支的链接文本仍用 trim 后的 target，不变。）

（c）运行：`npm run test` → 预期 **PASS，20/20**。非 20/20 → BLOCKED 汇报，勿提交。

（d）Commit：

```bash
git add docs/.vitepress/plugins/obsidianEmbed.ts tests/wikilink.test.mjs
git commit -m "fix(obsidian-embed): 段落续行中断与字面回退保真（任务4质量修复）"
```

（e）规格 §3/§5 已由控制器补记（与本计划修订同批提交），实现者**不改**规格与计划文件。

---

### 任务 5：接线 config + 卡片样式 + dev 冒烟

**文件：**
- 修改：`docs/.vitepress/config.ts`（L1-8 import 区、L233-235 markdown 块）
- 修改：`docs/.vitepress/theme/index.ts`（L28 后）
- 创建：`docs/.vitepress/theme/styles/embed.scss`
- 验证脚本：`/tmp/opencode/verify-embed-smoke.mjs`（不入库）

- [ ] **步骤 1：config.ts 注册插件**

在 import 区（`import { withMermaid } from 'vitepress-plugin-mermaid'` 行之后）插入：

```ts
import { fileURLToPath } from 'node:url'
import { obsidianEmbed } from './plugins/obsidianEmbed'

const DOCS_ROOT = fileURLToPath(new URL('..', import.meta.url))
```

将（现 L233-235）：

```ts
  markdown: {
    math: true
  },
```

改为：

```ts
  markdown: {
    math: true,
    config(md) {
      // Obsidian 式 ! [[]] 嵌入与 [[]] 站内链接
      // 规格：docs/superpowers/specs/2026-09-23-obsidian-embed-design.md
      obsidianEmbed(md, DOCS_ROOT)
    },
  },
```

说明：编辑器可能对 `.mjs` 导入提示 TS7016（无声明文件）——构建走 esbuild 只转译不类型检查，不影响 `docs:build`；如介意可后续补 `obsidianEmbed.d.mts`，非本计划范围。

- [ ] **步骤 2：theme/index.ts 引入样式**

将：

```ts
import "./styles/code-bg.scss";
import "./styles/homepage.scss";
import "./styles/iframe.scss";
```

改为（末尾追加一行）：

```ts
import "./styles/code-bg.scss";
import "./styles/homepage.scss";
import "./styles/iframe.scss";
import "./styles/embed.scss";
```

- [ ] **步骤 3：创建卡片样式**

创建 `docs/.vitepress/theme/styles/embed.scss`：

```scss
/* 论文笔记嵌入卡片
   规格：docs/superpowers/specs/2026-09-23-obsidian-embed-design.md */

.na-embed {
  margin: 16px 0;
  padding: 14px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}

.na-embed-source {
  display: inline-block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.na-embed-source:hover {
  text-decoration: underline;
}

.na-embed-body > :first-child {
  margin-top: 0;
}

.na-embed-body > :last-child {
  margin-bottom: 0;
}

/* 告警块（放在 .na-embed 之后以覆盖卡片配色） */
.na-embed-warning {
  margin: 16px 0;
  padding: 10px 14px;
  border: 1px solid var(--vp-c-danger-2);
  border-radius: 8px;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  font-size: 14px;
}
```

亮暗色说明：全部用 VitePress CSS 变量，`html.dark` 下自动适配，无需单独暗色规则。

- [ ] **步骤 4：dev 冒烟（含大纲检查）**

创建 `/tmp/opencode/verify-embed-smoke.mjs`：

```js
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// config.ts 变更会触发 dev server 重启，带重试
let ok = false;
for (let i = 0; i < 10 && !ok; i++) {
  try {
    await page.goto("http://localhost:5173/meet/20260120", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector(".na-embed", { timeout: 8000 });
    ok = true;
  } catch {
    await new Promise((r) => setTimeout(r, 2500));
  }
}

const out = await page.evaluate(() => ({
  cards: document.querySelectorAll(".na-embed:not(.na-embed-warning)").length,
  warnings: document.querySelectorAll(".na-embed-warning").length,
  sourceHref:
    document.querySelector(".na-embed-source")?.getAttribute("href") ?? null,
  sourceText:
    document.querySelector(".na-embed-source")?.textContent?.trim() ?? null,
  h2InContent: [...document.querySelectorAll("#VPDoc h2")].length,
  // 嵌入笔记的 H1（降级后）应进右侧大纲：任意 href="#" 的页内锚点里找
  outlineHasNoteTitle: [...document.querySelectorAll('a[href^="#"]')].some((a) =>
    a.textContent.includes("Multi-Loco: Unifying")
  ),
  literalLeft: (document.body.innerText.match(/!\[\[/g) || []).length,
}));

console.log(JSON.stringify({ reachable: ok, ...out, errors }, null, 2));
await browser.close();
process.exit(ok && out.warnings === 0 && out.cards === 1 && out.outlineHasNoteTitle && errors.length === 0 ? 0 : 1);
```

运行：`cd /tmp/opencode && node verify-embed-smoke.mjs`

预期退出码 0，输出要点：`reachable:true`、`cards:1`、`warnings:0`、`sourceHref` 为 `encodeURI` 后的源路径（中文呈百分号编码，以 `/Multi-Loco` 结尾；该篇无 permalink 时）、`sourceText:"📎 论文笔记 · Multi-Loco"`、`h2InContent ≥ 1`、`outlineHasNoteTitle:true`、`literalLeft:0`、`errors:[]`。

**若 `outlineHasNoteTitle:false`（大纲缺嵌入标题）**：`md.block.parse` 形态下嵌入标题由外层 core 链随宿主页在同一 token 流中统一收集，`block.parse` 传入的 env 不参与大纲管线——该症状不应由本插件的 env 写法引起。**禁止**改回 `md.parse` 或改写 parse 形态（会复现双重渲染，护栏断言"正文恰 1 次、锚点恰 2"必红）；此时停下以 BLOCKED 上报控制器，附冒烟输出与该页 `document.querySelectorAll('h2, h3')` 实测清单，由控制器裁决 vitepress 大纲管线层面的修法。

（dev server 未起时先跑：`cd /home/weno/works/Notes-Atlas && (npm run docs:dev -- --port 5173 > /tmp/opencode/dev.log 2>&1 &) `，等 5s 再执行冒烟。）

- [ ] **步骤 5：单测回归**

运行：`npm run test`

预期：PASS，20 个用例仍全绿。

- [ ] **步骤 6：Commit**

```bash
git add docs/.vitepress/config.ts docs/.vitepress/theme/index.ts docs/.vitepress/theme/styles/embed.scss
git commit -m "feat(obsidian-embed): 接线 config 与卡片样式"
```

---

### 任务 6：全量验收（规格 §10 的完成定义）

**文件：**
- 验证脚本：`/tmp/opencode/verify-all-embeds.mjs`（不入库）
- 无新代码；若发现问题则修复并用显式路径提交

- [ ] **步骤 1：单测全量**

运行：`npm run test`

预期：PASS，20 个用例。

- [ ] **步骤 2：36 篇组会页逐一 headless 断言**

创建 `/tmp/opencode/verify-all-embeds.mjs`：

```js
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:5173";
const DOCS_DIR = "/home/weno/works/Notes-Atlas/docs/01.组会材料/01.组会内容";

const pages = [];
for (const name of readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"))) {
  const src = readFileSync(join(DOCS_DIR, name), "utf-8");
  const fm = src.match(/^permalink:\s*(\S+)/m);
  const embeds = (src.match(/^!\[\[[^\]\n]+\]\]$/gm) || []).length;
  const url = fm
    ? fm[1]
    : "/" + join("01.组会材料/01.组会内容", name.replace(/\.md$/, ""));
  if (embeds > 0) pages.push({ name, url, embeds });
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  defaultViewport: { width: 1600, height: 1000 },
});

const failures = [];
let pass = 0;
for (const p of pages) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(BASE + p.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#VPDoc", { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 300));
    const res = await page.evaluate(() => ({
      cards: document.querySelectorAll(".na-embed:not(.na-embed-warning)").length,
      warnings: document.querySelectorAll(".na-embed-warning").length,
      sourceLinks: document.querySelectorAll(".na-embed-source").length,
      literal: (document.body.innerText.match(/!\[\[/g) || []).length,
    }));
    const ok =
      errors.length === 0 &&
      res.warnings === 0 &&
      res.cards === p.embeds &&
      res.sourceLinks === p.embeds &&
      res.literal === 0;
    if (ok) pass++;
    else failures.push({ ...p, ...res, errors });
  } catch (e) {
    failures.push({ ...p, catch: e.message });
  }
  await page.close();
}

console.log(JSON.stringify({ total: pages.length, pass, failures }, null, 2));
await browser.close();
process.exit(failures.length === 0 && pages.length === 36 ? 0 : 1);
```

运行：`cd /tmp/opencode && node verify-all-embeds.mjs`

预期退出码 0：`total:36, pass:36, failures:[]`。（若 `total ≠ 36` 是笔记增删导致——以实际嵌入页数为准人工核对来源列表，规格基线为 65 处/36 页。）

- [ ] **步骤 3：构建**

运行：`npm run docs:build`

预期：`build complete`，无 error。

- [ ] **步骤 4：产物断言**

```bash
cd /home/weno/works/Notes-Atlas
echo -n "字面 ![[ 残留（期望0）: "; grep -rF '![[' docs/.vitepress/dist/01.组会材料/01.组会内容 --include='*.html' | wc -l
echo -n "含 na-embed 的页面（期望36）: "; grep -rlF 'na-embed' docs/.vitepress/dist/01.组会材料/01.组会内容 --include='*.html' | wc -l
echo -n "组会文章页嵌入卡片痕迹（期望≥1）: "; grep -cF 'na-embed' docs/.vitepress/dist/01.组会材料/01.组会内容/20260120.html
```

预期：`0`、`36`、`≥1`。断言限定 `01.组会内容` 目录——`docs/superpowers/` 的规格/计划页同样会构建进 dist，其行内代码与代码块中的字面 `![[`、`na-embed` 属正常的字面展示（规格 §3 非目标：行中/代码块不解析），不应计入残留。

**规格 §10.2（公式）**：MathJax 在 `md.render` 阶段即预渲染为静态 `<mjx-container>`（探针证实输出含 SVG/MathML、无 `$$` 残留），任务 2 单测直接断言该产物，步骤 2 的 sweep 再保证运行期无 JS 异常——静态产物 + 无异常合并满足验收。

- [ ] **步骤 5：侧边栏回归（规格 §10.5）**

```bash
cd /home/weno/works/Notes-Atlas
grep -roF '组会pptx' docs/.vitepress/dist --include='*.html' | wc -l
grep -roF '>pdfs<' docs/.vitepress/dist --include='*.html' | wc -l
```

预期：均为 `0`。

- [ ] **步骤 6：收尾提交（如有修复）**

本任务通常无代码改动、无需提交。若验收发现问题并修复：

```bash
git add <被修改的显式路径>
git commit -m "fix(obsidian-embed): <一句话>"
```

全部验收项通过 → 计划完成。改动仍未推送；push 到 main 后经 `.github/workflows/deploy.yml` 上线。
