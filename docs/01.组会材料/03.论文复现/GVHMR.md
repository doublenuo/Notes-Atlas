---
date: 2026-10-15 21:45:49
title: GVHMR
permalink: /materials/reproduction/gvhmr
categories:
  - 论文复现
tags:
  - 人体运动恢复
---

# GVHMR: World-Grounded Human Motion Recovery via Gravity-View Coordinates

- Project Link：[https://zju3dv.github.io/gvhmr/](https://zju3dv.github.io/gvhmr/)
- Github Link: [https://github.com/zju3dv/GVHMR](https://github.com/zju3dv/GVHMR)
- Paper Link: [https://arxiv.org/pdf/2409.06662](https://arxiv.org/pdf/2409.06662)

## 论文方法概述

### 研究问题

GVHMR（World-Grounded Human Motion Recovery via Gravity-View Coordinates）研究如何从单目 RGB 视频中恢复人体在统一世界坐标系下的连续三维运动。与仅预测人体局部三维姿态的方法不同，世界坐标系下的人体运动恢复不仅需要估计人体关节姿态，还需要恢复人体的全局朝向、根节点平移轨迹以及与重力方向相关的空间信息。

现有方法在这一任务中主要面临两个问题：
- **全局坐标系存在歧义**。 不同视频的相机位置、观察方向和运动状态不同，人体在图像中的运动与其真实世界运动之间存在复杂的几何关系，增加了全局姿态与轨迹估计的难度。
- **自回归预测容易产生误差累积**。 部分方法通过逐帧预测相对运动并递推恢复全局轨迹，前序预测误差可能传递至后续帧，导致人体朝向和运动轨迹逐渐偏离真实结果。

针对上述问题，GVHMR 提出 Gravity-View（GV）坐标系，将世界重力方向与相机视线方向结合，构建与每一帧对应的重力对齐坐标系。在此基础上，模型直接预测各帧的人体运动状态，再结合相机旋转将预测结果转换至统一的世界参考坐标系，以降低全局朝向估计的歧义及自回归预测带来的误差累积。

### 核心创新

1. **提出 Gravity-View（GV）坐标系**：GV 坐标系由重力方向和相机视线方向共同定义，并随视频帧变化。由于该坐标系与重力方向对齐，模型可以在更稳定的几何参考下学习人体姿态和朝向，降低直接在相机坐标系中进行全局运动预测所面临的歧义。
2. **采用逐帧并行预测的运动恢复方式**：区别于依赖历史预测结果逐步生成后续运动的自回归方法，GVHMR 利用时序 Transformer 对视频特征进行建模，直接预测各帧的人体状态，再通过相机旋转关系恢复统一的全局运动序列，从而减少预测误差在时间维度上的递推累积。
3. **结合时序建模与全局运动恢复**：模型融合人体视觉信息、二维关键点及相机运动信息，通过基于相对位置编码的 Transformer 建模人体运动的时序关系，并联合预测人体姿态、全局朝向及根节点运动相关变量，使局部人体姿态与全局轨迹恢复能够协同进行。
4. **引入手脚静止状态预测与运动后处理**：GVHMR 通过预测手脚等部位的静止状态，为全局平移修正提供接触相关线索，并结合逆运动学后处理改善人体运动的空间一致性，减少足部滑动等不自然现象

### 方法框架

![](https://picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261015144940283.png)

GVHMR 的整体流程可分为以下五个阶段：
1. **输入视频与特征提取**：输入连续单目 RGB 视频，通过人体检测、跟踪及相关预处理获取人体检测框、二维人体关键点、图像特征和相机相对旋转等信息，为后续人体状态预测提供视觉和几何依据。
2. **构建 Gravity-View 坐标系**：根据重力方向和相机视线方向，为每一帧定义对应的 GV 坐标系。该坐标系天然与重力方向对齐，使人体朝向预测可以在约束更明确的参考系下进行，降低相机视角变化与人体自身旋转之间的耦合。
3. **时序特征融合与人体状态预测**：将各类输入特征映射至统一的特征空间并进行融合，利用 Transformer 建模视频中的时序关系。网络通过多个预测分支估计人体局部姿态、人体形状、GV 坐标系下的朝向、根节点运动以及手脚静止状态等变量。
4. **恢复世界坐标系下的全局运动**：利用各帧 GV 坐标系之间的相机旋转关系，将逐帧预测的朝向转换至统一的世界参考坐标系。随后将根节点运动信息转换到相应坐标系并进行轨迹积分，恢复人体全局位置与连续运动轨迹。
5. **运动后处理与结果输出**：利用手脚静止状态修正全局平移，并通过逆运动学调整局部人体姿态，改善运动连续性和接触一致性。最终输出世界坐标系下的人体三维运动结果。

##  复现运行流程

### 复现环境

| 项目            | 配置  |
| :---:|:---:|
| 操作系统          | Ubuntu 22 |
| GPU           | RTX 4090 |
| GPU 显存        | 24GB |
| Python       | 3.10          |
| 环境管理         | uv            |


### 安装依赖

以下命令对应官方仓库的基础安装流程，并使用 uv 管理虚拟环境。

```bash
git clone --recursive https://github.com/zju3dv/GVHMR.git
cd GVHMR

uv venv gvhmr --python 3.10
source gvhmr/bin/activate

uv pip install -r requirements.txt
uv pip install -e .
```

检查环境：

```bash
python --version
python -c "import torch; print(torch.__version__)"
python -c "import torch; print(torch.cuda.is_available())"
```

如果 `torch.cuda.is_available()` 返回 `False`，应检查 PyTorch 安装包、CUDA 运行时和驱动兼容性，而不是直接认定显卡驱动损坏。

> 注意：官方仓库的依赖版本可能随代码更新而变化。复现时应保存实际使用的 `requirements.txt`、安装日志和 Git commit，避免后续环境变化导致无法复现。

### 模型权重与数据准备

#### 模型权重

官方安装说明提供了预训练模型及人体模型的下载指引。

- **官方权重下载：** [Google Drive 模型资源](https://drive.google.com/drive/folders/1eebJ13FUEXrKBawHpJroW0sNSxLjh9xD?usp=drive_link)
- **SMPL 模型：** [SMPL 官网](https://smpl.is.tue.mpg.de/)
- **SMPL-X 模型：** [SMPL-X 官网](https://smpl-x.is.tue.mpg.de/)

SMPL 和 SMPL-X 模型需要按相应网站的授权要求获取。下载后，应将文件放置到项目实际读取的路径中。

官方仓库的主要资源目录如下：

```text
GVHMR/
├── inputs/
│   └── checkpoints/
│       ├── body_models/
│       │   ├── smpl/
│       │   │   └── SMPL_NEUTRAL.pkl
│       │   └── smplx/
│       │       ├── SMPLX_FEMALE.npz
│       │       ├── SMPLX_MALE.npz
│       │       └── SMPLX_NEUTRAL.npz
│       ├── dpvo/
│       │   └── dpvo.pth
│       ├── gvhmr/
│       │   └── gvhmr_siga24_release.ckpt
│       ├── hmr2/
│       │   └── epoch=10-step=25000.ckpt
│       ├── vitpose/
│       │   └── vitpose-h-multi-coco.pth
│       └── yolo/
│           └── yolov8x.pt
├── docs/
├── tools/
└── outputs/
```

上述结构列出主要资源，不代表所有文件都必须在每一种运行模式下使用。具体以所用代码版本的配置文件和安装说明为准。

**权重检查：**

```bash
find inputs/checkpoints -type f -printf '%p %s bytes\n'
```

记录每个模型的来源、文件大小及校验结果，不要将缺失权重、下载失败或空文件误判为模型加载成功，可以参考以下测试：

```bash
inputs/checkpoints/gvhmr/gvhmr_siga24_release.ckpt 163508011 bytes
inputs/checkpoints/vitpose/vitpose-h-multi-coco.pth 2549075546 bytes
inputs/checkpoints/body_models/smpl/SMPL_NEUTRAL.pkl 247186228 bytes
inputs/checkpoints/body_models/smplx/SMPLX_FEMALE.npz 108794146 bytes
inputs/checkpoints/body_models/smplx/version.txt 33 bytes
inputs/checkpoints/body_models/smplx/smplx_npz.zip 90885221 bytes
inputs/checkpoints/body_models/smplx/SMPLX_FEMALE.pkl 544434140 bytes
inputs/checkpoints/body_models/smplx/SMPLX_MALE.npz 108753445 bytes
inputs/checkpoints/yolo/yolov8x.pt 136867539 bytes
inputs/checkpoints/dpvo/dpvo.pth 14167743 bytes
inputs/checkpoints/hmr2/epoch=10-step=25000.ckpt 2709494041 bytes
```

#### 视频数据

本次首先使用自定义视频验证推理流程，视频放在 `inputs/videos/` ，视频主要使用最近比较火的闪身步这个视频：[https://www.bilibili.com/video/BV1YMaA6jEpK/](https://www.bilibili.com/video/BV1YMaA6jEpK/).

```text
inputs/
├── checkpoints/
└── videos/
    ├── gouxiong.mp4
    ├── langzitiqiu.mp4
    ├── shanshenbu.mp4
    └── yaotouhuangnao.mp4
```

视频统一使用`ffmpeg`按时间截取视频，建议记录每个视频的基本信息：

| 视频                   | 分辨率     | 帧率     | 时长   |
| -------------------- | ------- | ------ | ---- |
| `gouxiong.mp4`       | 960×720 | 30 FPS | 13 秒 |
| `langzitiqiu.mp4`    | 960×720 | 30 FPS | 6 秒  |
| `shanshenbu.mp4`     | 960×720 | 30 FPS | 7 秒  |
| `yaotouhuangnao.mp4` | 960×720 | 30 FPS | 10 秒 |

其中，静态相机视频和移动相机视频应分别测试。静态相机可以使用 `-s` 跳过视觉里程计；移动相机视频不应直接使用该选项，否则可能影响全局运动恢复结果。

