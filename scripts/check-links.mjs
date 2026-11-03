/**
 * 构建产物死链检查：扫描 dist 下全部 .html 页面里的内部 href/src，
 * 验证目标文件在 dist 中真实存在（含 cleanUrls 的无后缀路由、目录 index.html、图片等静态资源）。
 *
 * 只查站内链接：外链（http/https）网络波动大、结果不稳定，不适合放进必须通过的 CI，
 * 需要时可用 lychee 等工具单独跑。锚点（#）、mailto/tel/javascript/data、协议相对（//）一律跳过。
 *
 * 用法：先 vitepress build，再 node scripts/check-links.mjs [distDir]，发现死链退出码 1。
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'docs/.vitepress/dist');
if (!fs.existsSync(dist)) {
  console.error('[check-links] dist 不存在：' + dist + '，请先 vitepress build');
  process.exit(1);
}

// VitePress 部署 base（与 config.ts / site.ts 保持一致）：默认 '/'，
// GitHub Pages 部署时由 VITEPRESS_BASE=/Notes-Atlas/ 注入。链接在 HTML 里会带该前缀，
// 但产物文件直接落在 dist 根下，所以解析前必须先剥掉 base，否则会把
// /Notes-Atlas/assets/... 误判成 dist/Notes-Atlas/assets/... 而大量误报死链。
const BASE = (process.env.VITEPRESS_BASE ?? '/').replace(/\/?$/, '');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

const SKIP = /^(https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i;

/** dist 内相对路径 → 实际文件：cleanUrls 下 /a/b 可落 a/b.html 或 a/b/index.html */
function exists(target) {
  const p = path.join(dist, target);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return true;
  return fs.existsSync(p + '.html') || fs.existsSync(path.join(p, 'index.html'));
}

const htmlFiles = walk(dist);
const broken = new Map(); // 目标 -> [来源页]
let checked = 0;

for (const file of htmlFiles) {
  const relFile = path.relative(dist, file).split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    let href = m[1];
    if (!href || SKIP.test(href)) continue;
    // 去掉查询串与锚点
    href = href.replace(/[?#].*$/, '');
    if (!href) continue;
    // 站内绝对路径：剥掉 base 前缀后解析；相对路径按所在页面目录解析
    const target = href.startsWith('/')
      ? (BASE && href.startsWith(BASE) ? href.slice(BASE.length) : href).replace(/^\//, '')
      : path.posix.normalize(path.posix.join(path.posix.dirname(relFile), href));
    checked++;
    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      // 保留原样
    }
    if (!exists(decoded) && !exists(target)) {
      if (!broken.has(target)) broken.set(target, []);
      broken.get(target).push(relFile);
    }
  }
}

if (broken.size) {
  const head = '[check-links] 发现 ' + broken.size + ' 个死链（共检查 ' + checked + ' 个内部引用）：';
  console.error(head);
  for (const [target, sources] of [...broken.entries()].sort()) {
    const uniq = [...new Set(sources)];
    const from = uniq.slice(0, 3).join(', ') + (uniq.length > 3 ? ' 等 ' + uniq.length + ' 处' : '');
    console.error('  x ' + target);
    console.error('      <- ' + from);
  }
  process.exit(1);
}
console.log('[check-links] ' + htmlFiles.length + ' 个页面、' + checked + ' 个内部引用，全部可达');
