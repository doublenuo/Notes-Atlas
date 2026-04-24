---
date: 2026-04-24 11:51:53
title: dualboot
categories:
  - tools
  - linux
  - docs
permalink: /tools/linux/dualboot
---
# Windows 安装 Ubuntu 24.04 双系统教程

> 带*的为使用 Linux 操作系统进行操作，目前身边没有安装有 Linux 操作系统的机器可不用看这部分！

## 前置条件

- **两块硬盘**, 新手建议使用两个硬盘，防止数据覆盖，不过理论上一块也可以，新建磁盘分区就可以
  - Windows 电脑可以下载 [diskgenius](https://www.diskgenius.cn/download.php) 进行磁盘分区，或者使用系统设置的磁盘管理进行分区均可
- **一个容量大于 4G 的 U 盘**, 用于制作 linux 系统启动盘
- **Ubuntu 24.04.4 desktop iso 文件**, 将这个文件下载到电脑任意一个位置均可
  - 下载链接：这两个链接都可以试一下, 一定看准文件进行下载 **ubuntu-24.04.4-desktop-amd64.iso**, 文件大小大概 6.2G
    - [https://mirrors.aliyun.com/ubuntu-releases/24.04/](https://mirrors.aliyun.com/ubuntu-releases/24.04/)
    - [https://mirrors.tuna.tsinghua.edu.cn/ubuntu-releases/24.04.4/](https://mirrors.tuna.tsinghua.edu.cn/ubuntu-releases/24.04.4/)
- **Rufus**: 这是一个创建 USB 启动盘的工具，可以将任意 U 盘创建成 Linux 系统启动盘
  - 下载链接：[https://rufus.ie/zh/#download](https://rufus.ie/zh/#download)
- DiskGenius：一款功能强大的磁盘管理及数据恢复软件，主要用于进行硬盘分区、格式化、备份与恢复丢失的文件等操作
  - 下载链接：[https://www.diskgenius.com/download.php](https://www.diskgenius.com/download.php)

## 整体安装过程

1. 首先需要将 U 盘创建成 Linux 系统启动盘，**注意这一步会将 U 盘格式化**，需要将 U 盘数据提前备份好，这里需要用到上面下载好的工具 *Rufus* 和 *Ubuntu 24.04 ISO* 文件, 插入 U 盘后打开 Rufus, 将 iso 文件写入到 u 盘制作成启动盘，**注意不是将 iso 文件复制到 u 盘**，具体过程参考 [创建 U 盘启动盘](#创建u盘启动盘)；
2. 在 windows 系统压缩出来一个空白分区，具体大小参考 [Linux 系统磁盘分区管理](#Linux系统磁盘分区管理)，新建空白分区可以在 diskgenius 软件或者磁盘管理进行操作；
3. 查看磁盘格式，MBR 格式一般对应 Legacy Bios 启动模式，GPT 格式一般对应 UEFI 启动模式，后续方便我们进入 Bios 进行修改相关的启动项；
4. 重启电脑进入 bios 修改启动模式, 这里就要看磁盘格式对应不同的启动模式，不同电脑进入 bios 的操作有所不同，具体可以参考 [如何进入 BIOS 设置界面](#如何进入BIOS设置界面), 进入 bios 修改的选项有 *secure boot* 修改为否，*UEFI/Legacy Boot* 修改为对应的启动模式, **修改完成记得保存**；
5. 插入 U 盘后进入重启电脑，参考 [如何进入启动选项](#如何进入启动选项) 进入启动选项, 选择从 U 盘启动即可进入系统引导项进行系统安装。

## 前置知识

### 如何查看磁盘的分区格式

在 windows 系统上打开磁盘管理，按照下图操作进行查看磁盘格式，主要有 GPT 和 MBR 两种分区格式，对应不同的启动模式。

![查看磁盘的分区格式](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320074032.png)

### 磁盘分区管理

在安装双系统之前，要想好该给 Linux 系统分配多少空间，**磁盘空间规划** 决定了后续是否好用、是否需要重装, 这一步非常重要，错误的磁盘分区在后续安装中可能会 **覆盖 windows 数据导致 windows 系统故障**。

当然了，空间分配要取决于用途和实际的硬盘容量，这里假设你是 1T 的硬盘，可以参考下面的表格。



| 使用类型 | Linux 用途| 推荐空间|
| --- | ---| ---|
| 🧪 体验型       | 学习、尝试、偶尔用              | **40–60 GB**   |
| 💻 开发型（推荐）   | 编程 / Docker  | **100–200 GB** |
| 🤖 重度开发      | 深度学习 / 模型 / 数据集 /AI        | **300 GB+**    |
| 🔁 Linux 主力系统 | 日常全部在 Linux             | **≥50%硬盘**     |

在考虑好 linux 系统需要预留多少空间之后，也要考虑 **linux 系统的磁盘分区**，类似于 windows 系统的 C 盘、D 盘也要进行磁盘分区。以预留 300GB 空间为例，linux 系统的磁盘分区可以参考下面的表格。

|文件系统|分区|大小|说明|
|---|---|---| ---|
|ext4| /boot| 500MB-1GB| 系统启动分区|
|ext4| / | 100GB| 系统与软件分区，类似于 windows 的 C 盘，存放系统与软件|
|swap|swap|取决于内存大小| 主要用于休眠和虚拟内存使用，现代 16GB 内存的笔记本电脑其实不太需要 swap 分区，但建议给 2-4GB 作为 swap 分区，低于 8GB 的内存建议给 16GB 作为 swap 分区|
|ext4| /home |将上述分配好的剩余空间全部给该分区|数据文件分区, 类似于 windows 的 D 盘，存放个人软件和数据|


### 如何进入 BIOS 设置界面

BIOS 用于修改电脑的底层硬件配置，例如启动顺序、虚拟化支持、安全启动等。在部分老旧设备中，可能需要进入 BIOS 进行调整, 原因是有些老旧设备可能还在使用 MBR 格式，对应的是 Legacy 启动模式，但现代 Windows 11 系统默认使用 GPT 格式的磁盘，且默认启用 UEFI 固件模式，因此现代 windows 电脑默认 **不需要进入 BIOS 修改启动模式**，这里提供一下老旧电脑进入 bios 的方法。

#### 开机快捷键进入 BIOS

首先在设备完全关机的状态下按下电源键进行开机，在出现厂商 Logo 时快速按下 BIOS 快捷键，常见品牌对应的快捷键如下：

|品牌|BIOS 快捷键|
|---|---|
| 华硕| Del 或 F2|
| 联想| F2 或 Fn + F2 |
| 戴尔| F2 |
| 惠普| F10 或 Esc|
| 宏碁| F2|
| 微星| Del|
| 技嘉| Del|
|苹果|长按 option 键|
|华为|F12 或 F2|

数据均来源于网络，可能略有误差，如若无法通过快捷键启动，可以上网查询自己该设备及主板型号如何进入 BIOS, 或者通过以下 Windows 11 高级启动进入 BIOS。

#### 从 Windows 11 高级启动进入

若快捷键无法启动 BIOS 设置，可以尝试通过 Windows 11 系统高级启动进入 BIOS, 具体方法为打开 **设置-> 系统-> 恢复**, 在高级启动中点击点击重新启动，重启后依次选择 **疑难解答-> 高级选项-> UEFI 固件设置-> 重启**, 系统将自动进入 BIOS。

![Windows 11 高级启动](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320151944.png)

![通过高级启动进入 BIOS](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/f6948d6fa521da334f01660927026451.jpg)

### 如何进入启动选项(Boot Menu)

启动选项菜单（Boot Menu）用于 临时选择启动设备，我们可以从 U 盘启动安装系统，进入启动选项的方法与进入 BIOS 类似，在设备完全关机的状态下按下电源键进行开机，在出现厂商 Logo 时快速按下启动选项快捷键，常见品牌对应的快捷键如下：

|笔记本品牌|启动按键|
|:-:|:-:|
|联想笔记本|F12|
|宏基笔记本|F12|
|华硕笔记本|ESC 或 F8|
|惠普笔记本|F9|
|联想 Thinkpad|F12|
|戴尔笔记本|F12|
|神舟笔记本|F12|
|东芝笔记本|F12|
|三星笔记本|F12|
|IBM 笔记本|F12|
|苹果笔记本|长按 *option* 键|
|清华同方笔记本|F12|
|明基笔记本|F9|
|微星笔记本|F11|
|索尼笔记本|ESC|

|   台式机品牌   | 启动按键 |
| :------------: | :------: |
|   联想台式机   |   F12    |
|   惠普台式机   |   F12    |
|   宏基台式机   |   F12    |
|   戴尔台式机   |   ESC    |
|   神舟台式机   |   F12    |
|   华硕台式机   |    F8    |
|   方正台式机   |   F12    |
| 清华同方台式机 |   F12    |
|   海尔台式机   |   F12    |
|   明基台式机   |    F8    |

数据均来源于网络，可能略有误差，如若无法通过快捷键启动，可以上网查询自己该设备及主板型号如何进入启动选项。

## 开始安装

### 创建 U 盘启动盘

#### Windows 系统将 U 盘制作成系统启动盘

首先准备好 **Ubuntu 24.04 Desktop ISO** 镜像文件，**Rufus** 创建 U 盘启动盘工具，插入 U 盘后打开 **Rufus** 工具，镜像文件选择 Ubuntu 24.04 Desktop ISO 后写入 U 盘，其余默认设置不需要修改，点击开始后即可开始创建 U 盘启动盘，默认按照 **ISO 模式** 写入即可。

![Rufus 将 U 盘制作成系统启动盘](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153450.png)

若写入失败，则先格式化 U 盘，再选择换一个 USB 接口或者重新插入 U 盘写入。

#### Linux 系统将 U 盘制作成系统启动盘*

假如你有另一台安装好了 linux 的设备，也可以使用 Linux 系统来制作 U 盘系统启动盘。

首先使用以下命令查看 U 盘设备的存储位置, 一般是 `/dev/sdx`, **注意要将 iso 镜像文件写入 U 盘，而不是 U 盘的分区**，对应下图也就是需要将文件写入到 `/dev/sda` 而不是 `/dev/sda1`。

```bash
sudo lsblk -f
```

![Linux 系统查看磁盘信息](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320132357680.png)

使用 `dd` 命令开始将 U 盘制作成系统启动盘

```bash
sudo dd if=ubuntu-24.04.4-desktop-amd64.iso of=/dev/sda bs=4M status=progress oflag=sync
```

- `if`: input file，输入文件路径;
- `of`: output file，输出设备或文件, 注意是整个 u 盘;
- `bs=4M`: 每次读写 4MB，提高写入效率;
- `status=progress`: 显示实时进度，包括已写入的数据量和速度;
- `oflag=sync`: 每次写操作都同步写入磁盘, 保证数据写入完整。

命令完成后必须使用 `sync` 命令将缓存也写入 U 盘，避免文件碎片未写入 U 盘导致数据损坏。

```bash
sync
```

![Linux 系统将 U 盘制作成系统启动盘演示](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320145945495.png)

同步完成之后需要一下查看 U 盘是否制作成功

```bash
sudo lsblk -f
```

![查看 U 盘是否制作成功](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320150213518.png)

### 磁盘管理

要安装双系统，首先需要 **给 Linux 系统创建一个空白分区**，注意不要在 windows 中格式化为 NTFS 或者 FAT32，Linux 系统在安装时会自动格式化为 ext4，swap 等。

具体操作为在 Windows 系统磁盘管理找一个有容量多余的磁盘，点击压缩卷，单位换算为 $1GB=1024MB$.

![Windows 磁盘管理](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320154143.png)

注意这里可压缩空间量与磁盘剩余的空间量不总是一样的，这是因为存在磁盘碎片的原因，文件在硬盘上的数据块不是连续存放的，而是被分散在不同位置，但是可压缩空间量会尝试将文件 **连续存储或者以更小的块** 存储，可以使用 Windows 自带的磁盘碎片清理工具进行清理，或者自行使用其他方法进行清理。

![Windows 压缩卷](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320154423.png)

最终一定要有一块这样 **灰色的未分配空间** 供 Linux 系统安装使用。

### BIOS 与启动选项

#### BIOS 设置

进入 BIOS 的操作过程可以参考 [如何进入 BIOS 设置界面](#如何进入bios设置界面)，进入 BIOS 系统对英语不熟悉的同学可以先更改一下语言设置。

![BIOS 语言设置](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153034.png)


进入 BIOS 需要修改的选项主要有以下几个：

- **启动模式（UEFI/Legacy Boot）**：修改为对应的启动模式，GPT 磁盘格式为 UEFI 启动模式，MBR 磁盘格式为 Legacy 启动模式;
- **安全启动（Secure Boot）**：修改为否, 默认大部分 Linux ISO 支持 Secure Boot, 但部分发行版不支持，因此选择关闭，安装成功后可以选择打开 Secure Boot;

![BIOS 修改相关设置](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153138.png)

- **启动顺序（Boot Priority / Boot Order）**: BIOS 会按照顺序寻找启动设备，如果 U 盘或硬盘没有在第一位，系统可能直接进入 Windows, 不过这一项也可以不用设置，后续我们直接进入启动选项（Boot Menu）进行 U 盘启动即可；

![启动顺序图](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153233.png)

- **CSM Support**：将 CSM 开启，保证 UEFI 主板上兼容旧版 BIOS 启动；
- **USB Boot**：某些 BIOS 默认关闭 USB 引导，因此我们需要开启 USB Boot，否则 U 盘无法被识别。

#### 启动选项

进入启动选项的操作可以参考 [如何进入启动选项](#如何进入启动选项boot-menu)

进入启动选项后使用 U 盘启动即可。

![启动选项](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153322.png)

### 系统引导

这一部分按照不同的发行版引导程序进行操作即可，注意在磁盘分区的一定要选择 **手动分区**, 否则可能会误触导致 Linux 安装程序抹除 Windows 系统数据，这里以安装 Ubuntu Desktop 24 为例。

首先进入 Ubuntu 安装引导程序，第一个设置为语言设置，建议选择 English, 若选择简体中文的话后续文件系统会出现中文目录，个人感觉不是很方便，不过后续也可以进行修改。

![Ubuntu 设置语言](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324111516611.png)

接下来是一些 Ubuntu 系统设置，这一步通常不用理会，直接点下一步即可，后续安装成功可以修改相关的设置。

![Ubuntu 系统设置](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324111557749.png)

键盘布局设置选择 English（US）或者 English（UK）都可以，二者只有一些细微区别，影响不大。

![Ubuntu 键盘设置](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324111644671.png)

接下来是网络设置，由于是使用的 Ubuntu 安装镜像 ISO 文件离线安装，不需要选择连接网络，连接网络可能会导致系统更新、安装额外软件和驱动导致安装系统特别慢，因此这一步选择不连接互联网。

![Ubuntu wifi 设置](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324111723468.png)

这一步不需要点击 update now, 选择下一步即可。

![Ubuntu 更新设置](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324111801098.png)

如果只是想试用 ubuntu 系统可以点击 Try Ubuntu, 但是我们的需求是安装 Ubuntu，因此点击 Install Ubuntu。

![Ubuntu 是否安装](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324111830275.png)

这一步点击交互式安装，自动安装需要写 `autoinstall.yml` 脚本，是对于高级用户来实现特定功能的，普通用户点击交互式安装即可。

![Ubuntu 交互式安装](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324111911941.png)

这一步选择默认选项即可，Extended section 会安装一些 office 工具，如果有需要也可以选择这个选项，不过一般情况下选择默认选项进行安装系统必须项即可。

![Ubuntu 默认安装](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324111943909.png)

这一步不用勾选任何第三方软件，后续安装好系统再行安装其他第三方软件。

![Ubuntu 是否安装第三方软件](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324112028337.png)

这一步一定要选择手动安装 Ubuntu, 这样我们才能进行磁盘分区，若选择不当，可能会抹除 Windows 系统的相关数据，一定要仔细选择。

![Ubuntu 手动进行磁盘分区](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324112150963.png)

下面就可以参考 [Linux 系统磁盘分区管理](#磁盘分区管理) 来一步步进行磁盘分区，这一步也要看清楚，每一项都是从 free space 划分磁盘空间。

![Ubuntu 磁盘分区管理-1](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324112229652.png)

![Ubuntu 磁盘分区管理-2](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324112350288.png)

这里就要设置你的用户名、主机名和密码了

- 用户名是 Linux 系统中每个人的身份标识，用于登录系统、执行命令和访问文件，通常使用小写字母和数字，不推荐使用空格或特殊符号，系统有些保留用户名是无法使用的，例如 `root`、`admin`、`daemon`、`nobody` 等等
- 主机名是你的电脑在网络中的名字，相当于设备 id，在命令行、ssh、局域网识别显示中会出现，建议使用一些带有标识型的名字，例如 `Ubuntu`、`HP`、`Lenovo` 等等

![Ubuntu 设置用户名和主机名](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324112418346.png)

中国用户时区设置选择中国上海时区即可，其他用户选择自己国家对应的时区。

![Ubuntu 设置时区](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324112450189.png)

最后在确认一遍相关配置信息，点击安装即可。

![最后检查一遍相关配置](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260324112508417.png)

## 系统启动

### 更换软件源

这里推荐一个全平台通用换源工具 [chsrc](https://github.com/RubyMetric/chsrc)，使用 `chsrc` 更换 Ubuntu 软件源非常简单。

```bash
sudo chsrc set ubuntu
```

![chsrc 全平台通用换源工具](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320220438879.png)

### 默认启动项

若安装的是 Ubuntu 系统，则启动菜单的默认项为 Grub 菜单，默认启动 Linux 系统，要想启动 Windows 系统则需要在 10s 倒计时结束之前选择到 Windows 系统，对于较常使用 Windows 系统的同学就非常不友好，这里修改成 W **indows 系统为默认启动项**。


首先我们启动 Ubuntu 系统，在终端输入以下命令查看 grub 的启动菜单具体有哪些

```bash
sudo grep menuentry /boot/grub/grub.cfg
```

![查看启动菜单](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320172702545.png)

可以看到具体的启动项有以下几个：

|序号|启动项名称|说明|
| ---|---|---|
| 0  | Ubuntu| 默认 Ubuntu 启动项|
| 1  | Advanced options for Ubuntu              | 子菜单，包含 Ubuntu 的历史内核和恢复模式 |
| 2  | Windows Boot Manager (on /dev/nvme0n1p1) | Windows 系统启动项            |
| 3  | UEFI Firmware Settings                   | 进入 BIOS/UEFI 固件设置        |


然后输入以下命令修改默认启动项

```bash
sudo vim /etc/default/grub
```

修改以下选项

- `GRUB_DEFAULT=0` 修改为
`GRUB_DEFAULT='Windows Boot Manager (on /dev/nvme0n1p1)'`, 当然了如果你懂这个序号是什么意思的话也可以用序号，例如我这里是 `GRUB_DEFAULT=2`;
- `GRUB_TIMEOUT_STYLE` 值修改为 menu;
- `GRUB_TIMEOUT` 可以修改为 3, 意思是等待 3 秒用户选择后启动系统；

注意修改完之后记得使用 `sudo update-grub` 来更新 grub 启动菜单

![更新 grub 启动菜单](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320174733941.png)

### 输入法中英文切换


建议使用 fcitx5 输入法框架, 比其他的输入法更稳定

```bash
sudo apt update
sudo apt install fcitx5 fcitx5-chinese-addons fcitx5-configtool
```

执行以下命令并设置 Fcitx 为默认输入法，执行以下命令后必须注销或者重启系统才可以生效

```bash
im-config
```

配置环境变量并设置开机自动启动

```bash
vim ~/.profile
# 以下是需要写入文件的内容
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS=@im=fcitx
# 设置开机自启动
mkdir -p ~/.config/autostart
cp /usr/share/applications/org.fcitx.Fcitx5.desktop ~/.config/autostart/
```

最后需要添加中文拼音输入法, 执行交互式安装命令，选择拼音输入法即可

```bash
fcitx5-configtool
```

默认中英文切换快捷键是 `ctrl+space`。

#### Rime+雾凇拼音

Rime 与雾凇拼音是一套比较好的中文拼音输入法，安装这一套请确保上述步骤已完成。

首先需要安装 Rime 引擎，这里我们选择 fcitx5 作为输入法框架，因此需要安装 fcitx5 的 Rime 插件

```bash
sudo apt update
sudo apt install fcitx5-rime
```

接下来需要添加 Rime 输入法，打开配置找到对应点 rime 添加到输入法即可。

```bash
fcitx5-configtool
```

雾凇拼音是一套优化好的 Rime 配置和现代词库，代码仓库位于 [https://github.com/iDvel/rime-ice](https://github.com/iDvel/rime-ice)

```bash
git clone https://github.com/iDvel/rime-ice.git ~/.local/share/fcitx5/rime
```

### 系统时间同步

计算机中存在两种时间

- RTC 时间：也就是主板 BIOS 中的硬件时间，关机后仍然可以运行;
- 系统时间：操作系统运行时使用的时间。

系统启动时，操作系统会从 RTC 读取时间作为当前系统时间。Windows 系统的 RTC 时间默认使用本地时间，而 Linux 的系统时间同步是使用 UTC 机制，本质上是让你的电脑时钟自动与互联网标准时间服务器保持一致，避免时间漂移，例如你先使用了 Linux 系统，这时 RTC 时间就与互联网标准时间服务器保持一致，这时候你再切换到 Windows，就会导致时间不一致的情况。

有些教程建议让 Linux 使用本地时间：

```bash
timedatectl set-local-rtc 1
```

但是这里不推荐使用这种方式，这样会导致日志时间混乱，容器与服务器环境不兼容等等各种问题，因此推荐 Windows 系统使用 UTC 时间作为本地时间，在 Windows 系统打开终端，执行下述注册表命令修改时间。

```powershell
reg add HKLM\SYSTEM\CurrentControlSet\Control\TimeZoneInformation ^ /v RealTimeIsUniversal /t REG_DWORD /d 1
```

### 设置默认用户为 root

由于安全模型优化，从 Ubuntu 20.04 开始禁用 root 直接登录，Ubuntu 引入了 sudo 管理模型，也就是日常使用普通用户，需要管理员权限时临时 sudo 提权，这是非常合理的做法，可以提高系统的安全性与稳定性。在 Linux 桌面环境下 root 用户直接运行 gui 可能会导致 **配置文件权限混乱**、**浏览器崩溃**、**Wayland 拒绝运行** 等问题，但对于高级用户是可以避免这些问题的。

#### 为 root 用户设置密码

要想默认登陆 root 用户，就需要先为 root 用户设置密码。

```bash
sudo passwd root
```

要注意密码不少于 8 位，这也是为了安全性考虑的，一旦程序泄漏，非法分子登陆到 root 用户可以直接拿到管理员权限。

![设置 root 用户的密码](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260321213750478.png)

#### 允许 root 登录

Ubuntu 默认设置是不允许 root 远程登录的，因此需要修改一些配置项来保证可以 ssh 远程登录。

```bash
sudo vim /etc/ssh/sshd_config
```

所有的配置和具体含义如下：

```bash
PermitRootLogin prohibit-password # 这个选项表示只允许 root 用户通过密钥登陆，若设置为 yes 则表示允许密码登录，千万不要为设置为可用密码登陆，可能存在暴力破解的风险
PasswordAuthentication no # 禁止所有密码登录
PubkeyAuthentication yes # 启用公钥认证
PermitEmptyPasswords no # 禁止空密码:
```

修改完配置以后记得重启一下 ssh

```bash
sudo systemctl restart ssh
```

最后需要远程登录的话记得生成密钥并把公钥写到 root 用户的 `.ssh` 文件夹下, 具体操作如下：

```bash
sudo -i # 切换到 root 用户
ssh-keygen -t ed25519 #不懂配置的话一直按回车就可以
mkdir -p /root/.ssh # 创建 root 的 ssh 目录
# ssh 对权限配置较为严格，需要设置好权限
chmod 700 /root/.ssh 
chmod 600 /root/.ssh/authorized_keys
cat /root/.ssh/id_ed25519.pub >> /root/.ssh/authorized_keys # 将公钥写入配置文件实现免密登录
ssh localhost # 测试是否可以免密登陆
```

![root 用户设置密钥免密码登陆 ssh](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260321231240029.png)

#### 配置桌面登录 root 用户

由于 Ubuntu 默认在 PAM 层禁止 root，因此要在桌面端登陆 root 用户，需要修改 GDM 配置

```bash
sudo vim /etc/pam.d/gdm-password
```

找到这一行 `auth required pam_succeed_if.so user != root quiet_success`, 给它添加注释 `#auth required pam_succeed_if.so user != root quiet_success`, 这一步决定 root 能不能登录 GUI

![GDM 层启用 root 用户](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260321232330694.png)

接下来还需要修改 GDM 配置使其自动登录用户为 root

```bash
sudo vim /etc/gdm3/custom.conf
```

具体需要修改的选项如下：

```bash
[daemon]

# 自动登录
AutomaticLoginEnable=true
AutomaticLogin=root

# 建议关闭 Wayland，Wayland 对 root 用户不太支持
WaylandEnable=false
```

![设置 GDM 自动登录 root 用户](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260321232640257.png)

重启一下 GDM 查看是否使用 root 用户进入了桌面

```bash
sudo systemctl restart gdm3
```

若启动完电脑黑屏，可以尝试按 `Ctrl+Alt+F3` 进行 tty1 命令行，在命令行中将之前修改的选项恢复，然后重新启动 GDM。

## 疑难杂症

### 设置 Swap 交换缓存

```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 取消 Swap 交换缓存
sudo swapoff /swapfile
sudo rm /swapfile
```

### Ubuntu 系统分区扩容

### 彻底卸载 snap

### U 盘修复

当你的 U 盘是 NTFS 文件系统时，且在 Windows 电脑插入过并未安全弹出，可能会被 Windows 标记为 dirty，Linux 系统的 `ntfs3` 驱动为了防止数据损坏会拒绝自动挂载，这时候需要修复 U 盘。

```bash
lsblk -f # 查看 U 盘设备硬件位置
sudo ntfsfix -d /dev/sdx # 注意替换为 U 盘的实际位置, 这一步会清除 dirty bit, 修复基础元数据
udisksctl mount -b /dev/sdx # 重新挂载 U 盘
```

![U 盘自动挂载](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260322130025071.png)

这时候就会发现 U 盘已经修复好了，尝试重新插入 U 盘并查看挂载点，如果不是这个问题，可以尝试先安装以下工具。

```bash
sudo apt install udisks2 gvfs gvfs-backends ntfs-3g exfatprogs
```

然后检查一下自动挂载开关是否开启

```bash
gsettings get org.gnome.desktop.media-handling automount
# 若输出为 false，则运行以下命令开启自动挂载
gsettings set org.gnome.desktop.media-handling automount true
gsettings set org.gnome.desktop.media-handling automount-open true
```

### U 盘安全弹出

