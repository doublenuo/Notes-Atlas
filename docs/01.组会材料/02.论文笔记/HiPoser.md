---
date: 2026-09-22 16:16:40
title: HiPoser
categories:
  - 论文笔记
tags:
  - 感知
---
# HiPoser: 3D Human Pose Estimation with Hierarchical Shared Learning at Parts-Level Using Inertial Measurement Units

-   Paper Link: [https://haoxuanli-pku.github.io/papers/AAAI%2025%20-%20HiPoser%203D%20Human%20Pose%20Estimation%20with%20Hierarchical%20Shared%20Learning%20at%20Parts-Level%20Using%20Inertial%20Measurement%20Units.pdf](https://haoxuanli-pku.github.io/papers/AAAI%2025%20-%20HiPoser%203D%20Human%20Pose%20Estimation%20with%20Hierarchical%20Shared%20Learning%20at%20Parts-Level%20Using%20Inertial%20Measurement%20Units.pdf)

## 模型框架

首先看左下角的输入部分。模型输入是来自人体六个位置的 IMU 传感器数据，包括头部、双手、骨盆以及双脚，共六个 IMU。经过预处理后形成长度为 T的时序特征序列 X，作为整个网络的输入。输入序列首先进入层次化共享结构（Hierarchical Shared Structure）。这里作者没有采用 Transformer，而是使用 Mamba 作为核心时序编码器。整个网络由四个连续的子任务组成，每个子任务对应一个人体运动层级。

第一个子任务是躯干姿态估计（Torso Pose）。输入序列首先经过 Mamba Block 提取时序特征，得到隐藏表示。随后通过姿态回归头 预测躯干姿态参数 。第二个子任务是下肢姿态估计（Lower Limbs Pose）。这里不仅使用当前阶段提取的特征 ，同时还接收上一阶段预测得到的躯干姿态信息。作者将躯干信息作为先验共享给下肢预测任务，从而显式建模躯干与腿部之间的运动关联，最终输出下肢姿态 。第三个子任务是上肢姿态估计（Upper Limbs Pose）。与前一个阶段类似，上肢预测不仅利用当前特征 ，还接收前面两个阶段产生的躯干和下肢信息。因此网络能够利用已经估计出的身体状态作为条件，进一步预测双臂姿态。第四个子任务是全局位移估计（Global Translation）。该阶段在已有全身姿态信息基础上，利用隐藏特征预测人体的全局平移参数。

从图中的虚线连接可以看到，前一个任务的输出会不断传递给后续任务。因此整个结构并不是四个独立网络，而是一个逐级共享信息的层次化预测框架。作者认为人体运动本身具有层次依赖关系，因此采用“躯干→下肢→上肢→全局位移”的预测顺序更符合人体运动学规律。最后，在网络顶部，将四个阶段得到的预测结果进行拼接（Concatenate），组合成完整输出。整个网络的核心特点是将全身姿态估计拆解为多个具有运动学依赖关系的子任务，并通过层次化共享机制逐步完成全身人体运动重建。

![HiPoser模型框架图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260609131411759.png)
