# Twikoo 统一评论身份验证设计

- 日期：2026-11-15
- 状态：已确认，待实现
- 范围：博客主站（VitePress + Teek + Twikoo）、留言板、朋友圈评论
- 不在范围：点赞登录、评论编辑/删除、账号注销、换邮箱、2FA、旧评论迁移、giscus 与 Twikoo 数据同步

## 1. 目标与约束

### 目标

- 未登录用户可以正常浏览博客和所有评论。
- 只有登录且邮箱已验证的用户可以发表评论、回复、上传评论图片。
- 登录一次后，全站（文章、留言板、朋友圈）共用同一身份，正常活跃不重复登录。
- 服务端强制校验，不能通过修改前端 DOM、localStorage 或直接请求绕过。
- GitHub OAuth 与邮箱验证码两种登录方式。
- 邮箱验证后锁定；昵称首次自动生成，之后可修改并长期记住。

### 现有系统事实

- 博客：VitePress + `vitepress-theme-teek`，部署在 `https://blogs.lovetulin.cn`。
- Twikoo 2.0.17：自建在 `https://comments.lovetulin.cn`，与博客同一台阿里云服务器，Caddy 反向代理，Twikoo 容器/进程的 `8080` 只对本机开放。
- 评论入口三处：
  - 文章底部：Teek 内置 `CommentTwikoo`。
  - `/guestbook`：`docs/.vitepress/theme/components/GuestbookPage.vue` 自绘表单。
  - `/moments`：`docs/.vitepress/theme/components/MomentsTimeline.vue` 自绘表单。
- Twikoo 客户端没有评论者账号体系，只有管理员密码；不能直接复用为“邮箱已验证的评论用户”。
- GitHub Pages 镜像站无法共享主站 Cookie，改用 giscus；主站仍使用 Twikoo。

### 关键约束

- 主站与评论 API 必须同源，才能让 `HttpOnly` Cookie 自动携带。
- 不能把 Twikoo 管理员 token 当作评论者旁路。
- 不能要求用户频繁登录；采用 180 天滑动会话。
- 现有 Twikoo 评论数据、管理面板、图片资源保持可用。
- 生产环境 Node 24（`node:sqlite` 为内置模块），前端构建仍使用仓库现有 Node 版本。

## 2. 总体架构

采用同源网关方案：

```text
浏览器
  │  https://blogs.lovetulin.cn
  ├─ /                → Caddy → VitePress 静态文件
  ├─ /api/auth/*      → Caddy → auth-gateway:8787
  └─ /twikoo-api/*    → Caddy → auth-gateway:8787 → Twikoo:8080

  https://comments.lovetulin.cn
  └─ /*               → Caddy → auth-gateway:8787 → Twikoo:8080
```

- `auth-gateway` 是新增的常驻 Node 服务，使用 Hono + SQLite。
- 网关负责登录、会话、验证码、OAuth，以及 Twikoo 反向代理。
- 主站前端只请求同源 `/api/auth/*` 与 `/twikoo-api/*`，Cookie 自动携带。
- `comments.lovetulin.cn` 整站也经过网关，保证 Twikoo 管理面板和静态资源继续可用。
- Twikoo 的 `8080` 不对公网开放。

### 故障边界

- 网关或 Twikoo 不可用时，评论区不可用；博客静态内容不受影响。
- 回滚时只需把 Caddy 的 comments 上游改回 `127.0.0.1:8080`，并撤掉 blogs 的两条网关路由。

## 3. 身份与会话

### 邮箱验证码

- 6 位数字，10 分钟有效，只能使用一次。
- 同一验证码最多尝试 5 次，超过后作废。
- 同一邮箱 60 秒冷却，每小时最多 5 次。
- 同一 IP 每小时最多 20 次发送。
- 验证码只保存 HMAC-SHA256 哈希，不保存明文。
- 发送接口无论邮箱是否存在都返回相同提示，防枚举。
- 发信走阿里云 DirectMail SMTP（465 SSL）。

### GitHub OAuth

- 授权地址：`https://github.com/login/oauth/authorize`。
- 回调：`https://blogs.lovetulin.cn/api/auth/github/callback`。
- scope：`read:user user:email`。
- 使用一次性 state Cookie 防 CSRF。
- 只接受 GitHub 标记为 verified 的邮箱；优先 primary verified，否则第一个 verified。
- 账号匹配顺序：
  1. 按 `github_id` 查找；
  2. 按已验证邮箱查找，若该用户尚未绑定 GitHub 则绑定；
  3. 创建新用户。
- 如果邮箱已绑定另一个 GitHub 账号，拒绝登录并提示。
- 默认昵称：GitHub 用户名，清理后截断到 20 字符；邮箱注册则取邮箱前缀。
- 不覆盖用户后来自定义的昵称。

### 会话

- 32 字节随机 token，base64url 编码。
- 数据库只保存 SHA-256 哈希。
- Cookie：
  - 名称：`weno_session`
  - `HttpOnly`
  - `Secure`（生产）
  - `SameSite=Lax`
  - `Domain=.lovetulin.cn`
  - `Path=/`
  - 180 天有效
- 滑动续期：距上次续期超过 1 天时更新过期时间并重发 Cookie；活跃用户不需要重新登录。
- 退出登录删除服务端会话并清除 Cookie。
- 会话过期返回 401，前端统一弹登录框。

### 用户资料

- 邮箱验证后锁定，前端没有修改入口。
- 昵称 1–20 个字符，允许中英文、数字、空格和常见符号；过滤控制字符；不通过 `v-html` 渲染。
- 修改昵称只影响新评论；历史评论保持原昵称。
- 管理员也走统一登录；`ADMIN_EMAILS` 仅用于前端显示管理员标识，不作为评论旁路。

## 4. 三处评论入口

### 4.1 文章底部（Teek Twikoo）

- 在 `teek-comment-before` 插槽挂 `<CommentAuth />`。
- 未登录：
  - 显示登录卡片；
  - CSS 隐藏 `#twikoo .tk-submit` 与 `#twikoo .tk-actions`；
  - 评论列表仍可见。
- 已登录：
  - 隐藏 `#twikoo .tk-meta-input`；
  - 将 `{nick, mail}` 写入 localStorage 键 `twikoo`，同步隐藏输入框的值；
  - `teekConfig.comment.options.onSubmit` 中强制设置 `t.nick` / `t.mail`，未登录则抛错。
- 认证状态返回前给 `<html>` 加 `auth-pending`，隐藏提交框避免闪烁。
- 网关仍会再次覆盖身份，前端逻辑只是 UX 辅助。

### 4.2 留言板

- 删除昵称/邮箱输入；显示“以 {nick} 留言 · 邮箱已验证”。
- 保留可选“网址”字段。
- 未登录不渲染表单，原位显示登录卡。
- 点击回复时先要求登录。
- 提交时 `nick` / `mail` 从会话取；网关再次覆盖。
- 图片上传仅登录后显示。
- 会话过期时保留已写文本，登录成功后继续提交。

### 4.3 朋友圈

- 未登录点击评论先弹登录；登录成功后自动打开原朋友圈输入框。
- 移除昵称输入，提交使用会话身份；`mail` 不再传空。
- 点赞仍使用 localStorage，不要求登录。

## 5. 前端交互

### 导航栏

- 通过 `nav-bar-content-after` 放 `<AuthNav />`。
- 未登录：显示“登录”按钮。
- 已登录：头像 + 账号卡。
  - 昵称；
  - 脱敏邮箱；
  - 修改昵称；
  - 退出登录。
- 移动端只显示头像/图标。

### 登录弹窗

- Teleport 到 `body`。
- GitHub / 邮箱验证码两个 Tab。
- 邮箱流程：
  - 输入邮箱；
  - 60 秒倒计时；
  - 6 位验证码；
  - 错误、限流、发信失败分别提示。
- 可访问性：焦点陷阱、Esc 关闭、`aria-modal`、按钮 loading 状态。
- 隐私说明：“邮箱仅用于评论身份验证，不会公开”。
- GitHub 登录跳转前记录当前站内路径，回调后返回。
- OAuth 回跳 `?auth=success` 清理 query；错误通过 `?auth=error&reason=...` 提示。
- 登录成功后不刷新页面即切换身份，执行待办动作（例如打开朋友圈输入框）。

### Twikoo 身份同步

- 登录后写入 localStorage `twikoo` 的 `nick` / `mail`，保留原有 `link`。
- 若 Twikoo 已渲染，使用原生 setter + `input` 事件更新 `.tk-meta-input input[name=nick]`、`input[name=mail]`。
- 用 `MutationObserver` 监听 `#twikoo` 首次渲染，保证晚于认证加载的评论区也能同步。
- 退出登录清空 `nick` / `mail`，保留 `link`。
- 修改昵称后重新同步。

## 6. 网关 API

### 认证接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/auth/me` | 当前用户；未登录返回 401 |
| POST | `/api/auth/email/send` | 发送验证码，body `{ email }` |
| POST | `/api/auth/email/verify` | 校验验证码并登录，body `{ email, code }` |
| PATCH | `/api/auth/profile` | 修改昵称，body `{ nick }` |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/github` | 跳转 GitHub 授权，可带 `redirect` |
| GET | `/api/auth/github/callback` | OAuth 回调 |
| GET | `/healthz` | 健康检查 |

`/api/auth/me` 返回：

```json
{
  "user": {
    "id": 1,
    "nick": "Alice",
    "email": "alice@example.com",
    "emailVerified": true,
    "avatarUrl": null,
    "isAdmin": false
  }
}
```

### 错误格式

```json
{ "error": "invalid_code", "message": "验证码错误或已过期" }
```

状态码：

- 400：参数/验证码错误；
- 401：未登录；
- 403：Origin 校验失败；
- 429：限流；
- 502：邮件服务或 Twikoo 不可用。

### Twikoo 代理

- 主站路径：`/twikoo-api/*`。
- comments 域名：除 `/api/auth/*` 外的所有路径。
- 对 `COMMENT_SUBMIT`：
  - 必须已登录；
  - 解析 JSON body；
  - 强制覆盖 `nick` / `mail`；
  - 转发到 `TWIKOO_UPSTREAM`。
- 对 `UPLOAD_IMAGE`：必须已登录。
- 其他事件和静态资源透传。
- 请求体上限 20 MB（图片上传）。
- 上游超时 30 秒。
- 转发时清理 `Cookie`、`Host` 等头，避免把博客 Cookie 带给 Twikoo。

## 7. 数据模型

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email_verified_at INTEGER NOT NULL,
  nick TEXT NOT NULL,
  github_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE email_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
```

- `PRAGMA journal_mode=WAL`、`foreign_keys=ON`。
- 启动时清理过期会话和验证码。
- 所有时间使用 Unix 秒。

## 8. 安全设计

- 登录接口只接受 `application/json`。
- 对修改类请求校验 `Origin` 与 `Sec-Fetch-Site`；允许主站、comments 域名、本地开发地址；无 Origin 的非浏览器请求允许（无 Cookie 时无意义）。
- OAuth state 使用 HMAC 签名 + 随机数 + 10 分钟过期。
- 验证码哈希使用 `SESSION_SECRET` 做 HMAC，比较使用 timing-safe。
- 会话 token 只存哈希，Cookie HttpOnly。
- 重定向只允许站内 `/...`。
- 不记录邮箱、验证码、token 到日志；错误日志只记录事件和状态。
- 昵称过滤控制字符，前端不使用 `v-html`。
- 管理员不做 Twikoo token 旁路。
- 反向代理不转发客户端 Cookie 到 Twikoo。

## 9. 部署

### 目录

```text
server/auth-gateway/
  src/server.ts
  src/config.ts
  src/db.ts
  src/session.ts
  src/email.ts
  src/github.ts
  src/auth.ts
  src/twikoo.ts
  test/
  Dockerfile
  compose.yml
  .env.example
  README.md
```

### 容器

- 仅监听 `127.0.0.1:8787`（compose 端口映射）。
- volume：`./data:/data`。
- `TWIKOO_UPSTREAM=http://host.docker.internal:8080`；Linux 加 `extra_hosts: ["host.docker.internal:host-gateway"]`。
- 健康检查：`GET /healthz`。

### Caddy

```caddyfile
blogs.lovetulin.cn {
  handle /api/auth/*  { reverse_proxy 127.0.0.1:8787 }
  handle /twikoo-api* { reverse_proxy 127.0.0.1:8787 }
  # 其余保持现有静态配置
}

comments.lovetulin.cn {
  reverse_proxy 127.0.0.1:8787
}
```

### 环境变量

```dotenv
PUBLIC_ORIGIN=https://blogs.lovetulin.cn
COOKIE_DOMAIN=.lovetulin.cn
COOKIE_SECURE=true
SESSION_SECRET=...
DATABASE_PATH=/data/auth.db
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://blogs.lovetulin.cn/api/auth/github/callback
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=...
ADMIN_EMAILS=...
TWIKOO_UPSTREAM=http://host.docker.internal:8080
```

### 前端构建

- `teekConfig.comment.envId` 改为 `https://blogs.lovetulin.cn/twikoo-api`。
- 从 `deploy.yml` / `preview.yml` 移除 `VITE_TWIKOO_ENV_ID`。
- 本地开发：Vite proxy `/api`、`/twikoo-api` → `http://127.0.0.1:8787`；`VITE_TWIKOO_ENV_ID=http://localhost:5173/twikoo-api`。
- GitHub Pages 构建：`VITEPRESS_GISCUS=1`、`VITEPRESS_PAGES=1`、`VITEPRESS_BASE=/Notes-Atlas/`。
- 生产/预览不设置 `VITEPRESS_GISCUS`。
- giscus 需要 `repoId`、`categoryId`；缺失时 Pages 显示配置提示，不加载空脚本。

### 回滚

1. Caddy comments 上游改回 `127.0.0.1:8080`；
2. 移除 blogs 的 `/api/auth/*`、`/twikoo-api*`；
3. 停止 auth-gateway；
4. 前端回退到旧构建。Twikoo 数据不受影响。

## 10. 测试与验收

### 自动化

- 单元：
  - 邮箱归一化；
  - 验证码哈希、过期、尝试次数；
  - 会话创建、校验、滑动、退出；
  - 昵称过滤；
  - 站内重定向校验。
- 集成（mock Twikoo + fake mailer）：
  - 匿名提交 401；
  - 登录后被覆盖为会话身份；
  - 上传 401；
  - 读取评论放行；
  - 退出后提交失效；
  - Cookie 标志；
  - OAuth state 与 verified email 选择。
- 前端：
  - `pnpm docs:build` 在 `/` 与 `/Notes-Atlas/` 下通过；
  - Pages 产物包含 giscus，不包含登录 UI。

### 手工验收

- 未登录：三处评论可看，提交框不可见；直接请求提交返回 401。
- 邮箱验证码：收到邮件、登录、刷新后仍登录。
- GitHub：verified 邮箱登录成功；未验证邮箱被拒绝。
- 文章、留言板、朋友圈各发一条评论，身份一致。
- 修改昵称后新评论使用新昵称，历史评论不变。
- 退出后立即不能提交。
- 手机端、暗色模式正常。
- GitHub Pages 评论区正常显示 giscus。

## 11. 实施顺序

1. 写本 spec 并提交。
2. 实现 auth-gateway 基础模块与测试。
3. 实现认证路由与 Twikoo 代理。
4. 实现前端认证状态、登录弹窗、导航入口。
5. 接入文章评论区。
6. 改造留言板与朋友圈。
7. 更新构建配置、workflows、giscus。
8. 构建、测试、手工验证。
9. 整理提交。

## 12. 待部署输入

以下信息不阻塞代码，但部署前必须提供：

- giscus `repoId`、`categoryId`；
- 阿里云 DirectMail 发信地址与 SMTP 用户名/密码；
- GitHub OAuth App 的 Client ID/Secret；
- 现有 Caddyfile（用于合并，不整份替换）。
