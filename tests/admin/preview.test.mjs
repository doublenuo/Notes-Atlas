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
  assert.match(out, /&lt;script&gt;/, "原文 HTML 必须实体化,不能被静默丢弃");
});

test("3 [[双链]] → 站内链接", () => {
  const { docsDir } = mkVault();
  const r = createPreviewRenderer({ docsDir });
  const out = r.render("见 [[ADAPT]]。\n", "index.md").html;
  assert.match(out, /<a href="\/01\.%E7%BB%84%E4%BC%9A%E6%9D%90%E6%96%99\/02\.%E8%AE%BA%E6%96%87%E7%AC%94%E8%AE%B0\/ADAPT">ADAPT<\/a>/, "双链应指向论文笔记的站内绝对路径,链接文本用目标名");
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
  assert.match(out.html, /title: \[未闭合/, "降级路径是渲染全文,frontmatter 原文须进入输出");
});
