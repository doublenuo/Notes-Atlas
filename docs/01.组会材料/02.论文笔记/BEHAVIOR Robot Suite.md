---
date: 2026-09-22 16:16:40
title: BEHAVIOR Robot Suite
permalink: /materials/paper/behavior-robot-suite
categories:
  - 论文笔记
tags:
  - 机器人操作
---
# BEHAVIOR Robot Suite: Streamlining Real-World Whole-Body Manipulation for Everyday Household Activities

- Project Link: [https://behavior-robot-suite.github.io/](https://behavior-robot-suite.github.io/)
- Github Link: [https://github.com/behavior-robot-suite/brs-ctrl](https://github.com/behavior-robot-suite/brs-ctrl)
- Data Link: [https://huggingface.co/datasets/behavior-robot-suite/data](https://huggingface.co/datasets/behavior-robot-suite/data)
- Paper Link: [https://arxiv.org/abs/2503.05652](https://arxiv.org/abs/2503.05652)
- Docs Link: [https://behavior-robot-suite.github.io/docs/](https://behavior-robot-suite.github.io/docs/)
## 论文介绍图

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261009195939586.png)

论文整体都围绕以下三种能力来实现的，图中也展示了模型在星海图 R1 机器人的三大核心能力：

- 双手协调能力
- 稳定精确的导航能力
- 稳健的手臂末端执行器操作能力

## 创新点

1. 开发了一种 **低成本的全身遥操作接口 JoyLo**，在具有灵活躯干的轮式双臂机械臂上具体实现
2. 创造了 WB-VIMA **面向高自由度移动机械臂的全身控制学习模型**，可以有效地模拟协调的全身动作

## 模型框架

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261009195957154.png)
