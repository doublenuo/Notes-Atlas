# Natural Humanoid Robot Locomotion with Generative Motion Prior

-   Paper Link: [https://arxiv.org/abs/2503.09015](https://arxiv.org/abs/2503.09015)
-   Porject Link: [https://sites.google.com/view/humanoid-gmp](https://sites.google.com/view/humanoid-gmp)

## 模型框架图

首先看图(a)，作者先进行 **Whole-body Motion Retargeting**。由于人类和机器人具有不同的骨骼结构、关节自由度以及运动约束，原始人体动作数据无法直接用于机器人控制。因此作者首先将大规模人体运动数据库中的动作序列通过运动重定向映射到机器人运动空间，从而得到与机器人结构一致的参考运动数据集。经过这一过程之后，原来的人体步态、转向、奔跑等动作被转换成机器人能够执行的关节轨迹，为后续运动先验学习提供训练数据。

接下来是图(b)，这是整篇论文最核心的部分——**Generative Motion Prior（GMP）**。作者采用一种类似条件变分自编码器（CVAE）的结构学习机器人运动分布。在训练阶段，上半部分使用真实机器人动作序列作为输入，Motion Encoder将当前姿态 mt 和下一时刻姿态 mt+1编码到潜变量空间 zt+1，随后Motion Decoder根据该潜变量重建未来姿态，从而学习运动数据中的时序演化规律。在训练完成后，推理阶段不再使用Motion Encoder，而是使用下方的Command Encoder。此时系统输入当前机器人姿态 mt 和用户控制指令 ct（例如前进速度、转向角速度等），Command Encoder直接生成潜变量 zt+1，再通过已经训练好的Motion Decoder预测未来动作。这样模型实际上学习到了“在给定运动指令条件下，人类风格运动应该如何自然演化”的运动分布。

然后看图(c)，作者利用训练好的 GMP 来指导强化学习控制。当前时刻机器人状态 mt和控制命令 ct 被输入到 Generative Motion Prior 中，模型不仅预测下一帧动作 mt+1，而且能够递归生成未来多个时刻的参考动作序列，即 Robot Future Reference Motion。这一点与 AMP 等方法存在本质区别。AMP 使用判别器判断动作是否像人类，而 GMP 直接生成未来应该执行的完整运动轨迹。因此强化学习策略不再学习“什么是自然动作”，而是学习如何跟踪 GMP 给出的参考运动。RL Policy 根据环境状态输出控制动作，机器人在仿真环境中执行，同时利用参考运动计算跟踪奖励，从而不断优化控制策略。

整个框架的核心思想可以概括为：作者先通过运动重定向获得机器人版本的人类动作数据，然后利用生成模型学习人类运动分布，构建能够根据控制指令在线生成未来参考轨迹的 Generative Motion Prior，最后使用这些参考轨迹引导强化学习训练机器人控制器。相比传统 AMP 只提供风格奖励的方式，GMP 直接生成未来运动目标，使强化学习获得更加密集、稳定且可解释的监督信号，从而实现更加自然的人形机器人步态控制。

![模型框架图](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260609185850383.png)