# code-server：浏览器里的完整 VS Code，替代原 fastify 后台。
# 全程 root 运行（与原 admin 一致，避免 /opt/notes-atlas 属主权限问题）。
FROM codercom/code-server:latest

USER root

# 工具：git（提交/推送）+ openssh-client（ssh-keyscan 与私钥）
# 官方镜像基于 Debian（bookworm-slim），用 apt-get。
RUN apt-get update \
  && apt-get install -y --no-install-recommends git openssh-client \
  && rm -rf /var/lib/apt/lists/*

# 扩展不在镜像里安装：/root/.local/share/code-server 会被持久化卷挂载遮蔽，
# 改为 entrypoint.sh 首次启动时装到持久化目录（见 entrypoint.sh）。

# git 推送 GitHub 的 known_hosts（消除首次 push 的 host key 确认）
RUN mkdir -p /root/.ssh && ssh-keyscan github.com >> /root/.ssh/known_hosts

# 工作目录：挂载 vault（/opt/notes-atlas）
WORKDIR /workspace

# 自定义 entrypoint：配置 git 身份 + 启动
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8477

ENTRYPOINT ["/entrypoint.sh"]
