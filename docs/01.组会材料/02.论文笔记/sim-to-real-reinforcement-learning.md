---
date: 2026-09-22 16:16:40
title: >-
  Sim-to-Real Reinforcement Learning for Vision-Based Dexterous Manipulation on
  Humanoids
categories:
  - 论文笔记
tags:
  - Sim2Real
  - 强化学习
  - 机器人操作
  - 人形机器人
permalink: /materials/paper/sim-to-real-reinforcement-learning
---
# Sim-to-Real Reinforcement Learning for Vision-Based Dexterous Manipulation on Humanoids

- Project Link：[https://toruowo.github.io/recipe/](https://toruowo.github.io/recipe/)
- Paper Link：[http://arxiv.org/abs/2502.20396](http://arxiv.org/abs/2502.20396)
## 论文介绍

![论文介绍图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260602134328952.png)

## 模型框架

首先是 A 模块 Real-to-Sim Modeling，也就是现实到仿真的建模过程。作者认为仿真与现实之间最大的差异来源于机器人动力学参数的不准确，因此提出了自动化参数校准方法。具体来说，首先在真实机器人上采集运动数据，然后在仿真环境中使用不同参数进行重放，通过比较真实轨迹与仿真轨迹之间的均方误差，不断优化机器人模型参数，包括关节刚度、关节阻尼、电机输出能力以及连杆质量等参数，最终找到误差最小的一组参数，从而获得与真实机器人更加一致的仿真环境。同时，对于操作物体，作者并没有追求高精度几何建模，而是采用球体、圆柱体、立方体等简单几何体进行近似表示，以降低建模成本并增强策略泛化能力。

接下来是 B 模块 Generalizable Reward Design，也就是通用奖励函数设计。作者发现，大多数操作任务本质上都可以被拆解为两个目标。第一个是 Contact Goal，即机器人是否与目标物体建立了正确接触；第二个是 Object Goal，即物体是否达到了期望状态。因此作者将操作任务奖励统一表示为 Contact Goal 和 Object Goal 两部分的组合。在图中可以看到，作者使用 Contact Markers 来定义物体上的关键接触区域，当机器人手部接触这些区域时获得接触奖励；而当物体被移动到目标位置、达到目标高度或者完成双手交接时，则获得目标奖励。这样无论是抓取、搬运、举箱子还是双手交接任务，都能够使用统一的奖励设计框架，避免针对每个任务重新设计复杂奖励函数。

然后是 C 模块 Sample Efficient Policy Learning，也就是高样本效率策略学习。由于人形机器人具有大量自由度，如果直接训练一个统一策略，强化学习的探索空间非常大，训练效率较低。因此作者采用了 Divide-and-Conquer Distillation 的思想。首先将复杂任务划分为多个子任务，例如接近物体、建立抓取、抬升物体等，并分别训练对应的专家策略，也就是图中的 Sub-task Specialists。随后通过轨迹筛选机制保留高质量专家轨迹，并利用蒸馏方法将多个专家策略融合为一个统一的 Generalist Policy。除此之外，作者还设计了 Task-Aware Hand Pose Initialization，根据任务类型初始化手部位置，使机器人在训练开始时双手已经位于合理区域附近，从而减少无效探索并提高训练效率。

最后是 D 模块 Vision-Based Sim-to-Real Transfer，也就是基于视觉的仿真到现实迁移。作者希望最终策略能够直接利用视觉输入完成操作，因此采用 RGB-D 相机作为主要感知来源。具体流程是先利用 Segment Anything 2 对目标物体进行分割，从 RGB 图像中提取目标区域，同时结合深度图生成对应的分割深度信息，从而获得物体的稠密视觉特征。除此之外，作者还提取了物体三维质心位置，也就是图中的三维中心坐标，作为一种稀疏状态表示。最终将稠密视觉特征和稀疏状态信息进行融合，形成 Hybrid Object Representation，并作为策略网络输入。通过这种方式，策略既能够利用视觉感知能力，又能够获得稳定的低维状态信息，从而提升视觉策略在真实环境中的迁移性能。

整个训练流程可以概括为：首先通过自动参数校准建立高保真仿真环境，然后利用接触目标与物体目标构建统一奖励函数，在此基础上采用分治式专家学习与策略蒸馏获得高效的通用策略，最后结合视觉感知与物体状态融合实现从仿真到真实机器人的迁移部署，最终完成双手抓取、搬运以及双手交接等复杂人形机器人操作任务。

![模型框架图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260602134556449.png)