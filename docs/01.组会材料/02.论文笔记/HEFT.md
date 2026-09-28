---
date: 2026-09-22 16:16:40
title: HEFT
categories:
  - 论文笔记
tags:
  - 数据生成
  - 运动控制
---
# HEFT: Heavy-Payload Full-size Humanoid Teleoperation with Privileged Motion Guidance and Windowed Payload Curriculum

- Project Link： [https://heft.axell.top/](https://heft.axell.top/)
- Paper Link：[https://arxiv.org/pdf/2607.02332](https://arxiv.org/pdf/2607.02332)
- Github Link: [https://github.com/Axellwppr/motion_tracking](https://github.com/Axellwppr/motion_tracking)

## 模型框架图

首先看左侧的 (a) Dataset。作者使用两类数据：上方的 Mocap Dataset 是人体动作捕捉数据，提供相对干净、物理合理的人体运动；下方的 Raw VR Dataset 是通过 VR 遥操作采集的原始人体运动，其中可能包含脚部滑动、追踪噪声和漂移等问题。对于原始 VR 数据，作者先使用 Human Motion Diffusion 模型进行人体运动重建，得到 Reconstruct VR Dataset，也就是更加平滑、物理合理的 Dataset。随后，原始 VR 动作和重建后的动作都经过 Retarget，将人体动作转换到人形机器人关节空间，形成后续策略训练需要的两种参考：Sraw和Sclean​。这里的关键不是单纯生成动作，而是保留原始 VR 与干净参考之间的对应关系，让机器人训练时学会处理真实遥操作数据中的噪声。

接着看中上方的 (b) Window Payload Curriculum。作者先将 Mocap Dataset 中的动作输入 Motion Expert，训练一个能够跟踪人体运动的专家策略。这个 Motion Expert 负责在仿真中执行各种动作，比如行走、转弯、深蹲、弯腰等。训练完成后，作者把动作按照时间划分成若干个 5 秒窗口，并通过 Payload Rollout 在不同负载下测试专家的执行能力。图中的蓝色阶梯线表示每个时间窗口对应的最大可行负载，也就是 window load cap；红色曲线表示实际训练时采样的负载 sampled load。可以看到，动作前半段可能允许较大的负载，而在深蹲、转弯或其他困难动作阶段，负载上限会降低。因此，HEFT 不采用所有动作共享同一个负载课程，而是先为每个动作窗口估计可行负载范围，再在训练时按窗口采样负载。这样做的目的是让策略针对不同运动阶段学习适合的负载控制能力。

然后看中下方的 (c) Policy Training。这里是 HEFT 的核心策略学习部分。训练输入包括 Sclean​、Sraw、Sprop 。其中，Sclean 是重建后的干净动作参考，Sraw 是原始 VR 参考，Sprop是部署时能够获得的本体感知和参考信息，当前动作窗口采样的负载。上方的 Critic 接收等特权信息，用于 PPO 的价值估计；下方的 Actor 则通过 Encoder 和 Adapter 形成潜变量​。Encoder 利用训练时的干净参考和特权信息得到教师潜变量 ztz_tzt​，Adapter 则根据部署可获得的信息预测 z^t\hat z_tz^t​，并通过图中的 Lmse\mathcal L_{\text{mse}}Lmse​ 约束两者接近。Actor 根据这些潜变量和观测输出机器人动作，PPO 通过奖励函数更新策略，使机器人能够同时完成运动跟踪、平衡控制和负载搬运。

最后看右侧的 (d) Environment。训练好的策略先在仿真环境中执行不同负载的双手搬运任务，图中示意了双手分别承受 0–15 kg 的负载范围。训练完成后，策略部署到真实的全尺寸人形机器人上。真实机器人不再需要训练时的 ScleanS_{\text{clean}}Sclean​、SprivS_{\text{priv}}Spriv​ 或预先知道的负载上限，而是通过原始 VR 参考、本体传感器和历史观测输入 Adapter，估计教师策略所需要的潜变量。图中最下方展示机器人双手各携带 12 kg 壶铃、总负载 24 kg 的真实搬运实验。也就是说，训练阶段通过特权信息帮助策略学会重载运动，部署阶段再用 Adapter 将这些信息替换为真实机器人可获得的观测。

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260916112041804.png)