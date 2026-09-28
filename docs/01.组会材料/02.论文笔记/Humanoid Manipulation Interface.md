---
date: 2026-09-22 16:16:40
title: Humanoid Manipulation Interface
categories:
  - 论文笔记
tags:
  - 人形机器人
  - 遥操作
---
# Humanoid Manipulation Interface: Humanoid Whole-Body Manipulation from Robot-Free Demonstrations

- Project Link: [https://humanoid-manipulation-interface.github.io/#/](https://humanoid-manipulation-interface.github.io/#/)
- Github Link: [https://github.com/Richard-coder-Nai/HuMI](https://github.com/Richard-coder-Nai/HuMI)
- Paper Link: [https://arxiv.org/pdf/2602.06643](https://arxiv.org/pdf/2602.06643)
- Data Link: [https://huggingface.co/collections/Richard-Nai/humi](https://huggingface.co/collections/Richard-Nai/humi)

### 论文介绍

HuMI 由两个组件组成:一个机器人自由演示系统和一个分层策略学习框架，首先,作者以全身轨迹和图像观察的形式收集人类演示数据。这些数据用于训练高层操作策略,其中扩散策略将图像观察映射为以目标关键点轨迹表示的动作。相同的数据也用于训练低层控制器,该控制器输出机器人关节角度以跟踪高层策略生成的目标轨迹。通过将高层策略与低层控制器集成,所得系统利用机载传感器观察实现人形全身操作。

### 模型框架

这篇论文提出了一个名为 HuMI 的人形机器人全身操作框架，核心目标是在不使用真实机器人的情况下，仅通过人类自然动作演示，让人形机器人学习复杂的全身协同操作能力。论文首先分析了两个关键难点：第一，人类动作无法直接映射到机器人，例如人类下蹲时的姿态在人形机器人上可能会出现关节折叠异常等不可执行问题；第二，人类与机器人在身体结构、关节长度和运动范围上存在明显差异，仅靠简单缩放会导致动作空间错位，因此需要专门的动作适配方法。

在数据采集部分，作者设计了一套轻量化的人体动作采集系统。操作者佩戴 HTC VIVE 动作追踪器获取全身姿态信息，同时双手持有手柄设备记录抓取和操作动作。系统能够同步采集人体的手臂、躯干和腿部运动，并通过人在回路中的运动学适配实时调整动作，使采集到的数据更加符合人形机器人的运动约束。相比传统依赖真实机器人遥操作的方法，这种方案成本更低、效率更高，而且能够更容易采集大幅度的全身动作。

在数据处理阶段，论文将训练数据分为高层数据和低层数据两部分。高层数据主要包括腕部摄像头图像以及人体关键点轨迹，用于学习任务相关的操作意图；低层训练数据则是通过逆运动学计算后得到的人形机器人全身运动数据，包括机器人各关节的位置、速度以及对应的全身姿态轨迹，将这些轨迹转换为机器人可执行的全身运动数据。这种分层处理方式既保留了视觉信息中的任务语义，又保证了机器人动作的稳定性与可实现性。

整个控制框架采用分层控制结构。高层使用扩散策略网络，根据腕部相机图像和机器人状态预测未来一段时间的目标动作轨迹；低层则使用全身控制器，以更高频率实时跟踪这些目标轨迹，并结合机器人当前的惯性信息、关节位置和速度，输出最终的关节控制指令。相比传统只关注机械臂末端控制的方法，该框架能够实现手臂、躯干和双腿之间的全身协同，从而完成下蹲抓取、动态操作以及移动中的复杂操作任务。

![Humanoid Manipulation Interface数据采集系统](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260512101643044.png)
