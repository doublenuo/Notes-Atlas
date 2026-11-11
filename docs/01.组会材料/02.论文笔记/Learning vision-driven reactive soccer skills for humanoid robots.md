---
date: 2026-11-09 16:16:40
title: Learning vision-driven reactive soccer skills for humanoid robots
permalink: /materials/paper/learning-vision-driven-reactive-soccer-skills-for-humanoid-robots
categories:
  - 论文笔记
---

# Learning vision-driven reactive soccer skills for humanoid robots


- Project Link: [https://humanoid-kick.github.io/](https://humanoid-kick.github.io/)
- Code Link: [https://zenodo.org/records/21620490](https://zenodo.org/records/21620490)
- Paper Link: [https://arxiv.org/pdf/2511.03996](https://arxiv.org/pdf/2511.03996)

## 模型框架图

![模型框架图](https://static.lovetulin.cn/images/2026/11/09/84dbdd40-a374-4cc9-8e10-24e3111b3bae-1794224694-XIfV.webp)

## 核心方法

这篇论文主要研究的是如何让**人形机器人仅依靠视觉感知，在动态足球场景中自主完成搜球、追球和多方向踢球等反应式运动技能**。作者关注的核心问题是，传统运动控制方法往往依赖仿真中的精确状态信息，而真实机器人只能通过摄像头获取视觉观测，容易受到噪声、遮挡和检测失败的影响，因此仿真中训练的策略很难直接迁移到真实环境。

从整体框架来看，论文分为训练和部署两个阶段。在训练阶段，作者首先将机器人本体感知、目标位置和虚拟视觉感知作为输入，其中 Virtual Perception 用于模拟真实摄像头可能出现的噪声和不确定性。随后，通过 Buffer 保存历史观测，再利用 Encoder 提取时序特征，并输入 MLP Actor 输出机器人动作。同时，作者设计了 Decoder，根据编码特征重建训练环境中的特权状态，为视觉特征提取提供辅助监督。在策略优化方面，作者采用 PPO 作为强化学习算法，通过 Multi-Critic 评估当前策略的价值。另外，引入 Discriminator 判别数据集中的参考运动和当前策略生成的运动，将判别结果转化为运动先验奖励，再与足球任务奖励结合，使机器人在学习追球和踢球技能的同时，保持全身运动的协调性。训练完成后，部署阶段只保留 Actor 的推理部分，通过真实摄像头、本体感知和里程计获取观测，经过历史信息编码后直接输出机器人控制动作。

这篇论文比较有价值的地方在于，它没有提出全新的强化学习算法，而是将虚拟视觉感知、历史状态编码、特权状态重建和对抗式运动先验结合起来，解决视觉不确定性下的反应式运动控制问题。实验方面，作者将方法部署到 Booster T1 人形机器人上，实现了自主搜球、追球和多方向踢球，并在不同地形和真实足球场景中进行了验证，展示了较好的仿真到现实迁移能力。