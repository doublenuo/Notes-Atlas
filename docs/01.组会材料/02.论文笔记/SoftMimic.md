---
date: 2026-10-12 16:16:40
title: SoftMimic
permalink: /materials/paper/softmimic
categories:
  - 论文笔记
---

# SoftMimic: Learning Compliant Whole-body Control from Examples

- Project Link: [https://gmargo11.github.io/softmimic/](https://gmargo11.github.io/softmimic/)
- Github Link: [https://github.com/Improbable-AI/softmimic](https://github.com/Improbable-AI/softmimic)
- Paper Link: [https://arxiv.org/pdf/2510.17792](https://arxiv.org/pdf/2510.17792)

## 模型框架图

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261012221621117.png)

## 核心思想

这篇论文 SoftMimic 主要解决的是人形机器人在运动模仿过程中柔顺性不足的问题。传统的运动跟踪方法通常要求机器人严格跟踪参考轨迹，当机器人受到外力或者与环境发生接触时，往往会强行纠正动作偏差，导致机器人产生较大的对抗力，甚至影响整体平衡。作者希望机器人在保持原有动作风格的同时，能够根据外力主动调整动作，并且可以控制自身的柔顺程度。

整个方法分为两个阶段。
- 首先是柔顺动作增强模块，作者以原始参考动作作为输入，通过设置外部作用力和目标刚度，利用逆运动学求解器调整机器人的全身关节，生成受到不同外力时的柔顺动作示例。这里不仅要调整受到外力影响的局部关节，还要考虑全身协调、足部接触和身体平衡，从而得到合理的训练数据。
- 第二个阶段是强化学习策略训练。作者利用前面生成的柔顺动作示例训练一个统一的全身控制策略，让机器人学习在受到外力时应该如何调整关节动作，而不是始终回到原始参考轨迹。训练完成后，可以通过调整目标刚度来控制机器人的柔顺程度：刚度较低时，机器人更容易顺应外力发生偏移；刚度较高时，机器人则会表现出更强的抵抗能力。最终，作者通过外力扰动、不同尺寸箱子的抓取以及全身运动等实验，验证了方法在柔顺交互和任务适应方面的效果。