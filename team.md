---
title: team-book
description: 
published: true
date: 2026-06-24T07:56:34.496Z
tags: 
editor: markdown
dateCreated: 2026-06-24T07:56:34.496Z
---

# Git 同步配置指南

本文档介绍如何配置 Wiki.js 与 GitHub 的 Git 同步功能。

## 📌 前置要求

- Wiki.js v2.5+ 已安装
- 拥有 GitHub 仓库的管理权限
- 服务器已安装 Git 2.7.4+

## 🔧 配置步骤

### 1. 生成 SSH 密钥

在服务器上执行：

```bash
ssh-keygen -t rsa -b 4096 -f /etc/wiki/github_key
```

### 2. 添加公钥到 GitHub

1. 复制公钥内容：
   ```bash
   cat /etc/wiki/github_key.pub
   ```
2. 进入 GitHub 仓库 → Settings → Deploy Keys
3. 点击 "Add deploy key"，粘贴公钥
4. **务必勾选 "Allow write access"**

### 3. 配置 Wiki.js

在 Wiki.js 后台：

- **存储** → **Git**
- 认证类型: `SSH`
- 仓库 URI: `git@github.com:用户名/仓库名.git`
- 分支: `main`（或你的默认分支）
- SSH 私钥路径: `/etc/wiki/github_key`
- 同步方向: **双向**
- 同步计划: `*/5 * * * *`（每5分钟）

### 4. 测试同步

点击 **"立即同步"**，检查状态是否为绿色。

## 🐛 常见问题

### 问题：Permission denied (publickey)
**解决**：检查私钥权限，确保 `chmod 600` 且文件所有者正确。

### 问题：仓库内容不同步
**解决**：确认分支名称正确，检查同步方向设置。

---

*相关文档: [运维手册](/ops) | [常见问题](/faq)*