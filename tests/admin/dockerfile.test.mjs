import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dockerfile = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "admin", "server", "Dockerfile"),
  "utf8",
);

// 回归保护:面板新建/保存/重命名/删除落盘后会在容器内跑 git add/commit,
// 缺 git 会致全部文件操作 500(镜像 node:22-alpine 默认不含 git)。
test("Dockerfile:安装 git(容器内文件操作提交依赖)", () => {
  assert.match(dockerfile, /apk add --no-cache git/, "Dockerfile 应含 apk add git");
});