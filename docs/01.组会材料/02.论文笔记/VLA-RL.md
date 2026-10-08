---
date: 2026-09-22 16:16:40
title: VLA-RL
permalink: /materials/paper/vla-rl
categories:
  - 论文笔记
tags:
  - VLA
  - 强化学习
  - 机器人操作
---
# VLA-RL: Towards Masterful and General Robotic Manipulation with Scalable Reinforcement Learning

- Github Link: [https://github.com/GuanxingLu/vlarl](https://github.com/GuanxingLu/vlarl)
- Paper Link: [https://arxiv.org/abs/2505.18719](https://arxiv.org/abs/2505.18719)
## 论文介绍

传统的 VLA 模型通过模仿学习从离线演示数据中学习，无法有效应对未在数据中出现过的状态，这篇论文通过在线 RL 引入探索机制，使模型能够在测试时通过与环境交互不断提升表现；其次在机器人操作任务中，环境通常只在任务完成时给出一个奖励信号，也就是稀疏奖励问题，导致 RL 训练困难，作者提出的 RPRM 模型能够为中间步骤提供密集奖励，有效引导学习过程；最后通过一些工程优化的手段实现在大规模 VLA 上的高效 RL 微调。

![VLA-RL 论文介绍图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260326133305800.png)

## 创新点

- **轨迹级 RL 建模**：将机器人操作任务建模为多模态、多轮对话，使得 RL 可以适配自回归 VLA 的结构；
- **机器人过程奖励模型**：解决稀疏奖励问题；
- **工程优化**：GPU 负载均衡、批量解码、critic warmup 等等

## 模型框架

基础预训练模型选用 OpenVLA-7B，每个时间步 $t$，它将第三人称相机捕获的图像 $o_t$ 和人类指令 $v_t^{\mathrm{in}}$ 作为输入并输出动作令牌序列 $v_t^{\mathrm{out}}$，其中每个动作令牌表示机器人动作空间离散的一维。使用后处理函数 $f$ 从该序列中提取最终机器人动作 $a_t=f(v_t^{\mathrm{out}})$.

![VLA-RL 模型框架图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260326133336939.png)

### 问题定义

首先将马尔可夫决策过程公式化为多轮对话，空间 $V_m$ 和 $V_n$ 分别代表可能的输入和输出文本序列，其中 $m$ 和 $n$ 指定输入和输出的最大序列长度，状态空间定义为 $S=O\times V_m$，其中 $O$ 表示图像空间，动作空间由 VLA 生成的所有可能的输出话语的集合 $V_n$ 给出，VLA 策略就可以这样表示

$$
\pi_{\theta}: O\times V_m \to V_n
$$

在每个时间步，策略 $\pi_{\theta}$ 是一个概率分布 $\pi_{\theta}({V_t^{\mathrm{out}}|o_t,\theta}(V_t^{\mathrm{in}})$，且使用 PPO 算法进行稳定的训练。

### 整体流程

首先初始化环境，初始化预训练 VLA 模型的参数 $\theta_0$，初始化过程奖励模型的参数 $\phi$，加载后处理函数 $f$，步长 $M$，折扣因子 $\gamma$，优势函数的参数 $\lambda_{\mathrm{GAE}}$，在 N 个并行的环境中 rollout 收集一下轨迹数据，对于每个时间步

![VLA-RL 算法流程](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260328221514199.png)

