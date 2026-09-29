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
