---
date: 2026-11-16 9:18:03
title: GPC
permalink: /materials/paper/gpc
categories:
  - 论文笔记

tags:
  - 人形机器人
  - 运动控制
---


# GPC: Large-Scale Generative Pretraining for Transferable Motor Control

- Project Link: [https://xbpeng.github.io/projects/GPC/](https://xbpeng.github.io/projects/GPC/)
- Github Link: [https://github.com/NVlabs/ProtoMotions](https://github.com/NVlabs/ProtoMotions)
- Paper Link: [https://arxiv.org/pdf/2606.29148](https://arxiv.org/pdf/2606.29148)

## 模型框架图

![](https://static.lovetulin.cn/images/2026/11/16/6dcd0ef4-c7b2-46ea-ade7-3d68c583fb16-1794797739-J4QU.webp)

## 解决的问题

为物理模拟角色训练控制器，使其能以自然、拟人的方式完成广泛任务，是物理角色动画走向电影、游戏、XR 等实际应用的关键瓶颈，现有基于离散 token 的方法多依赖 VQ-VAE，需要维护显式码本，并引入码本嵌入更新、辅助损失、死码重初始化等启发式，在大规模数据上训练复杂且不稳定。如何在大规模运动数据上简化 token 化训练流程，同时获得一个**可复用、可迁移的通用运动控制器**，是 GPC 要回答的核心问题。

## 核心方法

GPC 采用**两阶段与轻量微调**的框架，把 LLM 式的离散化 → 下一 token 预测 → 下游适配范式迁移到物理角色运动控制中。

### 技能量化

这个阶段主要任务是用 FSQ 端到端 RL 学运动词汇表，使用 Finite Scalar Quantization 将连续运动技能离散化为 token，并与一个运动跟踪策略**端到端**联合优化，FSQ 不需要显式码本，从而绕开了 VQ-VAE 的码本更新、辅助损失和死码问题，训练显著简化且更稳定。

### 生成式控制器训练

在 FSQ 离散 token 序列上训练一个 GPT 风格自回归 Transformer，通过 next token 预测建模运动技能的分布，训练完成的生成式控制器可以直接在物理仿真中自回归地产生控制信号，无需参考运动片段，即具备随机生成能力，并能涌现出对扰动的响应行为和跌倒恢复行为。

### 任务适应

提出条件低秩适应（Conditional Low-Rank Adaptation, CoLA） 等一套轻量微调技术，将冻结的预训练生成式控制器适配到下游任务时，只添加不到 1% 的额外参数，即可在保留预训练自然运动先验的同时完成任务特化，CoLA 同时支持监督微调（SFT）和强化学习微调（RLFT），前者缓解大规模技能空间中的探索低效问题，后者用于优化任务特定奖励。

