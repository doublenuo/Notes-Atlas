---
date: 2026-10-11 22:10:00
title: 2026-10-11-admin-code-server-design
---
# 后台管理系统迁移到 code-server 设计规格

**日期：** 2026-10-11
**状态：** 待审查

## 1. 背景与目标

现有后台是自研面板：Fastify 5 + 无框架原生 JS（`public/index.html` + `app.js` 980 行 + `style.css` 792 行），提供登录、文件树、分栏编辑、markdown 预览、保存即 `git commit + push`、构建状态轮询。合计约 3000 行手写代码 + 3.8MB 提交进 git 的 vendor 资源。

这套代码已经比较像 VSCode，但止步于「像」：没有命令面板、没有多光标、没有成熟的查找替换、没有 git 可视化。后续每加一个编辑器能力都是在自研轮子上加轮子。

目标：**用真正的 VSCode（code-server）整体替换自研面板**，删掉全部自研前后端代码，同时保持站点构建链路不受影响。

非目标（本次不做）：终端以外的高级定制、VSCode 扩展市场、多用户权限体系、容器内构建与发布（现状 `BUILD_AUTO=0`，发布走 GitHub Actions，保持不变）。

## 2. 决策摘要

| # | 决策 | 取值 | 理由 |
|---|---|---|---|
| D1 | 形态 | 真实 code-server，不是仿制 UI | 「像 VSCode」的自研天花板太低，已决定整体替换 |
| D2 | 旧的 Fastify 面板 | 完全删除 | 用户明确选择「完全替换」，不做并存过渡期 |
| D3 | 鉴权 | code-server 自带 password | 运维最简，浏览器体验与 VSCode 原生一致 |
| D4 | 工作区 | 挂整个仓库 `/opt/notes-atlas`，但默认打开 `docs/` | 写笔记时保持原有安全边界；同时仓库完整可见，VSCode 的 SCM 视图可手动 commit + push |
| D5 | 推进方式 | 一步到位替换，**仅本地验证通过**，生产上线另行触发 | 用户决定先在本地跑通 |
| D6 | `obsidianEmbed.js` 位置 | 移到仓库根 `shared/` | 原位置在 `admin/server/` 已无语义（Docker build context 约束随 code-server 消失），且造成站点反向依赖后台目录 |

## 3. 约束

1. **`shared/obsidianEmbed.js` 必须存活**——它是站点构建的硬依赖：
   - `docs/.vitepress/config.ts:7` → `obsidianEmbed`
   - `docs/.vitepress/plugins/docAnalysisEmbed.ts:13` → `createResolver`、`readNote`
   - `tests/{helpers,resolver,doc-analysis}.test.mjs` 等 5 个测试
   仅依赖 `node:fs`/`node:path` + `gray-matter`，而 `gray-matter` 已在根 `devDependencies`，拆掉 `admin/server/node_modules` 不影响解析。
2. **`docs/` 之外的站点发布链路不动**——GitHub Actions（`.github/workflows/deploy.yml`）仍是唯一发布路径。
3. **Caddy 路由在宿主机上**——仓库内 `admin/server/Caddyfile` 是死文件（已在 `docker-compose.yml` 头部注明），仅作参考留存。
4. **code-server 镜像以 `coder`（uid 1000）用户运行**，不是 root。这直接决定了 ssh 密钥的挂载位置（见 §5）。

## 4. 架构

### 4.1 流量

```
浏览器  https://blogs.lovetulin.cn/admin/
   │
   ▼  Caddy（宿主机，唯一需要改的地方）
   │  redir  /admin → /admin/            308（不变）
   │  handle_path /admin/*               ← 由 handle 改为 handle_path
   ▼
code-server 容器（codercom/code-server，network_mode: host）
   监听  0.0.0.0:8477                    端口不变
   认证  auth: password（bcrypt）
   工作区 /workspace/notes-atlas          bind mount ${SITE_DIR:-/opt/notes-atlas}
   入口   /workspace/notes-atlas/docs     默认打开的工作区文件夹
   凭据   /home/coder/.ssh/id_rsa (ro) + 镜像内 baked known_hosts
```

**为什么必须 `handle` → `handle_path`**：code-server 的根路径就是 `/`，其静态资源用相对路径引用；而原 Fastify 是按 `/admin/` 前缀托管 `public/` 的。`handle_path` 会剥掉 `/admin` 前缀，code-server 才能正确解析自身资源。Caddy 只改这一个词。

### 4.2 容器内部

code-server 提供编辑器、集成终端、SCM 视图。VSCode 原生能力覆盖原面板的全部功能，另有新增：

| 原面板能力 | code-server 对应 |
|---|---|
| 保存即 commit + push | SCM 视图手动 commit；push 需 ssh 私钥（§5 已解决） |
| markdown 预览 | VSCode 自带 Markdown Preview（`Ctrl+Shift+V`） |
| mermaid / KaTeX | 需装对应 VSCode 扩展，见 §4.3 |
| `![[Obsidian 嵌入]]` 预览 | **无原生支持**，见 §4.4 |
| 构建状态轮询 | 取消，发布状态看 GitHub Actions |

### 4.3 编辑器扩展（决策：镜像构建期预装）

站点笔记大量使用 mermaid 与 KaTeX 公式，而 VSCode 内置 Markdown Preview **不渲染这两者**。原面板是靠服务端 markdown-it + KaTeX auto-render + mermaid.js 渲染的（`public/app.js` 847–943 行），换 code-server 后这部分由扩展承担。

**决策**：在 Dockerfile 构建期用 `code-server --install-extension` 预装两类扩展（mermaid 渲染、markdown 公式渲染），使预览能力与旧面板对齐。

- 扩展 ID 在实现阶段以 `code-server --list-extensions` 实际输出为准，不在规格里写死——写死一个拼错的 ID 会让构建期静默跳过安装
- 验收标准是**行为**而非扩展 ID：§6 验收清单第 4 条——含 mermaid 代码块与 `$...$` 公式的笔记，预览中分别渲染为图和排版好的公式
- 若届时扩展不可用，退路是「在 VSCode 里编辑、以站点预览为准」。这只影响编辑期预览，不影响内容正确性与线上渲染，故不阻塞上线

### 4.4 `![[Obsidian 嵌入]]` 在 VSCode 里怎么显示

`![[CMoE]]` 是本站自定义语法，由 `shared/obsidianEmbed.js` 在**站点构建期**展开。VSCode 不认识它，会显示为纯文本。

这是可接受的：嵌入的最终呈现以站点为准。编辑期看到 `![[CMoE]]` 字面量，与在 Obsidian 里看到的是同一种心智模型。若要改善，可后续加一个只做语法高亮的轻量扩展——本次不做。

### 4.5 共享模块迁移

`admin/server/shared/obsidianEmbed.js` → `shared/obsidianEmbed.js`，需改 7 处 import：

| 文件 | 改动 |
|---|---|
| `docs/.vitepress/config.ts:7` | `'../../admin/server/shared/obsidianEmbed.js'` → `'../../shared/obsidianEmbed.js'` |
| `docs/.vitepress/plugins/docAnalysisEmbed.ts:13` | `'../../../admin/server/shared/obsidianEmbed.js'` → `'../../../shared/obsidianEmbed.js'` |
| `tests/helpers.mjs:4` | `'../admin/server/shared/obsidianEmbed.js'` → `'../shared/obsidianEmbed.js'` |
| `tests/resolver.test.mjs:5` | 同上 |
| `tests/doc-analysis.test.mjs:7` | 同上 |
| `tests/embed.test.mjs` / `embed-errors.test.mjs` / `wikilink.test.mjs` | 经 `helpers.mjs` 间接引用，需实跑确认无残留直接引用 |

同时更新该文件头部注释：删除「放在 admin/server 是因为 Docker build context」的过时理由。

### 4.6 文件处置清单

**删除**

```
admin/server/src/                10 个文件（index/app/auth/files/frontmatter/paths/preview/build/publish/watcher）
admin/server/public/             index.html、app.js、style.css、tabs.js、tree-expand.js、vendor/（3.8MB）
admin/server/scripts/            fetch-vendor.mjs
admin/server/package.json
admin/server/package-lock.json
admin/server/node_modules/        （独立 npm 安装树，删掉不影响根 pnpm）
admin/server/.env                 （本机文件，保留但内容作废）
tests/admin/                     11 个测试：10 个删除，dockerfile.test.mjs 改名为 deploy.test.mjs 并重写内容
.gitignore                        失效条目 docs/public/admin/
```

**保留**

```
shared/obsidianEmbed.js          （由 admin/server/shared/ 迁入）
tests/embed.test.mjs
tests/embed-errors.test.mjs
tests/resolver.test.mjs
tests/wikilink.test.mjs
tests/doc-analysis.test.mjs
tests/helpers.mjs
tests/fixtures/
tests/print-export.test.mjs
admin/server/Caddyfile           （死文件，仅作路由参考留存）
```

**新增 / 重写**

```
admin/server/Dockerfile          基于 codercom/code-server:4.141.0
admin/server/docker-compose.yml  code-server 服务定义
admin/server/config.yaml.example code-server 配置模板（提交）
admin/server/config.yaml         code-server 配置（gitignore，部署时生成）
admin/server/.env.example        重写
tests/admin/deploy.test.mjs     重写（原 dockerfile.test.mjs 改名）
```

## 5. code-server 配置

### 5.1 `config.yaml`

```yaml
bind-addr: 0.0.0.0:8477
auth: password
password: <bcrypt 串>
cert: false
```

`config.yaml` 含密码哈希，**不入库**，由部署时生成；`config.yaml.example` 入库作为形状参考。

生成方式：

```bash
node -e "console.log(require('bcryptjs').hashSync('你的密码', 10))"
```

### 5.2 启动参数

```
--disable-telemetry
--disable-update-check
--disable-workspace-trust        免每次弹「是否信任此工作区」
/workspace/notes-atlas/docs       默认打开的工作区文件夹
```

### 5.3 ssh 密钥挂载（本方案最容易踩的坑）

旧方案挂 `/root/.ssh/id_rsa`，容器内 git 以 root 运行，可读。code-server 以 `coder` 运行，而 `/root` 权限 700，**coder 读不到**——表现为「commit 成功但 push 失败」，且报错发生在远端而非本地，很容易误判。

对策：

1. 密钥挂载点改为 `/home/coder/.ssh/id_rsa:ro`
2. `known_hosts` 用 `ssh-keyscan github.com` 在镜像构建时预置（沿用旧 Dockerfile 做法）
3. 宿主机侧私钥权限须为 `600`。属主由容器入口脚本统一修正——镜像构建时写入一条 `chown coder:coder /home/coder/.ssh/id_rsa && chmod 600 /home/coder/.ssh/id_rsa` 的 entrypoint 前置，避免属主不匹配时 ssh 客户端直接拒绝加载

code-server 版本锁定 `4.141.0`（对应 Code 1.141.0，发布于 2026-10-08）。不使用 `latest`——镜像内已装扩展，浮动 tag 会让「本地能跑通」与「生产跑不通」之间出现无法复现的偏差。

## 6. 本地验证方案

`docker-compose.yml` 用环境变量做挂载源，使生产与本地共用一份文件：

```yaml
- ${SITE_DIR:-/opt/notes-atlas}:/workspace/notes-atlas
```

本地跑通步骤：

```bash
cd admin/server
cp config.yaml.example config.yaml      # 填入本地密码哈希
SITE_DIR=$(git rev-parse --show-toplevel) docker compose up -d
# 打开 http://localhost:8477
```

验收清单（逐项人工确认）：

| # | 检查项 | 通过标准 |
|---|---|---|
| 1 | 登录 | code-server 密码页可登录 |
| 2 | 工作区 | 打开的是 `docs/`；资源管理器里**看不到** `.github/`、`.env` |
| 3 | 嵌入语法 | 打开 `01.组会材料/01.组会内容/20261014.md`，`![[CMoE]]` 正常显示为文本 |
| 4 | 公式/图表 | 含 mermaid 与 `$...$` 的笔记，VSCode 预览表现符合 §4.3 的结论 |
| 5 | **git push** | SCM 视图 commit 后 **push 成功**（本次最关键，唯一旧方案没有的能力） |
| 6 | CI 触发 | push 后 GitHub Actions `deploy.yml` 被触发，站点成功更新 |
| 7 | 回归 | `pnpm docs:build` 通过，`pnpm test` 通过 |

第 5、6 条若失败，说明 §5.3 的 ssh 挂载没做对，回查密钥权限。

## 7. 安全变化

| 项 | 现状 | 之后 | 评价 |
|---|---|---|---|
| `/var/run/docker.sock` | 挂载 | **移除** | 改善。docker.sock 挂载 ≈ 宿主机 root；它只服务于 `publish.js`（容器内发布），而发布已移交 GitHub Actions |
| `/opt/blogs` | 挂载 | **移除** | 改善。仅 `publish.js` 需要 |
| `./.state`（token 吊销） | 挂载 | **移除** | 无用，随 auth 一起删 |
| `/root/.ssh/id_rsa` | 挂载 | 改挂 `/home/coder/.ssh/` | 位置调整，权限收紧 |
| 认证 | bcrypt + HMAC token + 限流 + 30 天 cookie | code-server password + session | 能力变弱（无 IP 限流），但可接受——单管理员场景 |
| 可见范围 | 仅 `docs/**.md` | 整个仓库 + 集成终端 | **扩张**。拿到密码 ≈ 拿到全仓库读写与 shell |

最后一行是选择 code-server 的必然代价（已在决策阶段确认）。缓解手段：工作区默认打开 `docs/`，日常写笔记时看不到仓库其余部分；若日后觉得过宽，可改为单挂 `docs/`（代价是 git 操作不可用）。

## 8. 测试策略

1. **删除** `tests/admin/` 下 10 个只测 Fastify 面板的测试（`app` / `auth` / `build` / `files` / `frontmatter` / `paths` / `preview` / `publish` / `tabs` / `tree-expand`）。
2. **改写** `dockerfile.test.mjs` → `tests/admin/deploy.test.mjs`，断言本次决策的安全不变量，防止日后被改回去：
   - compose 中 `auth` 不是 `none`
   - compose 中**没有** `/var/run/docker.sock`
   - compose 中**没有** `/opt/blogs`
   - compose 挂载了 `${SITE_DIR}` 与 `/home/coder/.ssh`
   - Dockerfile 预置了 `known_hosts`
3. **保留** `tests/` 根下 6 个 embed / doc-analysis 测试，它们是 `shared/obsidianEmbed.js` 的回归网，也是 §4.5 迁移是否成功的判据。
4. `pnpm test` 保持是唯一的回归入口。

## 9. 生产上线（本次不执行）

本次只做本地跑通。上线需单独触发，步骤：

1. 生成 `admin/server/config.yaml`（生产密码哈希）
2. rsync `admin/server/` 到服务器（**排除** `config.yaml`、`node_modules`、`.env`；注意 `docker-compose.yml` 沿用现有排除约定，见 §10）
3. 宿主机 Caddy：`handle /admin/*` → `handle_path /admin/*`
4. 停旧容器、起新容器
5. 健康检查 `/admin/` 与站点 `/`

回滚：恢复旧 Caddy 配置并重启旧容器镜像（Fastify 镜像已构建过，`docker-compose.yml` 旧版本在 git 历史中）。

## 10. 需要更新的既有注释

`admin/server/docker-compose.yml` 头部有一段关于「本文件此前与生产版本分叉」的警告，以及 rsync 排除说明。重写 compose 时该注释需一并更新——排除 `docker-compose.yml` 的约定仍然有效（生产 compose 由宿主机侧维护）。

## 11. 验收清单

代码层面：

- [ ] `admin/server/src/`、`public/`、`scripts/`、`node_modules/`、`package.json` 已删除
- [ ] `tests/admin/` 原 11 个测试已删除
- [ ] `shared/obsidianEmbed.js` 就位，7 处 import 已更新
- [ ] `pnpm test` 通过（含 6 个 embed 测试）
- [ ] `pnpm docs:build` 通过
- [ ] `Dockerfile`、`docker-compose.yml`、`config.yaml.example`、`.env.example` 就位
- [ ] `config.yaml` 未入库
- [ ] `tests/admin/deploy.test.mjs` 守住 §7 的不变量

运行层面（本地，§6 清单）：

- [ ] 1–7 项全部通过

## 12. 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| coder 读不到 ssh 私钥 | commit 成功但 push 失败 | §5.3；验收第 5 条专门覆盖 |
| VSCode 预览不渲染 mermaid/公式 | 编辑期预览体验下降 | §4.3 装社区扩展；退路是以站点预览为准 |
| `[[]]` 嵌入显示为纯文本 | 编辑期可读性下降 | 可接受，与 Obsidian 心智模型一致 |
| 生产 Caddy 改错 | 全站 `/admin/` 不可达 | 本地先用同样的 `handle_path` 验证；回滚见 §9 |