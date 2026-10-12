#!/bin/sh
set -e

# git 提交身份：从环境读取，缺省跳过（commit 时会提示，不影响首次启动）
if [ -n "$GIT_USER_NAME" ]; then
  git config --global user.name "$GIT_USER_NAME"
fi
if [ -n "$GIT_USER_EMAIL" ]; then
  git config --global user.email "$GIT_USER_EMAIL"
fi

# 部署私钥权限（push 用，ro 挂载可能带 0644，git 拒绝，需收紧）
chmod 600 /root/.ssh/id_rsa 2>/dev/null || true

# 扩展安装到持久化目录（/root/.local/share/code-server 已挂到宿主机）。
# 首次启动（目录为空）时安装 markdown 编辑/预览扩展；已装则跳过（幂等）。
# 注意：不能在 Dockerfile 里装——挂载持久化目录会遮蔽镜像内的扩展。
if ! ls /root/.local/share/code-server/extensions/ 2>/dev/null | grep -q "markdown-all-in-one"; then
  echo "[entrypoint] 安装 markdown-all-in-one 扩展..."
  code-server --install-extension yzhang.markdown-all-in-one
fi

# 启动 code-server：绑定 0.0.0.0:8477（宿主机 Caddy 反代 blogs.lovetulin.cn/admin/*，
# 由 Caddy 端 uri strip_prefix 去掉 /admin 前缀后转发到根路径）。
# code-server 4.x 已移除 --base-path，子路径统一由反向代理 strip prefix 处理。
# 密码认证由 PASSWORD 环境变量提供，工作目录为 /workspace（vault）。
exec code-server --bind-addr 0.0.0.0:8477 --auth password /workspace
