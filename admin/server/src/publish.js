import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import tar from "tar";

/** 经 unix socket 调 Docker HTTP API;非 2xx → reject(信息含状态码);超时 → reject("Docker 归档超时")。 */
function put({ socketPath, requestPath, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        method: "PUT",
        path: requestPath,
        timeout: timeoutMs,
        headers: { "Content-Type": "application/x-tar", "Content-Length": body.length },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(buf);
          else reject(new Error(`Docker API ${res.statusCode}: ${buf.toString("utf8").slice(0, 300)}`));
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Docker 归档超时")));
    req.on("error", reject);
    req.end(body);
  });
}

/**
 * 把 distDir 内容发布进 Caddy 容器的静态目录。
 * 归档 API 等价 `docker cp -a <dist>/. <container>:/opt/blogs/`:
 * 只覆盖/新增,不删除容器内旧文件(与既有部署语义一致)。
 * 零参契约:构建队列调用 publish(),目标目录只能来自构造方 distDir——
 * 未注入时直接抛错,tar.create 在 cwd: undefined 下会静默归档 process.cwd()(审查修复)。
 * 无版本前缀的 /containers/.../archive 已实测被 daemon 接受(等同 latest API)。
 */
export function createArchivePublisher({
  socketPath = "/var/run/docker.sock",
  container,
  destPath = "/opt/blogs",
  distDir,
  putTimeoutMs = 60000,
}) {
  return async function publish() {
    if (!distDir) throw new Error("publish 缺少 distDir");
    const tmp = path.join(os.tmpdir(), `notes-pub-${process.pid}-${Date.now()}.tgz`);
    try {
      await tar.create({ gzip: true, cwd: distDir, file: tmp, portable: true }, ["."]);
      const body = await fs.readFile(tmp);
      await put({
        socketPath,
        requestPath: `/containers/${encodeURIComponent(container)}/archive?path=${encodeURIComponent(destPath)}`,
        body,
        timeoutMs: putTimeoutMs,
      });
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  };
}
