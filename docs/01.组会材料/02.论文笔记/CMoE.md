---
date: 2026-10-09 16:16:40
title: CMoE
permalink: /materials/paper/cmoe
categories:
  - 论文笔记
tags:
  - 人形机器人
  - 运动控制
---

# CMoE: Contrastive Mixture of Experts for Motion Control and Terrain Adaptation of Humanoid Robots

- Project Link: [https://hoshi-no-ai.github.io/CMoE/](https://hoshi-no-ai.github.io/CMoE/)
- Paper Link: [https://arxiv.org/pdf/2603.03067](https://arxiv.org/pdf/2603.03067)
- Github Link: [https://github.com/Hoshi-No-Ai/CMoE](https://github.com/Hoshi-No-Ai/CMoE)

## 模型框架图

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261009205939691.png)

## 核心思想

这篇论文的核心思路是保留 MoE 的多专家控制结构，同时引入对比学习，让专家激活模式与地形特征建立更明确的对应关系，从而提升人形机器人在复杂地形下的运动适应能力。整个方法采用单阶段强化学习训练，不需要先单独训练多个策略再进行蒸馏融合。

首先，框架左侧是状态估计与地形编码模块。系统输入包括机器人自身的关节角度、关节速度、机身角速度等本体感知信息，以及描述周围地形高低变化的高度图。作者使用基于 β-VAE 的编码器提取历史状态特征并估计机身速度，同时使用自编码器提取高度图特征，为后续控制提供机器人状态和环境信息。接下来是中间的 MoE 控制模块。作者将五个专家融入 PPO 的 Actor-Critic 架构，由门控网络根据机器人状态和地形信息计算各个专家的激活权重，再对专家输出进行加权融合，生成最终动作。专家并不是预先指定对应某种地形，而是在训练过程中逐渐形成不同的控制能力。这篇论文最核心的创新是地形对比学习。普通 MoE 的门控网络不一定能够根据地形形成有效的专家分工，因此作者将门控激活特征与高度图特征进行对比匹配，并利用可学习的原型向量和受 SwAV 启发的聚类分配机制，让两类特征形成更一致的聚类结构。这样，门控网络就能更好地区分不同地形，并动态调整专家权重。