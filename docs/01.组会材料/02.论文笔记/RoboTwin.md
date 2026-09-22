---
date: 2026-04-24 11:51:53
title: RoboTwin
permalink: /meet/robotwin
---
# RoboTwin 2.0: A Scalable Data Generator and Benchmark with Strong Domain Randomization for Robust Bimanual Robotic Manipulation

- Project Link: [https://robotwin-platform.github.io/](https://robotwin-platform.github.io/)
- Github Link: [https://github.com/robotwin-Platform/RoboTwin](https://github.com/robotwin-Platform/RoboTwin)
- Paper Link: [https://arxiv.org/pdf/2506.18088](https://arxiv.org/pdf/2506.18088)
- Data Link: []
- Docs Link: [https://robotwin-platform.github.io/doc/](https://robotwin-platform.github.io/doc/)

## 论文介绍

RoboTwin2.0 是一个可扩展的模拟框架, 可以实现自动化、大规模生成多样化和真实的数据, 以及用于双臂操纵的统一评估协议。

现有的仿真数据合成需要解决的问题：

- 缺乏自动化的质量控制，如果没有专家级的验证循环, 许多生成的轨迹包括执行失败或次优掌握, 这会降低策略学习的效果；
- 域随机化通常是不够的，产生过于干净和同质的场景, 忽略了现实世界的基本因素；
- 忽略了跨身体差异，不同的双臂机器人在运动能力和抓取策略方面可能存在很大差异。

论文的贡献包括：

- 开发了一个自动化专家数据生成框架, 将多模态大语言模型与循环仿真反馈相结合, 以确保高质量的专家级轨迹；
- 提出了一种系统的域随机化策略, 通过增加数据多样性和模拟到真实的泛化来增强策略的鲁棒性；
- 引入了一种实施例感知的适应机制, 该机制根据对象可供性生成机器人特定的操作候选者；
- 发布了 RoboTwin-OD 资产库、大规模预收集的多实施例域随机轨迹数据集、可扩展的双手数据生成器和标准化评估基准, 以支持跨不同机器人实施例、场景配 置和语言指令的可扩展策略的可扩展训练和评估。

![RoboTwin2.0](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260403104810236.png)

## 方法流程

![RoboTwin2.0-Method](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260403110033500.png)
