/**
 * 孤儿媒体文件扫描：找出 docs/public 下没有任何源码引用的图片/视频。
 *
 * 与 convert-images.mjs 只处理「被引用」相反，本脚本回答反向问题：
 * public 里哪些文件从未被任何源码提到，可以安全删除。
 *
 * 引用判定：把仓库内全部源码文件（排除 .git / node_modules / dist / cache / public）
 * 读成一个大字符串，对每个媒体文件用「相对 public 的路径」和「/ + 相对路径」
 * 两种形态做子串匹配。字符串字面量、模板串（${BASE}tx.jpg）、markdown、
 * html img/video 标签都能覆盖。
 *
 * 用法：node scripts/find-orphan-media.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_DIR = join(REPO_ROOT, 'docs', 'public');

const MEDIA_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico',   // 图片
  '.mp4', '.webm', '.mov', '.avi', '.mkv',                              // 视频
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'cache', 'public', '.superpowers']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const f = join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

/** 收集全部源码文本（按文件保留，便于报告引用位置） */
const sourceFiles = walk(REPO_ROOT).filter((f) => {
  const ext = extname(f);
  return ['.md', '.ts', '.vue', '.js', '.mjs', '.scss', '.css', '.html', '.json', '.yml', '.yaml', '.txt'].includes(ext);
});
const sources = sourceFiles.map((f) => ({ file: relative(REPO_ROOT, f), text: readFileSync(f, 'utf8') }));

/** public 下全部媒体文件 */
const mediaFiles = walk(PUBLIC_DIR)
  .filter((f) => MEDIA_EXTS.has(extname(f).toLowerCase()))
  .map((f) => ({ abs: f, rel: relative(PUBLIC_DIR, f).split(sep).join('/'), size: statSync(f).size }));

const orphans = [];
const referenced = [];
for (const m of mediaFiles) {
  const needle1 = m.rel;          // images/cos/x.png
  const needle2 = '/' + m.rel;    // /images/cos/x.png
  const hits = sources.filter((s) => s.text.includes(needle1) || s.text.includes(needle2));
  if (hits.length) referenced.push({ ...m, refs: hits.map((h) => h.file) });
  else orphans.push(m);
}

const mb = (n) => (n / 1048576).toFixed(2);
const totalOrphan = orphans.reduce((s, o) => s + o.size, 0);

console.log(`[orphan] 扫描 ${sources.length} 个源码文件、${mediaFiles.length} 个媒体文件`);
console.log(`[orphan] 被引用 ${referenced.length} 个，孤儿 ${orphans.length} 个（共 ${mb(totalOrphan)}MB）：\n`);
for (const o of orphans.sort((a, b) => b.size - a.size)) {
  console.log(`  ${mb(o.size).padStart(8)}MB  ${o.rel}`);
}
if (orphans.length) {
  console.log(`\n[orphan] 确认无误后执行：node scripts/delete-orphan-media.mjs`);
}
