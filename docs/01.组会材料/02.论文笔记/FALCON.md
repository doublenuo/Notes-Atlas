---
date: 2026-09-22 16:16:40
title: FALCON
permalink: /materials/paper/falcon
categories:
  - 论文笔记
tags:
  - 人形机器人
  - 强化学习
  - 机器人操作
  - 运动控制
---
# FALCON: Learning Force-Adaptive Humanoid Loco-Manipulation

- Project Link: [https://lecar-lab.github.io/falcon-humanoid](https://lecar-lab.github.io/falcon-humanoid)
- Paper Link: [https://arxiv.org/pdf/2505.06776](https://arxiv.org/pdf/2505.06776)
- Github Link: [https://github.com/LeCAR-Lab/FALCON](https://github.com/LeCAR-Lab/FALCON)
## TLDR

FALCON是一种双智能体强化学习框架，它将运动和操作解耦，并分别设置奖励，从而实现高效训练。在学习过程中，一个考虑扭矩限制的三维力训练模型会逐步增强末端执行器的外部力，在确保安全性的同时，最大限度地提高力适应性。
## 模型框架图

![FALCON模型框架图](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260728230441098.png)