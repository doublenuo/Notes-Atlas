import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { createArchivePublisher } from "../../admin/server/src/publish.js";

// tar 是 admin/server 的依赖(tests/ 不在其 node_modules 解析路径上,根 pnpm 隔离安装不提升传递依赖)
// → 从拥有方 package.json 锚点 require;红阶段静态 import publish.js 在 link 期先失败,5.6 预期不变
const tar = createRequire(new URL("../../admin/server/package.json", import.meta.url))("tar");

function listenFakeDocker(handler) {
  const sock = path.join(os.tmpdir(), `na-sock-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sock`);
  const server = http.createServer(handler);
  return new Promise((resolve) => server.listen(sock, () => resolve(server)));
}

test("归档发布:PUT docker socket,URL 与 tar 内容均正确", async () => {
  let got = null;
  const server = await listenFakeDocker((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      got = { method: req.method, url: req.url, body: Buffer.concat(chunks) };
      res.statusCode = 200;
      res.end("{}");
    });
  });
  const sock = server.address();
  try {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "na-dist-"));
    fs.writeFileSync(path.join(dist, "index.html"), "<h1>hi</h1>");
    fs.mkdirSync(path.join(dist, "admin"));
    fs.writeFileSync(path.join(dist, "admin", "app.js"), "console.log(1)");
    const publish = createArchivePublisher({ socketPath: sock, container: "caddy", destPath: "/opt/blogs" });
    await publish(dist);
    assert.equal(got.method, "PUT");
    assert.ok(got.url.includes("/containers/caddy/archive"), got.url);
    assert.ok(got.url.includes(encodeURIComponent("/opt/blogs")), "path 参数 URL 编码");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "na-untar-"));
    const tgz = path.join(tmp, "a.tgz");
    fs.writeFileSync(tgz, zlib.gunzipSync(got.body));
    await tar.extract({ file: tgz, cwd: tmp });
    assert.equal(fs.readFileSync(path.join(tmp, "index.html"), "utf8"), "<h1>hi</h1>");
    assert.equal(fs.readFileSync(path.join(tmp, "admin", "app.js"), "utf8"), "console.log(1)");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("Docker API 非 2xx → reject,信息含状态码与原因", async () => {
  const server = await listenFakeDocker((req, res) => {
    res.statusCode = 404;
    res.end('{"message":"No such container: caddy"}');
  });
  const sock = server.address();
  try {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "na-dist2-"));
    fs.writeFileSync(path.join(dist, "index.html"), "x");
    const publish = createArchivePublisher({ socketPath: sock, container: "caddy", destPath: "/opt/blogs" });
    await assert.rejects(
      () => publish(dist),
      (e) => /404/.test(e.message) && /No such container/.test(e.message),
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
