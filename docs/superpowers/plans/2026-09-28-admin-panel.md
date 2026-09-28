---
date: 2026-09-28 14:00:00
title: 2026-09-28-admin-panel
---
# 后台管理系统(登录 + 文档 CRUD + 自动重建)实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 站点新增同域 `/admin/` 后台：登录后加载服务器目录树,管理员对文档/目录增删改查,保存即 git commit + 自动重建发布;服务器仓库 `/opt/notes-atlas` 成为唯一真源,rsync 推送退役。

**架构：** 方案 A(已批准):自研 Fastify 轻量后端跑在 Docker 容器(`admin/server/`,挂载站点仓库 + docker.sock,加入既有外部网络 `caddy-network`)+ Vite+Vue3 静态管理 SPA(`admin/ui/`,产物进 `docs/public/admin/` 随站点发布,无 CDN);共享 Caddyfile 仅新增一段 `handle_path /admin/api/*` 反代;chokidar 监听 → 防抖 5s → 单飞行构建队列 → 构建成功才发布进 Caddy 容器。TDD:`node --test` 先红后绿,与现有 37 用例同框架同目录约定。

**技术栈：** Fastify 5、bcryptjs 2、chokidar 4、gray-matter 4、tar 6(均纯 JS);Vue 3.5 + Vite 5.4 + markdown-it 14;node:20-slim;共享 Caddy(`caddy:2-alpine`)。

**规格：** `docs/superpowers/specs/2026-09-28-admin-panel-design.md`(已 commit `81ba805`;本计划任务 0 含三类事实修订、四处精确替换,见下)

**规格事实修订(任务 0 执行,依据 2026-09-28 实测)：**
1. 仓库为 **pnpm 管理**(`pnpm-lock.yaml` 有效,`package-lock.json` 停在 4-21 已失效,`deploy.yml` 亦用 pnpm)→ 规格 §8.2 "服务器 npm ci" 改为 `pnpm install --frozen-lockfile`。
2. 后端容器内**不装 docker CLI** → 发布实现为 Docker 归档 API `PUT /containers/<id>/archive`(经 docker.sock,语义等价 `docker cp -a dist/. caddy:/opt/blogs/`,规格 §2/§5.2 同步注记)。
3. Caddy 容器的 `127.0.0.1` 是它自己,反代地址改为**容器名** `notes-admin:8477`:后端加入既有外部网络 `caddy-network`(已实测存在且 caddy 已挂载),宿主不发布端口,公网/宿主均不可直连(隔离性等同规格意图)。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `admin/server/package.json` + `package-lock.json` | 后端独立 npm 包(fastify/bcryptjs/chokidar/gray-matter/tar),Docker `npm ci` 用 | 新建 |
| `admin/server/src/paths.js` | 路径安全(`safeResolve`)、树排除表、`httpError` | 新建 |
| `admin/server/src/auth.js` | 登录校验、HMAC token 签发/验证、登出失效点、登录限流、`hashPassword` | 新建 |
| `admin/server/src/frontmatter.js` | 纯函数:parse/applyForm/buildTemplate(**服务端与 UI 共用**,浏览器可打包,已实测) | 新建 |
| `admin/server/src/files.js` | 目录树遍历 + 文档/目录 CRUD + git commit | 新建 |
| `admin/server/src/build.js` | `createSpawnRunner`(进程+超时+日志尾)+ `createBuildQueue`(状态机) | 新建 |
| `admin/server/src/publish.js` | Docker 归档 API 发布(tar 打包 → unix socket PUT) | 新建 |
| `admin/server/src/app.js` | Fastify 装配:鉴权钩子、13 条路由、错误体 `{code,message}` | 新建 |
| `admin/server/src/watcher.js` | chokidar 监听 `docs/`(排除规则同树)→ 触发队列 | 新建 |
| `admin/server/src/index.js` | 读 env、装配真实依赖、起监听、起 watcher | 新建 |
| `admin/server/Dockerfile` | node:20-slim + apt git,`npm ci --omit=dev` | 新建 |
| `admin/server/compose.yaml` | 容器名 notes-admin、挂仓库与 docker.sock、外部网络 caddy-network、`env_file: .env` | 新建 |
| `admin/server/.env.example` / `.gitignore` | 环境变量样例;忽略 `.env`、`.state/` | 新建 |
| `admin/ui/vite.config.js` + `index.html` + `src/**` | 管理 SPA(单页无路由):main.js、style.css、api.js、App.vue、LoginForm/FileTree/EditorView/BuildStatus | 新建 |
| `tests/admin/*.test.mjs`(7 个文件) | 后端 59 个用例(见各任务) | 新建 |
| `package.json` | devDeps +4(`vite/@vitejs/plugin-vue/vue/markdown-it`)、`docs:build` 先出 UI、`admin:dev` 脚本 | 修改(pnpm add) |
| `pnpm-lock.yaml` | 随 pnpm add 更新 | 修改 |
| `.gitignore` | 追加 `docs/public/admin/`、`admin/server/.env`、`admin/server/.state/` | 修改 |
| `docs/superpowers/specs/2026-09-28-admin-panel-design.md` | 上述三类事实修订(四处替换) | 修改 |
| 服务器 `/data/stacks/caddy/Caddyfile` | 仅插入 `handle_path /admin/api/*` 一段(备份 → validate → reload) | 迁移期修改 |

不做的事(YAGNI,规格 §10):媒体上传、多用户/RBAC、路由库、富文本、搜索、版本对比 UI;不动 `docs/.vitepress/config.ts`(用户 WIP)、不进站点导航。

**全局约定(所有任务遵守):**
- 包管理:根目录 **pnpm**(`pnpm add`/`pnpm test`/`pnpm docs:build`);`admin/server` 独立 **npm**(`npm install --prefix admin/server`)。
- git:`git add` 仅列本任务显式路径;不 `push`(push GitHub 触发部署,由用户发起;`push srv` 在任务 9 迁移指令内)。
- 错误对象统一 `e.status`(HTTP 码)+ `e.code`;Fastify 错误体统一 `{code, message}`。
- 后端代码须兼容 **node 20**(容器)与本地 node 24:`import.meta.dirname` 要求 ≥20.11(满足)。
- 提交粒度:每个任务末尾一次 commit,信息见各任务。

---

## 任务 0:依赖与脚手架(含规格事实修订)

**文件:**
- 修改:`package.json`、`pnpm-lock.yaml`、`.gitignore`
- 修改:`docs/superpowers/specs/2026-09-28-admin-panel-design.md`
- 创建:`admin/server/package.json`、`admin/server/package-lock.json`、`admin/server/.env.example`、`admin/server/.gitignore`

- [x] **步骤 0.1:确认依赖文件干净(脏则停下报告用户)**

```bash
cd /home/weno/works/Notes-Atlas && git status --short -- package.json pnpm-lock.yaml .gitignore
```

预期:无输出。若有输出 → 停下,报告用户(不得覆盖用户改动)。

- [x] **步骤 0.2:根目录添加 4 个 devDeps**

```bash
pnpm add -D vite@5.4.21 @vitejs/plugin-vue@5.2.4 vue@3.5.33 markdown-it@14.1.0
```

预期:exit 0;`node -e "const p=require('./package.json');console.log(Object.keys(p.devDependencies).length)"` 输出 `13`(原 9 + 新 4);`ls node_modules/.bin/vite node_modules/.bin/vitepress` 两个都存在。

- [x] **步骤 0.3:验证锁文件一致性(deploy.yml 的 frozen-lockfile 不能被破坏)**

```bash
pnpm install --frozen-lockfile
```

预期:exit 0,输出含 `Already up to date` 或无错误;`git status --short -- package.json pnpm-lock.yaml` 应显示两者均已修改(改动将随本任务提交)。

- [x] **步骤 0.4:创建后端独立包并安装**

写入 `admin/server/package.json`(全文):

```json
{
  "name": "notes-atlas-admin-server",
  "private": true,
  "type": "module",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "chokidar": "^4.0.0",
    "fastify": "^5.0.0",
    "gray-matter": "^4.0.3",
    "tar": "^6.2.1"
  }
}
```

写入 `admin/server/.gitignore`(全文):

```
.env
.state/
```

写入 `admin/server/.env.example`(全文):

```
ADMIN_USER=admin
ADMIN_PASS_HASH=<用 hashPassword 生成的 bcrypt 串>
TOKEN_SECRET=<openssl rand -hex 32 的输出>
SITE_DIR=/srv/site
CADDY_CONTAINER=caddy
HOST=0.0.0.0
PORT=8477
COOKIE_SECURE=1
BUILD_DEBOUNCE_MS=5000
DOCKER_SOCKET=/var/run/docker.sock
PUBLISH_PATH=/opt/blogs
```

安装并验证:

```bash
npm install --prefix admin/server
ls admin/server/node_modules/fastify admin/server/node_modules/bcryptjs admin/server/node_modules/chokidar admin/server/node_modules/tar admin/server/node_modules/gray-matter
```

预期:exit 0,五个目录齐全;`admin/server/package-lock.json` 已生成(提交它,Docker `npm ci` 依赖)。

- [x] **步骤 0.5:根 .gitignore 追加三行**

在 `.gitignore` 末尾追加:

```
# =========================
# NotesAtlas admin
# =========================
docs/public/admin/
admin/server/.env
admin/server/.state/
```

验证:`git check-ignore docs/public/admin/index.html admin/server/.env admin/server/.state/revoke` 三个路径全部被列出(即均被忽略)。

- [x] **步骤 0.6:规格四处事实修订(edit 工具,精确替换)**

对 `docs/superpowers/specs/2026-09-28-admin-panel-design.md` 执行四次替换:

替换 1(§2 发布机制):

- 旧:`(发布必须 \`docker cp\`——实测 Caddy 容器静态目录无 bind mount;docker.sock 等同 root,`
- 新:`(发布必须经 docker.sock 拷入容器——实现用 Docker 归档 API \`PUT /containers/<id>/archive\`,语义等价 \`docker cp -a dist/.\`,镜像内不装 docker CLI;实测 Caddy 容器静态目录无 bind mount;docker.sock 等同 root,`

替换 2(§2 Caddy 反代段):

- 旧:`  \`handle_path /admin/api/* { reverse_proxy 127.0.0.1:8477 }\`;改前备份(沿用 \`.bak-日期\` 惯例)、`
- 新:`  \`handle_path /admin/api/* { reverse_proxy notes-admin:8477 }\`(后端容器加入既有外部网络 \`caddy-network\`,按容器名直连;宿主不发布端口,公网不可直连);改前备份(沿用 \`.bak-日期\` 惯例)、`

替换 3(§8.2 依赖安装):

- 旧:`+ 服务器 checkout;服务器 \`npm ci\``
- 新:`+ 服务器 checkout;服务器 \`pnpm install --frozen-lockfile\`(仓库为 pnpm 管理,\`package-lock.json\` 已失效、不使用)`

替换 4(§5.2 发布命令,与替换 1 同一机制注记):

- 旧:`2. **构建成功** → \`docker cp /srv/site/docs/.vitepress/dist/. <CADDY_CONTAINER>:/opt/blogs/\` →`
- 新:`2. **构建成功** → 把 dist 拷入容器(实现:经 docker.sock 调 Docker 归档 API \`PUT /containers/<id>/archive\`,等价 \`docker cp /srv/site/docs/.vitepress/dist/. <CADDY_CONTAINER>:/opt/blogs/\`)→`

- [x] **步骤 0.7:基线回归确认**

```bash
pnpm test
```

预期:输出 `# tests 37`、`# pass 37`、`# fail 0`(新增 tests/admin 目录尚不存在,本步只确认没弄坏现状)。

- [x] **步骤 0.8:Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore admin/server/package.json admin/server/package-lock.json admin/server/.gitignore admin/server/.env.example docs/superpowers/specs/2026-09-28-admin-panel-design.md
git commit -m "chore(admin): 后端包脚手架与依赖(pnpm devDeps、规格事实修订)"
```

预期:`git status --short` 中上述路径无残留。

**执行注记(两阶段审查后的补充修复,随后续 `fix(admin)` 提交):**
- 代码质量审查发现规格四处修订漏了同文档其他旧事实 → 追加修复 4 行:§2 架构图(`notes-admin:8477`、`归档API入容器`)、§2 后端容器 bullet(容器内 `0.0.0.0:8477`、宿主不发布端口)、§7(改为 `caddy-network` 内按容器名可达);全文 `127.0.0.1` 清零(遗留的 `docker cp` 字样均为"语义等价/历史现状"说明,有意保留)。
- 根 `.gitignore` 追加块补第 4 行 `!admin/server/.env.example`:既有 `.env.*`(第 89 行)会把该模板文件当密件忽略,`git add` 需 `-f`;加否定规则后常规 add 即可。计划原文"追加三行"实为 4 行。
- `admin/server/package-lock.json` 的 71 条 `resolved` 均为 `registry.npmmirror.com`(本机 `~/.npmrc` 所致);integrity sha512 兜底,服务器在国内、npm ci 走该镜像反而更快——记入收尾报告,不是静默决定。

---

## 任务 1:路径安全与排除表(TDD)

**文件:**
- 创建:`tests/admin/paths.test.mjs`
- 创建:`admin/server/src/paths.js`

- [ ] **步骤 1.1:编写失败的测试(7 个用例)**

写入 `tests/admin/paths.test.mjs`(全文):

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { safeResolve, EXCLUDE_DIRS } from "../../admin/server/src/paths.js";

const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "na-paths-"));

test("逃逸1:../ 相对越界 → 400", () => {
  assert.throws(() => safeResolve(mk(), "../secret.md"), (e) => e.status === 400 && e.code === "INVALID_PATH");
});

test("逃逸2:绝对路径 → 400", () => {
  assert.throws(() => safeResolve(mk(), "/etc/passwd"), (e) => e.status === 400 && e.code === "INVALID_PATH");
});

test("逃逸3:归一化后越界(a/../../x.md) → 400", () => {
  assert.throws(() => safeResolve(mk(), "a/../../x.md"), (e) => e.status === 400 && e.code === "INVALID_PATH");
});

test("逃逸4:空字节 → 400", () => {
  assert.throws(() => safeResolve(mk(), "a\0b.md"), (e) => e.status === 400 && e.code === "INVALID_PATH");
});

test("逃逸5:符号链接逃逸(realpath 复核) → 400", () => {
  const docs = mk();
  const outside = path.join(os.tmpdir(), `na-out-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(outside, "x");
  fs.symlinkSync(outside, path.join(docs, "evil.md"));
  assert.throws(() => safeResolve(docs, "evil.md"), (e) => e.status === 400 && e.code === "INVALID_PATH");
  fs.unlinkSync(outside);
});

test("正常相对路径解析到 docs 下", () => {
  const docs = mk();
  assert.equal(safeResolve(docs, "dir/note.md"), path.join(docs, "dir/note.md"));
});

test("EXCLUDE_DIRS 覆盖四类排除目录", () => {
  for (const d of [".vitepress", "public", "admin", "node_modules"]) {
    assert.ok(EXCLUDE_DIRS.has(d), `缺少 ${d}`);
  }
});
```

- [ ] **步骤 1.2:运行确认失败**

```bash
pnpm test 2>&1 | tail -12
```

预期:FAIL——`tests/admin/paths.test.mjs` 因 `Cannot find module .../admin/server/src/paths.js` 报错;`fail` 数 > 0(其余 37 仍 pass)。

- [ ] **步骤 1.3:编写最少实现**

写入 `admin/server/src/paths.js`(全文):

```js
import fs from "node:fs";
import path from "node:path";

export const EXCLUDE_DIRS = new Set([".vitepress", "public", "admin", "node_modules"]);

export function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

/** 把相对路径解析为 docsDir 下的绝对路径;任何逃逸(../、绝对路径、\0、符号链接)抛 400。 */
export function safeResolve(docsDir, rel) {
  if (typeof rel !== "string" || rel === "" || rel.includes("\0")) {
    throw httpError(400, "INVALID_PATH", "非法路径");
  }
  const abs = path.resolve(docsDir, rel);
  if (abs !== docsDir && !abs.startsWith(docsDir + path.sep)) {
    throw httpError(400, "INVALID_PATH", "路径越界");
  }
  // realpath 复核:从目标向上找最近的已存在祖先,确认其真实位置仍在 docsDir 内(防符号链接)
  let probe = abs;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const root = fs.realpathSync(docsDir);
  const real = fs.realpathSync(probe);
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw httpError(400, "INVALID_PATH", "路径越界");
  }
  return abs;
}
```

- [ ] **步骤 1.4:运行确认通过**

```bash
node --test tests/admin/paths.test.mjs
```

预期:`# pass 7`、`# fail 0`。随后 `pnpm test` → `# pass 44`、`# fail 0`。

- [ ] **步骤 1.5:Commit**

```bash
git add tests/admin/paths.test.mjs admin/server/src/paths.js
git commit -m "feat(admin): 路径安全解析与树排除表"
```

**执行注记(两阶段审查后的补充修复,与规格/计划同笔 `fix(admin)` 提交):**
- 代码质量审查发现排除表与站点现实不符 → `EXCLUDE_DIRS` 补 `@fragment`(插件暂存,resolver 亦排除)与 `superpowers`(`config.ts` `srcExclude`、不发布);测试用例 7 同步断言六项;`@pages` 是真实发布页(`/about`、`/tags`、`/privacy` 等),**有意不排除**。规格 §4 树排除行同步修订。
- `safeResolve` 入口补 `path.resolve(docsDir)` 归一化:尾斜杠/相对形 docsDir 原会被字面比较判成全量 400(fail-closed footgun)。
- 审查建议但按现规格**不改、记档**:①测试临时目录不清理(/tmp 攒空目录,CI 无碍);②`docsDir` 缺失时 `realpathSync` 裸 ENOENT → 500,归到任务 6 启动断言;③写路径不校验排除表(`.vitepress/config.ts` 可经 API 直写)——规格仅要求树展示排除,且构建失败即不发布、git 留历史,风险接受,记入收尾报告。

---

## 任务 2:认证(TDD)

**文件:**
- 创建:`tests/admin/auth.test.mjs`
- 创建:`admin/server/src/auth.js`

- [ ] **步骤 2.1:编写失败的测试(7 个用例)**

写入 `tests/admin/auth.test.mjs`(全文):

```js
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
});

test("过期 token → null", () => {
  const { auth, tick } = mkAuth();
  const tok = auth.login("admin", PASS);
  tick(30 * 86400000 + 1000);
  assert.equal(auth.verify(tok), null);
});

test("登出后旧 token 失效,登出后新登录的 token 有效", () => {
  const { auth } = mkAuth();
  const old = auth.login("admin", PASS);
  auth.logout();
  assert.equal(auth.verify(old), null);
  const fresh = auth.login("admin", PASS);
  assert.ok(auth.verify(fresh));
});

test("限流:同 IP 一分钟内第 10 次放行、第 11 次拒绝", () => {
  const { auth } = mkAuth();
  for (let i = 0; i < 10; i++) assert.equal(auth.rateAllow("1.2.3.4"), true, `第 ${i + 1} 次`);
  assert.equal(auth.rateAllow("1.2.3.4"), false);
  assert.equal(auth.rateAllow("5.6.7.8"), true, "不同 IP 不受影响");
});

test("登出把全局失效点持久化到 stateDir/revoke", () => {
  const { auth, stateDir } = mkAuth();
  auth.logout();
  const saved = Number(fs.readFileSync(path.join(stateDir, "revoke"), "utf8"));
  assert.ok(Number.isFinite(saved) && saved > 0);
});
```

- [ ] **步骤 2.2:运行确认失败**

```bash
pnpm test 2>&1 | tail -6
```

预期:FAIL——`Cannot find module .../admin/server/src/auth.js`,`fail` ≥ 1,`pass` 仍为 44。

- [ ] **步骤 2.3:编写最少实现**

写入 `admin/server/src/auth.js`(全文):

```js
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
      if (u !== user || !bcrypt.compareSync(String(p ?? ""), passHash)) return null;
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
    /** 写全局失效点:iat 早于此刻的 token 一律拒绝(持久化,容器重启不复活)。 */
    logout() {
      fs.writeFileSync(revokeFile, String(now()));
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
```

- [ ] **步骤 2.4:运行确认通过**

```bash
node --test tests/admin/auth.test.mjs
```

预期:`# pass 7`、`# fail 0`(含 hashPassword 的一次性真实 bcrypt)。随后 `pnpm test` → `# pass 51`、`# fail 0`。

- [ ] **步骤 2.5:Commit**

```bash
git add tests/admin/auth.test.mjs admin/server/src/auth.js
git commit -m "feat(admin): 登录认证、HMAC 会话与登录限流"
```

---

## 任务 3:frontmatter 纯函数(TDD)

**文件:**
- 创建:`tests/admin/frontmatter.test.mjs`
- 创建:`admin/server/src/frontmatter.js`(服务端与 UI 共用;浏览器可打包已实测)

- [ ] **步骤 3.1:编写失败的测试(5 个用例)**

写入 `tests/admin/frontmatter.test.mjs`(全文):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseDoc, applyForm, buildTemplate, FORM_FIELDS } from "../../admin/server/src/frontmatter.js";

const HERO_SRC = `---
layout: home
hero:
  name: "Hi Atlas"
  text: "笔记"
  actions:
    - theme: brand
      text: 去读书
      link: /001
---

# 正文开始
`;

test("表单回写 title 后,hero 等嵌套键原样保真", () => {
  const out = applyForm(HERO_SRC, { title: "新标题" });
  const { frontmatter, body } = parseDoc(out);
  assert.equal(frontmatter.title, "新标题");
  assert.equal(frontmatter.layout, "home");
  assert.deepEqual(frontmatter.hero, {
    name: "Hi Atlas",
    text: "笔记",
    actions: [{ theme: "brand", text: "去读书", link: "/001" }],
  });
  assert.equal(body, parseDoc(HERO_SRC).body, "正文不得被改动");
});

test("只改 FORM_FIELDS 已知字段,表单里的未知键被忽略", () => {
  assert.deepEqual(FORM_FIELDS, ["title", "date", "tags", "categories", "sticky"]);
  const out = applyForm(HERO_SRC, { title: "t2", evil: "x", layout: "docs" });
  const { frontmatter } = parseDoc(out);
  assert.equal(frontmatter.title, "t2");
  assert.equal(frontmatter.layout, "home", "未知键不进表单通道;layout 保持原值");
  assert.equal("evil" in frontmatter, false);
});

test("无 frontmatter 的文件补出头部且正文保留", () => {
  const out = applyForm("# 只有正文\n\n段落。\n", { title: "T", tags: ["a"] });
  const { frontmatter, body } = parseDoc(out);
  assert.equal(frontmatter.title, "T");
  assert.deepEqual(frontmatter.tags, ["a"]);
  assert.ok(body.includes("段落。"));
});

test("buildTemplate 含 title/date/tags/categories 骨架", () => {
  const out = buildTemplate("2026-09-28-新文章.md", "2026-09-28 14:00:00");
  const { frontmatter, body } = parseDoc(out);
  assert.equal(frontmatter.title, "2026-09-28-新文章");
  assert.equal(frontmatter.date, "2026-09-28 14:00:00");
  assert.deepEqual(frontmatter.tags, []);
  assert.deepEqual(frontmatter.categories, []);
  assert.ok(body.startsWith("# 2026-09-28-新文章"));
});

test("parseDoc 往返:原文件不被改动", () => {
  const { frontmatter, body } = parseDoc(HERO_SRC);
  assert.equal(frontmatter.layout, "home");
  assert.ok(body.startsWith("# 正文开始"));
  assert.equal(HERO_SRC.includes("# 正文开始"), true);
});
```

- [ ] **步骤 3.2:运行确认失败**

```bash
pnpm test 2>&1 | tail -6
```

预期:FAIL——`Cannot find module .../frontmatter.js`,`pass` 仍为 51。

- [ ] **步骤 3.3:编写最少实现**

写入 `admin/server/src/frontmatter.js`(全文):

```js
import matter from "gray-matter";

export const FORM_FIELDS = ["title", "date", "tags", "categories", "sticky"];

/** 解析为 {frontmatter(对象), body(正文)}。 */
export function parseDoc(content) {
  const { data, content: body } = matter(content);
  return { frontmatter: data, body };
}

/** 只把表单里出现的已知字段合并进现有 frontmatter,其余键原样透传;正文不动。 */
export function applyForm(content, form) {
  const { data, content: body } = matter(content);
  for (const k of FORM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(form, k)) data[k] = form[k];
  }
  return matter.stringify(body, data);
}

/** 新建文档模板:title=文件名、date=当前时间、tags/categories 空数组。 */
export function buildTemplate(name, nowStr) {
  const title = String(name).replace(/\.md$/, "");
  return matter.stringify(`# ${title}\n`, { title, date: nowStr, tags: [], categories: [] });
}
```

- [ ] **步骤 3.4:运行确认通过**

```bash
node --test tests/admin/frontmatter.test.mjs
```

预期:`# pass 5`、`# fail 0`。随后 `pnpm test` → `# pass 56`、`# fail 0`。

- [ ] **步骤 3.5:Commit**

```bash
git add tests/admin/frontmatter.test.mjs admin/server/src/frontmatter.js
git commit -m "feat(admin): frontmatter 表单化纯函数(hero 嵌套键保真)"
```

---

## 任务 4:目录树与文档 CRUD(TDD)

**文件:**
- 创建:`tests/admin/files.test.mjs`
- 创建:`admin/server/src/files.js`

- [ ] **步骤 4.1:编写失败的测试(15 个用例)**

写入 `tests/admin/files.test.mjs`(全文):

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFiles } from "../../admin/server/src/files.js";

function mkSite() {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "na-site-"));
  const docsDir = path.join(siteDir, "docs");
  fs.mkdirSync(path.join(docsDir, "dir1"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, ".vitepress"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, "public"), { recursive: true });
  fs.writeFileSync(path.join(docsDir, "index.md"), "---\ntitle: 首页\nhero:\n  name: Hi\n---\n# 首页\n");
  fs.writeFileSync(path.join(docsDir, "dir1", "a.md"), "# a\n");
  fs.writeFileSync(path.join(docsDir, ".vitepress", "cfg.md"), "# 隐藏\n");
  fs.writeFileSync(path.join(docsDir, "public", "raw.md"), "# 资源\n");
  fs.writeFileSync(path.join(docsDir, "raw.txt"), "# 非 md\n");
  const gitCalls = [];
  const execGit = async (args) => {
    gitCalls.push(args);
    return "abc1234 admin(x): y";
  };
  const files = createFiles({ docsDir, siteDir, execGit });
  return { siteDir, docsDir, gitCalls, files };
}

test("tree:含 index.md 与 dir1/a.md,排除 .vitepress/public/非 md", async () => {
  const { files } = mkSite();
  const nodes = await files.tree();
  const names = nodes.map((n) => n.name).sort();
  assert.deepEqual(names, ["dir1", "index.md"]);
  const dir = nodes.find((n) => n.name === "dir1");
  assert.equal(dir.type, "dir");
  assert.deepEqual(dir.children.map((c) => c.path), ["dir1/a.md"]);
  assert.equal(nodes.find((n) => n.name === "index.md").path, "index.md");
  const flat = JSON.stringify(nodes);
  assert.ok(!flat.includes("cfg.md") && !flat.includes("raw.md") && !flat.includes("raw.txt"));
});

test("create:模板内容 + git add/commit 两连", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.create("dir1/b.md");
  const content = fs.readFileSync(path.join(docsDir, "dir1", "b.md"), "utf8");
  assert.ok(content.includes("title: dir1/b"), "模板 title=文件名");
  assert.ok(content.includes("date:"), "模板带 date");
  assert.deepEqual(gitCalls[0], ["add", "-A", "docs"]);
  assert.deepEqual(gitCalls[1], ["commit", "-m", "admin(create): dir1/b.md"]);
});

test("create:已存在 → 409", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.create("index.md"), (e) => e.status === 409);
});

test("create:父目录不存在 → 404", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.create("no-such-dir/x.md"), (e) => e.status === 404);
});

test("read:成功返回 content 与 mtime", async () => {
  const { files } = mkSite();
  const r = await files.read("dir1/a.md");
  assert.equal(r.content, "# a\n");
  assert.ok(r.mtime > 0);
});

test("read:缺失 → 404", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.read("missing.md"), (e) => e.status === 404);
});

test("write:落盘 + admin(write) commit", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.write("index.md", "---\ntitle: 改\n---\n# 改\n");
  assert.equal(fs.readFileSync(path.join(docsDir, "index.md"), "utf8"), "---\ntitle: 改\n---\n# 改\n");
  assert.deepEqual(gitCalls.at(-1), ["commit", "-m", "admin(write): index.md"]);
});

test("write:路径穿越 → 400", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.write("../evil.md", "x"), (e) => e.status === 400);
});

test("removeFile:成功 + admin(delete) commit", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.removeFile("dir1/a.md");
  assert.equal(fs.existsSync(path.join(docsDir, "dir1", "a.md")), false);
  assert.deepEqual(gitCalls.at(-1), ["commit", "-m", "admin(delete): dir1/a.md"]);
});

test("removeFile:缺失 → 404", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.removeFile("missing.md"), (e) => e.status === 404);
});

test("createDir:成功且不调 git;重复 → 409", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.createDir("dir2");
  assert.ok(fs.statSync(path.join(docsDir, "dir2")).isDirectory());
  assert.equal(gitCalls.length, 0, "空目录 git 不追踪,不产生提交");
  await assert.rejects(() => files.createDir("dir2"), (e) => e.status === 409);
});

test("removeDir:非空且未 force → 409", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.removeDir("dir1", false), (e) => e.status === 409);
});

test("removeDir:force 递归删除 + commit", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.removeDir("dir1", true);
  assert.equal(fs.existsSync(path.join(docsDir, "dir1")), false);
  assert.deepEqual(gitCalls.at(-1), ["commit", "-m", "admin(delete): dir1"]);
});

test("rename:成功移动 + commit", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.rename("dir1/a.md", "dir1/a2.md");
  assert.equal(fs.existsSync(path.join(docsDir, "dir1", "a2.md")), true);
  assert.deepEqual(gitCalls.at(-1), ["commit", "-m", "admin(rename): dir1/a.md -> dir1/a2.md"]);
});

test("rename:目标已存在 → 409", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.rename("dir1/a.md", "index.md"), (e) => e.status === 409);
});
```

- [ ] **步骤 4.2:运行确认失败**

```bash
pnpm test 2>&1 | tail -6
```

预期:FAIL——`Cannot find module .../files.js`,`pass` 仍为 56。

- [ ] **步骤 4.3:编写最少实现**

写入 `admin/server/src/files.js`(全文):

```js
import fs from "node:fs/promises";
import path from "node:path";
import { EXCLUDE_DIRS, httpError, safeResolve } from "./paths.js";
import { buildTemplate } from "./frontmatter.js";

const nowStr = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const isDir = async (p) => {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
};
const exists = async (p) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

/**
 * docsDir 内一切文件操作的唯一入口。
 * execGit(args) → Promise<string>,由装配层绑定 cwd=siteDir 的 git。
 * 每次落盘类改动:git add -A docs && git commit -m "admin(<op>): <path>"。
 */
export function createFiles({ docsDir, siteDir, execGit }) {
  async function commit(op, rel) {
    try {
      await execGit(["add", "-A", "docs"]);
      await execGit(["commit", "-m", `admin(${op}): ${rel}`]);
    } catch (e) {
      // 重复保存同一内容:git 会报 nothing to commit,视为成功
      if (!/nothing to commit/i.test(String(e.stderr || e.message || ""))) throw e;
    }
  }

  async function walk(dir, relBase) {
    const out = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".") || EXCLUDE_DIRS.has(e.name)) continue;
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        out.push({ type: "dir", name: e.name, path: rel, children: await walk(path.join(dir, e.name), rel) });
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push({ type: "file", name: e.name, path: rel });
      }
    }
    return out;
  }

  return {
    tree: () => walk(docsDir, ""),

    async read(rel) {
      const abs = safeResolve(docsDir, rel);
      try {
        const st = await fs.stat(abs);
        if (!st.isFile()) throw httpError(400, "NOT_A_FILE", "不是文件");
        return { content: await fs.readFile(abs, "utf8"), mtime: st.mtimeMs };
      } catch (e) {
        if (e.status) throw e;
        if (e.code === "ENOENT") throw httpError(404, "NOT_FOUND", "文件不存在");
        throw e;
      }
    },

    async create(rel) {
      const abs = safeResolve(docsDir, rel);
      if (await exists(abs)) throw httpError(409, "EXISTS", "已存在");
      if (!(await isDir(path.dirname(abs)))) throw httpError(404, "PARENT_MISSING", "父目录不存在");
      await fs.writeFile(abs, buildTemplate(path.basename(rel), nowStr()), "utf8");
      await commit("create", rel);
    },

    async write(rel, content) {
      if (typeof content !== "string") throw httpError(400, "BAD_BODY", "content 必须是字符串");
      const abs = safeResolve(docsDir, rel);
      if (!(await isDir(path.dirname(abs)))) throw httpError(404, "PARENT_MISSING", "父目录不存在");
      await fs.writeFile(abs, content, "utf8");
      await commit("write", rel);
    },

    async removeFile(rel) {
      const abs = safeResolve(docsDir, rel);
      if (!(await exists(abs))) throw httpError(404, "NOT_FOUND", "文件不存在");
      const st = await fs.stat(abs);
      if (!st.isFile()) throw httpError(400, "NOT_A_FILE", "是目录,请用目录删除");
      await fs.unlink(abs);
      await commit("delete", rel);
    },

    async createDir(rel) {
      const abs = safeResolve(docsDir, rel);
      if (await exists(abs)) throw httpError(409, "EXISTS", "已存在");
      if (!(await isDir(path.dirname(abs)))) throw httpError(404, "PARENT_MISSING", "父目录不存在");
      await fs.mkdir(abs);
      // 空目录 git 不追踪:不提交(文件落入后由 create/write 提交)
    },

    async removeDir(rel, force) {
      if (!rel || rel === "." || rel === "/") throw httpError(400, "INVALID_PATH", "拒绝操作根目录");
      const abs = safeResolve(docsDir, rel);
      if (!(await isDir(abs))) throw httpError(404, "NOT_FOUND", "目录不存在");
      const entries = await fs.readdir(abs);
      if (entries.length && !force) throw httpError(409, "NOT_EMPTY", "目录非空,需 force=1");
      if (entries.length) {
        await fs.rm(abs, { recursive: true });
        await commit("delete", rel);
      } else {
        await fs.rmdir(abs);
      }
    },

    async rename(from, to) {
      const a = safeResolve(docsDir, from);
      const b = safeResolve(docsDir, to);
      if (!(await exists(a))) throw httpError(404, "NOT_FOUND", "源不存在");
      if (await exists(b)) throw httpError(409, "EXISTS", "目标已存在");
      if (!(await isDir(path.dirname(b)))) throw httpError(404, "PARENT_MISSING", "父目录不存在");
      await fs.rename(a, b);
      await commit("rename", `${from} -> ${to}`);
    },

    /** 状态条展示用:最后一次 commit 摘要,无仓库/无提交返回 null。 */
    async lastCommit() {
      try {
        const out = await execGit(["log", "-1", "--format=%h %s"]);
        return String(out || "").trim() || null;
      } catch {
        return null;
      }
    },
  };
}
```

- [ ] **步骤 4.4:运行确认通过**

```bash
node --test tests/admin/files.test.mjs
```

预期:`# pass 15`、`# fail 0`。随后 `pnpm test` → `# pass 71`、`# fail 0`。

- [ ] **步骤 4.5:Commit**

```bash
git add tests/admin/files.test.mjs admin/server/src/files.js
git commit -m "feat(admin): 文件树与文档/目录 CRUD"
```

---

## 任务 5:构建队列与发布(TDD)

**文件:**
- 创建:`tests/admin/build.test.mjs`(7 用例)、`tests/admin/publish.test.mjs`(2 用例)
- 创建:`admin/server/src/build.js`、`admin/server/src/publish.js`

- [ ] **步骤 5.1:编写失败的测试(队列 7 用例)**

写入 `tests/admin/build.test.mjs`(全文):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createBuildQueue, createSpawnRunner } from "../../admin/server/src/build.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeSpawn(code, out) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => {
      child.stdout.emit("data", Buffer.from(out));
      child.emit("close", code);
    });
    return child;
  };
}

test("状态序列 idle→queued→building→success,publish 恰一次", async () => {
  const events = [];
  const queue = createBuildQueue({
    runBuild: async () => {
      events.push("run");
      await sleep(15);
      return "build ok";
    },
    publish: async () => {
      events.push("publish");
    },
    debounceMs: 5,
  });
  assert.equal(queue.status().state, "idle");
  queue.trigger();
  assert.equal(queue.status().state, "queued", "trigger 后进入 queued");
  await sleep(10);
  assert.equal(queue.status().state, "building", "防抖后进入 building");
  await sleep(40);
  assert.equal(queue.status().state, "success");
  assert.deepEqual(events, ["run", "publish"]);
  const s = queue.status();
  assert.ok(s.startedAt > 0 && s.durationMs > 0 && s.publishedAt > 0);
  assert.equal(s.log, "build ok");
  assert.equal(s.queued, false);
});

test("防抖:同一周期内连续三次 trigger 只跑一次", async () => {
  let runs = 0;
  const queue = createBuildQueue({
    runBuild: async () => {
      runs++;
      await sleep(5);
      return "x";
    },
    publish: async () => {},
    debounceMs: 8,
  });
  queue.trigger();
  queue.trigger();
  queue.trigger();
  await sleep(60);
  assert.equal(runs, 1);
});

test("构建中二次触发 → 当前构建后补跑恰好一次(共 2 次)", async () => {
  let runs = 0;
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const queue = createBuildQueue({
    runBuild: async () => {
      runs++;
      if (runs === 1) await gate;
      return `run${runs}`;
    },
    publish: async () => {},
    debounceMs: 5,
  });
  queue.trigger();
  await sleep(15);
  assert.equal(queue.status().state, "building");
  queue.trigger();
  assert.equal(queue.status().queued, true, "构建中触发只标记 queued");
  release();
  await sleep(40);
  assert.equal(runs, 2, "补跑一次");
  assert.equal(queue.status().state, "success");
  await sleep(30);
  assert.equal(runs, 2, "没有第三次");
});

test("runBuild 失败 → failed,且绝不发布", async () => {
  let published = 0;
  const queue = createBuildQueue({
    runBuild: async () => {
      throw Object.assign(new Error("boom"), { log: "错误:坏 YAML" });
    },
    publish: async () => {
      published++;
    },
    debounceMs: 5,
  });
  queue.trigger();
  await sleep(30);
  const s = queue.status();
  assert.equal(s.state, "failed");
  assert.equal(published, 0, "失败不发布");
  assert.equal(s.log, "错误:坏 YAML", "日志来自构建输出");
});

test("publish 失败 → failed(状态携带失败原因)", async () => {
  const queue = createBuildQueue({
    runBuild: async () => "ok",
    publish: async () => {
      throw new Error("docker 拒绝");
    },
    debounceMs: 5,
  });
  queue.trigger();
  await sleep(30);
  const s = queue.status();
  assert.equal(s.state, "failed");
  assert.equal(s.log, "docker 拒绝");
});

test("runner:exit 0 → resolve(合并日志)", async () => {
  const runner = createSpawnRunner({
    command: "echo",
    args: ["hi"],
    cwd: process.cwd(),
    spawnFn: fakeSpawn(0, "构建完成\n"),
  });
  const log = await runner();
  assert.ok(log.includes("构建完成"));
});

test("runner:exit 1 → reject 且携带日志", async () => {
  const runner = createSpawnRunner({
    command: "x",
    args: [],
    cwd: process.cwd(),
    spawnFn: fakeSpawn(1, "错误:坏 YAML\n"),
  });
  await assert.rejects(() => runner(), (e) => e.log.includes("坏 YAML"));
});
```

- [ ] **步骤 5.2:运行确认失败**

```bash
pnpm test 2>&1 | tail -6
```

预期:FAIL——`Cannot find module .../build.js`,`pass` 仍为 71。

- [ ] **步骤 5.3:编写 build.js 实现**

写入 `admin/server/src/build.js`(全文):

```js
import { spawn } from "node:child_process";

/**
 * 执行一条构建命令:合并捕获 stdout+stderr,只保留尾部 tailLimit 字符;
 * 超时 SIGKILL;exit≠0 / spawn 错误 → reject,错误对象携带 log。
 */
export function createSpawnRunner({ command, args, cwd, timeoutMs = 600000, tailLimit = 8000, spawnFn = spawn }) {
  return function runBuild() {
    return new Promise((resolve, reject) => {
      const child = spawnFn(command, args, { cwd });
      let log = "";
      const push = (d) => {
        log += d;
        if (log.length > tailLimit) log = log.slice(-tailLimit);
      };
      child.stdout?.on("data", (d) => push(String(d)));
      child.stderr?.on("data", (d) => push(String(d)));
      const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(Object.assign(e, { log }));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(log);
        else reject(Object.assign(new Error(`构建进程退出码 ${code}`), { log }));
      });
    });
  };
}

/**
 * 单飞行构建队列。
 * state: idle | queued | building | success | failed
 * queued(bool): 防抖等待中,或构建中标记、待当前构建结束后的补跑请求。
 * 构建成功才 publish;失败保留日志、不回滚 git(规格 §5.3)。
 */
export function createBuildQueue({ runBuild, publish, debounceMs = 5000 }) {
  let state = "idle";
  let queued = false;
  let timer = null;
  let startedAt = null;
  let durationMs = null;
  let publishedAt = null;
  let log = "";

  async function start() {
    if (state === "building") {
      queued = true;
      return;
    }
    state = "building";
    queued = false;
    startedAt = Date.now();
    durationMs = null;
    try {
      const out = await runBuild();
      if (typeof out === "string") log = out;
      await publish();
      publishedAt = Date.now();
      durationMs = publishedAt - startedAt;
      state = "success";
    } catch (e) {
      log = (e && e.log) || (e && e.message) || String(e);
      durationMs = Date.now() - startedAt;
      state = "failed";
    }
    if (queued) start();
  }

  return {
    trigger() {
      if (state === "building") {
        queued = true;
        return;
      }
      state = "queued";
      queued = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        start();
      }, debounceMs);
    },
    status: () => ({ state, queued, startedAt, durationMs, publishedAt, log }),
  };
}
```

- [ ] **步骤 5.4:运行确认队列测试通过**

```bash
node --test tests/admin/build.test.mjs
```

预期:`# pass 7`、`# fail 0`;`pnpm test` → `# pass 78`、`# fail 0`。

- [ ] **步骤 5.5:编写失败的发布测试(2 用例)**

写入 `tests/admin/publish.test.mjs`(全文):

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import tar from "tar";
import { createArchivePublisher } from "../../admin/server/src/publish.js";

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
```

> 注:`server.address()` 对 unix socket 返回的就是 socket 路径字符串。

- [ ] **步骤 5.6:运行确认失败**

```bash
pnpm test 2>&1 | tail -6
```

预期:FAIL——`Cannot find module .../publish.js`,`pass` 仍为 78。

- [ ] **步骤 5.7:编写 publish.js 实现**

写入 `admin/server/src/publish.js`(全文):

```js
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
```

- [ ] **步骤 5.8:运行确认通过**

```bash
node --test tests/admin/publish.test.mjs
```

预期:`# pass 2`、`# fail 0`;随后 `pnpm test` → `# pass 80`、`# fail 0`。

- [ ] **步骤 5.9:Commit**

```bash
git add tests/admin/build.test.mjs tests/admin/publish.test.mjs admin/server/src/build.js admin/server/src/publish.js
git commit -m "feat(admin): 构建队列状态机与 Docker 归档发布"
```

---

## 任务 6:Fastify 装配、监听与进程入口(TDD + 冒烟)

**文件:**
- 创建:`tests/admin/app.test.mjs`(16 用例)
- 创建:`admin/server/src/app.js`、`admin/server/src/watcher.js`、`admin/server/src/index.js`

- [ ] **步骤 6.1:编写失败的集成测试(16 用例)**

写入 `tests/admin/app.test.mjs`(全文):

```js
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
```

- [ ] **步骤 6.2:运行确认失败**

```bash
pnpm test 2>&1 | tail -6
```

预期:FAIL——`Cannot find module .../app.js`,`pass` 仍为 80。

- [ ] **步骤 6.3:编写 app.js**

写入 `admin/server/src/app.js`(全文):

```js
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
    reply.code(status).send({ code: err.code || "INTERNAL", message: err.message || "服务器错误" });
  });

  // 健康检查语义:登录只接受 POST(规格 §8.3)
  app.get("/admin/api/login", async (req, reply) =>
    reply.code(405).send({ code: "METHOD_NOT_ALLOWED", message: "请用 POST" }),
  );

  app.post("/admin/api/login", async (req, reply) => {
    if (!auth.rateAllow(req.ip)) {
      return reply.code(429).send({ code: "RATE_LIMITED", message: "尝试过于频繁,请一分钟后再试" });
    }
    const { user, pass } = req.body || {};
    const tok = auth.login(user, pass);
    if (!tok) return reply.code(401).send({ code: "BAD_CREDENTIALS", message: "用户名或密码错误" });
    const flags = "HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000" + (secure ? "; Secure" : "");
    reply.header("Set-Cookie", `${COOKIE_NAME}=${tok}; ${flags}`);
    return reply.code(204).send();
  });

  app.post("/admin/api/logout", async (req, reply) => {
    auth.logout();
    reply.header("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`);
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
```

- [ ] **步骤 6.4:运行确认通过**

```bash
node --test tests/admin/app.test.mjs
```

预期:`# pass 16`、`# fail 0`。随后 `pnpm test` → `# pass 96`、`# fail 0`。

- [ ] **步骤 6.5:编写 watcher.js 与 index.js**

写入 `admin/server/src/watcher.js`(全文):

```js
import { watch } from "chokidar";

/** 监听 docs/(排除规则与树一致);任何增删改 → onChange(路径)。返回 close()。 */
export function startWatcher({ siteDir, onChange }) {
  const watcher = watch(`${siteDir}/docs`, {
    ignoreInitial: true,
    ignored: (p) => /\/(\.vitepress|public|node_modules)(\/|$)/.test(p),
  });
  watcher.on("all", (event, p) => {
    if (event === "add" || event === "change" || event === "unlink" || event === "addDir" || event === "unlinkDir") {
      onChange(p);
    }
  });
  return () => watcher.close();
}
```

写入 `admin/server/src/index.js`(全文):

```js
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createAuth } from "./auth.js";
import { buildApp } from "./app.js";
import { createFiles } from "./files.js";
import { createBuildQueue, createSpawnRunner } from "./build.js";
import { createArchivePublisher } from "./publish.js";
import { startWatcher } from "./watcher.js";

const pexec = promisify(execFile);

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* 容器由 compose env_file 注入;本地可放 admin/server/.env */
  }
}
loadEnv(path.join(import.meta.dirname, "..", ".env"));

const SITE = process.env.SITE_DIR || "/srv/site";
for (const key of ["ADMIN_USER", "ADMIN_PASS_HASH", "TOKEN_SECRET"]) {
  if (!process.env[key]) {
    console.error(`[admin] 缺少环境变量 ${key}`);
    process.exit(1);
  }
}

const execGit = async (args) => {
  const { stdout } = await pexec("git", args, { cwd: SITE, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
};

// 构建命令可整体替换(本地冒烟用 BUILD_COMMAND="echo smoke-build-ok")
const [buildCmd, ...buildArgs] = (process.env.BUILD_COMMAND || "npm run docs:build").split(/\s+/);

const queue = createBuildQueue({
  runBuild: createSpawnRunner({
    command: buildCmd,
    args: buildArgs,
    cwd: SITE,
    timeoutMs: Number(process.env.BUILD_TIMEOUT_MS || 600000),
  }),
  publish: createArchivePublisher({
    socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock",
    container: process.env.CADDY_CONTAINER || "caddy",
    destPath: process.env.PUBLISH_PATH || "/opt/blogs",
  }),
  debounceMs: Number(process.env.BUILD_DEBOUNCE_MS || 5000),
});

const auth = createAuth({
  secret: process.env.TOKEN_SECRET,
  user: process.env.ADMIN_USER,
  passHash: process.env.ADMIN_PASS_HASH,
  stateDir: path.join(import.meta.dirname, "..", ".state"),
});

const files = createFiles({ docsDir: path.join(SITE, "docs"), siteDir: SITE, execGit });

const app = buildApp({ auth, files, queue, config: { cookieSecure: process.env.COOKIE_SECURE !== "0" } });

const closeWatcher = startWatcher({ siteDir: SITE, onChange: () => queue.trigger() });
process.on("SIGTERM", async () => {
  await closeWatcher();
  await app.close();
  process.exit(0);
});

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8477);
await app.listen({ host, port });
console.log(`[admin] notes-admin listening on ${host}:${port} (site=${SITE})`);
```

- [ ] **步骤 6.6:入口语法/加载检查(不持久运行)**

```bash
node --check admin/server/src/index.js && node --check admin/server/src/watcher.js && echo SYNTAX-OK
```

预期:`SYNTAX-OK`(真实运行留给任务 8 冒烟)。

- [ ] **步骤 6.7:Commit**

```bash
git add tests/admin/app.test.mjs admin/server/src/app.js admin/server/src/watcher.js admin/server/src/index.js
git commit -m "feat(admin): Fastify 路由装配与进程入口"
```

---

## 任务 7:管理 UI(admin/ui,Vue3 单页)+ 打通 docs:build

**文件:**
- 创建:`admin/ui/vite.config.js`、`admin/ui/index.html`
- 创建:`admin/ui/src/main.js`、`admin/ui/src/style.css`、`admin/ui/src/api.js`、`admin/ui/src/App.vue`
- 创建:`admin/ui/src/components/LoginForm.vue`、`FileTree.vue`、`EditorView.vue`、`BuildStatus.vue`
- 修改:`package.json`(步骤 7.1 改 `docs:build` 脚本、加 `admin:dev`)
- 产物(不提交):`docs/public/admin/`(已 gitignore)

依赖说明:UI 复用 `admin/server/src/frontmatter.js`(浏览器打包已实测,gray-matter 走根 node_modules);`docs:build` 在步骤 7.1 从"只建站点"改为"先建 admin UI 再建站点"。

- [ ] **步骤 7.1:改 package.json 脚本**

用 `pnpm pkg set` 精确改两条脚本:

```bash
pnpm pkg set scripts.docs:build="vite build --config admin/ui/vite.config.js && vitepress build docs"
pnpm pkg set scripts.admin:dev="vite --config admin/ui/vite.config.js"
node -e "const s=require('./package.json').scripts; console.log(s['docs:build']); console.log(s['admin:dev'])"
```

预期打印两行,第一行以 `vite build --config admin/ui/vite.config.js &&` 开头,第二行 `vite --config admin/ui/vite.config.js`。(此时 `pnpm docs:build` 会因 admin/ui 尚不存在而失败,属正常,后续步骤补齐。)

- [ ] **步骤 7.2:写 vite 配置与入口**

写入 `admin/ui/vite.config.js`(全文):

```js
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const root = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root,
  plugins: [vue()],
  base: "/admin/",
  build: {
    outDir: "../../docs/public/admin", // 相对 root → docs/public/admin(随站点发布)
    emptyOutDir: true,
  },
  server: {
    proxy: { "/admin/api": "http://127.0.0.1:8477" }, // admin:dev 直连本地后端
    fs: { allow: [root, repoRoot] }, // 允许引用 ../server/src/frontmatter.js
  },
});
```

写入 `admin/ui/index.html`(全文):

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NotesAtlas 管理</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

写入 `admin/ui/src/main.js`(全文):

```js
import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

createApp(App).mount("#app");
```

写入 `admin/ui/src/api.js`(全文):

```js
async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event("na-401")); // 会话失效 → App 回登录(规格 §6)
    const e = new Error("未登录或会话过期");
    e.unauthorized = true;
    throw e;
  }
  if (!res.ok) {
    let m = res.statusText;
    try {
      m = (await res.json()).message || m;
    } catch {
      /* 非 JSON 错误体 */
    }
    const e = new Error(m);
    e.status = res.status;
    throw e;
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  login: (user, pass) => req("POST", "/admin/api/login", { user, pass }),
  logout: () => req("POST", "/admin/api/logout"),
  tree: () => req("GET", "/admin/api/tree"),
  getFile: (path) => req("GET", `/admin/api/file?path=${encodeURIComponent(path)}`),
  putFile: (path, content) => req("PUT", "/admin/api/file", { path, content }),
  createFile: (path) => req("POST", "/admin/api/file", { path }),
  deleteFile: (path) => req("DELETE", `/admin/api/file?path=${encodeURIComponent(path)}`),
  createDir: (path) => req("POST", "/admin/api/dir", { path }),
  deleteDir: (path, force) =>
    req("DELETE", `/admin/api/dir?path=${encodeURIComponent(path)}${force ? "&force=1" : ""}`),
  rename: (from, to) => req("POST", "/admin/api/rename", { from, to }),
  buildStatus: () => req("GET", "/admin/api/build/status"),
  buildLastlog: () => req("GET", "/admin/api/build/lastlog"),
};
```

- [ ] **步骤 7.3:写 App.vue 与 LoginForm.vue**

写入 `admin/ui/src/App.vue`(全文):

```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { api } from "./api.js";
import LoginForm from "./components/LoginForm.vue";
import FileTree from "./components/FileTree.vue";
import EditorView from "./components/EditorView.vue";
import BuildStatus from "./components/BuildStatus.vue";

const authed = ref(null); // null=探测中,false=未登录,true=已登录
const tree = ref([]);
const selected = ref(null);
const editorDirty = ref(false);
const err = ref("");

async function probe() {
  try {
    tree.value = (await api.tree()).nodes;
    authed.value = true;
    err.value = "";
  } catch (e) {
    if (e.unauthorized) authed.value = false;
    else err.value = e.message;
  }
}
function on401() {
  authed.value = false;
  tree.value = [];
  selected.value = null;
  editorDirty.value = false;
}
function onSelect(p) {
  if (p === selected.value) return;
  if (editorDirty.value && !confirm("当前文档未保存,切换将丢弃改动,继续?")) return;
  selected.value = p;
}
async function onLogout() {
  if (editorDirty.value && !confirm("当前文档未保存,退出将丢弃改动,继续?")) return;
  try {
    await api.logout();
  } finally {
    authed.value = false;
    tree.value = [];
    selected.value = null;
    editorDirty.value = false;
  }
}
onMounted(() => {
  window.addEventListener("na-401", on401);
  probe();
});
onBeforeUnmount(() => window.removeEventListener("na-401", on401));
</script>

<template>
  <div class="app">
    <div v-if="err" class="err-banner">{{ err }}</div>
    <LoginForm v-if="authed === false" @login="probe" />
    <div v-else-if="authed === null" class="center">加载中…</div>
    <template v-else>
      <header class="top">
        <span class="brand">NotesAtlas 管理</span>
        <BuildStatus />
        <button class="ghost" @click="onLogout">退出</button>
      </header>
      <div class="main">
        <FileTree :nodes="tree" :selected="selected" @select="onSelect" @changed="probe" />
        <EditorView :path="selected" :key="selected || '-'" @dirty="(d) => (editorDirty = d)" @saved="probe" />
      </div>
    </template>
  </div>
</template>
```

写入 `admin/ui/src/components/LoginForm.vue`(全文):

```vue
<script setup>
import { ref } from "vue";
import { api } from "../api.js";

const emit = defineEmits(["login"]);
const user = ref("");
const pass = ref("");
const msg = ref("");
const busy = ref(false);

async function submit() {
  busy.value = true;
  msg.value = "";
  try {
    await api.login(user.value, pass.value);
    emit("login");
  } catch (e) {
    msg.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="login" @submit.prevent="submit">
    <h1>NotesAtlas 管理后台</h1>
    <input v-model="user" placeholder="用户名" autocomplete="username" />
    <input v-model="pass" type="password" placeholder="密码" autocomplete="current-password" />
    <button :disabled="busy || !user || !pass">{{ busy ? "登录中…" : "登录" }}</button>
    <p class="msg">{{ msg }}</p>
  </form>
</template>
```

- [ ] **步骤 7.4:写 FileTree.vue(递归树 + 全部操作)**

写入 `admin/ui/src/components/FileTree.vue`(全文):

```vue
<script setup>
import { ref } from "vue";
import { api } from "../api.js";

defineProps({
  nodes: { type: Array, default: () => [] },
  selected: { type: String, default: "" },
  depth: { type: Number, default: 0 },
});
const emit = defineEmits(["select", "changed"]);

const collapsed = ref(new Set());

function toggle(p) {
  const s = new Set(collapsed.value);
  if (s.has(p)) s.delete(p);
  else s.add(p);
  collapsed.value = s;
}
function isCollapsed(p) {
  return collapsed.value.has(p);
}

async function guard(fn) {
  try {
    await fn();
    emit("changed");
  } catch (e) {
    alert(e.message);
  }
}
async function addFile(dir) {
  const name = prompt("新文档文件名(需 .md 结尾):", "new-post.md");
  if (!name) return;
  if (!name.endsWith(".md")) return alert("文件名需以 .md 结尾");
  await guard(() => api.createFile(dir ? `${dir}/${name}` : name));
}
async function addDir(dir) {
  const name = prompt("新目录名:", "新目录");
  if (!name) return;
  await guard(() => api.createDir(dir ? `${dir}/${name}` : name));
}
async function ren(node) {
  const to = prompt("新名称(与原文件同级):", node.name);
  if (!to || to === node.name) return;
  const base = node.path.slice(0, node.path.length - node.name.length);
  if (!confirm(`确认重命名为「${base + to}」?\n改名会使引用旧路径的链接失效。`)) return;
  await guard(() => api.rename(node.path, base + to));
}
async function del(node) {
  const tip =
    node.type === "file"
      ? `删除文档「${node.path}」?(将提交 git 删除)`
      : `删除目录「${node.path}」及其全部内容?(将提交 git 删除)`;
  if (!confirm(tip)) return;
  await guard(() => (node.type === "file" ? api.deleteFile(node.path) : api.deleteDir(node.path, true)));
}
</script>

<template>
  <div class="tree-wrap" :class="depth === 0 ? 'root' : 'sub'">
    <div v-if="depth === 0" class="tree-toolbar">
      <button @click="addFile('')">+ 文档</button>
      <button @click="addDir('')">+ 目录</button>
    </div>
    <template v-for="n in nodes" :key="n.path">
      <div
        class="row"
        :class="{ active: n.path === selected, dir: n.type === 'dir' }"
        :style="{ paddingLeft: depth * 14 + 6 + 'px' }"
      >
        <span class="name" @click="n.type === 'dir' ? toggle(n.path) : emit('select', n.path)">
          <span class="icon">{{ n.type === "dir" ? (isCollapsed(n.path) ? "▸" : "▾") : "▪" }}</span>
          {{ n.name }}
        </span>
        <span v-if="n.type === 'dir'" class="ops">
          <button title="新建文档" @click.stop="addFile(n.path)">文</button>
          <button title="新建目录" @click.stop="addDir(n.path)">夹</button>
        </span>
        <span class="ops">
          <button title="重命名" @click.stop="ren(n)">改</button>
          <button title="删除" @click.stop="del(n)">删</button>
        </span>
      </div>
      <FileTree
        v-if="n.type === 'dir' && !isCollapsed(n.path)"
        :nodes="n.children"
        :selected="selected"
        :depth="depth + 1"
        @select="(p) => emit('select', p)"
        @changed="() => emit('changed')"
      />
    </template>
  </div>
</template>
```

- [ ] **步骤 7.5:写 EditorView.vue 与 BuildStatus.vue**

写入 `admin/ui/src/components/EditorView.vue`(全文):

```vue
<script setup>
import { ref, watch, computed, onBeforeUnmount } from "vue";
import MarkdownIt from "markdown-it";
import { api } from "../api.js";
import { parseDoc, applyForm } from "../../../server/src/frontmatter.js";

const props = defineProps({ path: { type: String, default: "" } });
const emit = defineEmits(["saved", "dirty"]);

const content = ref("");
const origin = ref("");
const frontmatter = ref({});
const msg = ref("");
const saving = ref(false);
const md = new MarkdownIt({ html: false, linkify: true }); // html:false 防预览 XSS(规格 §6)

const body = computed(() => {
  try {
    return parseDoc(content.value).body;
  } catch {
    return content.value;
  }
});
const preview = computed(() => md.render(body.value));
const dirty = computed(() => content.value !== origin.value);
const fmList = (v) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));
const splitList = (v) =>
  String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

watch(dirty, (d) => emit("dirty", d));

watch(
  () => props.path,
  async (p) => {
    if (!p) return;
    msg.value = "";
    try {
      const f = await api.getFile(p);
      content.value = f.content;
      origin.value = f.content;
      frontmatter.value = f.frontmatter || {};
      if (f.parseError) msg.value = "YAML 解析失败:" + f.parseError; // 坏 YAML 也能打开修复
      emit("dirty", false);
    } catch (e) {
      msg.value = "加载失败:" + e.message;
    }
  },
  { immediate: true },
);

/** 表单改动立即写回源码缓冲区(双向同步) */
function setField(k, v) {
  frontmatter.value = { ...frontmatter.value, [k]: v };
  content.value = applyForm(content.value, { [k]: v });
}
/** 源码改动(失焦)后回读 frontmatter 到表单 */
function syncFromSource() {
  try {
    frontmatter.value = parseDoc(content.value).frontmatter;
    msg.value = "";
  } catch (e) {
    msg.value = "YAML 解析失败:" + e.message;
  }
}
async function save() {
  if (!props.path || !dirty.value) return;
  saving.value = true;
  msg.value = "";
  try {
    await api.putFile(props.path, content.value);
    origin.value = content.value;
    msg.value = "已保存,重建已触发";
    setTimeout(() => {
      if (msg.value === "已保存,重建已触发") msg.value = "";
    }, 2500);
    emit("dirty", false);
    emit("saved");
  } catch (e) {
    msg.value = "保存失败:" + e.message;
  } finally {
    saving.value = false;
  }
}
function onBeforeUnload(e) {
  if (dirty.value) e.preventDefault();
}
window.addEventListener("beforeunload", onBeforeUnload);
onBeforeUnmount(() => window.removeEventListener("beforeunload", onBeforeUnload));
</script>

<template>
  <div class="editor">
    <div v-if="!path" class="placeholder">← 选择左侧文档,或新建一篇</div>
    <template v-else>
      <div class="editor-top">
        <span class="path">{{ path }}</span>
        <button class="save" :disabled="saving || !dirty" @click="save">
          {{ saving ? "保存中…" : dirty ? "保存" : "已保存" }}
        </button>
        <span class="msg">{{ msg }}</span>
      </div>
      <div class="fm-form">
        <label>标题 <input :value="frontmatter.title ?? ''" @change="setField('title', $event.target.value)" /></label>
        <label>
          日期
          <input :value="frontmatter.date ?? ''" placeholder="2026-09-28 10:00:00" @change="setField('date', $event.target.value)" />
        </label>
        <label>
          标签
          <input :value="fmList(frontmatter.tags)" placeholder="逗号分隔" @change="setField('tags', splitList($event.target.value))" />
        </label>
        <label>
          分类
          <input :value="fmList(frontmatter.categories)" placeholder="逗号分隔" @change="setField('categories', splitList($event.target.value))" />
        </label>
        <label class="chk">
          <input type="checkbox" :checked="!!frontmatter.sticky" @change="setField('sticky', $event.target.checked)" />
          置顶
        </label>
        <span class="hint">其余键(hero/layout 等)仅透传,可在下方源码 YAML 中直接编辑</span>
      </div>
      <div class="split">
        <textarea v-model="content" spellcheck="false" @change="syncFromSource"></textarea>
        <div class="preview" v-html="preview"></div>
      </div>
    </template>
  </div>
</template>
```

写入 `admin/ui/src/components/BuildStatus.vue`(全文):

```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { api } from "../api.js";

const st = ref(null);
const showLog = ref(false);
const lastlog = ref("");
let timer = null;

const LABEL = { idle: "空闲", queued: "排队中", building: "构建中", success: "已发布", failed: "构建失败" };

async function poll() {
  try {
    st.value = await api.buildStatus();
    if (st.value.state !== "failed") showLog.value = false;
  } catch {
    /* 401 由全局 na-401 事件处理 */
  }
}
async function toggleLog() {
  showLog.value = !showLog.value;
  if (showLog.value) {
    try {
      lastlog.value = (await api.buildLastlog()).log || "(暂无日志)";
    } catch (e) {
      lastlog.value = "日志获取失败:" + e.message;
    }
  }
}
onMounted(() => {
  poll();
  timer = setInterval(poll, 2000); // 规格 §5.3:2s 轮询
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div v-if="st" class="build">
    <span class="dot" :class="st.state"></span>
    <span class="build-label">
      {{ LABEL[st.state] || st.state }}
      <template v-if="st.state === 'building' && st.startedAt">
        · {{ Math.max(0, Math.round((Date.now() - st.startedAt) / 1000)) }}s</template
      >
      <template v-else-if="st.state === 'success' && st.lastCommit"> · {{ st.lastCommit }}</template>
    </span>
    <button v-if="st.state === 'failed'" class="ghost" @click="toggleLog">
      {{ showLog ? "收起日志" : "查看日志" }}
    </button>
    <pre v-if="showLog" class="log-drawer">{{ lastlog }}</pre>
  </div>
</template>
```

- [ ] **步骤 7.6:写 style.css**

写入 `admin/ui/src/style.css`(全文):

```css
* { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
body {
  font: 14px/1.6 system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #2a2a30; background: #f6f6f7;
}
button {
  border: 1px solid #d4d4da; background: #fff; border-radius: 6px;
  padding: 4px 10px; cursor: pointer; font-size: 13px;
}
button:hover { border-color: #8a8a94; }
button:disabled { opacity: 0.5; cursor: default; }
button.ghost { background: transparent; }
.app { display: flex; flex-direction: column; height: 100%; }
.err-banner { background: #fdecec; color: #a33; padding: 6px 12px; }
.center { margin: auto; color: #888; }
.top {
  display: flex; align-items: center; gap: 16px;
  background: #fff; border-bottom: 1px solid #e4e4e8; padding: 8px 14px;
}
.brand { font-weight: 600; }
.top .ghost { margin-left: auto; }
.main { display: flex; flex: 1; min-height: 0; }

/* 登录 */
.login {
  margin: 10vh auto; width: 320px; background: #fff; border: 1px solid #e4e4e8;
  border-radius: 10px; padding: 28px 24px; display: flex; flex-direction: column; gap: 12px;
}
.login h1 { font-size: 17px; margin: 0 0 6px; text-align: center; }
.login input { border: 1px solid #d4d4da; border-radius: 6px; padding: 8px 10px; font-size: 14px; }
.login button { padding: 8px; background: #2f6fed; border-color: #2f6fed; color: #fff; }
.login .msg { color: #c0392b; font-size: 13px; margin: 0; min-height: 18px; }

/* 树 */
.tree-wrap.root { width: 300px; flex: none; overflow: auto; background: #fff; border-right: 1px solid #e4e4e8; padding-bottom: 20px; }
.tree-toolbar {
  display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid #eee;
  position: sticky; top: 0; background: #fff; z-index: 5;
}
.row { display: flex; align-items: center; gap: 4px; padding: 3px 6px; cursor: pointer; white-space: nowrap; }
.row:hover { background: #f0f2f7; }
.row.active { background: #e3ebfd; }
.row .name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.row .icon { display: inline-block; width: 14px; color: #999; }
.ops { display: none; gap: 2px; }
.row:hover .ops, .row.active .ops { display: inline-flex; }
.ops button { padding: 0 5px; font-size: 12px; line-height: 18px; }

/* 编辑器 */
.editor { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.placeholder { margin: auto; color: #888; }
.editor-top {
  display: flex; align-items: center; gap: 10px; padding: 8px 14px;
  background: #fff; border-bottom: 1px solid #e4e4e8;
}
.editor-top .path { font-weight: 600; }
.editor-top .save { background: #2f6fed; border-color: #2f6fed; color: #fff; }
.editor-top .msg { color: #2a7; font-size: 13px; }
.fm-form {
  display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center;
  padding: 8px 14px; background: #fbfbfc; border-bottom: 1px solid #eee; font-size: 13px;
}
.fm-form label { display: flex; align-items: center; gap: 6px; color: #666; }
.fm-form input:not([type]) { border: 1px solid #d4d4da; border-radius: 5px; padding: 4px 8px; width: 170px; }
.fm-form .hint { color: #999; font-size: 12px; }
.split { display: flex; flex: 1; min-height: 0; }
.split textarea {
  flex: 1; border: none; resize: none; padding: 14px;
  font: 13px/1.7 ui-monospace, Menlo, Consolas, monospace; outline: none;
  background: #fff; min-width: 0;
}
.split .preview {
  flex: 1; overflow: auto; padding: 14px 18px; border-left: 1px solid #e4e4e8;
  background: #fcfcfd; min-width: 0;
}
.split .preview img { max-width: 100%; }

/* 构建状态条 */
.build { display: flex; align-items: center; gap: 8px; position: relative; font-size: 13px; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: #bbb; display: inline-block; }
.dot.queued { background: #e6a23c; }
.dot.building { background: #2f6fed; animation: pulse 1s infinite alternate; }
.dot.success { background: #2a7; }
.dot.failed { background: #c0392b; }
@keyframes pulse { to { opacity: 0.35; } }
.log-drawer {
  position: absolute; top: 28px; right: 0; width: min(70vw, 720px); max-height: 50vh;
  overflow: auto; background: #1e1e24; color: #d6d6dd; padding: 10px 12px;
  border-radius: 8px; font-size: 12px; white-space: pre-wrap; word-break: break-all;
  z-index: 30; margin: 0;
}

/* 移动端可用(验收①) */
@media (max-width: 768px) {
  .main { flex-direction: column; }
  .tree-wrap.root { width: 100%; max-height: 34vh; border-right: none; border-bottom: 1px solid #e4e4e8; }
  .split { flex-direction: column; }
  .split .preview { border-left: none; border-top: 1px solid #e4e4e8; }
}
```

- [ ] **步骤 7.7:构建产物断言**

```bash
pnpm docs:build 2>&1 | tail -8
test -f docs/public/admin/index.html && grep -q '<div id="app">' docs/public/admin/index.html && ls docs/public/admin/assets/ | head -5
```

预期:`pnpm docs:build` exit 0(vite 出 admin 产物 + vitepress 全站);`index.html` 存在且含 `<div id="app">`;assets 下有 js/css 文件。随后全量回归 `pnpm test` → `# pass 96`、`# fail 0`。

- [ ] **步骤 7.8:视觉确认(登录页)**

后台启动预览:`pnpm docs:preview`(background=true),确认 `curl -sI http://localhost:4173/admin/ | head -1` 为 `HTTP/1.1 200`。用会话浏览器打开 `http://localhost:4173/admin/`,截图并肉眼确认:居中登录卡「NotesAtlas 管理后台」+ 用户名/密码/登录按钮,无 404/空白。确认后停掉预览进程(`pkill -f "vitepress[.]js preview"`)。

- [ ] **步骤 7.9:Commit**

```bash
git add package.json admin/ui/vite.config.js admin/ui/index.html admin/ui/src
git commit -m "feat(admin): 管理 UI(Vue3 单页:树/编辑器/状态条)"
```

> 注:`docs/public/admin/` 为构建产物,已被忽略,不入提交。

---

## 任务 8:本地全链路冒烟(隔离站点,零污染)

**文件:** 无新建(验证性任务)。临时目录 `/tmp/opencode/admin-smoke` 承载一个独立 git 站点,真实走通 **登录 → CRUD → git commit → watcher → 防抖 → 构建 → 发布(预期死在发布,因为本机没有 caddy 容器)**。

- [ ] **步骤 8.1:搭建隔离冒烟站**

```bash
SMOKE=/tmp/opencode/admin-smoke
rm -rf "$SMOKE" && mkdir -p "$SMOKE/docs/dir1"
printf -- '---\ntitle: 冒烟首页\n---\n\n# 冒烟首页\n' > "$SMOKE/docs/index.md"
printf -- '# 文档 A\n' > "$SMOKE/docs/dir1/a.md"
cd "$SMOKE" && git init -b main -q && git config user.email smoke@test.local && git config user.name smoke \
  && git add -A && git commit -qm baseline
git -C "$SMOKE" log --oneline
```

预期:输出 `baseline` 一条提交。

- [ ] **步骤 8.2:启动真实服务(后台)**

以下命令整体作为 **background** 运行:

```bash
cd /home/weno/works/Notes-Atlas
export SITE_DIR=/tmp/opencode/admin-smoke ADMIN_USER=admin TOKEN_SECRET=smoke-secret \
  COOKIE_SECURE=0 HOST=127.0.0.1 PORT=8477 BUILD_COMMAND="echo smoke-build-ok" \
  BUILD_DEBOUNCE_MS=1000 DOCKER_SOCKET=/nonexistent/docker.sock CADDY_CONTAINER=caddy
export ADMIN_PASS_HASH="$(node --input-type=module -e "import('./admin/server/src/auth.js').then(m=>console.log(m.hashPassword('smoke-pw-2026')))")"
node admin/server/src/index.js
```

预期日志:`[admin] notes-admin listening on 127.0.0.1:8477 (site=/tmp/opencode/admin-smoke)`。

- [ ] **步骤 8.3:HTTP 断言(登录/鉴权/CRUD/git)**

```bash
BASE=http://127.0.0.1:8477
CJ=/tmp/opencode/smoke-cookie.txt
echo "tree未登录=$(curl -s -o /dev/null -w '%{http_code}' $BASE/admin/api/tree)"                    # 401
echo "login-GET=$(curl -s -o /dev/null -w '%{http_code}' $BASE/admin/api/login)"                   # 405
echo "login错密=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/admin/api/login -H 'Content-Type: application/json' -d '{"user":"admin","pass":"bad"}')"   # 401
echo "login正确=$(curl -s -c $CJ -o /dev/null -w '%{http_code}' -X POST $BASE/admin/api/login -H 'Content-Type: application/json' -d '{"user":"admin","pass":"smoke-pw-2026"}')"  # 204
curl -s -b $CJ $BASE/admin/api/tree | head -c 300                                                # JSON 树含 index.md/dir1
echo "建=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' -X POST $BASE/admin/api/file -H 'Content-Type: application/json' -d '{"path":"dir1/new.md"}')"        # 204
echo "读=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' "$BASE/admin/api/file?path=dir1/new.md")" # 200
git -C /tmp/opencode/admin-smoke log -1 --format=%s                                              # admin(create): dir1/new.md
echo "删=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' -X DELETE "$BASE/admin/api/file?path=dir1/new.md")"   # 204
git -C /tmp/opencode/admin-smoke log -1 --format=%s                                              # admin(delete): dir1/new.md
echo "登出=$(curl -s -b $CJ -c $CJ -o /dev/null -w '%{http_code}' -X POST $BASE/admin/api/logout)"            # 204
echo "登出后=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' $BASE/admin/api/tree)"              # 401
```

预期:注释里的状态码逐行命中;git log 两行分别为 create/delete 提交。

- [ ] **步骤 8.4:watcher → 防抖 → 构建 → 发布链路**

重新登录取 cookie(上一步登出了),然后 touch 触发:

```bash
BASE=http://127.0.0.1:8477
CJ=/tmp/opencode/smoke-cookie.txt
curl -s -c $CJ -o /dev/null -X POST $BASE/admin/api/login -H 'Content-Type: application/json' -d '{"user":"admin","pass":"smoke-pw-2026"}'
touch /tmp/opencode/admin-smoke/docs/dir1/a.md
for i in $(seq 1 40); do
  S=$(curl -s -b $CJ $BASE/admin/api/build/status)
  echo "$S" | grep -o '"state":"[a-z]*"' || echo "$S"
  echo "$S" | grep -qE '"state":"(failed|success)"' && break
  sleep 0.5
done
curl -s -b $CJ $BASE/admin/api/build/status
```

预期:先出现 `"state":"queued"`(防抖 1s),随后 `"state":"failed"`,且完整状态里 `log` 含 `nonexistent/docker.sock`(或 `ENOENT`)。**failed 且死在发布 = 构建(echo)已成功,链路全通**;`log` 含 `smoke-build-ok` 亦可(取决于覆盖顺序,不作硬断言)。若最终是 `success` → 异常,停下报告(说明发布环节没被触发)。

- [ ] **步骤 8.5:停服务并清理**

```bash
pkill -f "[a]dmin/server/src/index.js"; sleep 1
pgrep -f "[a]dmin/server/src/index.js" || echo "已停止"
rm -rf /tmp/opencode/admin-smoke /tmp/opencode/smoke-cookie.txt
```

预期:`已停止`。本任务无源码改动,无提交。

---

## 任务 9:服务器迁移与上线(含规格 §9 验收清单)

**文件:** 无本地新建;服务器侧 `/opt/notes-atlas`、`admin/server/.env`、共享 Caddyfile(备份+插入)。

**关卡 A(先决,不过不得继续):** 服务器基线必须等于"当前线上内容"(线上由本地工作树构建)。执行:

```bash
cd /home/weno/works/Notes-Atlas && git status --porcelain -- docs package.json pnpm-lock.yaml admin
```

预期:空。若非空 → **停下**,把清单报给用户:这些改动影响站点产物,必须先 commit(由用户执行,或用户明示同意后代为 commit,仅 add 清单所列路径)。`.obsidian/`、`deploy.yml` 等不参与构建的文件不拦(不 push、不入库,由用户自行处置)。

- [ ] **步骤 9.1:资源与容量预检**

```bash
ssh web 'df -h / | tail -1; echo ---; docker images | grep -E "node|caddy" | head -3; echo ---; command -v pnpm || echo no-pnpm'
du -sh /home/weno/works/Notes-Atlas/.git
```

判定:服务器 `/` 可用空间 ≥ 4G(node_modules ~1G + dist 154M + 推送历史);不足 → 停下报告。`pnpm` 不存在则在 9.4 装。

- [ ] **步骤 9.2:服务器建仓(规格 §8.2)**

```bash
ssh web 'sudo mkdir -p /opt/notes-atlas && sudo chown -R "$(whoami):$(whoami)" /opt/notes-atlas \
  && cd /opt/notes-atlas && git init -b main \
  && git config receive.denyCurrentBranch updateInstead \
  && git config user.email "notes-admin@notes-atlas.local" && git config user.name "notes-admin" && echo REPO-OK'
```

预期:`REPO-OK`。

- [ ] **步骤 9.3:本地挂远端并首次推送(服务器成为真源)**

```bash
cd /home/weno/works/Notes-Atlas
git remote add srv web:/opt/notes-atlas
git push srv main
ssh web 'cd /opt/notes-atlas && git log --oneline -3 && ls docs | head -5'
```

预期:push 成功(首次含全量历史);服务器 log 首行是本次会话的提交(计划或其后的实现提交),`docs` 目录在位。此后本地工作流 = `git push srv main`(rsync 退役的代码面变更即在此生效)。

- [ ] **步骤 9.4:服务器安装依赖(规格 §8.2 修订版 pnpm)**

```bash
ssh web 'npm i -g pnpm@10 >/dev/null 2>&1; pnpm --version'
ssh web 'cd /opt/notes-atlas && pnpm install --frozen-lockfile 2>&1 | tail -6'
```

预期:pnpm `10.x`;install exit 0(构建需要 devDependencies,**全程不设 `NODE_ENV=production`**)。若 3 分钟无进展/报错 → 中止,改走镜像(此变更会记入收尾报告):

```bash
ssh web 'npm config set registry https://registry.npmmirror.com && pnpm config set registry https://registry.npmmirror.com'
ssh web 'cd /opt/notes-atlas && pnpm install --frozen-lockfile 2>&1 | tail -6'
```

- [ ] **步骤 9.5:生成管理员凭据并写入服务器 .env**

本地生成(密码只在此显示一次):

```bash
cd /home/weno/works/Notes-Atlas
PW="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16)"
HASH="$(node --input-type=module -e "import('./admin/server/src/auth.js').then(m=>console.log(m.hashPassword(process.argv[1])))" "$PW")"
SECRET="$(openssl rand -hex 32)"
mkdir -p /tmp/opencode && ( umask 077; echo "PW=$PW" > /tmp/opencode/admin-credentials.env )
echo "=== 管理员密码(仅此一次,请立即保存):$PW ==="
{ echo "ADMIN_USER=admin"; echo "ADMIN_PASS_HASH=$HASH"; echo "TOKEN_SECRET=$SECRET"; \
  echo "SITE_DIR=/srv/site"; echo "CADDY_CONTAINER=caddy"; echo "HOST=0.0.0.0"; echo "PORT=8477"; \
  echo "COOKIE_SECURE=1"; echo "BUILD_DEBOUNCE_MS=5000"; echo "DOCKER_SOCKET=/var/run/docker.sock"; \
  echo "PUBLISH_PATH=/opt/blogs"; } \
  | ssh web 'cat > /opt/notes-atlas/admin/server/.env && chmod 600 /opt/notes-atlas/admin/server/.env && ls -l /opt/notes-atlas/admin/server/.env'
```

预期:打印 `-rw------- ... .env`;本地输出密码给用户保存。

- [ ] **步骤 9.6:构建镜像、起容器、健康检查(规格 §8.3)**

```bash
ssh web 'docker compose version >/dev/null 2>&1 && echo HAS-COMPOSE-V2 || echo NO-COMPOSE-V2'
ssh web 'cd /opt/notes-atlas/admin/server && docker compose up -d --build 2>&1 | tail -12'
ssh web 'docker ps --filter name=notes-admin --format "{{.Names}} {{.Status}}"'
```

预期:`HAS-COMPOSE-V2`(若 `NO-COMPOSE-V2` → 改用 `docker-compose` 前缀重跑);容器 `Up` 状态。若 `node:20-slim` 拉取失败,先走国内镜像再重跑:

```bash
ssh web 'docker pull registry.lovetulin.cn/library/node:20-slim && docker tag registry.lovetulin.cn/library/node:20-slim node:20-slim'
```

三条健康检查(均在服务器侧执行):

```bash
ssh web 'docker exec notes-admin node -e "fetch(\"http://127.0.0.1:8477/admin/api/build/status\").then(async r=>console.log(r.status,(await r.text()).slice(0,60)))"'
ssh web 'docker exec notes-admin node -e "fetch(\"http://127.0.0.1:8477/admin/api/login\").then(r=>console.log(r.status))"'
ssh web 'docker exec caddy wget -qO- http://notes-admin:8477/admin/api/build/status; echo " rc=$?"'
```

预期:①`401 {"code":"UNAUTHENTICATED"...` ②`405` ③输出 401 JSON 且 `rc=1`(wget 非 2xx 时 rc≠0 属正常)——③ 证明 **caddy 容器 → notes-admin 容器网络已通**。

- [ ] **步骤 9.7:其他站点改前基线(验收⑥的前半)**

```bash
ssh web 'sudo grep -nE "^[a-zA-Z0-9*._-]+ \{" /data/stacks/caddy/Caddyfile' | tee /tmp/opencode/caddy-sites.txt
while read -r line; do
  host=$(echo "$line" | sed -E 's/^[0-9]+://; s/ .*//')
  case "$host" in \*|*:*) continue;; esac
  echo "$host -> $(curl -sk -o /dev/null -w '%{http_code}' https://$host/ --max-time 8)"
done < /tmp/opencode/caddy-sites.txt | tee /tmp/opencode/sites-before.txt
```

预期:得到每个站点域名的状态码清单(200/301 等),留作 9.9 对比。若站点块头部格式与正则不符(如含端口),手工读文件补齐清单。

- [ ] **步骤 9.8:备份并插入反代段 → validate → reload(规格 §2/§7)**

```bash
ssh web 'sudo cp -a /data/stacks/caddy/Caddyfile /data/stacks/caddy/Caddyfile.bak-$(date +%Y%m%d-%H%M%S) && ls -lt /data/stacks/caddy/Caddyfile.bak-* | head -2'
ssh web 'sudo grep -n "blogs.lovetulin.cn" /data/stacks/caddy/Caddyfile'
```

若 grep 找不到 `blogs.lovetulin.cn` 站点块,或块头形态与预期(域名开头、行尾 `{`)不符 → **停下报告**,人工确认插入位置。

写入插入脚本并执行:

```bash
cat > /tmp/opencode/insert-caddy.py <<'PY'
import re
p = "/data/stacks/caddy/Caddyfile"
s = open(p).read()
if "notes-admin" in s:
    raise SystemExit("已存在反代段,勿重复执行")
m = re.search(r"blogs\.lovetulin\.cn[^{\n]*\{\n", s)
if not m:
    raise SystemExit("未找到 blogs.lovetulin.cn 站点块,停下")
snippet = "\thandle_path /admin/api/* {\n\t\treverse_proxy notes-admin:8477\n\t}\n"
s = s[: m.end()] + snippet + s[m.end():]
open(p, "w").write(s)
print("inserted at offset", m.end())
PY
scp /tmp/opencode/insert-caddy.py web:/tmp/insert-caddy.py
ssh web 'sudo python3 /tmp/insert-caddy.py'
```

预期:`inserted at offset <数字>`(若输出"已存在"或"停下"→ 按提示处理,不得重复插入)。

validate + reload(validate 失败则链式中止、**不 reload**,随后恢复备份):

```bash
ssh web 'docker exec -w /etc/caddy caddy caddy validate --config /etc/caddy/Caddyfile && docker exec -w /etc/caddy caddy caddy reload --config /etc/caddy/Caddyfile && echo RELOADED-OK'
```

预期:`RELOADED-OK`(graceful,零停机)。若 validate 失败 → 恢复(把 `<ts>` 换成 9.8 打印出的备份时间戳):

```bash
ssh web 'sudo cp -a /data/stacks/caddy/Caddyfile.bak-<ts> /data/stacks/caddy/Caddyfile && docker exec -w /etc/caddy caddy caddy reload --config /etc/caddy/Caddyfile && echo RESTORED'
```

- [ ] **步骤 9.9:反代生效 + 其他站点回归(验收⑥)**

```bash
echo "api经HTTPS=$(curl -s -o /dev/null -w '%{http_code}' https://blogs.lovetulin.cn/admin/api/build/status)"   # 401(后端已通)
while read -r line; do
  host=$(echo "$line" | sed -E 's/^[0-9]+://; s/ .*//')
  case "$host" in \*|*:*) continue;; esac
  echo "$host -> $(curl -sk -o /dev/null -w '%{http_code}' https://$host/ --max-time 8)"
done < /tmp/opencode/caddy-sites.txt | tee /tmp/opencode/sites-after.txt
diff /tmp/opencode/sites-before.txt /tmp/opencode/sites-after.txt && echo SITES-OK
```

预期:第一行 `401`;`SITES-OK`(逐站状态码与改前完全一致)。

- [ ] **步骤 9.10:首次服务器构建 + 发布 + 产物 diff(规格 §8.5)**

捕获现站产物做基线,触发构建:

```bash
ssh web 'rm -rf /tmp/blogs-pre && docker cp caddy:/opt/blogs /tmp/blogs-pre && du -sh /tmp/blogs-pre'
ssh web 'cd /opt/notes-atlas && touch docs/index.md'
```

登录线上后端并轮询(密码来自 9.5 的 `PW`):

```bash
source /tmp/opencode/admin-credentials.env
CJ=/tmp/opencode/live-cookie.txt
curl -s -c $CJ -o /dev/null -w "login=%{http_code}\n" -X POST https://blogs.lovetulin.cn/admin/api/login \
  -H 'Content-Type: application/json' -d '{"user":"admin","pass":"'"$PW"'"}'
for i in $(seq 1 60); do
  S=$(curl -s -b $CJ https://blogs.lovetulin.cn/admin/api/build/status)
  echo "$S" | grep -o '"state":"[a-z]*"' || echo "$S"
  echo "$S" | grep -q '"state":"success"' && break
  echo "$S" | grep -q '"state":"failed"' && { echo "BUILD-FAILED: $S"; break; }
  sleep 5
done
```

预期:`login=204`;状态经 `queued → building → success`(容器内真跑 `npm run docs:build`,发布走 Docker 归档 API)。若 failed → `build/lastlog` 看日志修复后重触发(touch 或任何保存),直到 success。

产物 diff(规格:应仅新增 `admin/`):

```bash
ssh web 'rm -rf /tmp/blogs-new && docker cp caddy:/opt/blogs /tmp/blogs-new && diff -rq /tmp/blogs-pre /tmp/blogs-new | tee /tmp/diff.txt | head -40; echo "--- 丢失文件数:"; grep -c "^Only in /tmp/blogs-pre" /tmp/diff.txt || true'
```

判定:`Only in /tmp/blogs-pre`(旧文件丢失)必须为 **0**;新增应集中在 `admin/` 与 manifest/hashmap、index.html 之类;出现其他既有资产被改/被删 → **停下报告**(违反"最后成功版本不受影响"的前提)。

- [ ] **步骤 9.11:验收清单逐项执行(规格 §9 ①-⑧)**

**① 桌面/手机访问 `/admin/` 登录页**(静态外壳此步才进容器):

```bash
curl -s https://blogs.lovetulin.cn/admin/ | grep -o "<title>[^<]*"                 # <title>NotesAtlas 管理
/usr/bin/google-chrome --headless=new --no-sandbox --disable-gpu --window-size=1280,900 \
  --screenshot=/tmp/opencode/admin-desktop.png https://blogs.lovetulin.cn/admin/ 2>/dev/null
/usr/bin/google-chrome --headless=new --no-sandbox --disable-gpu --window-size=390,844 \
  --screenshot=/tmp/opencode/admin-mobile.png https://blogs.lovetulin.cn/admin/ 2>/dev/null
```

用 Read 工具看两张截图:登录卡完整、手机视口不破版。(再用会话浏览器开一次 `https://blogs.lovetulin.cn/admin/` 供用户肉眼看。)

**② 建/改/删/改名各一 + git log 对应提交**(每次 shell 都是新会话,凭据/变量在块内重新装载;中文路径先定义 URL 编码辅助):

```bash
source /tmp/opencode/admin-credentials.env
CJ=/tmp/opencode/live-cookie.txt
curl -s -c $CJ -o /dev/null -w "login=%{http_code}\n" -X POST https://blogs.lovetulin.cn/admin/api/login \
  -H 'Content-Type: application/json' -d '{"user":"admin","pass":"'"$PW"'"}'    # 预期 204,cookie 续上
enc() { python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1], safe='/'))" "$1"; }
PAGE="/$(enc '011.工具与资源/admin-crud-test.html')"
echo "$PAGE" > /tmp/opencode/page.url
P='{"path":"011.工具与资源/admin-crud-test.md"}'
echo "建=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' -X POST https://blogs.lovetulin.cn/admin/api/file -H 'Content-Type: application/json' -d "$P")"
echo "改=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' -X PUT https://blogs.lovetulin.cn/admin/api/file -H 'Content-Type: application/json' -d '{"path":"011.工具与资源/admin-crud-test.md","content":"---\ntitle: 后台验收\n---\n\n# 后台验收 OK\n"}')"
echo "改名=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' -X POST https://blogs.lovetulin.cn/admin/api/rename -H 'Content-Type: application/json' -d '{"from":"011.工具与资源/admin-crud-test.md","to":"011.工具与资源/admin-crud-test2.md"}')"
echo "改回=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' -X POST https://blogs.lovetulin.cn/admin/api/rename -H 'Content-Type: application/json' -d '{"from":"011.工具与资源/admin-crud-test2.md","to":"011.工具与资源/admin-crud-test.md"}')"
ssh web 'cd /opt/notes-atlas && git log --oneline -6 | head -6'
```

预期:四个 `204`;git log 出现 `admin(create)`、`admin(write)`、`admin(rename)` 各一次(改名两次)。

**③ 保存 → building → success → 页面更新**:上一步 `改` 已触发,先在**新 shell** 里轮询(同 9.10 的循环,循环开头先 `CJ=/tmp/opencode/live-cookie.txt`)到 `success` 后断言页面:

```bash
CJ=/tmp/opencode/live-cookie.txt
PAGE=$(cat /tmp/opencode/page.url)
curl -s "https://blogs.lovetulin.cn$PAGE" | grep -o "后台验收 OK" \
  || curl -s "https://blogs.lovetulin.cn$(python3 -c "import urllib.parse;print(urllib.parse.quote('011.工具与资源/admin-crud-test', safe='/'))")" | grep -o "后台验收 OK"
```

预期:输出 `后台验收 OK`(两种 URL 形态取先通者;若都不通,查 `cleanUrls` 配置后给出实际可访问 URL 再断言)。

**④ 故意写坏 YAML → failed + 日志 + 站点保持旧版**:

```bash
CJ=/tmp/opencode/live-cookie.txt
PAGE=$(cat /tmp/opencode/page.url)
curl -s -b $CJ -o /dev/null -w "坏写=%{http_code}\n" -X PUT https://blogs.lovetulin.cn/admin/api/file \
  -H 'Content-Type: application/json' -d '{"path":"011.工具与资源/admin-crud-test.md","content":"---\ntitle: [未闭合\n---\n\nx\n"}'
# 轮询(同 9.10 循环)到 failed 后:
curl -s -b $CJ https://blogs.lovetulin.cn/admin/api/build/lastlog | head -c 400      # 含 YAML 解析错误
curl -s "https://blogs.lovetulin.cn$PAGE" | grep -c "后台验收 OK"   # 仍为 1(旧版)
```

随后修回(写回正确内容)→ 轮询 `success`(规格:修复保存即自动重跑,失败不 revert git):

```bash
CJ=/tmp/opencode/live-cookie.txt
curl -s -b $CJ -o /dev/null -w "修回=%{http_code}\n" -X PUT https://blogs.lovetulin.cn/admin/api/file \
  -H 'Content-Type: application/json' -d '{"path":"011.工具与资源/admin-crud-test.md","content":"---\ntitle: 后台验收\n---\n\n# 后台验收 OK\n"}'
# 轮询到 success,再 curl $PAGE 断言 "后台验收 OK" 仍在
```

**⑤ 本地 `git push srv` 触发重建**(独立闭环,恢复后字节级一致):

```bash
cd /home/weno/works/Notes-Atlas
CJ=/tmp/opencode/live-cookie.txt   # 轮询循环(同 9.10)用
F=docs/superpowers/specs/2026-09-28-admin-panel-design.md
git diff --quiet -- "$F" || { echo "该文件有未提交改动,停下"; false; }
SHA0=$(git hash-object "$F")
printf '<!-- srv-push-trigger-test -->\n' >> "$F"     # 原文件以换行结尾,此行独立成行
git add "$F" && git commit -qm "test(admin): push 触发链路自检" && git push srv main
# 立即轮询(同 9.10 循环)应见 queued→building→success —— 验收⑤成立
sed -i '/^<!-- srv-push-trigger-test -->$/d' "$F"
[ "$(git hash-object "$F")" = "$SHA0" ] && echo RESTORED-BYTE-IDENTICAL || { echo "恢复不一致,停下人工处理"; false; }
git add "$F" && git commit -qm "test(admin): 移除自检注释" && git push srv main
# 再轮询一轮到 success;文件内容与测试前完全一致(历史多两条 test commit,可接受)
```

**⑥ 其他站点回归**:重跑 9.9 的 diff → `SITES-OK`。

**⑦ 登出后 API 全 401**:

```bash
CJ=/tmp/opencode/live-cookie.txt
curl -s -b $CJ -c $CJ -o /dev/null -w "logout=%{http_code}\n" -X POST https://blogs.lovetulin.cn/admin/api/logout
echo "登出后=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' https://blogs.lovetulin.cn/admin/api/tree)"   # 401
echo "其他端点=$(curl -s -b $CJ -o /dev/null -w '%{http_code}' https://blogs.lovetulin.cn/admin/api/build/status)"  # 401
```

**⑧ 本地 `pnpm test` 全绿 + `pnpm docs:build` exit 0**:

```bash
pnpm test 2>&1 | grep -E "^# (tests|pass|fail)"
pnpm docs:build > /tmp/opencode/local-build.log 2>&1; echo "build-exit=$?"
```

预期:`# tests 96`、`# pass 96`、`# fail 0`;`build-exit=0`。

- [ ] **步骤 9.12:清理迁移现场**

```bash
ssh web 'rm -rf /tmp/blogs-pre /tmp/blogs-new /tmp/diff.txt /tmp/insert-caddy.py'
```

服务器侧 `/opt/blogs.bak-*` 与 `Caddyfile.bak-*` **保留**(用户确认满意前不删)。

---

## 任务 10:收尾与报告

- [ ] **步骤 10.1:确认无本地残留进程**

```bash
pgrep -fa "vitepress[.]js preview|admin/server/src/index.js" || echo CLEAN
```

预期:`CLEAN`(有则 kill 对应进程)。

- [ ] **步骤 10.2:确认计划与实现均已提交、工作区状态知会用户**

```bash
git log --oneline -8 && git status --porcelain -- docs package.json pnpm-lock.yaml admin tests
```

预期:计划/各任务提交齐全;上面路径无未提交残留(用户自己的 `.obsidian/`、`deploy.yml` 等不在此列,原样保留)。

- [ ] **步骤 10.3:向用户交付报告**

报告必须包含:
1. 访问地址 `https://blogs.lovetulin.cn/admin/`、用户名 `admin`、**一次性密码**(9.5 输出,若用户未记录则重新生成流程:改 `.env` 的 `ADMIN_PASS_HASH` 后 `docker compose restart`)。
2. 验收 ①-⑧ 结果逐项(含截图路径)。
3. 真源变更:本地工作流 `git push srv main`(rsync 退役);服务器仓库 `/opt/notes-atlas`;后台每次保存 = `admin(<op>): <path>` 提交。
4. 环境变更清单:`/opt/notes-atlas`、`admin/server/.env(600)`、`notes-admin` 容器、Caddyfile 反代段与其 `.bak-*`、(若发生)`npm registry → npmmirror`、服务器全局 `pnpm@10`。
5. 留待用户决定:GitHub 何时 push(手动备份通道)、`deploy.yml` 去留、`/opt/blogs.bak-*` 与 `Caddyfile.bak-*` 何时删、`/tmp/opencode/admin-credentials.env` 可删。
6. 风险重申:docker.sock 等同 root(仅单管理员、API 经 HTTPS+登录可达);共享 Caddy 只加了一段 handle_path,其他 handle 未动。

---

## 计划自检(写完即查,已执行)

- **规格覆盖**:§3 认证→任务 2/6;§4 API 与安全→任务 1/3/4/6;§5 管线→任务 5/6/8;§6 UI→任务 7;§7 错误与安全边界→任务 1/6/9.8;§8 迁移→任务 9;§9 测试验收→任务 1-6 的 TDD + 9.11 ①-⑧;§10 YAGNI→文件结构"不做的事"。
- **占位符扫描**:`TODO|待定|TBD|后续补充|适当处理|补充细节` → 0 处;每个步骤均有可执行命令 + 预期输出。
- **类型一致性**:`e.status`/`e.code` 贯穿 paths→files→app 错误处理;`queue.status()` 六字段 + app 合并 `lastCommit` = 规格 §4 的七字段;`api.js` 12 个方法 ↔ 12 条业务路由(+1 条 GET login 405);`FORM_FIELDS` 与 UI 五字段一致。
- **测试计数**:paths 7 + auth 7 + frontmatter 5 + files 15 + build 7 + publish 2 + app 16 = **新增 59,累计 37+59=96**,与各任务 `# pass` 预期一致。
- **红线**:不碰 `docs/.vitepress/config.ts`(用户 WIP)、不动其他 Caddy handle、push 仅限迁移指令内的 `push srv`、`git add` 全部显式路径、共享 Caddyfile 改前必有备份且 validate 失败即回滚。
