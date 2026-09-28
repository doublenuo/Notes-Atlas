---
date: 2026-09-22 16:16:40
title: GentleHumanoid
categories:
  - 论文笔记
tags:
  - 人形机器人
---
# GentleHumanoid: Learning Upper-body Compliance for Contact-rich Human and Object Interaction

- Project Link: [https://gentle-humanoid.axell.top/#/](https://gentle-humanoid.axell.top/#/)
- Paper Link: [https://arxiv.org/abs/2511.04679](https://arxiv.org/abs/2511.04679)
- Github Link: [https://github.com/Axellwppr/gentle-humanoid](https://github.com/Axellwppr/gentle-humanoid)
- Traning Code: [https://github.com/Axellwppr/gentle-humanoid-training](https://github.com/Axellwppr/gentle-humanoid-training)
## 模型框架图

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260715105620858.png)

传统的人形机器人控制一般都是直接跟踪一条固定的参考轨迹，也就是说，无论机器人是否受到外力干扰，目标轨迹都是不变的。当机器人与人或者物体发生接触时，就容易产生较大的接触力，导致交互比较僵硬。

这篇论文的核心思路是：把阻抗控制整合进全身运动跟踪策略中，让机器人上半身具备可调的柔顺能力。论文把每个连杆的运动建模为一个简单的质量-弹簧-阻尼系统，这篇论文最大的创新就是不再把参考轨迹看成固定的，而是让参考轨迹本身具有动力学特性，它同时受到两种力的作用：
- **Driving Force**，它负责把参考轨迹拉回到原始的人体动作目标，因此保证机器人能够完成任务；
- **Interaction Force**，也就是机器人与环境接触时产生的外力。当机器人受到外部作用力时，这个参考轨迹会随着外力发生偏移，而不是保持固定

论文采用二阶动力学模型描述这一过程，随后通过积分得到下一时刻的参考位置，因此最终得到的是一个能够根据接触实时调整的动态参考轨迹，而不是固定轨迹。训练阶段，Policy的输入主要包括三部分：第一部分是机器人自身状态，也就是 Proprioception，例如关节角度、速度以及IMU信息。第二部分是 Privileged Observation，包括接触力、人或物体的状态等，这些信息只在训练阶段使用，用来提高学习效率。第三部分是刚才通过 Reference Dynamics 生成的目标运动。Policy根据这些输入输出机器人动作，并在仿真器中执行。仿真器会得到机器人当前状态以及实际接触力，然后分别与参考动力学生成的参考状态和参考接触力进行比较，计算Reward，再利用强化学习不断优化Policy。
