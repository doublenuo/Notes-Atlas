---
date: 2026-09-22 16:16:40
title: B-spline Policy
permalink: /materials/paper/b-spline-policy
categories:
  - 论文笔记
---
# B-spline Policy: Accelerating Manipulation Policies via B-spline Action Representations

- Project Link: [https://b-spline-policy.github.io/](https://b-spline-policy.github.io/)
- Paper Link: [https://arxiv.org/pdf/2607.09648](https://arxiv.org/pdf/2607.09648)
- Github Link: [https://github.com/B-spline-policy/bspline-policy](https://github.com/B-spline-policy/bspline-policy)
- Colab Link: [https://colab.research.google.com/drive/1MzbUGoL9r5J144sn0jVOqA6yHd6ma5iS?usp=sharing](https://colab.research.google.com/drive/1MzbUGoL9r5J144sn0jVOqA6yHd6ma5iS?usp=sharing)

## 模型框架图

首先，机器人获取当前的观测信息，包括RGB图像和本体感知信息(关节位置$q_1\sim q_n$),这些信息作为 Policy 的输入。将观测输入到 B-spline Policy, B-spline Policy 不直接预测这些离散动作，而是预测一段 B-spline 曲线参数,包括控制点和节点向量，这些参数共同定义了一条未来运动轨迹。因此，策略学习的是一条连续轨迹，而不是一个固定长度的动作序列。

由于每一次推理都会重新预测一段新的 B-spline 曲线，因此相邻两段曲线之间可能存在一定的不连续。因此论文增加了一个 Segment Alignment 模块。它会将当前预测的 B-spline Segment 与上一段轨迹进行拼接，使两段轨迹能够更加平滑地连接。得到连续 B-spline 曲线之后，并不会直接执行，而是进行时间缩放，这里改变的不是轨迹形状，而是轨迹的参数化速度。机器人可以根据需求动态提高执行效率，而无需重新预测动作。最后，由于 B-spline 是连续曲线，因此可以按照任意频率进行采样。机器人控制器实际接收到的是更加密集、更加平滑的控制命令。

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260715110105025.png)