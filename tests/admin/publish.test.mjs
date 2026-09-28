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

test("归档发布:PUT docker socket,URL、请求头与 tar 内容均正确", async () => {
  let got = null;
  const server = await listenFakeDocker((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      got = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) };
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
    const publish = createArchivePublisher({ socketPath: sock, container: "caddy", destPath: "/opt/blogs", distDir: dist });
    await publish(); // 构建队列的零参形态
    assert.equal(got.method, "PUT");
    assert.ok(got.url.includes("/containers/caddy/archive"), got.url);
    assert.ok(got.url.includes(encodeURIComponent("/opt/blogs")), "path 参数 URL 编码");
    assert.equal(got.headers["content-type"], "application/x-tar", "swagger consumes 列出的标准类型");
    assert.equal(Number(got.headers["content-length"]), got.body.length, "content-length 与实际字节一致");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "na-untar-"));
    const tgz = path.join(tmp, "a.tgz");
    fs.writeFileSync(tgz, zlib.gunzipSync(got.body));
    await tar.extract({ file: tgz, cwd: tmp });
    assert.equal(fs.readFileSync(path.join(tmp, "index.html"), "utf8"), "<h1>hi</h1>");
    assert.equal(fs.readFileSync(path.join(tmp, "admin", "app.js"), "utf8"), "console.log(1)");
    const leftover = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(`notes-pub-${process.pid}-`));
    assert.deepEqual(leftover, [], "finally 清理临时 tgz");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("Docker API 异常:非 2xx 报状态码、无响应超时拒绝、缺 distDir 拒绝", async () => {
  const server = await listenFakeDocker((req, res) => {
    res.statusCode = 404;
    res.end('{"message":"No such container: caddy"}');
  });
  const sock = server.address();
  try {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "na-dist2-"));
    fs.writeFileSync(path.join(dist, "index.html"), "x");
    const publish = createArchivePublisher({ socketPath: sock, container: "caddy", destPath: "/opt/blogs", distDir: dist });
    await assert.rejects(() => publish(), (e) => /404/.test(e.message) && /No such container/.test(e.message));

    // 未注入 distDir → 拒绝,绝不静默打包 process.cwd()(必须修复①)
    const bare = createArchivePublisher({ socketPath: sock, container: "caddy", destPath: "/opt/blogs" });
    await assert.rejects(() => bare(), /缺少 distDir/);
  } finally {
    await new Promise((r) => server.close(r));
  }

  // PUT 无响应 → 超时拒绝,队列不得因 daemon 卡住而永久卡 building
  const hang = await listenFakeDocker(() => {});
  try {
    const hung = createArchivePublisher({
      socketPath: hang.address(),
      container: "caddy",
      distDir: fs.mkdtempSync(path.join(os.tmpdir(), "na-dist3-")),
      putTimeoutMs: 150,
    });
    const t0 = Date.now();
    await assert.rejects(() => hung(), /归档超时/);
    assert.ok(Date.now() - t0 < 3000, "超时在 putTimeoutMs 量级触发");
  } finally {
    hang.closeAllConnections();
    await new Promise((r) => hang.close(r));
  }
});
