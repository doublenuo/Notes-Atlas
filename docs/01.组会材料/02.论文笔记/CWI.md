---
date: 2026-09-22 16:16:40
title: CWI
permalink: /materials/paper/cwi
categories:
  - 论文笔记
tags:
  - 数据生成
  - 机器人操作
  - 运动控制
---
# CWI: Composite Humanoid Whole-Body Imitation System for Loco-manipulation

- Project Link: [https://cwi-ral.github.io/CWI-RAL-Webpage/](https://cwi-ral.github.io/CWI-RAL-Webpage/)
- Paper Link: [https://arxiv.org/abs/2606.27676](https://arxiv.org/abs/2606.27676)

## 模型框架图

MoCap Dataset包含原始全身动捕数据，经过运动重定向和解耦处理后分成两路：一路进入上肢数据集，保留了完整的 AMASS 上肢轨迹，用于上肢操作跟踪；另一路进入下肢数据集，这里只保留了精选的Walk和Squat片段，每种大约10条高质量片段。下肢数据分别喂给两个 AMP 判别器：分别接收行走片段的状态转移序列 $τ^M_{walk}$ 和下蹲片段的状态转移序列 $τ^M_{squat}$ ,两个判别器都是小型神经网络结构，用 LSGAN Loss 训练。在策略训练时，根据速度指令来选择激活哪个判别器，输出风格奖励 $r_{style}$ 。

三个独立的 critic 网络分别负责：处理上肢操作奖励 $r_{mani}$ 、处理运动任务奖励 $r_{loco}$ 、处理风格奖励 $r_{style}$ 。三个 critic 各自计算 GAE 优势，避免了单 critic 在多目标间的优化冲突。

教师策略接收特权信息（完整状态、本体感知、完整上肢参考），通过 PPO Loss 训练。学生策略只接收本体感知和简化命令（双手关键点 pose），通过 PPO Loss + BC Loss联合训练。图中红色箭头表示 BC Loss 让学生模仿教师的动作输出。

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260715105613018.png)

