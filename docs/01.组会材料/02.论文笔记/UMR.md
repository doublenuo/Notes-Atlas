---
date: 2026-09-23 10:24:57
title: UMR
permalink: /materials/paper/umr
categories:
  - 论文笔记
tags:
  - 人形机器人
---


# Unified Motion Retargeting for Humanoids with Learned Point Cloud Correspondence

- Project Link: [https://hanyang9.github.io/UMR/](https://hanyang9.github.io/UMR/)
- Github Link: [https://github.com/hanyang9/UMR](https://github.com/hanyang9/UMR)
- Paper Link: [https://arxiv.org/abs/2609.02134](https://arxiv.org/abs/2609.02134)
- **作者**：Hanyang Cao、Yuetong Fang、Taesoo Kwon、Runyi Yu、Ji Ma、Jing Tan、Yangchen Zhou、Baoze Du、Yi Gu、Yukang Gao、Ruoli Dai、Lei Han、Renjing Xu
- **机构**：HKUST(GZ)、Noitom Robotics、Hanyang University、HKUST、HKU

## 模型框架图

![](https://picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261028104934176.png)

## 一句话总结

UMR（Unified Motion Retargeting）把人体到机器人的 motion retargeting 从“稀疏关键点/关节语义匹配”改成“稠密表面点云对应”。它先在 canonical T-pose 上学习源人体与目标机器人表面点云的有序对应，再把对应点绑定到各自的 mesh，在每个动作帧中通过受关节限位、地面间隙和信赖域约束的 Gauss-Newton 优化，同时匹配表面位置、局部方向和接触关系。

核心结果是：**同一套 surface-based 接口可以处理不同人体运动表示、不同机器人形态以及 locomotion、human-object interaction 和 human-scene interaction，而不需要为每个机器人手工重写人体-机器人关节映射。**

## 1. 为什么需要 UMR

大规模 humanoid learning 越来越依赖人体动作数据，但人体与机器人之间存在明显的 embodiment gap：

- 身体比例不同；
- 关节数量、拓扑和自由度不同；
- 关节活动范围不同；
- 身体表面几何不同；
- 机器人存在更严格的运动学和碰撞约束。

传统 retargeting 通常手工选择 pelvis、手、脚等关键点，再定义人体关节和机器人 link 的对应关系。这种方法有三个根本问题：

1. **扩展到新机器人需要重新设计 mapping**：机器人拓扑一变，原有的语义对应和权重就可能失效。
2. **空间监督太稀疏**：少量关键点无法充分约束两条手臂、躯干或腿部之间的细节姿态。
3. **交互接触难以迁移**：人体手掌与物体接触的具体表面区域，很难通过一个“手部 link 对应”准确传给机器人。

UMR 的假设是：人体与机器人虽然骨架不同，但都可以表示为外部表面点云。表面点的空间位置和局部方向包含了比单个关节更多的几何信息，因此可以作为跨 embodiment 的统一接口。

## 2. 整体流程

UMR 分成两个阶段：

### 阶段一：Point Cloud Correspondence Learning

在 canonical T-pose 下，输入有序的人体表面点云和无序的机器人表面点云，学习每一个人体点应该对应机器人表面的哪个位置。这个对应关系只需针对一个 source template 和一个机器人建立一次，之后可以在多个动作帧和多个动作序列中复用。

### 阶段二：Correspondence-Guided Retargeting

将学到的点对分别绑定到人体和机器人 mesh。随着人体 mesh 运动，人体点通过 barycentric transport 移动；机器人点通过机器人正运动学移动。每个源点于是为对应机器人点提供位置和表面方向目标，优化器在关节限位、地面间隙和步长约束下求解机器人姿态。

若源动作与物体或场景交互，UMR 还根据相同的点索引和环境点云计算 contact map，并把人体的接触关系直接转移到机器人表面。

流程可以概括为：

$$
	ext{source mesh motion}
\rightarrow
	ext{canonical surface correspondence}
\rightarrow
	ext{surface/contact targets}
\rightarrow
	ext{constrained robot motion}.
$$

## 3. 点云对应学习

### 3.1 输入表示

设对齐后的 source T-pose 点云为：

$$
X^h=\{x_i^h\in\mathbb R^3\}_{i=1}^{N},
$$

其中人体点云有固定顺序；目标机器人 T-pose 点云为无序集合：

$$
X^r=\{x_j^r\in\mathbb R^3\}_{j=1}^{N}.
$$

人体点的顺序不是语义上的“一对一关节映射”，而是为后续建立稳定的 correspondence index。目标是预测一个与人体点具有相同索引的机器人侧点云 $\hat X^r$。

### 3.2 PointNet 风格网络

UMR 使用 PointNet 风格 encoder $E_\theta$ 对无序机器人点云提取整体 latent，再用 MLP decoder $D_\theta$ 为每个有序人体点预测一个 deformation vector：

$$
\hat X^r=X^h+D_\theta(E_\theta(X^r)).
$$

对于第 $i$ 个点：

$$
\hat x_i^r=x_i^h+d_i.
$$

这里 $d_i$ 是从人体 T-pose 点到机器人对应表面点的变形向量。网络不是直接输出机器人关节角，而是重建一个覆盖机器人表面的、继承人体点索引的点云。

### 3.3 Correspondence loss

总损失为：

$$
\mathcal L_{corr}=\lambda_c\mathcal L_c+
\lambda_r\mathcal L_r+
\lambda_e\mathcal L_e.
$$

#### Chamfer 几何覆盖损失

对重建点云和机器人目标点云使用对称 Chamfer 距离：

$$
\mathcal L_c=
\frac{1}{N}\sum_i\min_j\|\hat x_i^r-x_j^r\|_2^2
+\frac{1}{N}\sum_j\min_i\|x_j^r-\hat x_i^r\|_2^2.
$$

它保证预测点云覆盖机器人外部表面，但单独使用 Chamfer loss 可能让多个人体点聚集到同一片机器人表面。

#### Repulsion 损失

为防止多个重建点塌缩到相同局部区域，UMR 对每个点的近邻加入排斥项：

$$
\mathcal L_r=\frac{1}{NK_r}\sum_i\sum_{\ell\in\mathcal N_r(i)}
\exp\left(-\frac{\|\hat x_i^r-\hat x_\ell^r\|_2^2}{r^2}\right).
$$

当两个重建点距离很近时，指数项变大，优化器会把它们推开。

#### Geodesic edge smoothness 损失

在人体 template 上构造固定的 geodesic graph，边集合为 $\mathcal E$。相邻人体点应该产生相近的变形向量：

$$
\mathcal L_e=\frac{1}{|\mathcal E|}
\sum_{(i,\ell)\in\mathcal E}\|d_i-d_\ell\|_2^2.
$$

这一项非常关键：它让 correspondence 在人体表面上连续、平滑，而不是让相邻人体点跳到机器人完全不相邻的表面区域。训练后，机器人点可以继承人体 template 的 body segment label，从而允许后续复用分段权重和接触参数。

## 4. Correspondence-guided retargeting

### 4.1 表面点的运动绑定

学到 T-pose correspondence 后，人体侧和机器人侧点分别绑定到各自的 mesh：

- 人体点随 posed source mesh 通过 barycentric transport 更新；
- 机器人点根据所属 link 的局部绑定和机器人正运动学计算；
- 同一个 index $i$ 连接人体点和机器人点。

相比只匹配 pelvis、手腕和脚踝，稠密点对可以同时约束身体表面不同区域，提供更细粒度的姿态信号。

### 4.2 Pose residual

在选定的 correspondence 点集合 $\mathcal I$ 上，UMR 同时匹配位置和局部表面方向：

$$
r_{p,i}(q_t)=
\begin{bmatrix}
w_i^p(x_i^r(q_t)-x_{t,i}^h)\\
w_i^n(\bar n_i^r(q_t)-\bar n_{t,i}^h)
\end{bmatrix}.
$$

其中：

- $x_{t,i}^h$ 是当前人体表面点；
- $x_i^r(q_t)$ 是机器人广义坐标 $q_t$ 下的对应点；
- $\bar n$ 表示相对于各自 T-pose 绑定方向的局部方向变化；
- $w_i^p$ 和 $w_i^n$ 是与身体区域相关的位置、法向权重。

总的 pose matching 问题还会加入 contact residual：

$$
\min_{q_t}\|r_p(q_t)\|_2^2+\|r_c(q_t)\|_2^2.
$$

### 4.3 接触地图转移

假设环境或交互物体表面采样为：

$$
Y_t=\{y_{t,j}\in\mathbb R^3\}_{j=1}^{M}.
$$

对于每个人体 correspondence 点 $i$，找到距离最近的环境点：

$$
\pi_t(i)=\arg\min_j\|x_{t,i}^h-y_{t,j}\|_2.
$$

于是人体侧和机器人侧的 contact vector 分别为：

$$
c_{t,i}^h=x_{t,i}^h-y_{t,\pi_t(i)},
$$

$$
c_i^r(q_t)=x_i^r(q_t)-y_{t,\pi_t(i)}.
$$

当人体点到环境的距离小于接触阈值 $\tau_c$ 时，将它加入 active contact set：

$$
\mathcal C_t=\{i\in\mathcal I\mid\|c_{t,i}^h\|_2\le\tau_c\}.
$$

接触残差为：

$$
r_{c,i}(q_t)=w_i^c(c_i^r(q_t)-c_{t,i}^h),
\qquad i\in\mathcal C_t.
$$

这个机制的关键是：UMR 传递的不是“人体手对应机器人手”这样粗粒度的语义，而是“人体表面的这个点与物体表面的这个区域保持什么相对几何关系”。因此同一套表示可以处理手-物体、脚-地面、身体-场景等接触。

对于 self-contact，论文会把外部环境点替换为位于另一个、非相邻身体段上的 correspondence 点，避免把同一局部表面错误地当成外部物体。

### 4.4 受约束 Gauss-Newton 更新

由于点的位置和法向通过机器人正运动学非线性依赖于 $q_t$，UMR 在当前姿态处线性化残差：

$$
r(q_t+\Delta q)\approx r(q_t)+J(q_t)\Delta q,
$$

其中：

$$
J(q_t)=\left.\frac{\partial r(q)}{\partial q}\right|_{q=q_t}.
$$

每一次迭代求解阻尼的凸二次子问题：

$$
\min_{\Delta q}
\frac{1}{2}\|r(q_t)+J(q_t)\Delta q\|_2^2
+\frac{\mu}{2}\|\Delta q\|_2^2
$$

约束包括：

$$
q^-\le q_t+\Delta q\le q^+,
$$

$$
A_t\Delta q\le b_t,
\qquad
\|\Delta q\|_2\le\eta.
$$

- 第一项是关节上下限；
- $A_t\Delta q\le b_t$ 是地面 clearance 线性约束；
- $\|\Delta q\|_2\le\eta$ 是 trust region，防止一次线性化更新过大；
- $\mu$ 是 damping 系数，提升数值稳定性。

对于接近地面的 robot surface point $i$，令当前高度为 $z_i^r(q_t)$，要求更新后不低于地面高度 $z_f$：

$$
z_i^r(q_t+\Delta q)\ge z_f.
$$

线性化后得到：

$$
-J_i^z(q_t)\Delta q\le z_i^r(q_t)-z_f.
$$

将这些不等式堆叠，就能在 retargeting 优化阶段直接抑制穿地，而不是事后才发现机器人身体已经进入地面。

## 5. 为什么 UMR 可以统一不同输入和机器人

UMR 把 source-specific 的差异压缩到两个接口：

1. 一个 canonical template mesh；
2. 一段随时间变化的 posed surface point cloud。

因此输入可以来自：

- SMPL-X；
- SOMA；
- MimicKit 中的 humanoid character animation；
- 扫描的人体 mesh 与自建动捕数据。

目标机器人只需要提供其 mesh、T-pose 和运动学模型。论文展示了 4 种 source representation 到 5 种 humanoid embodiment 的 retargeting，且同一套 correspondence learning 和 retargeting formulation 不随 source-robot pair 改变。不同 source 主要只需要提供可用的 body region 划分和权重。

这一点与传统 skeleton-centric 方法的区别在于：传统方法的 correspondence 与关节语义绑定；UMR 的 correspondence 与 ordered surface point index 绑定。只要表面几何能被采样，机器人不需要和人体拥有相同的骨骼拓扑。

## 6. 实验设置

### 6.1 统一 retargeting 展示

论文在以下 source 上展示 UMR：

- MimicKit humanoid-character animation；
- BONES-SEED 中的 SOMA motion；
- LAFAN1 的 SMPL-X motion；
- 扫描人体和自建动捕 motion。

目标 embodiment 覆盖不同身高和比例的机器人，范围约为 0.75 m 到 1.83 m。项目页还展示了带网球拍的 morphologically augmented Unitree G1：球拍既是人体交互物体，又是机器人 embodiment 的刚性部分，UMR 可以在同一表面对应框架中处理这两种角色。

### 6.2 单动作 whole-body tracking

作者在 LAFAN1 上比较 UMR、GMR 和 Unitree retargeted references，并使用 BeyondMimic 训练单动作 imitation policy。评估包含：

- Sim w/o DR；
- Sim w/ DR；
- 按 GMR 部署设置进行的 Sim2Sim。

成功标准是 policy 在固定 reference window 内完成动作且不触发 termination。指标包括成功率、全局身体位置误差 $E_{g-mpbpe}$、根部相对身体位置误差 $E_{mpbpe}$ 和关节角误差 $E_{mpjpe}$。

### 6.3 大规模策略学习

作者使用 BONES-SEED 和 SONIC 检验 UMR reference 对大规模 motion collection learning 的影响。SONIC 可以通过 SMPL encoder 将人体 motion 映射到机器人 motion 的 latent space，并使用跨模态一致性损失。

实验比较两种设置：

- **有 SMPL encoder**：策略同时获得 source human motion 和 latent alignment 的额外信息；
- **无 SMPL encoder**：更直接地检验 retargeted robot reference 本身的质量。

一个重要控制变量是：BONES-SEED 发布的 Unitree G1 reference 来自 SOMA-Uniform + GMR，而 UMR 直接处理 actor-specific 的 SOMA-Proportional motion，因此 UMR 不需要把不同演员的体型先强行统一。

### 6.4 接触丰富的交互

UMR 与 OmniRetarget 进行两类比较：

- Robot-object interaction：使用 OmniContact 数据，任务包括 Carry、Kick、Push；
- Robot-scene interaction：使用 GRAIL 数据，任务包括 Chair、Stair、Slope。

下游训练协议保持对应工作不变，只更换 retargeted reference。

## 7. 实验结果

### 7.1 计算效率

UMR 的实现使用 MuJoCo，受约束 Gauss-Newton 子问题使用 Clarabel 求解。论文报告在 NVIDIA RTX 4070 Ti SUPER 和 Intel Core Ultra 7 265KF 上的平均开销：

| 阶段 | 组件 | 开销 |
| --- | --- | --- |
| Stage I | point cloud sampling | 9.83 s |
| Stage I | geodesic precomputation | 5.58 s |
| Stage I | correspondence training | 10.38 s |
| Stage I | 总 setup | 25.79 s |
| Stage II | data preprocessing | 141.46 FPS |
| Stage II | motion retargeting | 121.26 FPS |
| Stage II | overall throughput | 65.29 FPS |

关键点是 correspondence setup 可以复用。对于同一个 source template 和机器人，约 25.79 秒的初始化成本不需要每个动作 clip 重复支付；逐 clip retargeting 的整体吞吐约 65.29 FPS。

### 7.2 单动作 tracking

UMR 在 LAFAN1 上总体取得比 GMR 更高的 tracking success rate，优势在困难动作上更明显：

- **Fall and GetUp**：UMR 在 Sim w/o DR 下约 96.98%，GMR 约 84.72%；在 Sim w/ DR 下约 95.62%，GMR 约 81.60%；
- **Fight**：UMR 在 Sim w/o DR 下约 99.94%，GMR 约 87.60%；在 Sim w/ DR 下约 98.86%，GMR 约 83.04%；
- **Dance**：UMR 和 GMR 都较高，但 UMR 仍有小幅优势；
- **Run、Sprint、Walk**：UMR 在 nominal 和 domain-randomized 条件下整体优于或接近 GMR。

论文的总体结论是，UMR 在 domain randomization 和 Sim2Sim 下的优势更广泛，且与 Unitree curated references 保持竞争力。误差表明，UMR 在关节角误差上取得最低均值，身体关键点位置误差也接近 Unitree reference。

### 7.3 SONIC 大规模学习

在有 SMPL encoder 的设置下，UMR 和 Unitree reference 的性能相近，因为 human source motion 和 latent alignment 提供了额外指导。

在移除 SMPL encoder 后，UMR 在训练后期的总 reward、anchor position tracking error 和平均 joint-angle error 都优于发布的 Unitree references，论文报告约有 10% 的相对改进。这说明 UMR 的收益不只是来自额外的人体编码器，而是 retargeted robot reference 本身更好。

在 BONES-SEED 对比中，UMR 还能保留 actor-specific body geometry，而 GMR 使用 SOMA-Uniform reference，导致下肢姿态和地面接触出现更明显的失真。

### 7.4 Robot-object interaction

UMR 与 OmniRetarget 的结果如下，表中数值为 UMR / OmniRetarget：

| 任务 | 成功率 (%) | Joint error (rad) | Object error (m) |
| --- | --- | --- | --- |
| Carry | 99.28 / 82.89 | 0.570 / 1.030 | 0.081 / 0.252 |
| Kick | 99.98 / 83.13 | 0.619 / 1.396 | 0.038 / 0.215 |
| Push | 99.99 / 99.87 | 0.630 / 1.043 | 0.048 / 0.049 |

两种方法都可能让手到达物体附近，但 OmniRetarget 可能把接触转移到物体错误的表面区域；UMR 通过 contact map 保持了具体的手-物体几何关系。因此 UMR 的优势不仅体现在成功率，也体现在 joint error 和 object tracking error。

论文指出，三个任务中 UMR reference 训练的 policy 将 joint error 降低约 40%--56%。这说明一个任务“成功移动物体”并不代表 retargeted motion 是高质量的，策略可能用明显偏离参考的姿态完成任务。

### 7.5 Robot-scene interaction

在 GRAIL 的场景交互中，UMR 相比 OmniRetarget：

- **Stair**：成功率约 43.53% 对 11.01%，joint error 约 0.229 对 0.327 rad；
- **Slope**：成功率约 58.32% 对 52.37%，joint error 约 0.152 对 0.179 rad；
- **Chair**：OmniRetarget 略有优势，约 79.67% 对 UMR 的 75.24%。

作者推测，OmniRetarget 的 heuristic stance detection 和 foot-sticking hard constraint 在不同 motion distribution 下可能保留了错误接触；UMR 不依赖这些手工 stance heuristic，因此在楼梯和斜坡场景上更稳定。

## 8. UMR 的主要贡献

### 贡献一：表面中心的统一接口

把 source motion 和 robot motion 都转成表面点云，绕过人体和机器人必须拥有匹配骨骼拓扑的限制。

### 贡献二：可复用的稠密 correspondence

对应关系在 canonical T-pose 中学习一次，绑定到 mesh 后可以跨帧、跨动作复用。相比为每个动作重新设计 body mapping，这更适合大规模数据处理。

### 贡献三：姿态、表面方向和接触统一优化

同一组点对既用于 pose matching，也用于 contact map transfer，避免另外编写人体手、脚与机器人 link 的交互规则。

### 贡献四：下游验证覆盖从 tracking 到 interaction

作者不仅展示几何 retargeting 结果，还用 BeyondMimic、SONIC、OmniContact 和 GRAIL 验证 retargeted references 对策略训练、物体交互和场景交互的影响，并展示真机部署。

## 9. 我的理解与批判性分析

### 9.1 UMR 解决的核心不是“更密的 IK”

表面点数量增加并不自动带来更好的 retargeting。UMR 真正改变的是 correspondence 的定义：

- 传统方法：人体关节/身体段 $\rightarrow$ 机器人关节/link；
- UMR：人体 canonical surface point $\rightarrow$ 机器人 canonical surface point。

这使得 correspondence 从依赖语义和拓扑，变成依赖几何覆盖和局部连续性。之后的优化器仍然是经典的 constrained Gauss-Newton，但它优化的是更丰富、更统一的几何目标。

### 9.2 为什么 contact map 是重要扩展

对于 locomotion，仅匹配脚的位置可能已经有用；但对推、搬、踢球、坐椅子等任务，关键不是“手在大概的位置”，而是手/脚与物体接触的具体法向、偏移和表面区域。UMR 将环境点分配和人体-环境相对向量放进同一个 correspondence index，可以自然地把接触关系迁移到不同形态的机器人上。

这让 UMR 更像是一个几何约束生成器，而不只是一个姿态转换器。

### 9.3 为什么 canonical T-pose 学习是合理折中

如果每个动作帧都重新寻找 correspondence，计算昂贵且容易受姿态遮挡、接触和局部极端形变影响。UMR 在 T-pose 中学习静态几何对应，再随 mesh 运动运输点，能够把“身体形态差异”和“动作变化”分开处理。

代价是它假设 source template 和 mesh binding 足够可靠；如果源几何本身是错误的，或动作中发生超出模板表达能力的形变，固定 correspondence 可能不再是最优。

### 9.4 UMR 与 GMR 的关系

GMR 通过人工定义 key body mapping、非均匀局部缩放和两阶段 IK 改善 retargeting；UMR 则把 mapping 本身学习为稠密 surface correspondence。可以把 UMR 看成是在 GMR 所关注的几何一致性问题上进一步减少人工语义设计：

| 维度 | GMR | UMR |
| --- | --- | --- |
| Correspondence | 人工定义关键身体映射 | canonical point cloud 学习稠密对应 |
| 监督密度 | 关键身体和末端 | 全身表面点 |
| 接触迁移 | 依赖手脚等 key body 设计 | 共享点索引直接转移 contact map |
| 新机器人适配 | 需要配置 body mapping 和权重 | 重新建立点云 correspondence |
| 优化器 | differential IK / 分阶段优化 | 受约束 Gauss-Newton QP |
| 交互能力 | 主要面向全身动作 | 显式支持物体和场景接触 |

UMR 并没有消灭所有人工设计：仍需要 canonical mesh、点云采样、body region、权重、接触阈值和机器人运动学模型。但人工工作从“为每个身体部位写一套对应规则”，转向“准备可学习的几何接口和约束”。

### 9.5 实验结果应如何理解

UMR 的成功率优势在困难动作和接触任务上最明显，但并不是所有任务都提升。例如 Chair 场景中 OmniRetarget 略好，说明接触 heuristics 在某些固定分布下仍然有效。论文更有说服力的地方是：在多种源表示、不同机器人形态、domain randomization、Sim2Sim 和物体/场景交互中，UMR 的整体表现更稳定。

同时，定量实验主要在 Unitree G1 上进行，因此“跨 embodiment 的统一性”目前主要由跨形态展示和项目页结果支持，而不是每个机器人都做了同等规模的下游 policy benchmark。

## 10. 局限与未来方向

- **需要 mesh-based source geometry**：当前方法假设输入能提供 canonical source template 和 posed surface；对于只有二维视频或稀疏关键点的输入，需要先接入人体重建模型。
- **依赖 canonical template**：template 的姿态、尺度和 mesh binding 错误会影响所有后续 correspondence。
- **点云 correspondence 并非完整动力学可行性**：UMR 约束了运动学、地面 clearance 和局部接触几何，但没有直接求解全身动力学、摩擦力和执行器能力。
- **接触仍有阈值和环境点云依赖**：最近邻 contact map 在复杂遮挡、滑动接触或多个相邻表面距离很近时可能产生错误匹配。
- **更灵巧的 embodiment 尚未充分覆盖**：未来需要扩展到 dexterous hands、多指接触和多机器人交互。
- **量化下游实验主要是 Unitree G1**：跨机器人泛化仍需要更多统一指标和硬件验证。

## 11. 复现和实现要点

从实现角度，UMR 可以拆成以下模块：

1. 读取 source mesh 和 robot mesh，并统一 canonical T-pose；
2. 采样表面点云，记录点所属 body segment、局部坐标和 mesh binding；
3. 构造 source template 的 geodesic graph；
4. 训练 PointNet encoder + per-point MLP decoder；
5. 保存 ordered point correspondence 和 body labels；
6. 对每帧通过 mesh transport 和 robot forward kinematics 得到点目标；
7. 建立 pose residual、contact residual、joint limit 和 floor clearance 约束；
8. 使用 Clarabel 等 QP/conic solver 进行阻尼 Gauss-Newton 更新；
9. 将生成的机器人 reference 接入 BeyondMimic、SONIC 或交互策略训练。

项目页提供了 UMR Robot Retargeting Studio，可以通过拖拽机器人资产、调整 T-pose 和选择 reference 来尝试跨 embodiment retargeting；项目展示中还包括带球拍的 Unitree G1、旋踢、上下楼梯、搬运球和箱体搬运等结果。

## 12. 最终 takeaway

1. **Skeleton mapping 是 retargeting 的可扩展性瓶颈，表面点云提供了更通用的跨 embodiment 接口。**
2. **UMR 的关键不是单纯增加点数，而是学习有序 correspondence，并保持局部几何连续性。**
3. **位置、表面方向和接触地图共享同一组点索引，使 locomotion 与 interaction 可以用同一套优化框架处理。**
4. **Canonical T-pose correspondence 让昂贵的匹配过程可复用，逐 clip retargeting 可以达到约 65 FPS 的整体吞吐。**
5. **高质量 reference 不只提高视觉相似度，也能提高下游 policy 在 domain randomization、Sim2Sim 和真机上的鲁棒性。**
6. **UMR 仍是运动学和几何 retargeting 系统，不应被误解为完整的动力学规划器；动力学、摩擦和复杂多智能体接触是下一步问题。**
