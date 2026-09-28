import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../../admin/server/src/app.js";
import { createAuth, hashPassword } from "../../admin/server/src/auth.js";
import { createFiles } from "../../admin/server/src/files.js";
import { createBuildQueue } from "../../admin/server/src/build.js";

const PASS = "pw-app-123";
const HASH = hashPassword(PASS); // 模块级只算一次

function mkApp() {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "na-app-"));
  const docsDir = path.join(siteDir, "docs");
  fs.mkdirSync(path.join(docsDir, "dir1"), { recursive: true });
  fs.writeFileSync(path.join(docsDir, "index.md"), "---\ntitle: 首页\nhero:\n  name: Hi\n---\n# 首页\n");
  fs.writeFileSync(path.join(docsDir, "dir1", "a.md"), "# a\n");
  const auth = createAuth({
    secret: "app-test-secret",
    user: "admin",
    passHash: HASH,
    stateDir: path.join(siteDir, ".state"),
  });
  const execGit = async () => "abc1234 admin(x): y";
  const files = createFiles({ docsDir, siteDir, execGit });
  const queue = createBuildQueue({ runBuild: async () => "ok", publish: async () => {}, debounceMs: 1 });
  const app = buildApp({ auth, files, queue, config: { cookieSecure: true } });
  return { app, docsDir };
}

async function loginPair(app) {
  const res = await app.inject({ method: "POST", url: "/admin/api/login", payload: { user: "admin", pass: PASS } });
  assert.equal(res.statusCode, 204);
  return res.headers["set-cookie"][0].split(";")[0]; // 只取 na_admin=<tok>
}

test("1 未登录访问 /tree → 401 {code,message}", async () => {
  const { app } = mkApp();
  const res = await app.inject({ method: "GET", url: "/admin/api/tree" });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().code, "UNAUTHENTICATED");
});

test("2 GET /login → 405(仅接受 POST)", async () => {
  const { app } = mkApp();
  const res = await app.inject({ method: "GET", url: "/admin/api/login" });
  assert.equal(res.statusCode, 405);
  assert.equal(res.json().code, "METHOD_NOT_ALLOWED");
});

test("3 密码错误 → 401", async () => {
  const { app } = mkApp();
  const res = await app.inject({ method: "POST", url: "/admin/api/login", payload: { user: "admin", pass: "wrong" } });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().code, "BAD_CREDENTIALS");
});

test("4 登录成功 → 204 + Set-Cookie 属性齐全", async () => {
  const { app } = mkApp();
  const res = await app.inject({ method: "POST", url: "/admin/api/login", payload: { user: "admin", pass: PASS } });
  assert.equal(res.statusCode, 204);
  const c = res.headers["set-cookie"][0];
  assert.ok(c.startsWith("na_admin="));
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=2592000"]) {
    assert.ok(c.includes(flag), `缺 ${flag}:${c}`);
  }
});

test("5 登录后 /tree → 200 且结构正确", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({ method: "GET", url: "/admin/api/tree", headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const { nodes } = res.json();
  assert.deepEqual(nodes.map((n) => n.name).sort(), ["dir1", "index.md"]);
  assert.equal(nodes.find((n) => n.name === "dir1").children[0].type, "file");
});

test("6 限流:同 IP 第 11 次登录 → 429", async () => {
  const { app } = mkApp();
  for (let i = 0; i < 10; i++) {
    const r = await app.inject({ method: "POST", url: "/admin/api/login", payload: { user: "admin", pass: "bad" } });
    assert.equal(r.statusCode, 401, `第 ${i + 1} 次应为 401`);
  }
  const r11 = await app.inject({ method: "POST", url: "/admin/api/login", payload: { user: "admin", pass: PASS } });
  assert.equal(r11.statusCode, 429);
});

test("7 PUT /file 路径穿越 ../ → 400", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({
    method: "PUT",
    url: "/admin/api/file",
    headers: { cookie },
    payload: { path: "../evil.md", content: "x" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, "INVALID_PATH");
});

test("8 编码型逃逸 %2e%2e%2f → 400(框架解码后仍被拦截)", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({ method: "GET", url: "/admin/api/file?path=%2e%2e%2fsecret.md", headers: { cookie } });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, "INVALID_PATH");
});

test("9 PUT /file 正常 → 204 且落盘", async () => {
  const { app, docsDir } = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({
    method: "PUT",
    url: "/admin/api/file",
    headers: { cookie },
    payload: { path: "dir1/a.md", content: "# 改过\n" },
  });
  assert.equal(res.statusCode, 204);
  assert.equal(fs.readFileSync(path.join(docsDir, "dir1", "a.md"), "utf8"), "# 改过\n");
});

test("10 GET /file → 200 {content, frontmatter, mtime},hero 保真", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({ method: "GET", url: "/admin/api/file?path=index.md", headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const b = res.json();
  assert.ok(b.content.includes("# 首页"));
  assert.equal(b.frontmatter.title, "首页");
  assert.deepEqual(b.frontmatter.hero, { name: "Hi" });
  assert.ok(b.mtime > 0);
});

test("11 DELETE /file → 204;再次删除 → 404", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const r1 = await app.inject({ method: "DELETE", url: "/admin/api/file?path=dir1/a.md", headers: { cookie } });
  assert.equal(r1.statusCode, 204);
  const r2 = await app.inject({ method: "DELETE", url: "/admin/api/file?path=dir1/a.md", headers: { cookie } });
  assert.equal(r2.statusCode, 404);
});

test("12 logout → 204,旧 cookie 随即全 401", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const out = await app.inject({ method: "POST", url: "/admin/api/logout", headers: { cookie } });
  assert.equal(out.statusCode, 204);
  const res = await app.inject({ method: "GET", url: "/admin/api/tree", headers: { cookie } });
  assert.equal(res.statusCode, 401);
});

test("13 GET /build/status → 200 含全部字段", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({ method: "GET", url: "/admin/api/build/status", headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const s = res.json();
  for (const k of ["state", "queued", "startedAt", "durationMs", "log", "lastCommit", "publishedAt"]) {
    assert.ok(k in s, `缺字段 ${k}`);
  }
  assert.equal(s.state, "idle");
  assert.equal(typeof s.lastCommit, "string");
});

test("14 GET /build/lastlog → 200 {log}", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const res = await app.inject({ method: "GET", url: "/admin/api/build/lastlog", headers: { cookie } });
  assert.equal(res.statusCode, 200);
  assert.ok("log" in res.json());
});

test("15 rename/dir 联动:204/204/409/204", async () => {
  const { app } = mkApp();
  const cookie = await loginPair(app);
  const h = { cookie };
  const r1 = await app.inject({ method: "POST", url: "/admin/api/rename", headers: h, payload: { from: "dir1/a.md", to: "dir1/b.md" } });
  assert.equal(r1.statusCode, 204);
  const r2 = await app.inject({ method: "POST", url: "/admin/api/dir", headers: h, payload: { path: "dir2" } });
  assert.equal(r2.statusCode, 204);
  const r3 = await app.inject({ method: "DELETE", url: "/admin/api/dir?path=dir1", headers: h });
  assert.equal(r3.statusCode, 409, "dir1 非空需 force");
  const r4 = await app.inject({ method: "DELETE", url: "/admin/api/dir?path=dir1&force=1", headers: h });
  assert.equal(r4.statusCode, 204);
});

test("16 GET /file 坏 YAML → 200 + parseError(可经 UI 打开修复,不 500)", async () => {
  const { app, docsDir } = mkApp();
  fs.writeFileSync(path.join(docsDir, "broken.md"), "---\ntitle: [未闭合\n---\n\nx\n");
  const cookie = await loginPair(app);
  const res = await app.inject({ method: "GET", url: "/admin/api/file?path=broken.md", headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const b = res.json();
  assert.ok(b.parseError, "应携带 parseError");
  assert.ok(b.content.includes("[未闭合"), "原文可读可改");
  assert.equal(typeof b.mtime, "number");
});
