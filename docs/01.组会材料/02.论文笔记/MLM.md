# MLM: Learning Multi-task Loco-Manipulation  Whole-Body Control for Quadruped Robot with Arm

- Paper Link: [https://arxiv.org/pdf/2508.10538](https://arxiv.org/pdf/2508.10538)
## 论文介绍

这篇论文核心上是在四足机器人和机械臂，如何通过一个统一策略，同时完成移动和操作（manipulation），并且还能支持多任务切换。

## 模型框架

首先，作者通过遥操作采集机械臂末端 TCP 轨迹和图像数据，并训练扩散模型生成未来的操作轨迹，这些轨迹随后被构建成轨迹库，训练过程中，系统通过课程采样动态调整不同任务轨迹的采样概率，从简单任务到复杂任务来缓解多任务学习的任务干扰问题。

论文最核心的模块是 TVP，由于真实机器人属于部分可观测系统，仅依赖当前 observation 容易导致控制滞后和不稳定，因此作者利用历史 observation、历史 action 和 task trajectory 预测未来运动趋势，包括 future velocity 和 future trajectory latent，使策略具备 predictive control 能力。随后，整个系统采用 unified whole-body policy，同时输出机械臂和四足腿部动作。

论文采用非对称actor-critic 结构，actor 使用真实部署可获得的 proprioception 和 trajectory condition，critic 则额外利用 privileged state 和 terrain information 来提升稳定性。

![MLM论文框架图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260511181840835.png)
