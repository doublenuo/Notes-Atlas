import { watch } from "chokidar";

/** 监听 docs/(忽略构建产物目录防自触发循环;树排除另见 paths.js EXCLUDE_DIRS);任何增删改 → onChange(路径)。返回 close()。 */
export function startWatcher({ siteDir, onChange }) {
  const watcher = watch(`${siteDir}/docs`, {
    ignoreInitial: true,
    ignored: (p) => /\/(\.vitepress|public|node_modules)(\/|$)/.test(p),
  });
  watcher.on("all", (event, p) => {
    if (event === "add" || event === "change" || event === "unlink" || event === "addDir" || event === "unlinkDir") {
      onChange(p);
    }
  });
  return () => watcher.close();
}
