FROM node:22-alpine

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 复制源码
# shared/ 是 obsidianEmbed.js 的落点:站点与 admin 预览共用的单一事实来源。
# preview.js 以 ../shared/obsidianEmbed.js 引用,故必须打进镜像——不能指望从
# /opt/notes-atlas 挂载引入,那里的 vault 是旧 commit,没有 docs/.vitepress/plugins/。
COPY src ./src
COPY shared ./shared
COPY public ./public
COPY Caddyfile ./Caddyfile

# 创建状态目录
RUN mkdir -p .state

EXPOSE 8477

CMD ["node", "src/index.js"]
