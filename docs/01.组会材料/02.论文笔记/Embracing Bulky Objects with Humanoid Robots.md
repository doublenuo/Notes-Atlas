# Embracing Bulky Objects with Humanoid Robots: Whole-Body Manipulation with Reinforcement Learning

- Github Link: [https://github.com/Chunx1nZHENG/Embracing-Bulky-Objects-with-Humanoid-Robots](https://github.com/Chunx1nZHENG/Embracing-Bulky-Objects-with-Humanoid-Robots)
- Paper Link: [https://arxiv.org/pdf/2509.13534v1](https://arxiv.org/pdf/2509.13534v1)
## 模型框架图

这篇论文主要解决的是人形机器人如何利用全身多个身体部位去抱持和搬运大型物体。整个方法的核心思想是，作者并不是直接让强化学习去控制机器人所有关节，而是先利用人体动作数据学习一个低维的机器人运动先验，也就是 Motion Prior，然后再在这个运动先验的基础上训练真正的 Whole-Body Embracing Policy。这样可以把原本非常复杂的高维关节控制问题转换成在低维运动空间中进行任务决策。

这篇论文的整体方法可以概括为：先利用人体 Mocap 数据学习一个“人形机器人自然运动的先验”，再在这个运动先验的基础上训练一个专门负责“大物体环抱搬运”的强化学习策略。具体来说，首先从 AMASS 等 Mocap Dataset 中获取大量人体动作，然后进行 Data Cleaning，去除存在脚滑、碰撞、姿态异常等问题的动作；接着通过 Motion Retargeting 将人体动作映射到目标人形机器人 H1 的运动学结构上，得到机器人能够执行的参考运动轨迹。这里得到的数据主要解决的是“机器人应该怎样自然地运动”，还没有涉及具体的搬箱任务。

然后进入图中的 Motion Prior Distillation。作者首先利用这些 retarget 后的动作训练一个 Teacher Policy，Teacher 输入机器人当前的 proprioceptive state 和参考动作，通过 PPO 学习如何让机器人准确跟踪人体运动轨迹，因此它实际上是一个“人体动作模仿控制器”。但 Teacher 在真正执行任务时需要参考轨迹，而搬运箱子时并没有提前规划好的 reference motion，因此作者进一步使用 VAE 对 Teacher 进行蒸馏。Encoder $\mathcal E$ 同时观察当前机器人状态和参考动作，把完整的高维运动信息压缩成低维 latent $z_t$，Decoder $\mathcal D$ 再把这个 latent 解码成机器人关节动作 $a_t$，通过让 Student 的动作逼近 Teacher 的动作，使 latent 空间学习到人体运动的结构。

与此同时，作者训练了一个 Motion Prior $\mathcal R$。它不再需要参考动作，而是只根据机器人当前状态 $s_t^d$，预测当前情况下合理的运动 latent 分布 $(\mu_t^p,\sigma_t^p)$。训练时通过 KL divergence 让 Prior 输出的分布接近 Encoder 得到的 latent 分布，因此训练结束后，Prior 就能够在没有 Mocap 参考轨迹的情况下，根据机器人当前状态判断“机器人正常情况下应该采用什么样的运动”。最终得到的 Prior $\mathcal R$ + Decoder $\mathcal D$ 被冻结下来，成为整个系统的运动先验，也就是说后面的强化学习不需要从零学习“怎么走、怎么弯腰、怎么抬手”，而是在这个已经学好的自然运动空间里面进行任务层面的调整。

接下来就是图 (c) 的 Embracing Policy Training，这是整个任务策略的核心。Embracing Policy 同样通过 PPO 训练，但它不直接输出机器人的 27 个关节动作，而是输出一个低维的 latent residual $z_t^s$。策略输入的是任务相关信息，包括机器人自身状态、物体相对于机器人 torso 的位置关系、目标位置，以及最关键的 NSDF 几何特征。NSDF 可以理解成一种连续的距离场特征，用来描述物体与机器人上半身不同身体部位之间的距离，例如左右手臂、躯干等距离物体还有多远，因此 RL 策略可以明确知道“应该让哪个身体部位继续靠近物体”。

Embracing Policy 输出的 residual 并不是独立控制机器人，而是和 Motion Prior 提供的正常运动 latent 结合起来：

$$ z_t = \mu_t^p + z_t^s $$

其中 $\mu_t^p$ 提供“正常的人形运动”，而 $z_t^s$ 提供“为了完成抱箱任务需要做的调整”。这个组合后的 latent 再输入冻结的 Decoder $\mathcal D$，最终生成机器人 27 个关节的目标位置 $a_t^s$，再由底层控制器执行。因此整个 RL 学习过程实际上是在回答一个问题：“在保持自然全身运动的前提下，为了把眼前这个大物体抱起来并搬到目标位置，我应该怎样调整自己的身体动作？” NSDF 则帮助策略产生手臂、胸口等多个身体部位同时接近物体的行为，从而形成稳定的多点接触。

最终整个流程就是 “人体动作 → 清洗 → Retarget 到机器人 → Teacher 学习动作跟踪 → VAE 蒸馏成低维 Motion Prior → 冻结 Prior + Decoder → PPO 学习 Embracing Policy → 输出 latent residual → 与 Motion Prior 相加 → Decoder 生成关节动作 → 完成环抱、抬升和搬运”。所以这篇论文真正的核心不是单纯用 PPO 搬箱子，而是把问题拆成了两个层次：Motion Prior 负责解决“机器人怎么自然地动”，Embracing Policy 负责解决“为了搬这个物体应该怎么改动作”，再利用 NSDF 提供物体—身体之间的几何关系，使策略最终形成全身、多接触点的环抱搬运行为。

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260906101815551.png)