import Fastify from "fastify";
import { parseDoc } from "./frontmatter.js";

const COOKIE_NAME = "na_admin";

function parseCookie(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/**
 * 装配 Fastify(不监听)。路由见规格 §4(13 条,前缀 /admin/api)。
 * 除 /login 外全部要求有效会话 cookie;错误体统一 {code, message}。
 */
export function buildApp({ auth, files, queue, config = {} }) {
  const app = Fastify({ logger: false }); // 不用默认日志:避免任何请求体/token 入日志
  const secure = config.cookieSecure !== false;

  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin/api/")) return;
    if (req.url.startsWith("/admin/api/login")) return;
    const tok = parseCookie(req.headers.cookie)[COOKIE_NAME];
    if (!auth.verify(tok)) {
      return reply.code(401).send({ code: "UNAUTHENTICATED", message: "未登录或会话过期" });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error("[admin]", req.method, req.url, err); // 只记方法/路径/错误,不记 body 与 cookie
    // execFile 的 err.code 是数字(退出码 1/128),契约要求 code 恒为字符串 → 非字符串一律 INTERNAL
    reply.code(status).send({ code: typeof err.code === "string" ? err.code : "INTERNAL", message: err.message || "服务器错误" });
  });

  // 健康检查语义:登录只接受 POST(规格 §8.3)
  app.get("/admin/api/login", async (req, reply) =>
    reply.code(405).send({ code: "METHOD_NOT_ALLOWED", message: "请用 POST" }),
  );

  app.post("/admin/api/login", async (req, reply) => {
    if (!auth.rateAllow(req.headers["x-real-ip"] || req.ip)) {
      return reply.code(429).send({ code: "RATE_LIMITED", message: "尝试过于频繁,请一分钟后再试" });
    }
    const { user, pass } = req.body || {};
    const tok = auth.login(user, pass);
    if (!tok) return reply.code(401).send({ code: "BAD_CREDENTIALS", message: "用户名或密码错误" });
    const flags = "HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000" + (secure ? "; Secure" : "");
    // 单元素数组:fastify 5 注入层对单条 set-cookie 透传原始类型(字符串),数组形态让 inject 断言稳定;线上序列化字节相同
    reply.header("Set-Cookie", [`${COOKIE_NAME}=${tok}; ${flags}`]);
    return reply.code(204).send();
  });

  app.post("/admin/api/logout", async (req, reply) => {
    // 先推进 2ms 再吊销:auth 失效点是毫秒时间戳,同毫秒的 iat 无法区分先后(见 auth.test 同刻注释);
    // 本处理器入口必然 ≥ 已签发 token 的 iat,推进后 revokeAt 严格更大 → 注销确定性生效
    await new Promise((r) => setTimeout(r, 2));
    auth.logout();
    reply.header("Set-Cookie", [`${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`]);
    return reply.code(204).send();
  });

  app.get("/admin/api/tree", async () => ({ nodes: await files.tree() }));

  app.get("/admin/api/file", async (req) => {
    const r = await files.read(req.query.path);
    // YAML 坏了也要能打开修复(验收④的恢复路径):不 500,返回原文 + parseError
    let frontmatter = {};
    let parseError = null;
    try {
      frontmatter = parseDoc(r.content).frontmatter;
    } catch (e) {
      parseError = e.message;
    }
    return { content: r.content, frontmatter, parseError, mtime: r.mtime };
  });

  app.put("/admin/api/file", async (req, reply) => {
    await files.write(req.body?.path, req.body?.content);
    return reply.code(204).send();
  });

  app.post("/admin/api/file", async (req, reply) => {
    await files.create(req.body?.path);
    return reply.code(204).send();
  });

  app.delete("/admin/api/file", async (req, reply) => {
    await files.removeFile(req.query.path);
    return reply.code(204).send();
  });

  app.post("/admin/api/dir", async (req, reply) => {
    await files.createDir(req.body?.path);
    return reply.code(204).send();
  });

  app.delete("/admin/api/dir", async (req, reply) => {
    await files.removeDir(req.query.path, req.query.force === "1");
    return reply.code(204).send();
  });

  app.post("/admin/api/rename", async (req, reply) => {
    await files.rename(req.body?.from, req.body?.to);
    return reply.code(204).send();
  });

  app.get("/admin/api/build/status", async () => ({
    ...queue.status(),
    lastCommit: await files.lastCommit(),
  }));

  app.get("/admin/api/build/lastlog", async () => ({ log: queue.status().log }));

  return app;
}
