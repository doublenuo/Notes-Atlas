---
date: 2026-09-23 10:54:14
title: HOVER
categories:
  - 论文笔记
tags:
  - 人形机器人
  - 运动控制
---
# HOVER: Versatile Neural Whole-Body  Controller for Humanoid Robots

- Project Link: [https://hover-versatile-humanoid.github.io/](https://hover-versatile-humanoid.github.io/)
- Paper Link: [https://arxiv.org/pdf/2410.21229](https://arxiv.org/pdf/2410.21229)
- Github Link: [https://github.com/NVlabs/HOVER/](https://github.com/NVlabs/HOVER/)
## 模型框架图


**这篇 HOVER 主要解决的是 humanoid robot 全身控制中控制能力比较割裂的问题。**传统方法通常针对行走、手部操作、关节跟踪、动作模仿等不同任务分别设计控制器或者训练不同的 Policy，这样虽然能够完成单一任务，但是当机器人需要同时完成多个身体部位的控制，或者在不同控制任务之间进行切换时，就需要额外设计控制逻辑。HOVER 的核心思想就是希望训练出一个**统一的、可泛化的 Neural Whole-Body Controller**，让一个 Policy 就能够覆盖多种不同的控制模式，并且能够根据当前的控制目标灵活地决定机器人全身应该如何运动。

它首先解决的是如何把不同类型的控制任务统一表示。**HOVER 构建了一个统一的 Command Space，把机器人的控制目标分成不同类型。例如一种是 **Body Keypoint Tracking**，也就是直接指定头部、躯干、左右手、左右脚等关键点应该到什么位置；另一种是 **Motor Joint Tracking**，直接给出某些关节的目标角度；还有一种是 **Root Tracking**，例如给机器人指定前进速度、侧向速度、竖直速度以及身体高度。因此，原来完全不同的“走路”“抬手”“手部跟踪”“关节控制”等任务，都可以转化成统一形式的 command。

**在这个统一 Command Space 的基础上，HOVER 又引入了两个非常关键的 Mask。**第一个是 **Mode Mask**，它解决的是“现在采用什么类型的控制方式”的问题。例如当前是 Keypoint Tracking、Joint Tracking 还是 Root Tracking。第二个是 **Sparsity Mask**，它解决的是“当前这个控制模式里面，到底控制哪些具体目标”的问题。例如在 Keypoint Tracking 模式下，可以只激活右手，也可以同时激活左右手，甚至可以同时控制手、头和躯干。这里需要特别注意，Sparsity Mask 并不是把没有激活的身体关节直接锁死，而是表示**哪些目标具有显式的 tracking constraint**。即使我只给机器人一个右手目标，Policy 最终输出的仍然是整个机器人的 full-body action，它可能主动调整躯干、腿部和另一只手来维持平衡并完成右手动作，所以这本质上还是一个全身协调控制问题。

接下来就是 HOVER 的训练过程。**作者首先利用人类动作数据，例如 MoCap 数据，通过 motion retargeting 将人体动作转换到 humanoid robot 的运动空间，然后构建大量不同的控制目标。在强化学习阶段，作者训练一个具有 privileged proprioception 的 **Oracle Policy**。这个 Oracle 可以获得更加完整的机器人状态，因此它相当于一个能力比较强的 teacher。训练的时候并不是给 Oracle 一个固定任务，而是不断改变 command、Mode Mask 和 Sparsity Mask，让它在不同的控制模式和不同的目标组合下学习对应的 whole-body motor skill。这样从训练结果来看，Oracle 实际上就形成了一个能够处理多种控制任务的 multi-skill controller。

**这里可以把 HOVER 理解成“学习很多控制能力，然后把这些能力集中到一个统一 Policy 中”，但严格来说并不是训练很多个独立 Policy 再简单拼接。**更加准确地说，它是在一个共享的 Policy 框架下，通过大量不同的 command 和 mask 让 Oracle 学习不同的控制技能，然后再把这些技能蒸馏到最终的 HOVER Policy 中。所以它最终不是 locomotion 一个网络、hand control 一个网络、joint tracking 又一个网络，而是**一个共享参数的条件化 Policy**。输入的 command、Mode Mask 和 Sparsity Mask 决定当前到底需要执行哪一种控制能力。

**然后作者进一步解决了 Oracle 和真实机器人之间的信息差问题。**Oracle 在训练的时候可以使用 privileged information，但是实际部署时机器人不可能获得这些额外信息。因此作者采用了 **policy distillation，并结合 DAgger**。简单来说，首先让 Oracle 在各种状态和控制目标下产生 expert action，然后让 student，也就是最终的 HOVER Policy 去模仿这个 expert。普通的行为克隆容易出现 distribution shift，因为 student 自己执行以后会进入一些训练数据中没有出现过的状态，所以 HOVER 使用 DAgger，让 student 自己运行产生状态，再由 Oracle 对这些状态重新提供正确的 expert action，然后继续训练 student。这样最终得到的 student policy 就能够在只使用实际机器人可以获得的 proprioception 信息的情况下，复现 Oracle 的 whole-body control 能力。

**所以整个 HOVER 的流程可以概括成：Human Motion / MoCap 数据首先经过 Retargeting，形成机器人可以执行的运动数据；然后把不同的控制需求统一转换成 Command Space，并通过 Mode Mask 和 Sparsity Mask 指定当前控制模式以及具体控制目标；接着使用这些不同任务组合训练具有 privileged information 的 Oracle Policy，让 Oracle 学会多种 whole-body motor skills；然后通过 DAgger-based policy distillation，把 Oracle 的多种控制能力压缩到一个共享参数的 HOVER Policy；最后部署的时候不需要根据任务切换不同 Policy，而是只需要改变 command 和 mask，就可以让同一个 Policy 表现出不同的控制行为。**

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260923105633444.png)
![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260923105826690.png)
