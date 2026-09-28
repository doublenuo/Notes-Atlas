import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const DAY = 86400000;
const b64 = (buf) => Buffer.from(buf).toString("base64url");

export function hashPassword(pw) {
  return bcrypt.hashSync(String(pw), 10);
}

export function createAuth({
  secret,
  user,
  passHash,
  stateDir,
  now = Date.now,
  windowMs = 60000,
  limit = 10,
}) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("createAuth: secret 必填且非空(安全模块对自己的构造参数负责)");
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const revokeFile = path.join(stateDir, "revoke");
  const hits = new Map(); // ip -> [时间戳]

  const revokeAt = () => {
    try {
      return Number(fs.readFileSync(revokeFile, "utf8")) || 0;
    } catch {
      return 0;
    }
  };
  const hmac = (body) => crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const sign = (payload) => {
    const body = b64(JSON.stringify(payload));
    return `${body}.${hmac(body)}`;
  };

  return {
    /** 成功返回 token,失败 null。 */
    login(u, p) {
      const ok = bcrypt.compareSync(String(p ?? ""), passHash); // 无条件恒时比较,防用户名枚举时序(CWE-203)
      if (u !== user || !ok) return null;
      const t = now();
      return sign({ user, iat: t, exp: t + 30 * DAY });
    },
    /** 校验签名、过期、全局失效点;失败 null。 */
    verify(token) {
      if (typeof token !== "string") return null;
      const i = token.indexOf(".");
      if (i < 0) return null;
      const body = token.slice(0, i);
      const got = token.slice(i + 1);
      const want = hmac(body);
      const a = Buffer.from(got);
      const b = Buffer.from(want);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      let p;
      try {
        p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      } catch {
        return null;
      }
      if (p.user !== user || p.exp <= now() || p.iat < revokeAt()) return null;
      return p;
    },
    /** 写全局失效点:iat 早于此刻的 token 一律拒绝(原子写,容器重启不复活)。 */
    logout() {
      const tmp = `${revokeFile}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, String(now()));
      fs.renameSync(tmp, revokeFile); // rename 原子替换,防半截文件把失效点静默清零
    },
    /** 每次登录尝试计数,超限 false。 */
    rateAllow(ip) {
      const t = now();
      const arr = (hits.get(ip) || []).filter((x) => t - x < windowMs);
      if (arr.length >= limit) {
        hits.set(ip, arr);
        return false;
      }
      arr.push(t);
      hits.set(ip, arr);
      return true;
    },
  };
}
