import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import MarkdownIt from "markdown-it";
import { imageSizePlugin, loadImageDimensions } from "../docs/.vitepress/plugins/imageSize.ts";
import { DOCS } from "./helpers.mjs";

const PUBLIC_DIR = join(DOCS, "public");

test("图片尺寸：远程图片从缓存注入 width/height", () => {
  const dims = new Map([["https://example.com/a.webp", { width: 1200, height: 800 }]]);
  const md = new MarkdownIt({ html: true }).use((md) => imageSizePlugin(md, PUBLIC_DIR, dims));
  const html = md.render('![示例](https://example.com/a.webp "标题")');

  assert.match(html, /width="1200"/);
  assert.match(html, /height="800"/);
  assert.match(html, /decoding="async"/);
});

test("图片尺寸：本地 public 图片仍从文件头解析", () => {
  const md = new MarkdownIt({ html: true }).use((md) => imageSizePlugin(md, PUBLIC_DIR, new Map()));
  const html = md.render("![logo](/logo.png)");

  assert.match(html, /width="128"/);
  assert.match(html, /height="128"/);
});

test("图片尺寸：HTML <img> 也会补尺寸，已有 width 不覆盖", () => {
  const dims = new Map([
    ["https://example.com/a.webp", { width: 1200, height: 800 }],
    ["https://example.com/b.webp", { width: 640, height: 480 }],
  ]);
  const md = new MarkdownIt({ html: true }).use((md) => imageSizePlugin(md, PUBLIC_DIR, dims));
  const html = md.render(
    '<img src="https://example.com/a.webp" alt="a">\n\n<img src="https://example.com/b.webp" alt="b" width="100">',
  );

  assert.match(html, /src="https:\/\/example\.com\/a\.webp" alt="a" width="1200" height="800"/);
  assert.match(html, /src="https:\/\/example\.com\/b\.webp" alt="b" width="100"/);
  assert.ok(!html.includes('width="100" height="480"'), "已有 width 时不应再补 height");
});

test("图片尺寸：缓存缺失时保持原样", () => {
  const md = new MarkdownIt({ html: true }).use((md) => imageSizePlugin(md, PUBLIC_DIR, new Map()));
  const html = md.render("![未知](https://example.com/missing.webp)");

  assert.ok(!html.includes("width="));
  assert.ok(!html.includes("height="));
});

test("图片尺寸：缓存文件格式解析", () => {
  // 仓库里提交的缓存应能被加载（新增图片后由 pnpm images:sizes 更新）
  const dims = loadImageDimensions();
  assert.ok(dims instanceof Map);
  for (const [url, dim] of dims) {
    assert.match(url, /^https?:\/\//, "缓存键应是绝对 URL");
    assert.ok(dim.width > 0 && dim.height > 0, `${url} 的尺寸应大于 0`);
  }
});
