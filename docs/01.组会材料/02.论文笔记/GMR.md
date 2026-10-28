---
date: 2026-04-24 11:51:53
title: GMR
permalink: /materials/meet/gmr
categories:
  - 论文笔记
tags:
  - 运动控制
  - 数据生成
---
# Retargeting Matters: General Motion Retargeting for Humanoid Motion Tracking

- Github Link: [https://github.com/YanjieZe/GMR](https://github.com/YanjieZe/GMR)
- Paper Link: [https://arxiv.org/abs/2510.02252](https://arxiv.org/abs/2510.02252)
- Video Link: [https://www.bilibili.com/video/BV1p1nazeEzC/?share_source=copy_web&vd_source=c76e3ab14ac3f7219a9006b96b4b0f76](https://www.bilibili.com/video/BV1p1nazeEzC/?share_source=copy_web&vd_source=c76e3ab14ac3f7219a9006b96b4b0f76)
- **作者**：Joao Pedro Araujo、Yanjie Ze、Pei Xu、Jiajun Wu、C. Karen Liu
- **机构**：Stanford University

## 一句话总结

这篇论文的核心观点是：**运动重定向质量本身会决定后续 humanoid motion tracking policy 的学习难度和最终鲁棒性，不能把 retargeting 产生的错误全部留给 RL 去修正。** 作者提出 GMR，通过人体-机器人 rest pose 对齐、非均匀局部缩放和两阶段逆运动学优化，生成更接近原始人体动作、同时更适合机器人运动约束的参考轨迹。

论文使用同一个 BeyondMimic 训练流程，在不额外调奖励的前提下比较 PHC、ProtoMotions、GMR 和 Unitree 的 retargeted motion。结果表明：GMR 的策略成功率、跟踪误差和人类感知一致性都明显优于两个开源基线，并接近 Unitree 的闭源高质量数据。

## 1. 为什么 retargeting 是关键问题

人体动作数据通常先经过 retargeting 变成机器人可以使用的根部位姿和关节轨迹，再用于训练运动跟踪策略。常见的工作流默认 RL 可以在训练中自动修正 retargeting 误差，但这会产生两个问题：

- 参考轨迹如果包含物理上不可能的状态，策略需要在“跟踪参考”和“保持平衡/满足接触约束”之间做冲突决策；
- 为了让策略学会这些带伪影的动作，往往需要额外的 reward engineering、domain randomization 和大量参数调试。

论文重点研究三个问题：

1. retargeting 方法是否会影响 motion tracking policy 的性能？
2. 哪些 retargeting 伪影会显著降低策略的鲁棒性？
3. 不同 retargeting 方法对原始人体动作的视觉/感知忠实度如何？

作者的实验假设是：如果抑制过多的奖励调参和随机化，retargeting 质量的差异会直接反映在策略表现中。

## 2. 相关方法的局限

### PHC

PHC 将人体动作转换为 SMPL 形状，再使用梯度下降优化机器人根部位姿和关节角，使机器人关键身体的位置尽量匹配目标位置。它的特点是直接、容易复用，但存在几个问题：

- SMPL 的人体形状不一定能准确表示形态差异很大的机器人；
- 主要依赖位置匹配，未充分处理接触状态；
- 生成的足部可能漂浮、滑动或穿过地面；
- 通过整体缩放和后处理修正高度时，可能产生很大的浮空误差。

### ProtoMotions

ProtoMotions 使用 Mink differential IK，把源动作的笛卡尔位置按世界坐标轴做全局缩放，再最小化关键身体的位置和姿态误差。它比简单复制关节角更灵活，但全局轴向缩放无法同时适应人体不同身体区域与机器人对应部位的比例差异，极端动作中还可能出现腿部自相交等问题。

### Unitree

Unitree 提供了用于 BeyondMimic 等工作的高质量闭源 retargeted dataset。论文无法获得其具体算法，因此把它作为“高质量上限”或实际系统基线，而不是可复现的方法基线。

## 3. GMR 总体流程

GMR 的单帧 retargeting 流程可以概括为：

1. 定义人体和机器人关键身体的对应关系；
2. 对齐二者在 rest pose 下的笛卡尔姿态；
3. 对人体动作进行非均匀局部缩放，得到机器人关键身体目标；
4. 用第一阶段 differential IK 优先满足身体朝向和手脚末端位置；
5. 用第二阶段优化同时细化所有关键身体的位置和姿态；
6. 对连续序列逐帧求解，并使用上一帧结果初始化下一帧；
7. 通过前向运动学检查身体高度，修正浮空和穿地。

GMR 的重点不是使用复杂的学习模型，而是把人体-机器人几何差异、优化目标的优先级和动作后处理明确地放进 retargeting 流程。

## 4. GMR 的关键设计

### 4.1 人体-机器人关键身体匹配

用户首先提供人体骨架和机器人骨架的 key body 映射，通常包括：

- pelvis 或 torso；
- head；
- 左右腿和脚；
- 左右臂和手。

每一对匹配身体可以设置位置误差权重和姿态误差权重。代码中的配置还支持为人体参考身体添加位置偏移和局部旋转修正。

这种显式 mapping 让 GMR 不依赖人体与机器人具有完全相同的拓扑结构，也支持机器人只有 revolute joint、人体数据却带有 $SO(3)$ 关节旋转的情况。

### 4.2 Rest pose 的笛卡尔对齐

人体和机器人即使在“站立”状态下，身体局部坐标系的方向也可能不同。例如脚部可能存在 toed-in 或坐标轴朝向不一致的问题。如果直接比较原始姿态，IK 会把坐标系差异错误地当成真实动作。

GMR 先计算人体和机器人 rest pose 中对应身体的方向差异，再对人体身体姿态施加补偿；必要时也为特定身体加入局部位置偏移。这样后续优化比较的是对齐后的动作，而不是两个骨架定义方式之间的差异。

### 4.3 非均匀局部缩放

这是 GMR 相比 PHC 和 ProtoMotions 最核心的改变。作者观察到，许多 retargeting 伪影不是 IK 本身造成的，而是在源人体动作缩放阶段引入的。

如果只使用一个全局缩放因子，人体和机器人下肢、躯干、上肢之间的比例差异会被错误地平均。例如机器人腿更长而手臂相对更短时，统一缩放会使某些末端目标落在不合理的位置，进而导致脚滑、身体偏移或关节极端姿态。

GMR 为每个关键身体设置局部缩放因子 $s_b$，并根据源人体高度 $h$ 与参考高度 $h_{ref}$ 进行整体归一化。对于身体 $b$，目标位置为：

$$
p_b^{target}=
\frac{h}{h_{ref}}s_b(p_j^{source}-p_{root}^{source})
+\frac{h}{h_{ref}}s_{root}p_{root}^{source}.
$$

其中第一项描述相对根部的局部身体位置，第二项描述根部的全局位移。根部位置可以写成：

$$
p_{root}^{target}=\frac{h}{h_{ref}}s_{root}p_{root}^{source}.
$$

作者特别强调，根部平移也必须使用与动作一致的统一尺度，否则即使脚端位置在局部看起来合理，根部运动也会与脚的运动不一致，最终产生足部滑动。

这种缩放不是把所有关节长度硬拉到机器人尺寸，而是在保持动作相对结构的同时，允许不同身体区域采用不同的适配比例。

## 5. 两阶段 IK 优化

### 5.1 第一阶段：方向和末端位置

给定一个目标帧，机器人广义坐标 $q$ 包含根部平移、根部旋转和关节角。第一阶段只使用身体姿态误差，以及手和脚等 end-effector 的位置误差：

$$
\min_q \sum_{(i,j)\in\mathcal M}
(w_1^R)_{i,j}\|R_i^h\ominus R_j(q)\|_2^2
+\sum_{(i,j)\in\mathcal M_{ee}}
(w_1^p)_{i,j}\|p_i^{target}-p_j(q)\|_2^2
$$

约束为：

$$
q^-\le q\le q^+.
$$

这里 $\mathcal M_{ee}$ 是只包含手和脚的匹配集合。先保证身体朝向以及关键末端位置，可以减少“所有身体点一起优化”时的局部最优和姿态跳变。

实现上，GMR 使用 Mink differential IK。它不是直接对 $q$ 做黑盒梯度下降，而是线性化当前误差：

$$
\min_{\dot q}
\|e(q)+J(q)\dot q\|_W^2
$$

并约束积分后的下一状态：

$$
q^-\le q+\dot q\Delta t\le q^+.
$$

$J(q)=\partial e/\partial q$ 是误差对广义坐标的 Jacobian。通过求解速度并积分，能够在每次迭代中直接利用机器人正运动学和 Jacobian 下降误差。

第一阶段迭代到目标函数变化小于 $0.001$ 或最多迭代 10 次。

### 5.2 第二阶段：全身体位置和姿态微调

第一阶段的结果作为初始值，第二阶段重新加入所有 key body 的位置和姿态约束：

$$
\min_q \sum_{(i,j)\in\mathcal M}
\left[(w_2^R)_{i,j}\|R_i^h\ominus R_j(q)\|_2^2
+(w_2^p)_{i,j}\|p_i^{target}-p_j(q)\|_2^2\right]
$$

同样满足关节上下限。第二阶段使用与第一阶段不同的权重，使系统可以在已经找到合理身体方向和末端位置后，再平衡全身关键点的误差。

这种“两阶段”设计的意义是把优化目标按重要性排序：先获得不容易崩坏的姿态和接触相关末端，再追求整体位置/姿态的精确拟合，而不是让一个大而混杂的目标从任意初值开始优化。

## 6. 从单帧到动作序列

对于长度为 $T$ 的动作，GMR 按时间顺序处理每一帧：

1. 当前帧使用上一帧 retargeting 结果作为初始猜测；
2. 运行两阶段 IK；
3. 保存根部位姿和关节角；
4. 进入下一帧。

这种 warm start 能保持连续性，也比每帧从 rest pose 开始更适合实时流式输入。代码库中的 `GeneralMotionRetargeting` 既能处理离线动作，也能接收 Xsens、OptiTrack 等在线输入。

处理完整序列后，GMR 使用正运动学计算每一帧所有 robot body 的高度，并用每帧最低身体高度修正整体根部平移，以减轻浮空和地面穿透。这个后处理不能替代真正的接触约束，但可以清理一部分由 IK 和根部高度估计造成的全局高度偏差。

## 7. 实验设置

### 7.1 数据与机器人

- 数据集：LAFAN1。
- 动作数量：21 条。
- 动作类型：行走、转身、跑步、跳跃、舞蹈、武术和各种体育动作。
- 时长：约 5 秒到 2 分钟。
- 机器人：Unitree G1。
- 排除项：复杂环境交互动作，如爬行和从地面起身；保留了一条手脚交替接触地面的侧手翻动作。

LAFAN1 原始数据是 BVH 格式。为了让 PHC 和 ProtoMotions 也能使用，作者将 BVH 转换为 SMPL/SMPL-X 表示，并发现 SMPL-X 对 LAFAN1 骨架拟合得更好。

### 7.2 策略训练与评估

每一个 retargeted motion 都单独训练一个 BeyondMimic motion imitation policy。这样做可以把 retargeting 方法的差异尽量隔离出来：训练器、策略结构和评估流程保持一致，不针对某种 retargeter 单独调奖励。

评估包含三种条件：

- **sim**：IsaacSim 中使用观测噪声，100 次 rollout；
- **sim-dr**：开启 domain randomization，4096 次 rollout；
- **sim2sim**：使用带 ROS 状态估计和控制时序的 MuJoCo 环境，100 次 rollout，更接近实际部署。

每次 rollout 从机器人默认姿态开始，直到机器人摔倒或参考动作结束。成功定义很严格：策略必须完整走完参考动作，且 anchor body 的高度和姿态不能超过阈值。

### 7.3 评价指标

- **Success rate**：完整完成动作的 rollout 比例；
- **$E_{g-mpbpe}$**：全局坐标下身体关键点的平均位置误差；
- **$E_{mpbpe}$**：相对于根部坐标的身体关键点平均位置误差；
- **$E_{mpjpe}$**：关节旋转的平均角度误差；
- **Perceptual faithfulness**：用户对 retargeted motion 是否忠实于源人体动作的主观选择。

成功率衡量“能不能完成”，跟踪误差衡量“完成得是否像”，用户研究则衡量“看起来是否仍然是原来的动作”。三者结合比只看成功率更合理，因为一个策略可能通过偏离原参考的方式保持不摔倒。

## 8. 实验结果

### 8.1 Retargeting 方法显著影响策略性能

21 条动作中，有 11 条动作在所有 retargeting 方法下都取得了 98% 以上成功率，说明许多普通动作对 retargeting 误差并不敏感。Walk 1、Walk old 和 Hop around 等动作在不同方法下基本都能达到完美表现。

差异主要出现在动态、复杂或较长的动作上：

- PHC 整体表现最弱；
- GMR 和 ProtoMotions 通常明显优于 PHC；
- Unitree 数据在多数动作上接近完美；
- GMR 的成功率和跟踪误差总体接近 Unitree，且优于开源基线。

具有代表性的结果包括：

- Dance 1 和 Dance 2：PHC 在 sim 和 sim2sim 中基本无法完成，而 GMR、ProtoMotions 和 Unitree 接近 100%；
- Run (stop & go)：PHC、ProtoMotions 的表现明显下降，GMR 约为 91% 的 sim-dr 成功率，Unitree 接近 100%；
- Dance 5：GMR 受到少量腰部姿态突变影响，sim-dr 成功率约为 92.75%，说明 GMR 也不是没有失败案例。

这些结果支持论文的核心论点：在控制器和奖励固定时，参考动作质量会直接影响 RL 策略的可学习性和鲁棒性。

### 8.2 关键 retargeting 伪影

论文将低成功率与具体的参考动作伪影对应起来：

#### 地面穿透

PHC retarget 的 Dance 1 和 Dance 2 存在明显的地面穿透，其中一个案例达到约 60 cm。策略如果严格跟踪该参考，就必须让机器人身体进入地面；如果遵守物理接触，又会产生很大的 tracking error。

#### 自相交

ProtoMotions retarget 的 Run (stop & go) 中，机器人腿部发生严重相交。这会造成不合理的碰撞几何和关节姿态，增加策略维持稳定的难度。

#### 关节值突变

GMR 的 Dance 5 中出现腰部 roll 和 pitch 的突然跳变。该问题只占完整数据集中的很小片段，但足以导致策略在 sim2sim 中鲁棒性下降。作者指出，这类突变来自优化过程，统一的优化权重并不一定适合所有动作。

论文最终强调，物理高度不一致、自相交和关节突变是最需要避免的三类伪影。

### 8.3 用户研究：动作是否仍然像源动作

用户研究共有 20 名参与者。每个问题展示一个 SMPL-X 源动作和两个随机顺序的 retargeted 视频，用户选择更接近源动作的那个，也可以认为两者难以区分。

结果是：

- GMR 比 PHC 和 ProtoMotions 更忠实于源人体动作；
- Unitree retarget 比 GMR 略受偏好；
- 用户较难区分 GMR 和 Unitree。

这说明 GMR 不只是生成“容易被机器人执行”的动作，也较好保留了人体动作的视觉语义和风格。对 imitation learning 来说，这一点很重要，因为策略最终学习的是 retargeted reference，而不是原始人体数据本身。

### 8.4 初始参考帧同样重要

即使 retargeting 方法不变，参考动作从哪一帧开始也会显著改变策略成功率。例如同一个 Walk 2 或 Turn 1 policy，只改变起始帧，sim2sim 成功率可能从接近 0 变成 100%。

原因是策略从机器人默认姿态开始，需要在最初几个控制周期内到达参考动作。如果第一帧本身离默认姿态太远或不稳定，策略可能一开始就摔倒。

因此数据处理时应：

- 让第一帧是机器人能够安全接近的姿态；
- 让最后一帧落在稳定姿态，便于安全结束控制；
- 不要只检查动作中间帧，也要单独检查首尾帧。

## 9. GMR 相比基线的核心改进

| 对比维度 | PHC | ProtoMotions | GMR |
| --- | --- | --- | --- |
| 缩放方式 | 基于 SMPL 形状拟合 | 世界坐标轴全局缩放 | 身体关键点非均匀局部缩放 |
| 优化方式 | 全局梯度下降 | Mink differential IK | 两阶段 Mink differential IK |
| 末端优先 | 不突出 | 位置/姿态统一优化 | 第一阶段显式优先手脚末端 |
| 接触处理 | 未充分考虑 | 主要依赖后处理 | 通过末端目标和高度后处理改善 |
| 典型问题 | 浮空、穿地 | 自相交、比例不一致 | 少量优化突变仍可能出现 |
| 实时性 | 梯度下降较慢 | 较快 | CPU 实时，支持在线 retargeting |

这里的“接触处理”需要谨慎理解：GMR 并不是完整的 contact-aware dynamics retargeter，也没有在论文中显式优化接触力或碰撞约束；它主要通过更合理的局部缩放、手脚末端约束和高度后处理降低明显的接触伪影。

## 10. 我的理解与批判性分析

### 10.1 论文真正证明了什么

论文不是证明“GMR 在所有动作上都绝对最好”，而是证明了一个更重要的工程事实：**retargeted reference 是 RL 的训练数据，不是无条件正确的 ground truth。** 如果参考轨迹中包含明显的几何和物理伪影，策略可能仍然在仿真里学会，但它会付出更高的跟踪误差、更低的鲁棒性或更多的奖励调参成本。

GMR 的贡献因此包含两层：

1. 给出一个实用的通用 retargeting 实现；
2. 通过统一训练和评估流程，把 retargeting 质量对 policy 学习的影响单独展示出来。

### 10.2 为什么局部缩放比全局缩放更合理

人和机器人不是同一套骨架的简单缩放。不同身体部分的长度比例、关节自由度和 rest pose 方向都可能不同。全局缩放只能在平均意义上匹配骨架，局部缩放则允许腿、躯干和手臂分别适配目标机器人。

但局部缩放也引入了新自由度：如果缩放因子没有物理依据或调得过激，可能破坏源动作的比例关系。因此 GMR 的局部缩放不是“越自由越好”，而是要在动作忠实度和机器人可实现性之间折中。

### 10.3 为什么两阶段 IK 有帮助

如果一次性同时最小化所有位置和旋转误差，优化器可能为了降低平均误差而牺牲脚、手等关键末端，或者陷入关节极限附近的局部最优。第一阶段先锁定方向和末端，再用第二阶段细化全身，相当于给优化过程加入了一个任务优先级。

这也解释了为什么 GMR 不需要使用非常复杂的学习型 retargeter：在明确的目标分解和合适的 warm start 下，经典 differential IK 已经能提供足够好的实时解。

## 11. 与后续 RL/遥操作系统的关系

GMR 位于“人体数据/传感器输入”和“机器人策略或控制器”之间：

$$
	ext{Human motion}
\xrightarrow{\text{GMR}}
	ext{Robot reference motion}
\xrightarrow{\text{RL tracking policy}}
	ext{Robot action}.
$$

在离线 imitation learning 中，GMR 负责生成质量更高的训练参考；在 TWIST 等在线 teleoperation 中，GMR 负责把人体或动捕系统的每一帧实时映射成机器人姿态。无论哪种场景，retargeting 的误差都会直接进入下游系统，因此不能只用“策略最后能不能跑”来判断 retargeting 是否成功。

## 12. 代码与复现要点

代码仓库当前支持多种机器人和人体数据格式，包括 Unitree G1、G1 with hands、H1、H1 2、Booster T1、Fourier N1、Galaxea R1 Pro、Kuavo、Talos 等，并支持 SMPL-X、AMASS、OMOMO、LAFAN1 BVH、Nokov、Xsens 和 OptiTrack 等输入。

典型安装方式：

```bash
uv sync
```

从 SMPL-X motion retarget 到机器人：

```bash
uv run scripts/smplx_to_robot.py \
  --smplx_file <path_to_smplx_data> \
  --robot <path_to_robot_data> \
  --save_path <path_to_save_robot_data.pkl> \
  --rate_limit
```

从 LAFAN1/Nokov BVH retarget：

```bash
uv run scripts/bvh_to_robot.py \
  --bvh_file <path_to_bvh_data> \
  --robot <path_to_robot_data> \
  --save_path <path_to_save_robot_data.pkl> \
  --rate_limit \
  --format lafan1
```

代码中的机器人模型由 MuJoCo XML 解析，使用 Mink 和 MuJoCo 计算 forward kinematics、Jacobian、关节限制和 differential IK。README 中报告的速度基准为：AMD Threadripper 7960X 上约 60--70 FPS，Intel i9-13900K 上约 35--45 FPS。

## 13. 最终 takeaway

1. **Retargeting 是 imitation learning 的数据生成阶段，不是可随意忽略的预处理。**
2. **足部滑动、穿地、自相交和关节突变会把几何错误直接转化为 RL 的学习难题。**
3. **人体到机器人的缩放应当允许身体局部差异，而不是只使用单一全局因子。**
4. **两阶段 IK 通过先保证方向和末端，再细化全身，降低了局部最优和姿态崩坏风险。**
5. **成功率必须和 tracking error、源动作忠实度一起看，否则可能把“能跑完但动作已经变形”误判为好 retargeting。**
6. **GMR 的优势是通用、实时、可复现和适合下游 RL；它仍不是完整的接触动力学规划器。**
