---
date: 2026-09-28 16:16:40
title: Accelerating and Scaling MPC-Guided Reinforcement Learning for Humanoid Locomotion and Manipulation
categories:
  - 论文笔记
tags:
  - 机器人操作
  - 人形机器人
permalink: /materials/paper/mpc-rl
---

# Accelerating and Scaling MPC-Guided Reinforcement Learning for Humanoid Locomotion and Manipulation

- Project Link: [https://caltech-amber.github.io/mpc-guided-rl/](https://caltech-amber.github.io/mpc-guided-rl/)
- Github Link: [https://github.com/junhengl/mpc-rl](https://github.com/junhengl/mpc-rl)
- Paper Link: [https://arxiv.org/pdf/2606.05687](https://arxiv.org/pdf/2606.05687)
- **作者**：Junheng Li, Liang Wu, Sergio A. Esteban, Lizhi Yang, Jan Drgona, Aaron D. Ames
- **机构**：California Institute of Technology、Johns Hopkins University
- **机器人平台**：Westwood Robotics Themis V2 人形机器人


## 模型框架图

![](https://picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261026151129912.png)

## 一句话总结

这篇论文提出了 MPC-RL：在强化学习训练阶段，为每个并行环境运行一个基于质心动力学的 MPC，用 MPC 预测出的质心、动量、足端接触力以及手部推力等轨迹构造结构化奖励；部署时移除 MPC，只保留一个仅依赖本体感知的 PPO 策略。为了解决“4096 个环境中反复运行 MPC 太慢”的问题，作者又提出了可处理时变动力学、同时沿环境和预测时域并行的 $\pi^n$ MPC 求解器。

这里最重要的思想是：**MPC 不再是部署时的控制器，而是训练时的物理先验和探索引导器**。RL 学到的不是直接模仿某一条离线轨迹，而是在在线变化的速度指令、接触状态和任务状态下，学习跟随 MPC 给出的动态可行结构。

## 1. 为什么需要 MPC-RL

纯 RL 的优势是可以利用大规模仿真学习全身协调和鲁棒行为，但对人形机器人来说，奖励设计往往需要同时表达：

- 速度跟踪与长时域运动趋势；
- 质心位置、线动量和角动量的动态一致性；
- 足端接触、摩擦锥和接触力矩约束；
- 推箱子时身体与物体之间的力传递关系。

单纯依赖局部奖励，策略可能找到短期上“得分”的动作，却没有学到满足动力学和接触约束的运动结构。MPC 能利用模型进行预测，并显式处理摩擦锥、接触力和输入边界，因此可以提供比手工标量奖励更有结构的指导。

但传统 MPC-RL 有两个现实问题：

1. 如果部署阶段每一步都求解 MPC，系统仍然需要实时状态估计和在线优化，降低了策略部署的独立性。
2. 如果训练阶段在数千个环境中重复求解 MPC，QP 构造、内存占用以及沿预测时域的递推会成为主要瓶颈。

本文的方案分别对应解决这两个问题：**训练期使用、部署期移除**，以及用 $\pi^n$ MPC 让批量求解在 GPU 上可扩展。

## 2. 整体架构

每个训练控制周期执行如下流程：

1. 从仿真器读取当前全身状态，并将其映射到质心状态。
2. MPC 根据当前状态、速度指令、周期性接触计划和参考轨迹，预测未来一段时间的质心状态与接触力。
3. 从完整 MPC 轨迹中选取若干时间 landmark，而不是只使用下一时刻预测。
4. 将真实仿真状态与这些 landmark 对齐，构造 MPC guidance reward。
5. PPO 的 actor 使用带噪声的本体感知观测；critic 额外看到无噪声的特权信息和 MPC 参考。
6. 训练结束后，部署时只执行 actor，完全不运行 MPC，也不需要物体质量、物体状态等额外反馈。

因此，MPC 的作用是改变训练信号和 critic 的价值估计，而不是作为 actor 的运行时输入或动作生成器。

## 3. 质心动力学 MPC

### 3.1 状态与动力学

作者使用 9 维质心状态：

$$
\xi = \begin{bmatrix} c^\top & l_G^\top & k_G^\top \end{bmatrix}^\top,
$$

其中 $c$ 是质心位置，$l_G$ 是线动量，$k_G$ 是关于质心的角动量。离散质心动力学为：

$$
c_{k+1}=c_k+\Delta t\frac{1}{m}l_{G,k},
$$

$$
l_{G,k+1}=l_{G,k}+\Delta t\left(mg+\sum_{i\in\mathcal C_k}f_{i,k}\right),
$$

$$
k_{G,k+1}=k_{G,k}+\Delta t\sum_{i\in\mathcal C_k}
\left((p_{i,k}-c_k)\times f_{i,k}+\tau_{i,k}\right).
$$

$\mathcal C_k$ 是当前有效接触集合。对于行走任务，它主要包含左右脚；对于 loco-manipulation，还可以加入手部与环境的接触，用来描述推箱子所需的外力。

### 3.2 MPC 优化问题

在长度为 $N$ 的预测窗口内，决策变量是质心状态和各接触点的 wrench：

$$
\mathcal Z=\{\xi_k,f_{i,k},\tau_{i,k}\}_{k=0}^{N-1}.
$$

优化目标包含：速度指令跟踪、质心参考跟踪、角动量调节以及接触输入正则化：

$$
L_k=\|v_k^c-v_{cmd}^t\|_{Q_v}^2
+\|c_k-c_k^{ref}\|_{Q_c}^2
+\|k_{G,k}-k_{G,k}^{ref}\|_{Q_k}^2
+\sum_{i\in\mathcal C_k}\|u_{i,k}\|_{R_u}^2.
$$

约束包括：

- 质心离散动力学约束；
- 足端或手部接触 wrench cone；
- 摩擦金字塔约束；
- 非接触时对应接触力被置零；
- 接触力、接触力矩和法向力上界。

这个 MPC 是低阶模型：它没有直接优化全身关节轨迹，也没有完整表达柔性执行器、碰撞和复杂接触切换。因此它提供的是“动态骨架”，而不是可以直接下发给机器人关节的完整动作。

## 4. MPC landmark reward

### 4.1 为什么不能只跟踪下一步

最直接的做法是让当前状态跟踪 MPC 的下一步预测，但这样会丢掉 MPC 已经计算出的长时域信息。作者从整条预测轨迹中抽取 $N_L$ 个 landmark，覆盖从下一时刻到预测窗口末端的不同位置：

$$
\delta_\ell=n_\ell\Delta t,
\qquad
n_\ell=1+\lfloor s_\ell(N-1)\rfloor,
$$

其中 $s_\ell\in[0,1]$。第一个 landmark 接近下一步，最后一个 landmark 位于预测终点。

在未来时刻真正到达时，将真实质心与此前 MPC 对该时刻的预测进行比较：

$$
e_c^\ell(t)=c^t-c^{t-\delta_\ell}(\delta_\ell).
$$

最终的质心 guidance reward 是：

$$
r_{t,mpc,c}=\exp\left(
-\frac{\sum_{\ell=0}^{N_L-1}\alpha_\ell
\|e_c^\ell(t)\|_{Q_c}^2}{\sigma_c^2}
\right).
$$

### 4.2 预测置信度加权

作者没有平均地使用所有时间点，而是采用随预测距离递减的权重：

$$
\alpha_0>\alpha_1>\cdots>\alpha_{N_L-1}>0.
$$

论文实验使用：

$$
\alpha=\{0.5,\ 0.25,\ 0.15,\ 0.07,\ 0.03\}.
$$

直觉是，近时域预测受模型误差和积分误差影响较小，应该更可信；远时域预测虽然不精确，但包含重要的运动趋势，因此仍保留较小权重。这个设计在“只看下一步”和“平均跟踪整条轨迹”之间取得了折中。

同样的 landmark 思路还用于：

- CoM velocity；
- centroidal angular momentum；
- foot placement；
- ground reaction force；
- loco-manipulation 中的手部推力和物体状态参考。

总奖励可以写为：

$$
r_t=r_{t,reg}+\eta r_{t,mpc},
$$

其中 $r_{t,reg}$ 保留姿态、步态、足端抬脚、关节限位、自碰撞、软着地和动作变化率等正则项。

## 5. $\pi^n$ MPC：让 MPC 适合大规模 RL

### 5.1 原有瓶颈

训练使用 $N_{env}=4096$ 个并行环境。如果每个环境单独构造并求解一次 MPC，开销大致来自：

- 每个环境的 QP 构造；
- 预测时域内的顺序递推；
- 稀疏 QP 的大矩阵和 VRAM 占用；
- 特定问题的符号表达式生成和编译。

这使得“理论上有帮助”的 MPC 可能在 wall-clock 训练效率上得不偿失。

### 5.2 求解器的关键设计

$\pi^n$ MPC 建立在 parallel-in-horizon 的 ADMM 结构上，并做了两项关键扩展：

1. **处理时变动力学**：沿预测窗口保存 $A_k,B_k,e_k$，不再局限于时不变的单一动力学矩阵。
2. **construction-free**：直接对时变动力学和约束进行批量运算，避免每个更新周期重新组装庞大的稀疏 MPC-QP，也避免依赖问题专用的符号编译。

作者采用 velocity-form MPC，将优化变量改为输入增量 $\Delta u_k$，并引入 lifted state：

$$
\bar\xi_k=\begin{bmatrix}\xi_k\\u_{k-1}\end{bmatrix},
\qquad
\bar\xi_{k+1}=\bar A_k\bar\xi_k+\bar B_k\Delta u_k+\bar e_k.
$$

随后通过变量分裂引入 $z_{k+1}=\bar\xi_{k+1}$ 和 $v_k=\bar B_k\Delta u_k$。这样做的效果是：动力学一致性、状态/输入约束和局部二次代价可以被拆成适合 GPU 批量执行的子问题。ADMM 的 horizon 内更新不再依赖传统 Riccati 风格的顺序递推，并结合 Nesterov acceleration 和 restart 加快收敛。

### 5.3 实现与对比

论文提供 PyTorch 和 JAX 两套实现：

- `jax_pimpc`：JAX/XLA 编译，训练规模下通常更快，但预分配和内存开销更大；
- `pimpc`：PyTorch 版本，内存更友好；
- `admm`：批量 consensus-ADMM 基线。

对比对象包括 `qpax`、`qpth`、CusADi 和 consensus ADMM。实验结论是：

- 在并行环境数增加时，$\pi^n$ MPC 的 GPU 扩展性优于 consensus ADMM、qpth 和 qpax；
- CusADi 的求解速度接近，但 $N=10$ 时符号编译约需 1.5 小时、约 150 GB RAM，长时域时编译时间超过 5 小时；
- consensus ADMM 在更大规模或更长时域下明显变慢或耗尽 VRAM；
- $\pi^n$ MPC 在实验中仍可扩展到 $N=400$ 的预测时域。

## 6. RL 训练配置

- **算法**：PPO，基于 `rsl_rl` 和 `mjlab`。
- **并行环境**：4096。
- **物理频率**：200 Hz；控制频率 50 Hz。
- **最长 episode**：20 秒，即 1000 个控制步。
- **动作**：29 维关节位置增量，围绕默认姿态 $q^\star$，再由每关节 PD 控制器跟踪。
- **策略网络**：actor 和 critic 都是宽度为 $(512,256,128)$ 的 MLP，使用 ELU。
- **部署观测**：IMU 角速度、投影重力、关节位置/速度、上一动作、速度指令和二维步态相位。
- **观测噪声**：对角速度、重力投影、关节位置和关节速度加入均匀噪声，以提升真机鲁棒性。
- **critic 特权信息**：无噪声本体状态、基座线速度、足端离地高度，以及 MPC 预测的质心和角动量参考。

这种 asymmetric actor-critic 设计很关键：critic 可以利用训练期的 MPC 信息帮助估计价值，但 actor 不依赖这些部署时不可得的信息，因此策略仍然可以直接迁移到硬件。

作者还根据关节处的 effective inertia 选择 PD 增益：

$$
J_{eff,i}\ddot q_i+K_{d,i}\dot q_i+K_{p,i}q_i\approx0,
$$

$$
K_{p,i}=J_{eff,i}\omega_{n,i}^2,
\qquad
K_{d,i}=2\zeta_iJ_{eff,i}\omega_{n,i}.
$$

Themis V2 的执行器惯量较大、减速比低，作者选择较低的自然频率（约 1--2 Hz），避免过高带宽激发未建模的执行器柔性并导致髋部和膝部震荡。

## 7. 实验结果

### 7.1 MPC 配置选择

作者重点研究预测长度和更新频率：

- 预测长度过短时，策略获得的长时域信息不足；
- 预测长度过长时，模型误差累积，额外计算也不一定转化为更好的策略；
- $N=10$，约覆盖一个完整步态周期时，整体速度跟踪和抗推恢复表现最好；
- 固定 $N=10$ 时，10 Hz MPC 更新频率取得了较好的性能/训练效率折中；更高更新频率没有带来持续收益。

最终 locomotion 实验采用 $N=10$、10 Hz 的训练期 MPC，策略在约 6 小时内完成 15k 次训练迭代。

### 7.2 行走和抗推恢复

与 Pure RL 相比，MPC-RL 在以下方面更好：

- 常规速度指令和 OOD 速度指令的平移速度跟踪；
- 不同方向外力下的最大可恢复推力；
- 摩擦约束和接触 wrench cone 的满足率；
- 训练过程中的速度跟踪进展。

表格中的一个重要结论是，MPC-RL 并不是简单地让策略更贴近某个短期参考，而是通过接触力和质心动力学引导，减少了纯 RL 只依靠 foot-slip penalty 时出现的接触不一致。

### 7.3 不同 reward 设计对比

作者比较了：

1. Pure RL reward；
2. 基于 CLF 的 MPC landmark reward；
3. interpolated oracle guidance；
4. 本文的 prediction-confidence weighted MPC reward。

同时比较了三种 landmark 权重：

- **Next-step**：$\{1,0,0,0,0\}$；
- **Averaged**：$\{0.2,0.2,0.2,0.2,0.2\}$；
- **Tapered**：$\{0.5,0.25,0.15,0.07,0.03\}$。

结果显示，tapered 方案在速度跟踪、抗推恢复和单位时间的训练进展上整体最好。next-step 方案缺少长时域结构，averaged 方案又对远期预测给予了过高权重；递减权重更符合低阶质心模型的预测置信度。

### 7.4 Loco-manipulation：推箱子

对于推箱子任务，MPC 在训练中加入手部接触变量和箱体状态参考，使奖励同时约束：

- 机器人质心和动量；
- 脚部接触力；
- 手部推力；
- 机器人与箱体的速度协调。

仿真中，机器人推动质量随机变化的 20 kg 箱子；纯 RL 即使添加箱体速度、身体速度匹配和接触粘附奖励，也很早停滞，而 MPC-RL 能学到更强的推行行为。真机实验中，Themis V2 可以推动总负载约 290 kg 的小车，对应机器人自身质量的 829%，测得所需推力约 180 N。

这个实验说明 MPC guidance 的价值不局限于“走得更稳”：对于探索空间很大、成功奖励稀疏的施力操作任务，物理模型可以把策略从一开始就引向可行的接触和力传递模式。

## 8. 论文贡献拆解

### 贡献一：把 MPC 变成训练期的结构化奖励

很多 MPC-RL 工作让 MPC 参与运行时控制，或者让策略学习 residual。本文的选择更彻底：MPC 只负责训练中的 predictive guidance，最终策略单独执行。这降低了部署计算和状态依赖，同时保留了模型先验。

### 贡献二：prediction-confidence weighted landmarks

作者没有把 MPC 轨迹简单当作 imitation target，而是把预测距离和模型可信度绑定起来：近端强监督，远端弱监督。这个设计具有较强的普适性，尤其适合低阶模型指导高维全身策略的场景。

### 贡献三：面向 RL 批量环境的 $\pi^n$ MPC

求解器同时利用环境维度和 horizon 维度的并行性，并避免频繁构造大型 QP。它解决的是 MPC-guided RL 能否在真实训练预算内运行的问题，而不只是单次求解速度问题。

### 贡献四：扩展到全身 loco-manipulation

论文将手部接触力加入质心 MPC，并在真机上展示了推动超大负载小车的能力，证明这种训练期模型引导也可以服务于强交互操作，而不只适用于行走。

## 9. 我的理解与批判性分析

### 9.1 方法真正解决了什么

本文并没有解决“如何用 MPC 在部署时精确控制完整人形机器人”这个问题，而是解决了另一个更实用的问题：**如何让 RL 在大规模训练中获得动态和接触方面的先验，同时不把 MPC 的运行成本带到部署阶段**。

因此它的核心价值可以概括为：

$$
	ext{低阶模型的可解释性}
\quad + \quad
	ext{RL 的高维全身表达能力}
\quad \Longrightarrow \quad
	ext{可部署的全身策略}.
$$

### 9.2 为什么质心模型足够有用

质心动力学虽然不表达每个关节的细节，但它直接约束了人形机器人最难凭奖励学出来的宏观量：整体平衡、动量变化、接触力分配和受力方向。actor 再通过本体感觉学习如何把这些宏观目标落实到 29 个关节上。也就是说，MPC 负责“身体整体应该怎样运动”，RL 负责“具体每个关节怎样协同实现”。

### 9.3 方法的边界

论文自己也承认了几项限制：

- 依赖降阶质心动力学，可能遗漏关节级碰撞、柔性和局部接触效应；
- 接触序列是预先规定的，不能完全自主发现复杂接触模式；
- $\pi^n$ MPC 仍然是数值求解器，环境规模和预测长度继续增大时仍会遇到计算与显存上限；
- 手部推力的规划依赖简化接触模型，复杂物体几何、滑动和多点接触还没有充分覆盖；
- 论文展示了很强的硬件结果，但对不同机器人形态、不同执行器和不同地面条件的泛化仍需要更多验证。

### 9.4 实验解读时需要注意

论文报告的是训练期 MPC 的收益，而不是部署时 MPC 的实时性能。部署阶段策略不需要 MPC，这一点是方法设计的优势；但也意味着最终性能仍依赖训练分布、观测噪声和 sim-to-real 设计。另一个重要事实是，MPC 并非越精确、越频繁或越长时域越好：$N=10$ 和 10 Hz 的结果说明，预测信息的质量、时域和训练成本之间存在平衡。

## 10. 与其他 MPC-RL 范式的区别

| 范式 | MPC 在哪里运行 | 策略是否依赖 MPC | 主要优点 | 主要代价 |
| --- | --- | --- | --- | --- |
| 运行时 MPC | 部署/控制循环 | 通常依赖 | 约束处理直接 | 实时算力和状态估计要求高 |
| residual RL + MPC | 部署时 MPC + 学习 residual | 依赖 | 可在 MPC 基础上补偿复杂行为 | 系统复杂，仍保留 MPC 开销 |
| offline trajectory imitation | 训练前生成轨迹 | 通常不依赖 | 训练时便宜 | 探索受离线轨迹分布限制 |
| **本文 MPC-RL** | **只在训练期** | **不依赖** | **动态引导与部署独立兼得** | **训练增加 MPC 成本，且依赖降阶模型** |

## 11. 可复现要点

代码仓库使用 Python 3.11--3.13、CUDA 12 和 `uv`。主要训练任务为：

```bash
# Locomotion
CUDA_VISIBLE_DEVICES=0 uv run train Mjlab-MPC-Guided-Locomotion-Themis \
  --env.scene.num-envs 4096 \
  --agent.max-iterations 15000

# Loco-manipulation
CUDA_VISIBLE_DEVICES=0 uv run train Mjlab-MPC-Guided-Loco-manipulation-Themis \
  --env.scene.num-envs 4096 \
  --agent.max-iterations 25000
```

MPC 配置主要包括：`mpc_dt`、`mpc_horizon`、`run_every_n_steps`、`solver_type`、机器人质量、步态周期、占空比、质心高度，以及摩擦系数和接触力上界。代价权重包括 $Q_c$、$Q_l$、$Q_k$、终端代价缩放和输入增量正则化。

## 12. 最终 takeaway

1. **MPC 最适合在 RL 中提供结构，而不一定要在部署时提供动作。**
2. **完整预测轨迹比单步 target 更有价值，但远期预测必须降权。**
3. **大规模 MPC-RL 的关键不只是算法复杂度，还包括 QP 构造、显存和编译开销。**
4. **质心动力学可以成为连接“模型约束”和“全身策略”的中间表示。**
5. **对于推箱子等稀疏、强接触任务，MPC guidance 对探索的帮助可能比普通 locomotion 更明显。**
6. **未来方向是更丰富的接触模式、非线性 MPC，以及神经网络增强的批量求解器。**