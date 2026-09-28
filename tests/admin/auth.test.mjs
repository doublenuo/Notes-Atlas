import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAuth, hashPassword } from "../../admin/server/src/auth.js";

const PASS = "pw-test-123";
const HASH = hashPassword(PASS); // 一次性真实 bcrypt(约 80ms),顺带覆盖 bcryptjs 导入正确性

function mkAuth(overrides = {}) {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "na-auth-"));
  let clock = Date.parse("2026-09-28T10:00:00Z");
  const auth = createAuth({
    secret: "unit-test-secret",
    user: "admin",
    passHash: HASH,
    stateDir,
    now: () => clock,
    ...overrides,
  });
  return { auth, stateDir, tick: (ms) => (clock += ms) };
}

test("正确凭据签发 token 且 verify 返回载荷(30 天有效期)", () => {
  const { auth } = mkAuth();
  const tok = auth.login("admin", PASS);
  assert.ok(tok && tok.includes("."));
  const p = auth.verify(tok);
  assert.equal(p.user, "admin");
  assert.equal(p.exp - p.iat, 30 * 86400000);
});

test("错误密码或错误用户 → null", () => {
  const { auth } = mkAuth();
  assert.equal(auth.login("admin", "wrong"), null);
  assert.equal(auth.login("nobody", PASS), null);
});

test("篡改签名或载荷 → null", () => {
  const { auth } = mkAuth();
  const tok = auth.login("admin", PASS);
  assert.equal(auth.verify(tok.slice(0, -2) + "xx"), null);
  const [body, sig] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ user: "admin", iat: 1, exp: 9999999999999 })).toString("base64url");
  assert.equal(auth.verify(`${forged}.${sig}`), null);
  assert.equal(auth.verify(undefined), null); // 无 cookie 时任务6 onRequest 传 undefined
  assert.equal(auth.verify("nodot"), null); // 无分隔符的畸形 token
});

test("过期 token → null", () => {
  const { auth, tick } = mkAuth();
  const tok = auth.login("admin", PASS);
  tick(30 * 86400000 + 1000);
  assert.equal(auth.verify(tok), null);
});

test("登出后旧 token 失效,登出后新登录的 token 有效", () => {
  const { auth, tick } = mkAuth();
  const old = auth.login("admin", PASS);
  tick(1); // 登出发生在签发之后(真实世界必然;冻结时钟下同刻三时间戳相等会让单失效点语义无解)
  auth.logout();
  assert.equal(auth.verify(old), null);
  const fresh = auth.login("admin", PASS);
  assert.ok(auth.verify(fresh));
});

test("限流:同 IP 一分钟内第 10 次放行、第 11 次拒绝", () => {
  const { auth, tick } = mkAuth();
  for (let i = 0; i < 10; i++) assert.equal(auth.rateAllow("1.2.3.4"), true, `第 ${i + 1} 次`);
  assert.equal(auth.rateAllow("1.2.3.4"), false);
  assert.equal(auth.rateAllow("5.6.7.8"), true, "不同 IP 不受影响");
  tick(60001); // 窗口滑出后该 IP 恢复放行
  assert.equal(auth.rateAllow("1.2.3.4"), true, "61s 后窗口重置");
});

test("登出把全局失效点持久化到 stateDir/revoke", () => {
  const { auth, tick, stateDir } = mkAuth();
  const tok = auth.login("admin", PASS);
  tick(1);
  auth.logout();
  const saved = Number(fs.readFileSync(path.join(stateDir, "revoke"), "utf8"));
  assert.ok(Number.isFinite(saved) && saved > 0);
  // 跨实例(等价容器重启)读同一失效点:旧 token 必须失效
  const auth2 = createAuth({ secret: "unit-test-secret", user: "admin", passHash: HASH, stateDir, now: () => saved });
  assert.equal(auth2.verify(tok), null, "新实例读同一 revoke 后旧 token 失效");
});
