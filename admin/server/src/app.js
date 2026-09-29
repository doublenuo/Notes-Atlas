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
 * 装配 Fastify(不监听)。路由见规格 §4(14 条,前缀 /admin/api)。
 * 除 /login 外全部要求有效会话 cookie;错误体统一 {code, message}。
 */
export function buildApp({ auth, files, queue, preview, config = {} }) {
  const app = Fastify({ logger: false }); // 不用默认日志:避免任何请求体/token 入日志
  const secure = config.cookieSecure !== false;

  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin/api/")) return;
    if (req.url.split("?")[0] === "/admin/api/login") return; // 精确匹配:login?x=1 豁免、/admin/api/loginX 不豁免
    const tok = parseCookie(req.headers.cookie)[COOKIE_NAME];
    if (!auth.verify(tok)) {
      return reply.code(401).send({ code: "UNAUTHENTICATED", message: "未登录或会话过期" });
    }
  });

  // 语义码白名单:与 app.js/files.js 源码字面量逐一对应;框架内部码与 errno 一律不外泄
  const SEMANTIC = new Set([
    "UNAUTHENTICATED",
    "BAD_CREDENTIALS",
    "RATE_LIMITED",
    "METHOD_NOT_ALLOWED",
    "INVALID_PATH",
    "BAD_EXT",
    "BAD_BODY",
    "NOT_FOUND",
    "NOT_A_FILE",
    "EXISTS",
    "PARENT_MISSING",
    "NOT_EMPTY",
    "INTERNAL",
  ]);

  app.setErrorHandler((err, req, reply) => {
    let status, code, message;
    if (typeof err.code === "string" && err.code.startsWith("FST_ERR_CTP_")) {
      status = 400; // 消除 413/415 越界,封死框架内部码
      code = "BAD_BODY";
      message = err.message;
    } else if (typeof err.code === "string" && SEMANTIC.has(err.code)) {
      status = err.status || err.statusCode || 500;
      code = err.code;
      message = err.message;
    } else {
      status = 500; // errno/未知一律语义码,不回显(防绝对路径泄漏)
      code = "INTERNAL";
      message = "服务器错误";
    }
    if (status >= 500) console.error("[admin]", req.method, req.url, err); // 只记方法/路径/错误,不记 body 与 cookie
    reply.code(status).send({ code, message });
  });

  // ② 未注册路径统一 {code,message}(规格 §7)。注入实测:路径已注册但方法不匹配(DELETE /admin/api/tree)时
  //    req.routeOptions?.url 恒为 null 且同样落进本处理器 → 不设 405 分支,一律 404(405 仅 /login 显式路由,见 §8.3)
  app.setNotFoundHandler(async (req, reply) => reply.code(404).send({ code: "NOT_FOUND", message: "接口不存在" }));

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
    // 与登录同源属性(仅 Max-Age=0):HttpOnly/SameSite=Strict/Path=/Secure 一致
    reply.header("Set-Cookie", [`${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? "; Secure" : ""}`]);
    return reply.code(204).send();
  });

  // 预览渲染:html:false 防 XSS(嵌入正文走同一实例二次解析),解析失败经既有 setErrorHandler 收口为 INTERNAL
  app.post("/admin/api/preview", async (req) => {
    const r = preview.render(req.body?.content ?? "", req.body?.path ?? "");
    return { html: r.html, title: r.title };
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
