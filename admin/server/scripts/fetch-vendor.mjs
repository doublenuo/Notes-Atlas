/**
 * 从仓库根 node_modules 生成 admin 前端预览所需的浏览器库到 public/vendor/。
 * 版本以根 package.json 的 devDependencies 为准(mermaid ^11.15.0)。
 * 不手抄:升级根依赖后重跑本脚本即可。
 *
 * 只取 woff2 字体(20 个 ttf/woff 是给旧浏览器的回退,现代浏览器不需要)。
 * mermaid 只取 dist/mermaid.min.js:该 UMD 末尾执行
 * globalThis["mermaid"] = ... ,自包含单文件;整包 dist 有 217 个 ESM chunk/75MB。
 *
 * katex 刻意经 mermaid 的依赖图解析而非硬编码顶层 node_modules/katex:
 * katex 不是根 devDependency,只是 mermaid 的传递依赖,pnpm 的 isolated
 * 布局下顶层软链不保证存在。经已声明的 mermaid 解析才有保证。
 *
 * 锚点必须是 realpath 后的 mermaid:顶层 node_modules/mermaid 本身也是软链,
 * 直接用软链路径 createRequire 会让 Node 从 node_modules/mermaid 逐级向上
 * 找,跳过 .pnpm/ 而命中顶层 node_modules/katex —— 恰好是这里要消除的软链。
 * realpath 后锚点落在 .pnpm/mermaid@x/node_modules/mermaid/,其同级
 * katex 软链由 pnpm 按 mermaid 真实依赖图生成,必定存在。
 */
import { copyFileSync, cpSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NM = resolve(HERE, "..", "..", "..", "node_modules"); // 仓库根 node_modules
const OUT = join(HERE, "..", "public", "vendor");

// 经 mermaid 解析 katex:mermaid 是已声明依赖,katex 由它带入
const req = createRequire(realpathSync(join(NM, "mermaid/package.json")));
const KATEX = dirname(req.resolve("katex/package.json"));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "katex"), { recursive: true });

copyFileSync(join(NM, "mermaid/dist/mermaid.min.js"), join(OUT, "mermaid.min.js"));
copyFileSync(join(KATEX, "dist/katex.min.js"), join(OUT, "katex/katex.min.js"));
copyFileSync(join(KATEX, "dist/katex.min.css"), join(OUT, "katex/katex.min.css"));
copyFileSync(join(KATEX, "dist/contrib/auto-render.min.js"), join(OUT, "katex/auto-render.min.js"));
cpSync(join(KATEX, "dist/fonts"), join(OUT, "katex/fonts"), {
  recursive: true,
  filter: (src) => !/\.(ttf|woff|eot|svg)$/.test(src),
});

console.log(`vendor 已生成 → ${OUT}`);
console.log(`katex 解析自 → ${KATEX}`);
