---
date: 2026-09-22 16:16:40
title: >-
  Learning a Unified Policy for Position and ForceControl in Legged
  Loco-Manipulation
categories:
  - 论文笔记
tags:
  - 机器人操作
  - 运动控制
---
# Learning a Unified Policy for Position and Force Control in Legged Loco-Manipulation

- Project Link: [https://unified-force.github.io/](https://unified-force.github.io/)
- Paper Link: [https://arxiv.org/pdf/2505.20829](https://arxiv.org/pdf/2505.20829)
- Github Link: [https://github.com/unified-force/UniFP/tree/main](https://github.com/unified-force/UniFP/tree/main)
## 模型框架

这篇工作主要解决的是**腿式机器人在接触丰富的操作任务中，位置控制和力控制难以统一的问题**。传统的机器人控制通常更关注位置跟踪，比如让机械臂末端到达某一个目标位置，但是在推、拉、搬运等任务中，仅仅保证位置是不够的，还需要控制机器人和环境之间的接触力。因此作者提出了 **UniFP，也就是 Unified Force and Position Policy**，希望通过一个统一的策略，同时实现位置控制和力控制，而且不依赖额外的力传感器。

从整个框架来看，这篇工作实际上分成了**底层控制器训练和高层任务策略两个部分**。首先看左上角的强化学习部分，作者在 Isaac Gym 仿真环境中训练 UniFP。策略的输入主要包括 Position Command、Force Command，以及机器人的本体感知信息。本体感知这里包括 Base State、Joint State、上一时刻的 Action，以及一段时间的历史状态。也就是说，机器人不仅知道“我要移动到什么位置、施加多大的力”，还能够结合自己之前的运动状态判断当前的运动和接触情况。

这些信息经过 Encoder 编码以后，会进入两个分支。第一个分支是 Actor，它以 **50 Hz** 的频率输出机器人的控制 Action，再通过底层 PD 控制器作用到机器人关节上。这里 Actor 学习的并不是单纯的关节运动，而是让整个机器人根据 Position Command 和 Force Command 进行协调运动，所以它实际上承担的是一个**统一的全身控制器**。第二个分支是 Estimator，它的作用是根据机器人自身的 proprioception history 来估计当前受到的 External Force。

这里是这篇工作比较关键的地方。因为在仿真训练阶段，我们是知道机器人实际受到的 External Force 的，所以作者把 Estimator 输出的 Estimated Force 和仿真中的真实 External Force 做 MSE Loss，通过监督的方式训练这个力估计模块。同时，Actor 本身通过 PPO 进行强化学习训练。训练过程中，作者还会不断随机采样不同的 Force Command 和 External Force，让机器人经历不同的接触情况。这样训练出来以后，机器人就能够在没有显式力传感器的情况下，仅仅依靠自身的运动状态历史，隐式地估计外界作用力，并进一步调整自己的运动。

然后看左下角的 **Imitation Learning in Real World**。底层 UniFP 训练好以后，作者又在它上面加入了一个 **2 Hz 的 Diffusion Policy**。这个 Diffusion Policy 和底层 UniFP 的作用是不一样的。它不是直接输出关节动作，而是根据真实环境中的 RGB 图像、机器人自身的 Proprioception，以及底层 Estimator 得到的 Estimated Force，生成下一步的 **Position Command 和 Force Command**。所以可以把它理解成一个高层任务策略：Diffusion Policy负责决定“接下来机器人应该往哪里运动、应该施加多大的力”，而 UniFP负责以 50 Hz 的高频率把这个目标真正执行出来。

最后看右侧的真实机器人部署。整个系统形成一个闭环：首先 Diffusion Policy 根据视觉、本体状态和估计的外力生成 Position 和 Force Command；然后 UniFP 根据这些 Command 和实时的本体状态生成全身 Action，再通过 PD 控制机器人。机器人和环境发生接触以后，身体状态会发生变化，这些状态变化再次输入 Force Estimator，得到新的 Estimated Force，然后反馈给上层 Diffusion Policy。这样机器人就形成了一个**视觉感知—力估计—高层决策—全身控制—环境反馈**的闭环。

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260915230919779.png)