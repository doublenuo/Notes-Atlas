# 安装双系统教程

!> **本教程重点关注已经安装Windows操作系统下如何进行Linux双系统的安装，且发行版为Ubuntu 24.04 Desktop**

?> 带*的为使用Linux操作系统进行操作，只有Windows系统的用户可以不看这些部分！

## 前置条件

- 两块磁盘分区（理论上一块也可以，不过可能在处理双系统启动的时候可能会有故障）；
  - Windows电脑可以下载[diskgenius](https://www.diskgenius.cn/download.php)进行磁盘分区
  - 或者使用系统设置的磁盘管理进行分区均可
- 一个容量大于8G的U盘,用于制作linux系统启动盘
- Ubuntu 24.04.4 desktop iso 文件,将这个文件下载到电脑任意一个位置均可
  - 下载链接：这两个链接都可以试一下,一定看准文件进行下载**ubuntu-24.04.4-desktop-amd64.iso**,文件大小大概6.2G
    - [https://mirrors.aliyun.com/ubuntu-releases/24.04/](https://mirrors.aliyun.com/ubuntu-releases/24.04/)
    - [https://mirrors.tuna.tsinghua.edu.cn/ubuntu-releases/24.04.4/](https://mirrors.tuna.tsinghua.edu.cn/ubuntu-releases/24.04.4/)
- Rufus:这是一个创建USB启动盘的工具，可以将任意U盘创建成Linux系统启动盘
  - 下载链接：[https://rufus.ie/zh/#download](https://rufus.ie/zh/#download)
- DiskGenius：一款功能强大的磁盘管理及数据恢复软件，主要用于进行硬盘分区、格式化、备份与恢复丢失的文件等操作
  - 下载链接：[https://www.diskgenius.com/download.php](https://www.diskgenius.com/download.php)

## 整体安装过程

1. 首先需要将U盘创建成Linux系统启动盘，**注意这一步会将U盘格式化**，需要将U盘数据提前备份好，这里需要用到上面下载好的工具*Rufus*和*Ubuntu 24.04 ISO*文件,插入U盘后打开Rufus,将iso文件写入到u盘制作成启动盘，**注意不是将iso文件复制到u盘**，具体过程参考[创建U盘启动盘](#创建u盘启动盘)；
2. 在windows系统压缩出来一个空白分区，具体大小参考[Linux系统磁盘分区管理](#Linux系统磁盘分区管理)，新建空白分区可以在diskgenius软件或者磁盘管理进行操作；
3. 查看磁盘格式，MBR格式一般对应Legacy Bios启动模式，GPT格式一般对应UEFI启动模式，后续方便我们进入Bios进行修改相关的启动项；
4. 重启电脑进入bios修改启动模式,这里就要看磁盘格式对应不同的启动模式，不同电脑进入bios的操作有所不同，具体可以参考[如何进入 BIOS设置界面](#如何进入BIOS设置界面),进入bios修改的选项有*secure boot*修改为否，*UEFI/Legacy Boot*修改为对应的启动模式,**修改完成记得保存**；
5. 插入U盘后进入重启电脑，参考[如何进入启动选项](#如何进入启动选项)进入启动选项,选择从U盘启动即可进入系统引导项进行系统安装。

## 前置知识

### 如何查看磁盘的分区格式

在windows系统上打开磁盘管理，按照下图操作进行查看磁盘格式，主要有GPT和MBR两种分区格式，对应不同的启动模式。

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320074032.png)

### 磁盘分区管理

在安装双系统之前，要想好该给Linux系统分配多少空间，**磁盘空间规划**决定了后续是否好用、是否需要重装,这一步非常重要，错误的磁盘分区在后续安装中可能会**覆盖windows数据导致windows系统故障**。

当然了，空间分配要取决于用途和实际的硬盘容量，这里假设你是1T的硬盘，可以参考下面的表格。

| 使用类型 | Linux用途| 推荐空间|
| --- | ---| ---|
| 🧪 体验型       | 学习、尝试、偶尔用              | **40–60 GB**   |
| 💻 开发型（推荐）   | 编程 / Docker  | **100–200 GB** |
| 🤖 重度开发      | 深度学习 / 模型 / 数据集 /AI        | **300 GB+**    |
| 🔁 Linux主力系统 | 日常全部在Linux             | **≥50%硬盘**     |

在考虑好linux系统需要预留多少空间之后，也要考虑**linux系统的磁盘分区**，类似于windows系统的C盘、D盘也要进行磁盘分区。以预留300GB空间为例，linux系统的磁盘分区可以参考下面的表格。

|文件系统|分区|大小|说明|
|---|---|---| ---|
|ext4| /boot| 500MB-1GB| 系统启动分区|
|ext4| / | 100GB| 系统与软件分区，类似于windows的C盘，存放系统与软件|
|swap|swap|取决于内存大小| 主要用于休眠和虚拟内存使用，现代16GB内存的笔记本电脑其实不太需要swap分区，但建议给2-4GB作为swap分区，低于8GB的内存建议给16GB作为swap分区|
|ext4| /home |将上述分配好的剩余空间全部给该分区|数据文件分区,类似于windows的D盘，存放个人软件和数据|

### 如何进入BIOS设置界面

BIOS用于修改电脑的底层硬件配置，例如启动顺序、虚拟化支持、安全启动等。在部分老旧设备中，可能需要进入 BIOS 进行调整,原因是有些老旧设备可能还在使用MBR格式，对应的是Legacy启动模式，但现代Windows 11 系统默认使用GPT格式的磁盘，且默认启用UEFI固件模式，因此现代windows电脑默认**不需要进入BIOS修改启动模式**，这里提供一下老旧电脑进入bios的方法。

#### 开机快捷键进入BIOS

首先在设备完全关机的状态下按下电源键进行开机，在出现厂商Logo时快速按下BIOS快捷键，常见品牌对应的快捷键如下：

|品牌|BIOS 快捷键|
|---|---|
| 华硕| Del或F2|
| 联想| F2或Fn + F2 |
| 戴尔| F2 |
| 惠普| F10或Esc|
| 宏碁| F2|
| 微星| Del|
| 技嘉| Del|
|苹果|长按option键|
|华为|F12或F2|

数据均来源于网络，可能略有误差，如若无法通过快捷键启动，可以上网查询自己该设备及主板型号如何进入BIOS,或者通过以下Windows 11 高级启动进入BIOS。

#### 从 Windows 11 高级启动进入

若快捷键无法启动BIOS设置，可以尝试通过Windows 11系统高级启动进入BIOS,具体方法为打开**设置->系统->恢复**,在高级启动中点击点击重新启动，重启后依次选择**疑难解答->高级选项->UEFI 固件设置->重启**,系统将自动进入 BIOS。

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320151944.png)

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/f6948d6fa521da334f01660927026451.jpg)

### 如何进入启动选项(Boot Menu)

启动选项菜单（Boot Menu）用于 临时选择启动设备，我们可以从 U 盘启动安装系统，进入启动选项的方法与进入BIOS类似，在设备完全关机的状态下按下电源键进行开机，在出现厂商Logo时快速按下启动选项快捷键，常见品牌对应的快捷键如下：

|笔记本品牌|启动按键|
|---|---|
|联想笔记本|F12|
|宏基笔记本|F12|
|华硕笔记本|ESC或F8|
|惠普笔记本|F9|
|联想Thinkpad|F12|
|戴尔笔记本|F12|
|神舟笔记本|F12|
|东芝笔记本|F12|
|三星笔记本|F12|
|IBM笔记本|F12|
|苹果笔记本|长按*option*键|
|清华同方笔记本|F12|
|明基笔记本|F9|
|微星笔记本|F11|
|索尼笔记本|ESC|

|台式机品牌|启动按键|
|---|---|
|联想台式机|F12|
|惠普台式机|F12|
|宏基台式机|F12|
|戴尔台式机|ESC|
|神舟台式机|F12|
|华硕台式机|F8|
|方正台式机|F12|
|清华同方台式机|F12|
|海尔台式机|F12|
|明基台式机|F8|

数据均来源于网络，可能略有误差，如若无法通过快捷键启动，可以上网查询自己该设备及主板型号如何进入启动选项。

## 开始安装

### 创建U盘启动盘

#### Windows系统将U盘制作成系统启动盘

首先准备好**Ubuntu 24.04 Desktop ISO**镜像文件，**Rufus**创建U盘启动盘工具，插入U盘后打开**Rufus**工具，镜像文件选择Ubuntu 24.04 Desktop ISO后写入U盘，其余默认设置不需要修改，点击开始后即可开始创建U盘启动盘，默认按照**ISO模式**写入即可。

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153450.png)

若写入失败，则先格式化U盘，再选择换一个USB接口或者重新插入U盘写入。

#### Linux系统将U盘制作成系统启动盘*

假如你有另一台安装好了linux的设备，也可以使用Linux系统来制作U盘系统启动盘。

首先使用以下命令查看U盘设备的存储位置,一般是`/dev/sdx`,**注意要将iso镜像文件写入U盘，而不是U盘的分区**，对应下图也就是需要将文件写入到`/dev/sda`而不是`/dev/sda1`。

```bash
sudo lsblk -f
```

![](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320132357680.png)

使用`dd`命令开始将U盘制作成系统启动盘

```bash
sudo dd if=ubuntu-24.04.4-desktop-amd64.iso of=/dev/sda bs=4M status=progress oflag=sync
```

- `if`:input file，输入文件路径;
- `of`:output file，输出设备或文件,注意是整个u盘;
- `bs=4M`:每次读写 4MB，提高写入效率;
- `status=progress`:显示实时进度，包括已写入的数据量和速度;
- `oflag=sync`:每次写操作都同步写入磁盘,保证数据写入完整。

命令完成后必须使用`sync`命令将缓存也写入U盘，避免文件碎片未写入U盘导致数据损坏。

```bash
sync
```

![](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320145945495.png)

同步完成之后需要一下查看U盘是否制作成功

```bash
sudo lsblk -f
```

![](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320150213518.png)


### 磁盘管理

要安装双系统，首先需要**给Linux系统创建一个空白分区**，注意不要在windows中格式化为NTFS或者FAT32，Linux系统在安装时会自动格式化为ext4，swap等。

具体操作为在Windows系统磁盘管理找一个有容量多余的磁盘，点击压缩卷，单位换算为$1GB=1024MB$.

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320154143.png)

注意这里可压缩空间量与磁盘剩余的空间量不总是一样的，这是因为存在磁盘碎片的原因，文件在硬盘上的数据块不是连续存放的，而是被分散在不同位置，但是可压缩空间量会尝试将文件**连续存储或者以更小的块**存储，可以使用Windows自带的磁盘碎片清理工具进行清理，或者自行使用其他方法进行清理。

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320154423.png)

最终一定要有一块这样**灰色的未分配空间**供Linux系统安装使用。

### BIOS与启动选项

#### BIOS 设置

进入BIOS的操作过程可以参考[如何进入BIOS设置界面](#如何进入bios设置界面)，进入BIOS系统对英语不熟悉的同学可以先更改一下语言设置。

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153034.png)


进入BIOS需要修改的选项主要有以下几个：
- **启动模式（UEFI/Legacy Boot）**：修改为对应的启动模式，GPT磁盘格式为UEFI启动模式，MBR磁盘格式为Legacy启动模式;
- **安全启动（Secure Boot）**：修改为否,默认大部分 Linux ISO 支持 Secure Boot,但部分发行版不支持，因此选择关闭，安装成功后可以选择打开Secure Boot;

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153138.png)

- **启动顺序（Boot Priority / Boot Order）**:BIOS 会按照顺序寻找启动设备，如果 U 盘或硬盘没有在第一位，系统可能直接进入 Windows,不过这一项也可以不用设置，后续我们直接进入启动选项（Boot Menu）进行U盘启动即可；

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153233.png)

- **CSM Support**：将CSM开启，保证 UEFI主板上兼容旧版BIOS启动；
- **USB Boot**：某些 BIOS 默认关闭 USB 引导，因此我们需要开启USB Boot，否则 U 盘无法被识别。

#### 启动选项

进入启动选项的操作可以参考[如何进入启动选项](#如何进入启动选项boot-menu)

进入启动选项后使用U盘启动即可。

![](https://raw.githubusercontent.com/doublenuo/ImageBox/main/image/20260320153322.png)

### 系统引导

这一部分按照不同的发行版引导程序进行操作即可，注意在磁盘分区的一定要选择**手动分区**,必须Linux安装程序抹除Windows系统数据。

## 系统启动

### 默认启动项

若安装的是Ubuntu系统，则启动菜单的默认项为Grub菜单，默认启动Linux系统，要想启动Windows系统则需要在10s倒计时结束之前选择到Windows系统，对于较常使用Windows系统的同学就非常不友好，这里修改成W**indows系统为默认启动项**。


首先我们启动Ubuntu系统，在终端输入以下命令查看grub的启动菜单具体有哪些

```bash
sudo grep menuentry /boot/grub/grub.cfg
```
![](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320172702545.png)

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
- `GRUB_DEFAULT=0`修改为
`GRUB_DEFAULT='Windows Boot Manager (on /dev/nvme0n1p1)'`,当然了如果你懂这个序号是什么意思的话也可以用序号，例如我这里是`GRUB_DEFAULT=2`;
- `GRUB_TIMEOUT_STYLE`值修改为menu;
- `GRUB_TIMEOUT`可以修改为3,意思是等待3秒用户选择后启动系统；

注意修改完之后记得使用`sudo update-grub`来更新grub启动菜单

![](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320174733941.png)


### 输入法中英文切换


建议使用fcitx5,比其他的输入法更稳定
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
最后需要添加中文拼音输入法,执行交互式安装命令，选择拼音输入法即可
```bash
fcitx5-configtool
```

默认中英文切换快捷键是`ctrl+space`。

### 系统时间同步

计算机中存在两种时间
- RTC时间：也就是主板BIOS中的硬件时间，关机后仍然可以运行;
- 系统时间：操作系统运行时使用的时间。

系统启动时，操作系统会从 RTC 读取时间作为当前系统时间。Windows系统的RTC时间默认使用本地时间，而Linux的系统时间同步是使用UTC机制，本质上是让你的电脑时钟自动与互联网标准时间服务器保持一致，避免时间漂移，例如你先使用了Linux系统，这时RTC时间就与互联网标准时间服务器保持一致，这时候你再切换到Windows，就会导致时间不一致的情况。

有些教程建议让 Linux 使用本地时间：
```bash
timedatectl set-local-rtc 1
```
但是这里不推荐使用这种方式，这样会导致日志时间混乱，容器与服务器环境不兼容等等各种问题，因此推荐Windows系统使用UTC时间作为本地时间，在Windows系统打开终端，执行下述注册表命令修改时间。
```powershell
reg add HKLM\SYSTEM\CurrentControlSet\Control\TimeZoneInformation ^ /v RealTimeIsUniversal /t REG_DWORD /d 1
```
