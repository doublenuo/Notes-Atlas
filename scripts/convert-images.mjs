/**
 * 图片批量转 WebP 并更新引用。
 *
 * 背景：docs/public 下 300+ 张截图类 PNG 共约 112MB（最大单张 9.5MB），
 * 直接进 dist 拖慢部署与首屏。WebP q85 实测截图可减 90%+ 体积。
 *
 * 流程：
 *   1. 扫描 docs 下全部 .md / .ts / .vue / .scss / .css，收集本地图片引用
 *      （/ 开头的站点绝对路径，如 /images/cos/xxx.png）
 *   2. 对 public/ 下被引用的 png/jpg/jpeg 调 ImageMagick 转 WebP（q85）
 *   3. 把所有引用里的扩展名改成 .webp
 *   4. 删除原图；若 webp 反而更大则保留原图、不改引用（安全阀）
 *
 * 保留原格式的文件（KEEP）：favicon / apple-touch-icon / logo / tx.jpg。
 * favicon 与 og:image 涉及浏览器与社交平台兼容性（部分平台不认 WebP），
 * 不随批量转换；这几个文件都很小，没有优化必要。
 *
 * 用法：node scripts/convert-images.mjs [--dry-run]
 *   --dry-run  只统计将转换的文件与预计收益，不落盘
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const DOCS_ROOT = fileURLToPath(new URL('../docs', import.meta.url));
const PUBLIC_DIR = join(DOCS_ROOT, 'public');
const DRY_RUN = process.argv.includes('--dry-run');

/** 不参与转换的文件（兼容性优先） */
const KEEP = new Set([
  'favicon.ico',
  'favicon-32.png',
  'apple-touch-icon.png',
  'logo.png',
  'tx.jpg',
]);

/** 会被改写引用的源码文件类型 */
const SOURCE_EXTS = new Set(['.md', '.ts', '.vue', '.scss', '.css', '.js']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    // node_modules 与构建产物不扫：dist 里是带 hash 的拷贝，改了会与源码脱节
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'cache') continue;
    const f = join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

/** 收集源码文件中的本地图片引用 → Map<publicDir 相对路径, Set<引用该图的源码文件>> */
function collectReferences() {
  const files = walk(DOCS_ROOT).filter((f) => SOURCE_EXTS.has(extname(f)) && !f.includes('node_modules'));
  const refs = new Map();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // markdown ![](.../x.png)、html/vue src=".../x.png"、ts 里的 "/x.png" 字符串
    const re = /(?:\[[^\]]*\]\(|src="|href="|'|\"|`)(\/[^)'"`\s:]+\.(?:png|jpe?g))(?:\)|"|'|`)/gi;
    for (const m of text.matchAll(re)) {
      const rel = m[1].replace(/^\//, '');
      if (KEEP.has(rel)) continue;
      if (!refs.has(rel)) refs.set(rel, new Set());
      refs.get(rel).add(file);
    }
  }
  return refs;
}

/** 把源码里的旧扩展名替换为新扩展名（按完整路径匹配，避免误伤同名不同目录文件） */
function updateReferences(refRel, newExt) {
  const files = refs.get(refRel);
  const newRel = refRel.replace(/\.(png|jpe?g)$/, newExt);
  let hits = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const next = text.split(`/${refRel}`).join(`/${newRel}`);
    if (next !== text) {
      hits++;
      if (!DRY_RUN) writeFileSync(file, next);
    }
  }
  return hits;
}

const refs = collectReferences();
let totalBefore = 0;
let totalAfter = 0;
let converted = 0;
let skipped = 0;
const missing = [];

for (const [rel, sources] of [...refs.entries()].sort()) {
  const src = join(PUBLIC_DIR, rel);
  if (!existsSync(src)) {
    missing.push(rel);
    continue;
  }
  const before = statSync(src).size;
  const webp = src.replace(/\.(png|jpe?g)$/, '.webp');
  if (DRY_RUN) {
    totalBefore += before;
    converted++;
    continue;
  }
  try {
    execFileSync('convert', [src, '-quality', '85', webp], { stdio: 'pipe' });
  } catch (e) {
    console.error(`[convert-images] 转换失败，跳过：${rel}（${e.message}）`);
    skipped++;
    continue;
  }
  const after = statSync(webp).size;
  if (after >= before) {
    // 安全阀：webp 没有收益，保留原图与引用
    unlinkSync(webp);
    skipped++;
    continue;
  }
  const updated = updateReferences(rel, '.webp');
  if (updated === 0) {
    // 引用没换成功就不能删原图，否则死链
    console.error(`[convert-images] 引用未更新，保留原图：${rel}`);
    unlinkSync(webp);
    skipped++;
    continue;
  }
  unlinkSync(src);
  totalBefore += before;
  totalAfter += after;
  converted++;
}

const mb = (n) => (n / 1048576).toFixed(1);
console.log(
  `[convert-images]${DRY_RUN ? '（dry-run）' : ''} 转换 ${converted} 张，跳过 ${skipped} 张` +
    (missing.length ? `，缺失 ${missing.length} 张：${missing.slice(0, 5).join(', ')}` : '') +
    (DRY_RUN
      ? `\n  待转换原始体积 ${mb(totalBefore)}MB`
      : `\n  原始体积 ${mb(totalBefore)}MB → WebP ${mb(totalAfter)}MB（-${totalBefore ? Math.round((1 - totalAfter / totalBefore) * 100) : 0}%）`)
);
