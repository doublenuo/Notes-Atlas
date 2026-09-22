# Retargeting Matters: General Motion Retargeting for Humanoid  Motion Tracking

- Project Link: [https://jaraujo98.github.io/retargeting_matters/](https://jaraujo98.github.io/retargeting_matters/)
- Github Link: [https://github.com/YanjieZe/GMR](https://github.com/YanjieZe/GMR)
- Paper Link: [https://arxiv.org/abs/2510.02252](https://arxiv.org/abs/2510.02252)
- Video Link: [https://youtu.be/kr3I_g1GLYw](https://youtu.be/kr3I_g1GLYw)
## 论文介绍

这篇论文探讨了**人形机器人运动跟踪**中的关键挑战，即如何有效弥补人类与机器人之间的**身体形态差异**。研究人员发现，现有的运动重定向方法往往会产生动作不稳或物理上不可行的错误，从而削弱了训练策略的稳定性，主要包括：

-   足部滑动：机器人脚部在支撑阶段发生位移；
-   地面穿透：脚部陷入地面以下；
-   自碰撞：身体部位互相重叠；
-   物理不可行运动：产生突发的异常速度。

为此，作者提出了一种名为通用运动重定向（GMR）的新技术，旨在提升动作转换的质量。通过在多样化数据集上的实验，该研究证明了高精度重定向对于实现流畅且真实的机器人动作至关重要。与现有的开源工具相比，GMR方法在模拟复杂动态序列时表现出更高的忠实度与成功率。这项工作强调了在不依赖过度奖励调优的情况下，优化基础数据质量对机器人学习的重要性。

![Retargeting Matters论文介绍](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260428104436124.png)

## 模型框架

![Retargeting Matters模型框架图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260423114208069.png)

### 人机关键身体匹配

从源人体骨骼(可以来自动作捕捉系统或 BVH 和 SMPL 等 格式的文件)和目标机器人骨骼(在 XML 或 URDF机器 人描述文件中找到)中的身体列表开始,首先定义人类和机器人关键身体(通常是躯干、头部、腿、脚、 手臂和手)之间的映射。此信息用于设置 IK 解算器的优化问题，用户还可以为这些关键体的位置和方向跟踪误差提供权重。

### 笛卡尔空间静止姿势对齐

人类在默认的零点姿态是 T-Pose，但机器人默认的零点姿态手是垂下的，需要通过旋转偏移旋转人类的骨骼方向，使得人类的初始姿态与机器人的初始姿态在空间中完全重合。
$$
R_{robot} = \Delta R \cdot R_{human}
$$
针对特定的关节，还要微调位置偏移，会加入局部位置偏移量 $p_{\mathrm{offset}}$，以解决诸如内八字或脚部错位这类因机械结构引起的伪影。

### 人类数据非均匀局部缩放

机器人和人的腿长、臂展比例通常不一致，简单的统一缩放会导致动作变形，在其他重定向方法中发现的大多数伪影都是在缩放源运动时引入的。缩放过程的第一步是根据人的身高 $h$ 和参考身高 $h_{ref}$ 算出大体的缩放比例，该通用因子用于调整为每个关键主体定义的自定义局部比例因子，可以为不同部位设置不同的缩放因子。例如，机器人腿短手长，那么腿部动作就缩得小一点，手臂动作缩得大一点。笛卡尔空间中的目标身体位置由下式给出
$$
\mathbf{p}_{b}^{\mathrm{target}}=\frac{h}{h_{\mathrm{ref}}}s_{b}(\mathbf{p}_{j}^{\mathrm{source}}-\mathbf{p}_{\mathrm{root}}^{\mathrm{source}})+\frac{h}{h_{\mathrm{ref}}}s_{\mathrm{root}}\mathbf{p}_{\mathrm{root}}^{\mathrm{source}}
$$

其中$h$为人体源骨骼的高度,$h_{\mathrm{ref}}$ 为设置缩放因子时假设 的参考高度，$p_b$ 表示身体位置, $s_b$ 为身体b对应的缩放因子。

### 求解具有旋转约束的机器人逆运动学

有了目标位置后，需要计算机器人的关节角度$q$，目标是希望找到机器人广义坐标，以最小化相对于参考的身体位置和方向误差。为了避免陷入死循环或者局部优化最小值,作者采用两阶段过程。给定目标姿势,在第一阶段我们解决以下优化问题,该问题仅考虑末端执行器的位置和所有的执行方向。

$$
\begin{aligned}
\mathrm{min}_{\mathbf{q}}&\sum_{(i,j)\in\mathcal{M}}(w_{1})_{i,j}^{R}\|R_{i}^{h}\ominus R_{j}(\mathbf{q})\|_{2}^{2} +\sum_{(i,j)\in\mathcal{M}_{\mathrm{ce}}}(w_{1})_{i,j}^{p}\|\mathbf{p}_{i}^{\mathrm{target}}-\mathbf{p}_{j}(\mathbf{q})\|_{2}^{2}\\\mathrm{subject~to}\quad & \mathbf{q}^{-}\leq\mathbf{q}\leq\mathbf{q}^{+}\end{aligned}
$$

它不是一步算出结果，而是计算一个速度$q$，通过多次迭代让机器人慢慢靠近目标姿态，同时保证关节转动不会超过机器人的物理极限。为了数值稳定性，使用微分逆运动学进行求解
$$
\min_{\dot{q}} \| e(q) + J(q) \dot{q} \|_2^2 W
$$
其中 $J(q) = \frac{\partial e}{\partial q}$ 是雅可比矩阵，$e(q)$ 是上述损失函数。

在第四步的基础上，进行最后的精细调整，这一步会计算所有的关键部位，利用第四步的结果作为初始值，通过优化算法让机器人的整体姿态更接近人类，而不仅仅是手脚到位。
$$
\begin{array}{rl}\min_{\mathbf{q}}&\sum_{(i,j)\in\mathcal{M}}\left(w_2\right)_{i,j}^R\|R_i^h\ominus R_j(\mathbf{q})\|_2^2+(w_2)_{i,j}^p\|\mathbf{p}_i^\mathrm{target}-\mathbf{p}_j(\mathbf{q}^r)\|_2^2\\\mathrm{subject~to}&\mathbf{q}^-\leq\mathbf{q}\leq\mathbf{q}^+\end{array}
$$
当这五步走完，你就得到了一帧完美的动作。对于一段**视频或动作序列**，每一帧都以上一帧的结果作为初始值，保证动作连贯，系统会自动计算机器人离地的最低点，然后整体上下平移，确保机器人稳稳地踩在地面上。

## 实验

作者的实验核心目标是验证 GMR 生成的动作数据是否比现有方法更少伪影，以及这些数据是否能让强化学习RL策略更容易学会走路和运动。

数据集： 使用了[LAFAN1](https://github.com/ubisoft/ubisoft-laforge-animation-dataset)动作捕捉数据集中的 21 种多样化动作，包括行走、跑步、跳舞、武术等；

重定向方法Baseline：

-   [PHC](https://github.com/ZhengyiLuo/PHC)：目前非常流行的物理模拟人物控制框架；
-   [ProtoMotions](https://github.com/NVlabs/ProtoMotions)：NVIDIA Labs 发布的 GPU 加速模拟框架，内置了基于 PyRoki 的重定向工具；
-   Unitree Official：官方针对自研硬件微调的数据，通常不可获取，GMR 的目标是达到甚至超越它；
-   [GMR](https://jaraujo98.github.io/retargeting_matters/)：本文提出的重定向方法。

强化学习策略：[BeyondMimic](https://github.com/HybridRobotics/whole_body_tracking)框架用于训练高动态的机器人动作追踪，论文中将其作为训练策略的 Baseline。

### 重定向方法对策略的影响

![重定向方法成功率](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260428103701124.png)

![重定向方法跟踪误差](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260428103719883.png)

### 失败案例

![重定向失败案例](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260427170129350.png)
