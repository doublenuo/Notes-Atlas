import fs from "node:fs";
import path from "node:path";

// 树排除 = 站点不发布的目录(隐藏目录由调用方 `startsWith(".")` 统一过滤):
// @fragment 是插件暂存(resolver 亦排除)、superpowers 被 config srcExclude;@pages 为真实发布页,有意不排除
export const EXCLUDE_DIRS = new Set([".vitepress", "public", "admin", "node_modules", "@fragment", "superpowers"]);

export function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

/** 把相对路径解析为 docsDir 下的绝对路径;任何逃逸(../、绝对路径、\0、符号链接)抛 400。 */
export function safeResolve(docsDir, rel) {
  if (typeof rel !== "string" || rel === "" || rel.includes("\0")) {
    throw httpError(400, "INVALID_PATH", "非法路径");
  }
  docsDir = path.resolve(docsDir); // 入口归一化:吞掉尾斜杠与 `.` 段,避免合法请求被字面比较误判 400
  const abs = path.resolve(docsDir, rel);
  if (abs !== docsDir && !abs.startsWith(docsDir + path.sep)) {
    throw httpError(400, "INVALID_PATH", "路径越界");
  }
  // realpath 复核:从目标向上找最近的已存在祖先,确认其真实位置仍在 docsDir 内(防符号链接)
  let probe = abs;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const root = fs.realpathSync(docsDir);
  const real = fs.realpathSync(probe);
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw httpError(400, "INVALID_PATH", "路径越界");
  }
  return abs;
}
