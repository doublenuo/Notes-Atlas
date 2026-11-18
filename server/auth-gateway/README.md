# Notes Atlas Auth Gateway

为 Twikoo 评论区提供统一登录：GitHub OAuth 或邮箱验证码登录；只有登录且邮箱已验证的用户可以提交评论或上传图片。未登录用户仍可浏览评论。

网关部署在 Twikoo 前面，同时代理 `/api/auth/*` 与 `/twikoo-api*`。Cookie 只存在同源主站，前端无法通过修改 DOM、localStorage 或直接请求伪造评论身份：网关会用服务端会话里的昵称和已验证邮箱覆盖提交内容。

## 目录

```
src/
  app.ts          Hono 应用、路由与健康检查
  auth.ts         /api/auth 路由
  config.ts       环境变量解析
  db.ts           node:sqlite 数据访问
  email.ts        验证码、限流、SMTP 发信
  github.ts       GitHub OAuth
  nick.ts         邮箱/昵称清洗
  oauth-state.ts  带签名的 OAuth state
  session.ts      会话与 Cookie
  server.ts       启动入口
  twikoo.ts       Twikoo 反向代理与提交校验
test/
  gateway.test.ts 集成测试（内存数据库 + mock Twikoo / GitHub / Mailer）
```

## 本地开发

要求 Node.js 24+（使用内置 `node:sqlite`）。

```bash
cd server/auth-gateway
npm ci
cp .env.example .env
# 至少填写 SESSION_SECRET，并保持 SMTP_DRY_RUN=true
openssl rand -base64 48   # 填入 SESSION_SECRET
npm run dev
```

默认监听 `127.0.0.1:8787`。本地联调时：

- Twikoo 运行在 `http://127.0.0.1:8080`，设置 `TWIKOO_UPSTREAM`；
- 博客 dev server 的 Vite proxy 把 `/api` 与 `/twikoo-api` 转到 `http://127.0.0.1:8787`；
- 前端 `.env.local` 设置 `VITE_TWIKOO_ENV_ID=http://localhost:5173/twikoo-api`；
- `SMTP_DRY_RUN=true` 时验证码打印在网关日志里，不真正发信。

```bash
npm test
npm run typecheck
npm run build
```

## 部署（Docker Compose）

```bash
cd server/auth-gateway
cp .env.example .env
# 填写 SESSION_SECRET、GITHUB_*、SMTP_*、COOKIE_DOMAIN 等
mkdir -p data
docker compose build
docker compose up -d
docker compose logs -f
```

容器内监听 `0.0.0.0:8787`，但 compose 只把端口发布到宿主机 `127.0.0.1:8787`。数据库位于 `./data/auth.db`，不要提交到 Git。

如果 Caddy 和 Twikoo 已经位于同一个外部 Docker 网络（例如 `caddy-network`），使用：

```bash
docker compose -f compose.yml -f compose.caddy.yml up -d --build
```

此时网关通过 `http://twikoo:8080` 访问 Twikoo，不需要把 8080 暴露到宿主机；Caddy 中也应写 `reverse_proxy auth-gateway:8787`，而不是 `127.0.0.1:8787`。

Caddy 参考 `Caddyfile.example`，把其中两条路由合并进现有站点配置：

- `blogs.lovetulin.cn`：`/api/auth/*` 与 `/twikoo-api*` 反代到 `127.0.0.1:8787`，其余仍由静态文件服务；
- `comments.lovetulin.cn`：整站反代到 `127.0.0.1:8787`，由网关再转发给本机 Twikoo `:8080`。

Twikoo 的 `8080` 端口不要暴露公网；安全组只放行 80/443。

### 阿里云 DirectMail

- 在 DirectMail 控制台验证发信域名，配置 SPF/DKIM；
- 发信地址与 SMTP 用户名通常是完整邮箱；
- `SMTP_HOST=smtpdm.aliyun.com`，`SMTP_PORT=465`，`SMTP_SECURE=true`；
- 25 端口被云厂商封禁时不要使用 25；
- 先用 `SMTP_DRY_RUN=true` 验证流程，再切到真实发信。

### GitHub OAuth App

- 必须在 **Settings → Developer settings → OAuth Apps** 创建，不要创建 GitHub App：GitHub App 的 `scope` 不生效，且需要单独授予 Email addresses 权限，否则 `/user/emails` 返回 403。
- Homepage URL：`https://blogs.lovetulin.cn`
- Authorization callback URL：`https://blogs.lovetulin.cn/api/auth/github/callback`
- 把 Client ID / Client Secret 写入服务器 `.env`；
- 只接受 GitHub 账号的 verified email，未验证会拒绝登录。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/healthz` | 健康检查 |
| GET | `/api/auth/me` | 当前用户；未登录 401 |
| POST | `/api/auth/email/send` | 发送 6 位验证码，body `{email}` |
| POST | `/api/auth/email/verify` | 校验验证码并建立会话，body `{email, code}` |
| PATCH | `/api/auth/profile` | 修改昵称，body `{nick}` |
| POST | `/api/auth/logout` | 删除服务端会话 |
| GET | `/api/auth/github` | 跳转 GitHub 授权 |
| GET | `/api/auth/github/callback` | OAuth 回调 |
| POST | `/twikoo-api` | Twikoo API 代理；提交/上传强制登录 |

`COMMENT_SUBMIT` 与 `UPLOAD_IMAGE` 需要有效 `weno_session` Cookie；网关会用会话中的昵称和邮箱覆盖 `nick` / `mail`。其他事件（`GET_CONFIG`、`COMMENT_GET`、`COMMENT_LIKE` 等）公开透传。

## 安全说明

- 会话 token 为 32 字节随机值，数据库只存 SHA-256；Cookie 为 `HttpOnly; Secure; SameSite=Lax`，180 天滑动续期。
- 验证码 10 分钟有效、单次使用、最多 5 次尝试；同邮箱 60 秒冷却、每小时 5 次；同 IP 每小时 20 次。数据库只存 HMAC。
- 修改类请求校验 `Origin` / `Sec-Fetch-Site`；OAuth 使用一次性签名 state。
- 生产日志不记录验证码、邮箱或 token；仅 `SMTP_DRY_RUN=true` 的本地调试会打印邮箱与验证码。
- 管理员也走统一登录，不使用 Twikoo admin token 旁路。

## Twikoo 反垃圾配置

所有评论者都已经过网关登录与邮箱验证，Twikoo 自身的 Akismet 自动反垃圾应当关闭（`AKISMET_KEY` 置空）。否则 Akismet 可能把正常回复——尤其是短回复或连续回复——标记为 `isSpam`，而 Twikoo 的访客 `COMMENT_GET` 会过滤垃圾评论，表现就像“回复没有保存”。网关不会绕过 Twikoo 的垃圾标记；重新启用 Akismet 前，必须验证回复仍对其他访客可见。

## 备份与升级

```bash
# 备份
docker compose stop
cp data/auth.db "data/auth-$(date +%F).db"
docker compose start

# 升级
git pull
docker compose build
docker compose up -d
```

回滚时把 Caddy 的 `comments.lovetulin.cn` 上游改回 `127.0.0.1:8080`，并移除 `blogs.lovetulin.cn` 的两条网关路由。

## 常见问题

- **登录后提交仍 401**：确认浏览器请求带 `weno_session`，且 `COOKIE_DOMAIN=.lovetulin.cn`、`COOKIE_SECURE=true` 与 HTTPS 一致。
- **验证码收不到**：先看 `docker compose logs`；DirectMail 需要域名验证与 SPF/DKIM，且 25 端口通常不可用。
- **GitHub 回调失败**：检查回调 URL 是否完全一致，以及 `GITHUB_CALLBACK_URL` 是否与 OAuth App 配置一致。
- **评论区 502**：网关无法连接 `TWIKOO_UPSTREAM`；确认 Twikoo 正在 `:8080` 监听，Linux 下 `host.docker.internal` 已通过 `extra_hosts` 映射。如果 Twikoo 容器只绑定 `127.0.0.1:8080`，宿主机网关地址可能访问不到，可把 `TWIKOO_UPSTREAM` 改成 Twikoo 容器名/服务名，并让两个容器加入同一 Docker 网络。
