# 设计:NotesAtlas 后台管理系统(登录 + 文档 CRUD + 自动重建)

- 日期:2026-09-28
- 状态:已批准(方案 A:自研轻量后端 + 静态管理 SPA;服务器即真源)
- 关联:VitePress 站点 `doublenuo/Notes-Atlas`、服务器 `web:/opt/blogs`(Caddy 容器)

## 1. 背景与目标

站点是纯静态 VitePress,当前部署为"本地构建 → `rsync --delete` → `docker cp`"单向推送,
服务器上没有任何可写入口。需求:一个**登录后可管理服务器上文档目录、增删改查并让改动生效**的后台。

**定案(澄清结果)**:
1. **服务器即真源**:服务器持有 git 仓库 `/opt/notes-atlas`,后台保存即 commit、自动重建发布;本地改为 `git push/pull srv main`,**rsync 推送流程退役**;GitHub 降级为可选备份(服务器不存其凭据)。
2. **范围**:文档 CRUD + 目录树 + 目录 CRUD + frontmatter 表单化;**不做媒体上传**(媒体仍仅本地放入)。
3. **认证**:单管理员账号(用户名+bcrypt 密码)+ 签名会话 cookie。
4. **路线**:方案 A 自研(否决 B:Wiki.js 类 DB 真源与文件真源冲突;否决 C:Strapi/Directus 过重)。

**非目标**:多用户/RBAC、媒体上传、WYSIWYG 可视化编辑、GitHub Actions 集成(deploy.yml 去留另议)、移动端后台。

## 2. 总体架构

```
本地编辑器 ──git push srv──▶ 服务器仓库 /opt/notes-atlas(唯一真源)
                                 │
  浏览器 /admin/ ──/admin/api/*──▶ 后端容器(node:20,notes-admin:8477)
   (同域静态 SPA)                │  保存=commit;chokidar 监听→构建队列
                                 ▼
              docs:build → 仓库 dist → 归档API入容器 → caddy:/opt/blogs
                                 ▼
        https://blogs.lovetulin.cn(静态站)   /admin/(同域路径)
```

- **仓库**:`/opt/notes-atlas`,非 bare,`receive.denyCurrentBranch=updateInstead`
  (本地 `git remote add srv web:/opt/notes-atlas` 后 `git push srv main` 直接更新服务器工作树)。
- **后端容器**:源码在仓库 `admin/server/`(自带 Dockerfile + compose.yaml),容器内监听 `0.0.0.0:8477`、宿主不发布端口
  (仅共享 Caddy 可反代,公网不可直连);挂载 `/opt/notes-atlas:/srv/site` 与 `/var/run/docker.sock`
  (发布必须经 docker.sock 拷入容器——实现用 Docker 归档 API `PUT /containers/<id>/archive`,语义等价 `docker cp -a dist/.`,镜像内不装 docker CLI;实测 Caddy 容器静态目录无 bind mount;docker.sock 等同 root,
  风险接受条件:单管理员自用、API 仅经 HTTPS+登录可达)。
- **Caddy**:共享 Caddyfile(`/data/stacks/caddy/Caddyfile`)仅新增一段
  `handle_path /admin/api/* { reverse_proxy notes-admin:8477 }`(后端容器加入既有外部网络 `caddy-network`,按容器名直连;宿主不发布端口,公网不可直连);改前备份(沿用 `.bak-日期` 惯例)、
  `caddy validate` 通过后 `caddy reload`(graceful 零停机),不改动既有 handle。
- **管理 UI**:独立 Vite+Vue3 工程 `admin/ui/`,产物输出 `docs/public/admin/`(gitignore),
  随 `docs:build` 一并发布到 `/admin/`。**无任何 CDN**(服务器为国内网络环境)。
- **`docs:build` 脚本改为先构建 admin UI 再构建站点**(本地与服务器同一入口,`npm run docs:build` 语义不变)。

## 3. 认证设计

- env(root-only 文件 `admin/server/.env`,gitignore):`ADMIN_USER`、`ADMIN_PASS_HASH`(bcrypt)、
  `TOKEN_SECRET`、`CADDY_CONTAINER=caddy`。
- 密码哈希库用 `bcryptjs`(纯 JS,免 alpine 原生编译)。
- 登录成功签发 HMAC-SHA256 自签 token(`crypto` 内置实现,`payload.b64.signature`,含 `{user,exp}`),
  写 cookie:`na_admin`,`httpOnly; Secure; SameSite=Strict`,有效期 30 天;登出时服务端把
  "当前时刻"记为全局失效点(持久化到 `admin/server/.state/revoke`,gitignore),`iat` 早于该时刻的
  token 一律拒绝——容器重启不复活旧会话。
- 登录限流:内存计数 10 次/分/IP,超限 429。
- 除 `/api/login` 外一切 `/admin/api/*` 未带有效 token → 401。
- 站点内容页与 `/admin/`(静态外壳)不需认证;无 token 时外壳只显示登录表单。

## 4. 后端 API(Fastify,全部前缀 `/admin/api`)

| 方法/路径 | 入参 | 出参/行为 |
|---|---|---|
| `POST /login` | `{user, pass}` | 成功 204 + Set-Cookie;失败 401;限流 429 |
| `POST /logout` | - | 204,写入全局失效点(§3) |
| `GET /tree` | - | `{nodes:[{type:"dir"\|"file",name,path,children?}]}`,根=`docs/`,仅 `.md` 与目录 |
| `GET /file?path=` | 相对 `docs/` 的路径 | `{content, frontmatter, mtime}` |
| `PUT /file` | `{path, content}` | 落盘 + git commit;204;路径非法 400 |
| `POST /file` | `{path}` | 新建(模板 frontmatter),父目录必须存在;已存在 409 |
| `DELETE /file?path=` | - | 删除 + commit;204 |
| `POST /dir` | `{path}` | 建目录;204 |
| `DELETE /dir?path=&force=` | `force=1` 允许非空 | 空目录或 force 才删;204 |
| `POST /rename` | `{from,to}` | 文件/目录改名 + commit;204 |
| `GET /build/status` | - | `{state, queued, startedAt, durationMs, log, lastCommit, publishedAt}` |
| `GET /build/lastlog` | - | 完整日志尾部 8KB |

- **树排除**:`.vitepress`、`public`、`admin`、`node_modules`、`@fragment`、`superpowers`、一切隐藏目录;文件白名单 `.md`。(排除即"站点不发布":`@fragment` 为插件暂存、`superpowers` 被 `srcExclude`;`@pages` 是真实发布页,有意保留。)
- **路径安全**:入参 `path.normalize` + 解析为绝对路径后必须以 `docs/` 为前缀、不以 `..` 逃逸、
  不含 `\0`;已存在目标落盘前再做 `fs.realpath` 复核父目录仍在 `docs/` 内(防符号链接逃逸)。
  违规 400(单测覆盖每类逃逸)。
- **frontmatter**:服务端用 `gray-matter` 解析/回写;表单只读写已知简单字段
  `title`(string)、`date`(string,形如 `2026-09-28 10:00:00`)、`tags`(string[])、
  `categories`(string[])、`sticky`(number|boolean);**其余键(如 `index.md` 的 `hero`/`layout`
  嵌套结构)按解析后的对象原样透传,序列化时保留**。回写不改动正文。
- **git**:每次写操作 `git add -A docs && git commit -m "admin(<op>): <path>"`(服务器本地,不 push)。
- **构建队列**(状态机,单飞行):`idle → queued → building → success|failed`;
  变更源=chokidar 监听 `docs/**.md`(覆盖后台保存与本地 push 两条路,防抖 5s);
  构建中再触发 → 标记 `queued` 于当前构建后补跑一次。

## 5. 构建发布管线

1. 队列消费:`npm run docs:build`(cwd=`/srv/site`,超时 10 分钟,捕获 stdout+stderr 日志)。
2. **构建成功** → 把 dist 拷入容器(实现:经 docker.sock 调 Docker 归档 API `PUT /containers/<id>/archive`,等价 `docker cp /srv/site/docs/.vitepress/dist/. <CADDY_CONTAINER>:/opt/blogs/`)→
   更新 `publishedAt`。**容器内文件只在成功时更新 = 站点永远是"最后成功版本",构建失败对外无感。**
3. **构建/发布失败** → 状态 `failed` + 日志进后台;**不自动 revert git**(错误留管理员修复,
   修复保存即自动重跑);`build/status` 轮询(2s)驱动 UI 状态条。
4. 本地 push 与后台保存走同一监听,无第二触发路径。

## 6. 管理 UI(admin/ui,Vue3+Vite,单页无路由)

- **状态切换**:未登录 → `LoginForm`;已登录 → 主界面(不引入路由库)。
- **主界面**:
  - 左侧 `FileTree`:目录展开/收起、新建文件/目录、删除(二次确认)、重命名(二次确认,防断链)。
  - 右侧 `EditorView` 三区:frontmatter 表单(已知 5 字段 + "其他键仅透传"提示)、
    Markdown 源码 `textarea`、实时预览(markdown-it,`html:false` 防预览 XSS);
    表单与源码缓冲区双向同步(表单改动即写回缓冲区)。
  - 顶部 `BuildStatus`:`idle/queued/building(耗时)/success/failed`,失败可展开日志抽屉。
- **交互**:未保存切换文件/刷新拦截(`beforeunload` + 内部确认);新建文档自动套模板
  (`title`=文件名、`date`=当前时间、`tags: []`、`categories: []`);`/admin/` 不进站点导航。
- **组件切分**:`LoginForm`、`FileTree`、`EditorView`、`BuildStatus`、`api.js`(fetch 封装,401 → 回登录)。

## 7. 错误处理与安全边界

- 全部异常返回 `{code, message}`,HTTP 语义码(400/401/404/409/429/500);日志含请求路径但**绝不含密码/token**。
- 路径穿越、扩展白名单、目录排除(§4);登录限流(§3);cookie httpOnly(SameSite=Strict)。
- API 宿主不发布端口(仅 `caddy-network` 内按容器名可达),经 Caddy HTTPS 暴露;Caddy reload 前 `caddy validate`,失败即中止不重载。
- 磁盘:构建输出与 git 对象增量已核(服务器 `/` 余 5.5G,构建产物 154M 同分区);
  备份:`Caddyfile.bak-*`、迁移期仓库基线 commit。

## 8. 迁移步骤(执行计划给确切命令)

1. 本地收拢未提交改动 → commit(不 push GitHub)。
2. 服务器 `git init /opt/notes-atlas` + `receive.denyCurrentBranch=updateInstead` + 本地
   `git remote add srv` + `git push srv main` + 服务器 checkout;服务器 `pnpm install --frozen-lockfile`(仓库为 pnpm 管理,`package-lock.json` 已失效、不使用)
   (**构建需要 devDependencies,勿设 `NODE_ENV=production`**)。
3. `admin/server` 构建镜像、compose 起容器(env 文件就位),健康检查 `/admin/api/login` 401/405 通。
4. 备份共享 Caddyfile → 加反代段 → `caddy validate` → `caddy reload`(graceful)。
5. 服务器侧 `npm run docs:build` + 发布一次,产物与现站 diff 应仅新增 `admin/` 静态文件。
6. **rsync 推送退役**;本地工作流改 `git push srv main`(服务器仓库为 origin 语义)。
7. GitHub 远端保留为手动备份通道(何时 push 由用户决定,deploy.yml 去留另议)。

## 9. 测试与验收

- **后端**(`node --test`,与现有 37 用例同框架):登录成功/失败/限流、401 拦截、
  五类路径逃逸(`../`、绝对路径、`\0`、符号链接前缀、编码型)、tree 排除规则、
  frontmatter 表单往返(含 `hero` 嵌套键保真)、建删改名的 409/400 分支、
  构建队列状态机(idle→queued→building→success、构建中二次触发→补跑一次、failed 不发布)。
- **验收清单**:①手机/桌面访问 `/admin/` 登录进入;②建/改/删/改名各一,git log 出现对应 commit;
  ③保存后状态条转 building→success,站点对应页面内容更新;④故意写坏 frontmatter YAML→ failed +
  日志可见 + 站点保持旧版;⑤本地 `git push srv` 同样触发重建;⑥Caddy 其他站点回归正常;
  ⑦登出后 API 全 401;⑧本地 `npm test` 37+新增全绿、`docs:build` exit 0。

## 10. YAGNI 记录

不做:媒体上传、多用户、RBAC、GitHub Actions 集成、富文本 WYSIWYG、版本对比 UI
(git log/`git show` 已是安全网,按需后补)、搜索(客户端 tree 过滤足够)。
