---
date: 2026-09-22 16:16:40
title: Learning to Plan & Schedule with Reinforcement-Learned Bimanual Robot Skills
categories:
  - 论文笔记
tags:
  - 双臂操作
  - 机器人操作
  - 强化学习
---
# Learning to Plan & Schedule with Reinforcement-Learned Bimanual Robot Skills

-   Paper Link: [https://arxiv.org/abs/2510.25634](https://arxiv.org/abs/2510.25634)

## 模型框架图

![image-20260322173408683](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260322173408743.png)

## 核心方法

### 问题定义

作者将长时程双臂操作任务形式化为一个**两层的层次化决策问题**，其核心思想是将任务分解为高层技能调度与低层技能执行，并引入**时间扩展动作**，使高层决策不再局限于每一步的原子动作，而是可以调度持续多个时间步的技能。

低层MDP被定义为单个技能的学习，每个原始技能被建模成一个**目标条件化的马尔可夫决策过程**，定义为
$$
<S,A,T,R_k,\gamma,\Omega>
$$

-   $w_t\in\omega$表示技能参数，作为该MDP的目标
-   $R_k$表示与技能相关的稠密奖励函数，用于引导策略向参数$w_t$指定的子目标前进

每个技能的低层策略被定义为
$$
\pi_k(a_t|s_t,w_t)
$$
高层调度问题被定义为一个**半马尔可夫决策过程**，其中每个动作对应一个技能$k_t$及其参数$w_t$,执行时会持续多个时间步,高层调度策略被定义为
$$
\pi^{H}(k_t,w_t|s_t,g)
$$
最终的分层策略是高层策略与对应低层策略的乘积，即
$$
\pi(s_t|a_t,g)=\pi^{H}(k_w,w_t|s_t,g)\times\pi^{k_t}(a_t|s_t,w_t)
$$

### 低层策略

作者训练了 **5 种原始技能**，每个技能都通过一个**目标参数**$w_t$来指定任务目标位置、朝向和完整位姿。

-   单臂 rotating
-   双臂 rotating
-   双臂 pushing
-   双臂 pick-and-place

每个技能使用**强化学习PPO算法**进行训练，所有技能共享一个**统一的稠密奖励函数模板**，但可根据具体技能调整系数，奖励函数被设计为
$$
r_t=r_{\text{contact}}+r_{\text{goal}}+r_{\text{succ}}-r_{\text{energy}}
$$

-   $r_{\text{contact}}$表示鼓励末端执行器靠近物体的接触奖励
-   $r_{\text{goal}}$表示稠密的目标接近奖励
-   $r_{\text{energy}}$表示能量惩罚项，鼓励节能的运动
-   $r_{\text{succ}}$表示稀疏的成功奖励

### 高层策略

高层策略采用 **Transformer 架构**，采用行为克隆的方式使用专家演示数据进行训练，输入是**一段最近的历史观测序列**，同时输出左右臂离散的技能索引$k_t$和连续的技能参数$w_t$。

首先通过一个state encoder将原始观测$s_t$和任务目标 $g_t$转换为模型可处理的**嵌入向量**,然后经过obs trunks对**历史观测序列**进行时序建模，捕捉时间依赖关系,最后通过Action Head将时序编码后的特征映射为最终的双臂的技能索引和技能参数。

## 创新点

1.   传统方法将长时程双臂操作建模为**纯序列决策**,作者提出将其重构为**集成式规划与调度问题**,使高层决策能够同时为双臂分配技能，支持**并行执行、异步协作、顺序协作**三种行为模式;
2.   低层通过强化学习训练一组**可参数化的单臂**和**双臂原始技能**，每个技能都是目标条件化的，可泛化到连续目标空间，高层调度使用**Transformer-based 调度策略**，同时预测双臂的**离散技能类别**和**连续技能参数**；
