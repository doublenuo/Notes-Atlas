# ViBe: Visual Behavior Adaptation for Perceptive Humanoid Whole-Body Control

- Project Link: [https://lok-i.github.io/vibe-control/](https://lok-i.github.io/vibe-control/)
- Paper Link: [https://arxiv.org/pdf/2609.09918](https://arxiv.org/pdf/2609.09918)
## 模型框架图

ViBe 的整体方法可以分为三个连续阶段。首先，在仿真环境中，机器人接收视觉图像、本体状态、任务指令和运动指令，预训练视觉编码器将图像转换为 patch tokens 和 cls token。随后，Visual Extractor 通过多个查询分支，将全局视觉信息、任务指令和本体状态映射为 Query，并利用 Cross-Attention 从视觉特征中提取与当前任务相关的感知信息。

第二阶段是运动控制。Reference Generator 根据运动指令生成参考运动，输入预训练的 Whole-body Tracker。该 Tracker 已经具备人形机器人自然的全身运动能力，而 ViBe 在其输入层、隐藏层和输出层加入 LoRA Adapter，将视觉特征融合进原有运动控制网络，使机器人能够根据环境变化调整动作。

第三阶段是强化学习训练。Agent 将环境观测输入 Planner 和 Controller，输出全身动作作用于仿真环境，环境返回任务奖励。训练过程中利用参考数据集和任务奖励进行策略优化，主要学习 Visual Extractor 与 LoRA Adapter 的参数，而保留预训练视觉编码器和全身运动跟踪器的运动先验。最终得到一个能够利用视觉感知环境，并执行全身运动适应的 humanoid perceptive control policy。

![](https://ubuntu-picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20260912122843493.png)
