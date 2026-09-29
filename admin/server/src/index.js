import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createAuth } from "./auth.js";
import { buildApp } from "./app.js";
import { createFiles } from "./files.js";
import { createPreviewRenderer } from "./preview.js";
import { createBuildQueue, createSpawnRunner } from "./build.js";
import { createArchivePublisher } from "./publish.js";
import { startWatcher } from "./watcher.js";

const pexec = promisify(execFile);

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trimEnd();
    }
  } catch {
    /* 容器由 compose env_file 注入;本地可放 admin/server/.env */
  }
}
loadEnv(path.join(import.meta.dirname, "..", ".env"));

// 非法数值回退默认值,防 NaN(空串/abc → 默认;TimeoutNaNWarning 会让超时变成 +5ms 的秒级超时)
const envNum = (v, def) => {
  const n = Number(v);
  return v && Number.isFinite(n) ? n : def;
};

const SITE = process.env.SITE_DIR || "/srv/site";
for (const key of ["ADMIN_USER", "ADMIN_PASS_HASH", "TOKEN_SECRET"]) {
  if (!process.env[key]) {
    console.error(`[admin] 缺少环境变量 ${key}`);
    process.exit(1);
  }
}

// 站点目录存在性断言(任务 1 执行注记②):缺目录 = 挂载配置错误,启动即失败好过运行时 500
if (!fs.existsSync(path.join(SITE, "docs"))) {
  console.error(`[admin] 站点目录不存在: ${path.join(SITE, "docs")}`);
  process.exit(1);
}
// 入参格式断言(任务 2 质量审查)
if (process.env.TOKEN_SECRET.length < 32) {
  console.error("[admin] TOKEN_SECRET 过短(应为 openssl rand -hex 32 的 64 位十六进制)");
  process.exit(1);
}
if (!/^\$2[aby]\$\d{2}\$/.test(process.env.ADMIN_PASS_HASH)) {
  console.error("[admin] ADMIN_PASS_HASH 不是 bcrypt 串(用 hashPassword 生成)");
  process.exit(1);
}

const execGit = async (args) => {
  const { stdout } = await pexec("git", args, { cwd: SITE, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
};

// 构建命令可整体替换(本地冒烟用 BUILD_COMMAND="echo smoke-build-ok");先 trim 再按空白拆分,不支持 shell 引号语义(含引号请用包装脚本)
const buildSpec = (process.env.BUILD_COMMAND || "").trim() || "npm run docs:build";
const [buildCmd, ...buildArgs] = buildSpec.split(/\s+/);

// 审查落点(任务 5 质量审查):①distDir 必须注入——队列零参调 publish(),缺参 createArchivePublisher 直接抛错而非 tar.create 静默打包 process.cwd()
//   (路径 docs/.vitepress/dist 是 vitepress 默认产物,已对照 deploy.yml 的 source 行核实);②putTimeoutMs 默认 60s,daemon 卡住时队列落 failed、不永久 building
const queue = createBuildQueue({
  runBuild: createSpawnRunner({
    command: buildCmd,
    args: buildArgs,
    cwd: SITE,
    timeoutMs: envNum(process.env.BUILD_TIMEOUT_MS, 600000),
  }),
  publish: createArchivePublisher({
    socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock",
    container: process.env.CADDY_CONTAINER || "caddy",
    destPath: process.env.PUBLISH_PATH || "/opt/blogs",
    distDir: path.join(SITE, "docs/.vitepress/dist"),
  }),
  debounceMs: envNum(process.env.BUILD_DEBOUNCE_MS, 5000),
});

const auth = createAuth({
  secret: process.env.TOKEN_SECRET,
  user: process.env.ADMIN_USER,
  passHash: process.env.ADMIN_PASS_HASH,
  stateDir: path.join(import.meta.dirname, "..", ".state"),
});

const files = createFiles({ docsDir: path.join(SITE, "docs"), siteDir: SITE, execGit });

const preview = createPreviewRenderer({ docsDir: path.join(SITE, "docs") });

const app = buildApp({ auth, files, queue, preview, config: { cookieSecure: process.env.COOKIE_SECURE !== "0" } });

const closeWatcher = startWatcher({ siteDir: SITE, onChange: () => queue.trigger() });
// 关闭双兜底:watcher 关闭失败也要 close server;SIGINT 同路径(本地 Ctrl-C 冒烟)
const shutdown = async () => {
  try {
    await closeWatcher();
  } finally {
    await app.close();
    process.exit(0);
  }
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const host = process.env.HOST || "127.0.0.1";
const port = envNum(process.env.PORT, 8477);
await app.listen({ host, port });
console.log(`[admin] notes-admin listening on ${host}:${port} (site=${SITE})`);
