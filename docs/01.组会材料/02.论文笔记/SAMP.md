# SAMP: Spatial Anchor-based Motion Policy for Collision-Aware Robotic Manipulators

- Github Link: [https://github.com/kkkkkaiai/SAMP](https://github.com/kkkkkaiai/SAMP)
- Paper Link: [https://arxiv.org/pdf/2509.11185](https://arxiv.org/pdf/2509.11185)

## 模型框架图

SAMP（Spatial Anchor-based Motion Policy）的目标是让机械臂在复杂障碍环境中生成**安全、无碰撞的运动轨迹**。从图中看，整个方法首先把环境和机器人都转换为空间几何表示，然后将两者在统一的空间位置上进行对齐，最后结合当前状态和目标状态预测下一步关节动作。它不是传统的 RRT 那样每次进行显式路径搜索，而是训练一个神经运动策略，输入当前机器人、环境和目标信息，直接预测下一步应该怎么运动。

首先看环境分支，系统把周围环境表示成一个 $160^3$ 的 Environment SDF，其中每个空间位置保存该位置到障碍物的距离，然后通过 3D CNN 对这个 SDF 进行编码，得到环境的空间特征。与此同时，根据机器人当前的关节配置 $q_t$，得到机器人当前姿态，并在机器人表面及其附近采样 1024 个三维点，形成图中的 Robot Points [3,1024]。这里的 Robot Points 可以理解为机器人当前身体在三维空间中的几何采样，它会随着机器人姿态 $q_t$ 的变化而变化。

接下来 Robot Points 会进入两条不同的分支。一条进入预训练的 Robot SDF Network，得到每个机器人采样点对应的 Robot SDF 特征，用来更加精确地描述机器人自身的几何形状；另一条进入 Point Cloud Encoder，进一步提取机器人点云的整体空间结构。与此同时，Robot Points 还作为查询位置，对前面的 Environment Feature 进行 Grid Sampling，也就是在机器人当前身体所在的空间位置，从环境的三维特征图中取出对应的环境特征。这样，对于机器人上的一个采样点 $p_i$，网络同时知道“这个位置附近有什么环境障碍物”和“这个位置属于机器人什么几何结构”，从而建立机器人与环境之间的空间关系，这实际上就是 SAMP 中 Spatial Anchor 思想最核心的地方。

除了几何信息之外，SAMP 还需要知道机器人“现在在哪里”和“最终要去哪里”。因此当前关节配置 $q_t$ 和目标关节配置 $q_g$ 会进行拼接，然后送入 C-space Encoder，通过 MLP 得到配置空间特征。此时网络已经获得三类关键信息：环境的空间特征、机器人自身的几何特征，以及从当前状态到目标状态的运动信息。随后这些特征进行融合形成 Fusion Latent，再经过图中的 Spatial Encoder 对空间关系进一步编码，最后交给 Decoder 生成动作输出。

最终 Decoder 并不是一次性生成完整轨迹，而是预测下一步的关节增量 $\Delta q_{t+1}$，然后与当前关节状态相加得到下一时刻状态，即 $q_{t+1}=q_t+\Delta q_{t+1}$。执行这个动作之后，再以新的 $q_{t+1}$ 重新生成 Robot Points、重新查询环境特征，再预测 $q_{t+2}$，如此循环直到到达目标。因此整个过程实际上是一个闭环、逐步生成的运动策略：$q_t\rightarrow q_{t+1}\rightarrow q_{t+2}\rightarrow\cdots\rightarrow q_g$。

训练阶段则通过右下角的 Collision Loss、Point Matching Loss 和 Configuration Loss 对策略进行约束。Configuration Loss 让预测的关节运动符合目标或专家轨迹，Point Matching Loss 约束机器人实际空间中的几何运动轨迹，而 Collision Loss 则利用环境与机器人之间的距离关系惩罚碰撞，使策略学会避开障碍物。所以从整张图来看，SAMP真正的核心并不是单纯“使用 SDF 做避障”，而是以机器人空间采样点为桥梁，把 Environment Feature、Robot SDF 和 Robot Point Feature 对齐到同一个空间位置，再结合 $q_t$ 和 $q_g$，学习一个能够直接输出下一步关节运动的碰撞感知策略。

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260909093744708.png)