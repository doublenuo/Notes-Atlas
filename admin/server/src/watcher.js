import { watch } from "chokidar";

/** 监听 docs/(规格 §5:监听 docs/**.md);任何增删改 → onChange(路径)。返回 close()。 */
export function startWatcher({ siteDir, onChange }) {
  const watcher = watch(`${siteDir}/docs`, {
    ignoreInitial: true,
    ignored: (p) => /\/(\.vitepress|public|node_modules)(\/|$)/.test(p),
  });
  watcher.on("all", (event, p) => {
    // ① .md 过滤 = 规格监听语义(docs/**.md);② 天然忽略 public/(含任务 7 的 UI 产物 public/admin/)防自触发;
    // ③ 非内容文件(.txt/.js 等)不触发构建;树排除另见 paths.js EXCLUDE_DIRS
    if (!p.endsWith(".md")) return;
    if (event === "add" || event === "change" || event === "unlink" || event === "addDir" || event === "unlinkDir") {
      onChange(p);
    }
  });
  return () => watcher.close();
}
