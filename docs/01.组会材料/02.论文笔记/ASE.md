# ASE: Large-Scale Reusable Adversarial Skill Embeddings for Physically Simulated Characters

-   Paper Link: [https://arxiv.org/abs/2205.01906](https://arxiv.org/abs/2205.01906)
-   Github Link: [https://github.com/nv-tlabs/ASE](https://github.com/nv-tlabs/ASE)
-   Project Link: [https://research.nvidia.com/labs/toronto-ai/ASE/](https://research.nvidia.com/labs/toronto-ai/ASE/)

## 模型框架图

在预训练阶段，首先从大规模动作数据集采样参考动作片段，系统通过 Encoder 将每段动作映射到一个低维潜在技能空间中的技能向量 z。这里的 z 可以理解为一种动作技能的抽象表示，它不再对应具体关节轨迹，而是表示动作背后的运动模式。随后，随机采样得到的技能向量 z 与当前角色状态 sₜ 一起输入到底层策略网络 Low-Level Policy，策略输出动作 aₜ 驱动仿真角色运动，从而产生新的状态轨迹。为了让生成动作保持真实自然的人体运动特征，ASE引入了对抗模仿学习机制。图中的 Discriminator 判别器同时接收数据集中的参考动作和策略生成的动作轨迹，并判断其是否来自真实数据。判别器输出的结果构成模仿奖励 rₜ，用于指导策略学习逼近真实动作分布。同时，Encoder 还承担技能一致性约束的作用，它会根据当前生成的状态轨迹重新预测对应的技能向量，并要求预测结果与最初输入的 z 保持一致。这样能够避免策略忽略技能变量，确保不同的 z 真正控制不同类型的运动行为。经过这一阶段训练后，模型获得了一个统一的技能空间以及一个能够执行大量运动技能的底层控制器。

下半部分展示的是任务训练阶段。在这一阶段中，预训练得到的 Low-Level Policy 被固定下来，不再继续学习。对于具体任务，例如导航、追踪目标或者与环境交互，系统新增一个 High-Level Policy。高层策略根据当前状态 sₜ 和任务目标 g 输出技能指令 zₜ，而不是直接输出关节控制信号。随后，底层策略接收状态和技能向量，自动生成对应的控制动作 aₜ 并作用于环境。也就是说，高层策略负责决定当前应该使用什么技能，而底层策略负责将技能转化为具体的人体运动。

从整体上看，ASE最大的创新在于将复杂的运动控制问题分解为“技能学习”和“技能调用”两个层次。预训练阶段利用海量动作数据构建连续的技能潜空间，并学习统一的技能执行器；任务训练阶段只需要在技能空间中进行决策，而无需重新学习底层运动控制。因此，高层策略能够直接复用已经掌握的大量运动能力，实现技能切换、技能组合以及技能插值，大幅提升复杂任务的学习效率和泛化能力。这也是 ASE 相比传统单技能策略方法最核心的贡献。

![ASE模型框架图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260609133333686.png)
