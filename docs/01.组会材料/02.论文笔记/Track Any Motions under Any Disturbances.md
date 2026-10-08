---
date: 2026-09-22 16:16:40
title: Track Any Motions under Any Disturbances
permalink: /materials/paper/track-any-motions-under-any-disturbances
categories:
  - 论文笔记
tags:
  - 运动控制
---
# Track Any Motions under Any Disturbances

- Project Link: [https://zzk273.github.io/Any2Track/](https://zzk273.github.io/Any2Track/)
- Paper Link: [https://arxiv.org/pdf/2509.13833](https://arxiv.org/pdf/2509.13833)
- Github Link: [https://github.com/GalaxyGeneralRobotics/OpenTrack](https://github.com/GalaxyGeneralRobotics/OpenTrack)

## 模型框架图

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260715105628762.png)

这篇论文其核心思想是将动作跟踪和扰动适应解耦。整个框架主要由两部分组成：左侧的 AnyTracker 和右侧的 AnyAdapter。首先，在 AnyTracker 阶段，作者对人体动作数据进行重定向、筛选、分类和聚类，构建高质量的参考动作库。随后，针对不同类别的动作分别训练多个 Specialist Policy，再利用 DAGGER 将这些专家策略蒸馏成一个统一的 Generalist Policy。这一阶段是在无扰动环境下完成的，目的是让机器人先学习高精度的动作跟踪能力，实现 Track Any Motion。

随后，仅额外训练一个 World Model 和一个 Adapter。其中，World Model 的输入是机器人过去一段时间的状态和动作序列，首先经过 History Encoder 提取历史运动特征，再结合当前状态输入世界模型，预测下一时刻的机器人状态。在此基础上，Adapter 利用当前机器人状态、目标运动信息以及 World Model 提供的环境特征，对冻结策略网络的隐藏特征进行残差修正。这里并不是直接修改策略输出的动作，而是在每一层网络特征中学习一个补偿量，并与原有特征相加，从而动态调整策略生成的动作，使机器人能够根据当前环境变化做出更加合理的控制决策。整个训练过程中，强化学习算法只更新 Adapter 的参数，而基础策略始终保持不变，因此既保留了 Generalist Policy 已经学到的高质量运动跟踪能力，又赋予了机器人快速适应未知扰动的能力。

在训练过程中，作者还在仿真环境中随机施加多种扰动，包括外部推力、地形变化、地面摩擦变化、身体质量变化、质心偏移以及关节惯量变化等，使 Adapter 在强化学习过程中不断学习如何补偿这些扰动。最终形成了一个既能够跟踪任意参考动作，又能够在各种未知扰动下保持稳定跟踪的统一框架。

