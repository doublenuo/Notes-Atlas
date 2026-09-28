import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import tar from "tar";

/** 经 unix socket 调 Docker HTTP API;非 2xx → reject(信息含状态码)。 */
function put({ socketPath, requestPath, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        method: "PUT",
        path: requestPath,
        headers: { "Content-Type": "application/tar", "Content-Length": body.length },
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
    req.on("error", reject);
    req.end(body);
  });
}

/**
 * 把 distDir 内容发布进 Caddy 容器的静态目录。
 * 归档 API 等价 `docker cp -a <dist>/. <container>:/opt/blogs/`:
 * 只覆盖/新增,不删除容器内旧文件(与既有部署语义一致)。
 */
export function createArchivePublisher({ socketPath = "/var/run/docker.sock", container, destPath = "/opt/blogs" }) {
  return async function publish(distDir) {
    const tmp = path.join(os.tmpdir(), `notes-pub-${process.pid}-${Date.now()}.tgz`);
    try {
      await tar.create({ gzip: true, cwd: distDir, file: tmp, portable: true }, ["."]);
      const body = await fs.readFile(tmp);
      await put({
        socketPath,
        requestPath: `/containers/${encodeURIComponent(container)}/archive?path=${encodeURIComponent(destPath)}`,
        body,
      });
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  };
}
