import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = fs.readFileSync(path.join(ROOT, "docs", ".vitepress", "config.ts"), "utf8");
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const LOCK = fs.readFileSync(path.join(ROOT, "pnpm-lock.yaml"), "utf8");

// VitePress 不支持 frontmatter permalink，不启用则 /meet/20260929 刷新即 404
test("config.ts：用 createRewrites 把 frontmatter permalink 变成实际构建路径", () => {
  assert.match(
    CONFIG,
    /import \{ createRewrites \} from "vitepress-plugin-permalink"|'vitepress-plugin-permalink'/,
    "应引入 vitepress-plugin-permalink 的 createRewrites"
  );
  assert.match(CONFIG, /rewrites:\s*createRewrites\(/, "应配置 rewrites");
});

// 插件用 gray-matter 扫描全部 md；superpowers 里有故意写坏的 frontmatter 会抛异常
test("config.ts：createRewrites 排除 superpowers 并限定扫描根为 docs", () => {
  assert.match(CONFIG, /path:\s*'docs'/, "扫描根应限定为 docs，避免扫到仓库其它目录");
  assert.match(CONFIG, /ignoreList:\s*\['superpowers'\]/, "必须排除 superpowers");
});

test("依赖：vitepress-plugin-permalink 已显式声明并锁定", () => {
  assert.ok(
    PKG.devDependencies["vitepress-plugin-permalink"],
    "应显式声明 vitepress-plugin-permalink，不能只依赖 teek 的传递依赖"
  );
  // CI 用 pnpm --frozen-lockfile，lock 不同步会直接失败
  const importer = LOCK.slice(LOCK.indexOf("importers:"), LOCK.indexOf("packages:"));
  assert.match(importer, /vitepress-plugin-permalink:/, "lock 的根 importer 应包含该依赖");
});

// 重复 permalink 会让 MiniSearch 抛 duplicate ID 导致构建失败
test("重复 permalink 已清理：同一 permalink 只归属一个文档", () => {
  const DOCS = path.join(ROOT, "docs");
  const seen = new Map();
  const dups = [];

  const walk = dir => {
    for (const name of fs.readdirSync(dir)) {
      if (name === "node_modules" || name === "dist" || name === ".vitepress" || name === "public") continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".md")) continue;
      const rel = path.relative(DOCS, full);
      if (rel.startsWith("superpowers" + path.sep)) continue;
      const m = fs.readFileSync(full, "utf8").match(/^permalink:\s*(\S+)\s*$/m);
      if (!m) continue;
      const link = m[1];
      if (seen.has(link)) dups.push(`${link}: ${seen.get(link)} <-> ${rel}`);
      else seen.set(link, rel);
    }
  };
  walk(DOCS);

  assert.deepEqual(dups, [], `不应有重复 permalink：\n${dups.join("\n")}`);
});

// 该文档的 permalink 必须真的存在
test("目标文档 20260929 声明了 permalink", () => {
  const src = path.join(ROOT, "docs", "01.组会材料", "01.组会内容", "20260929.md");
  assert.match(
    fs.readFileSync(src, "utf8"),
    /^permalink:\s*\/meet\/20260929\s*$/m,
    "应声明 permalink: /meet/20260929"
  );
});

// permalink 是逐个文档的，不能出现 /meet/20260929 落到别的页面
test("permalink 命名空间隔离：/meet/ 下不混放非组会内容", () => {
  const src = path.join(ROOT, "docs", "01.组会材料", "01.组会内容", "20260929.md");
  const title = fs.readFileSync(src, "utf8").match(/^title:\s*(.+)$/m);
  assert.ok(title, "源文档应有 title");
  assert.match(title[1].trim(), /组会/, "/meet/ 下的文档应是组会记录");
});
