---
date: 2026-10-09 16:16:40
title: I-BFM
permalink: /materials/paper/I-BFM
categories:
  - 论文笔记
tags:
  - 人形机器人
  - 运动控制
---

# I-BFM: Reward-Conditioned Robust Humanoid Interaction via Unsupervised Reinforcement Learning

- Project Link: [https://iamhardworking.github.io/I-BFM/](https://iamhardworking.github.io/I-BFM/)
- Paper Link: [https://arxiv.org/pdf/2610.06129](https://arxiv.org/pdf/2610.06129)
- Github Link: [https://github.com/Roboparty/I-BFM-Code](https://github.com/Roboparty/I-BFM-Code)

## 模型框架图

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261009203218874.png)

## 核心思想

在预训练阶段，按照模型框架图的流程，可以细分为以下几个关键环节：

首先，**数据输入与轨迹嵌入**。模型接收两类运动数据：**交互运动数据**（如搬箱子、推物体）和**基础运动数据**（如行走、转身）。这些数据通过 **Trajectory Embedding** 模块进行编码，图中显示其输出包含状态 $S$、时间 $T$ 以及潜在轨迹变量 $z_T$，它们共同构成了后续学习的行为表示基础。

其次，**前向-后向表示学习与判别器**。核心是学习一个共享的**前向-后向（FB）空间**。**Backward Model** 将状态（包括机器人状态、物体6D位置、接触信息）映射到潜在空间中的点，而 **Forward Model** 则根据当前状态、动作和潜在指令预测未来的状态表示。同时，**Discriminator** 接收来自轨迹嵌入的专家数据（图中蓝色点）和来自 Replay Buffer 的学习策略数据（图中红色点），通过对抗训练区分两者，促使策略生成的行为在分布上接近真实运动。**Disc. Critic ($Q_D$)** 和 **FB Critic ($Q_F$)** 则负责评估策略在给定潜在指令下的表现，图中还引入了一个辅助项 $Q_{aux}$ 与 $Q_D$ 相加，共同指导策略优化。

特别值得注意的是 **LOGO 模块**。它并非简单聚合特征，而是为策略提供**两个不同时间尺度的条件**：一个是**局部目标**（对应即时接触与动作意图），另一个是**长时域目标**（对应最终任务完成，如将箱子搬到某处）。图中 LOGO 的输出以潜在空间中的方向向量表示，并同时输入给评论家网络（$Q_D$ 和 $Q_F$）以及策略网络，使策略在闭环交互中能同时兼顾即时接触和长期任务规划，这是提升鲁棒性的关键。

**在奖励推理与执行阶段（右侧）。** 当面对一个新任务时，用户只需定义一个简单的奖励函数（如搬运分为Approach→Lift→Transport→Place），模型便能利用学习到的前向-后向表示，在Replay Buffer中推断出最大化该奖励的潜在指令向量 $z$。随后，策略网络（Policy）根据当前观测和潜在指令 $z$ 输出动作 $a_t$，直接在环境中闭环执行。框架图右侧展示了同一策略在搬运、推、踢以及复杂任务链（Chain）上的成功演示。
  