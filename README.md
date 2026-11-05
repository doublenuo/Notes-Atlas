# 🧠 欢迎来到我的学习宇宙 🚀

![Status](https://img.shields.io/badge/Status-Active-2ea44f?style=flat-square)
![Type](https://img.shields.io/badge/Type-Knowledge%20Base-0969da?style=flat-square)
![Focus-AI](https://img.shields.io/badge/Focus-AI-8a2be2?style=flat-square)
![Focus-Robotics](https://img.shields.io/badge/Focus-Robotics-ff8c00?style=flat-square)
![Focus-Linux](https://img.shields.io/badge/Focus-Linux-fcc624?style=flat-square&logo=linux&logoColor=black)
![Maintained](https://img.shields.io/badge/Maintained-Yes-31c653?style=flat-square)
![Notes](https://img.shields.io/badge/Notes-Continuously%20Updated-1f6feb?style=flat-square)

一个正在**持续进化**的技术学习基地（偶尔严肃，经常踩坑，长期更新）

## 👋 这里是什么？

这里不是教程站，也不是博客。

这是一个**正在生长的学习系统**：

* 📚 记录我真正学过的东西
* 🔬 拆解论文与技术原理
* 🛠️ 积累项目实践经验
* 🤖 探索 AI/机器人/强化学习/深度学习的可能性
* ☕ 顺便和未来的自己对话

如果某篇内容帮到了你 ——说明我当时至少掉进过同一个坑。

## 🧭 学习导航（从这里开始）

### 🤖 AI & Robotics

* 🧠 **深度学习** — 模型结构 / 训练技巧 / 原理理解
* 🎯 **强化学习** — Policy、Value、RL Tricks
* 🤖 **ROS** — 机器人系统实践
* 🦾 **具身智能** — AI × Robotics × Environment
* 📄 **论文阅读** — 精读 + 人话翻译

👉 建议从你当前最需要的方向进入，而不是按顺序阅读。

---

## 🔥 最近在折腾什么？

* ⚙️ Linux环境深度定制
* 🤯 强化学习训练问题
* 🤖 机器人真机部署问题

## 🧪 项目实践区

理论不会自动变强。

所以这里还有：

* 💻 实验项目
* 🧱 Demo 构建记录
* 🐛 踩坑日志（含真实痛苦）
* 🚧 未完成但值得记录的尝试

👉 **项目区 = 真正的成长记录**

---

## 🧰 软件与工具资源

我长期使用并持续优化的工具集合：

* 🐧 Linux 工作流
* ✍️ LaTeX 排版
* ⚡ 开发效率工具
* 🔧 环境配置方案

目标只有一个：

> 少折腾配置，多折腾思想。

## 🧩 关于这个站点

这里不会追求：

* ❌ 日更
* ❌ 流量
* ❌ 完美排版

这里只追求**长期有效的知识沉淀。**

## 🔍 预览部署

项目已配置 Vercel 预览部署：

1. 从 `main` 创建 `feature/xxx` 分支并推送到 GitHub。
2. Vercel 会自动构建该分支并生成 Preview URL；创建 Pull Request 后，URL 也会显示在 PR checks 中。
3. 验收 Preview 站点后合并到 `main`，Vercel 会将 `main` 部署为 Production。

首次使用时，需要在 Vercel 中导入 `doublenuo/Notes-Atlas` 仓库，并将 Production Branch 设置为 `main`。构建配置已由根目录 `vercel.json` 提供。

评论系统使用 Twikoo。部署前请配置 `TWIKOO_ENV_ID` GitHub Actions Secret；它的值应为 Twikoo 云函数或自建服务的环境 ID。Vercel 部署则在项目的 Preview 和 Production 环境变量中配置 `VITE_TWIKOO_ENV_ID`。未配置时站点仍可构建，但评论区无法初始化。

### 使用 Rclone 增量同步图片到腾讯云 COS

Rclone 配置一次即可复用：

```bash
rclone config
```

选择 S3 兼容协议，填写腾讯云 COS 的 Endpoint、SecretId 和 SecretKey。配置完成后，在仓库根目录执行：

```bash
COS_BUCKET=my-blog-bucket pnpm sync:images
```

该命令等价于：

```bash
rclone sync ./docs/public/images/ cos:my-blog-bucket/images/ --progress --checksum
```

它会只同步发生变化的文件，并删除 COS 中本地已删除的对应文件，保持两端一致。GitHub Actions 中可选启用自动同步：设置仓库变量 `COS_BUCKET`，以及 Secrets `COS_ENDPOINT`、`COS_ACCESS_KEY_ID`、`COS_SECRET_ACCESS_KEY`；未设置时会跳过该步骤。

生产构建默认使用 COS 图片地址。可配置 `COS_IMAGE_BASE_URL` Secret/环境变量为图片桶的公开访问前缀，例如 `https://picupload-1330431167.cos.ap-guangzhou.myqcloud.com`。图床异常时设置 `USE_LOCAL_IMAGES=true` 后重新构建即可一键回滚到本地图片；未设置时会使用 COS。

---

## ☕ 如果你读到了这里

那我们大概是同类人：

* 喜欢理解原理而不是背答案
* 愿意长期投入学习
* 相信技术是复利

欢迎随便逛逛。

也许未来某一天，你会回来找一篇曾经救过你的笔记。

---

<p align="center">
    <i>Last deployed somewhere between curiosity and caffeine.</i>
</p>
