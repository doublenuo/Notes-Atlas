# AdaptManip: Learning Adaptive Whole-Body Object Lifting and Delivery with Online Recurrent State Estimation

- Project Link：[https://morganbyrd03.github.io/adaptmanip/](https://morganbyrd03.github.io/adaptmanip/)
- Paper Link: [https://morganbyrd03.github.io/adaptmanip/AdaptManip-Arxiv.pdf](https://morganbyrd03.github.io/adaptmanip/AdaptManip-Arxiv.pdf)
## 论文介绍

![AdaptManip论文介绍](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260520160018723.png)
## 模型框架

这篇论文提出了一个分阶段训练的自适应全身搬运框架，核心目标是在未知负载条件下实现稳定的举起、搬运与递送。整个方法首先训练一个基础全身控制策略 π_wbc。在这一阶段，机器人并不进行搬运任务，而是在大量随机速度指令下学习稳定行走与全身平衡控制。策略输入主要是机器人本体感觉信息，例如关节状态、IMU以及足端接触信息，输出则是全身关节动作。通过强化学习训练后，机器人获得了稳定的 locomotion 和 whole-body coordination 能力，相当于先学习“如何稳定运动”。

在此基础上，论文进一步训练一个 manipulation residual policy，也就是残差操作策略 π_res。这里作者并没有重新训练整个控制器，而是在基础策略输出动作 a_t 的基础上，再额外学习一个补偿动作 Δa_t，最终控制量为 a_t + Δa_t。训练过程中，机器人开始执行真实搬运任务，并随机化物体质量、重心以及惯性等参数。残差策略主要学习如何针对负载变化进行动态补偿，例如调整身体前倾、改变步态宽度以及稳定上半身姿态。这样做的好处是，基础 locomotion 能力不会被破坏，而 manipulation policy 只需要关注负载适应问题，从而提高训练稳定性与泛化能力。

此外，论文还设计了一个基于 LSTM 的在线循环状态估计器，用于实时估计未知物体的动力学状态。估计器输入包括视觉观测以及机器人本体感觉信息，例如身体振动、关节力矩和运动响应等，再通过 LSTM 建模历史时序信息，最终输出估计的物体状态，例如质量、重心和惯性。这个估计结果会实时输入残差策略 π_res，使机器人能够在搬运过程中动态调整动作。因此整个系统形成了“在线估计 + 自适应补偿”的闭环控制框架，实现了未知负载条件下的自适应全身搬运。

![AdaptManip模型框架](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260520160052920.png)

