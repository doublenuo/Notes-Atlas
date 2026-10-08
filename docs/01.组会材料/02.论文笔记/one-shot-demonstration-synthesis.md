---
date: 2026-09-22 16:16:40
title: One-Shot Real-World Demonstration Synthesis for Scalable Bimanual Manipulation
categories:
  - 论文笔记
tags:
  - 双臂操作
  - 数据生成
  - 机器人操作
permalink: /materials/paper/one-shot-demonstration-synthesis
---
# One-Shot Real-World Demonstration Synthesis for Scalable Bimanual Manipulation

-   Project Link：[https://hnuzhy.github.io/projects/BiDemoSyn/](https://hnuzhy.github.io/projects/BiDemoSyn/)
-   Github Link：[https://github.com/hnuzhy/](https://github.com/hnuzhy/)
-   Paper Link: [https://arxiv.org/pdf/2512.09297](https://arxiv.org/pdf/2512.09297)

## 论文介绍

![论文介绍图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260616164116577.png)

## 模型框架

首先输入的是一条完整的双臂示教轨迹，以倒水任务为例整个任务包含多个连续动作阶段，首先将整条轨迹切分为多个执行块，图中对应编号0到8，随后进一步提取原子执行动作单元，在此基础上，作者将这些动作块划分为两类：

-   不变动作块：这些动作描述的是双臂之间的协作关系，其相对运动模式在不同场景中基本保持不变
-   可变动作块：这些动作主要受到物体位置变化的影响，需要根据新场景进行重新适配

完成任务分解后，第二阶段需要解决场景变化问题，作者采用基于视觉的初始对齐方法，首先检测新场景中的物体位姿，然后将原始示教中的抓取位姿与目标物体建立对应关系，轨迹不是绑定在世界坐标系下，而是绑定在物体局部坐标系下，因此当物体发生平移或旋转时，只需要更新对应坐标变换，就能够快速生成新的轨迹初值，对于左右机械臂分别执行同样的过程，从而得到适配新场景的双臂动作序列。

经过初始对齐后得到的轨迹仍然可能存在执行问题，因此需要进一步优化，主要考虑两类约束：

-   可达性约束：由于场景变化后，某些目标位置可能超出机械臂工作空间，因此需要保证轨迹对应的逆运动学解存在
-   碰撞约束：机械臂与物体、机械臂之间是否碰撞

对于未见过的新物体，通过调整物体高度和物体宽度来实现对不同尺寸实例的适配。

通过遍历不同物体布局，系统自动生成对应的新轨迹，可以从一条示教扩展出大规模双臂数据集

![模型框架图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260616164146059.png)
