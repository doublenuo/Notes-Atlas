# Ubuntu常见问题及软件安装

## 修改默认启动项

若安装的是 Ubuntu 系统，则启动菜单的默认项为 Grub 菜单，默认启动 Linux 系统，要想启动 Windows 系统则需要在 10s 倒计时结束之前选择到 Windows 系统，对于较常使用 Windows 系统的同学就非常不友好，这里修改成 Windows 系统为默认启动项。


首先我们启动 Ubuntu 系统，在终端输入以下命令查看 grub 的启动菜单具体有哪些

```bash
sudo grep menuentry /boot/grub/grub.cfg
```

![查看启动菜单](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320172702545.png)

可以看到具体的启动项有以下几个：

| 序号 |                启动项名称                |                   说明                   |
| ---- | :--------------------------------------: | :--------------------------------------: |
| 0    |                  Ubuntu                  |            默认 Ubuntu 启动项            |
| 1    |       Advanced options for Ubuntu        | 子菜单，包含 Ubuntu 的历史内核和恢复模式 |
| 2    | Windows Boot Manager (on /dev/nvme0n1p1) |            Windows 系统启动项            |
| 3    |          UEFI Firmware Settings          |         进入 BIOS/UEFI 固件设置          |


然后输入以下命令修改默认启动项

```bash
sudo vim /etc/default/grub
```

修改以下选项

- `GRUB_DEFAULT=0` 修改为
    `GRUB_DEFAULT='Windows Boot Manager (on /dev/nvme0n1p1)'`, 当然了如果你懂这个序号是什么意思的话也可以用序号，例如我这里是 `GRUB_DEFAULT=2`;
- `GRUB_TIMEOUT_STYLE` 值修改为 menu;
- `GRUB_TIMEOUT` 可以修改为 3, 意思是等待 3 秒用户选择后启动系统；

注意修改完之后记得使用 `sudo update-grub` 来更新 grub 启动菜单，然后重启即可发现windows系统为默认启动项。

![更新 grub 启动菜单](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260320174733941.png)

## 输入法中英文切换

### 安装Fcitx5输入法框架


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

### 安装Rime配置雾凇拼音作为输入法

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

## 系统时间同步

计算机中存在两种时间

- RTC 时间：也就是主板 BIOS 中的硬件时间，关机后仍然可以运行;
- 系统时间：操作系统运行时使用的时间，关机后不能运行。

系统启动时，操作系统会从 RTC 读取时间作为当前系统时间。Windows 系统的 RTC 时间默认使用本地时间，而 Linux 的系统时间同步是使用 UTC 机制，本质上是让你的电脑时钟自动与互联网标准时间服务器保持一致，避免时间漂移，例如你先使用了 Linux 系统，这时 RTC 时间就与互联网标准时间服务器保持一致，这时候你再切换到 Windows，就会导致时间不一致的情况。

有些教程建议让 Linux 使用本地时间：

```bash
timedatectl set-local-rtc 1
```

但是这里不推荐使用这种方式，这样会导致日志时间混乱，容器与服务器环境不兼容等等各种问题，因此推荐 Windows 系统使用 UTC 时间作为本地时间，在 Windows 系统打开终端，执行下述注册表命令修改时间。

```powershell
reg add HKLM\SYSTEM\CurrentControlSet\Control\TimeZoneInformation ^ /v RealTimeIsUniversal /t REG_DWORD /d 1
```

## 安装Windows字体

已经安装好了双系统是比较好安装Windows字体的，直接将Windows系统的字体全量复制到linux系统即可，下面是具体的步骤：

```bash
lsblk # 查看windows系统的分区设备
# 挂载windows系统，注意需要指定自己实际的windows系统
sudo mount /dev/nvme0n1p3 /media/weno/system
# 将Windows系统的字体复制到Linux系统
sudo mkdir -p /usr/local/share/fonts/WindowsFonts 
sudo cp -r /media/weno/system/Windows/Fonts/* /usr/local/share/fonts/WindowsFonts
# 刷新字体缓存
fc-cache -fv
```

也可以查看具体的操作步骤文档：[Linux系统安装Windows字体](https://wiki.archlinuxcn.org/wiki/%E5%BE%AE%E8%BD%AF%E5%AD%97%E4%BD%93)

## 设置 Swap 交换缓存

Swap 的作用可以理解为当物理内存不够时，用磁盘空间临时充当内存。

如果在安装Ubuntu系统的时候未指定Swap分区，可以后期重新设置Swap分区，具体步骤如下：

```bash
# 创建一个8G的SwapFile文件
sudo fallocate -l 8G /swapfile
# 修改文件权限，只有root可以读写，其他用户没有任何权限
sudo chmod 600 /swapfile
# 将文件格式化为Swap类型
sudo mkswap /swapfile
# 将swap文件加入系统的虚拟内存池
sudo swapon /swapfile
```

当然了，如果后续不需要Swap分区了，也可以选择释放SwapFile文件来增加磁盘容量。

```bash
# 取消 Swap 交换缓存
sudo swapoff /swapfile
# 删除SwapFile文件
sudo rm /swapfile
```

## 配置gnome桌面

首先安装一下必要的软件和插件，其中`tweaks`为必备软件，提供了美化gnome的接口，最终全部gnome美化设置均由tweaks来设置。

```bash
sudo apt update
sudo apt install gnome-tweaks -y 
sudo apt install chrome-gnome-shell -y
sudo apt install gnome-shell-extension -y
sudo apt install gnome-shell-extension-manager -y
```

### 安装桌面插件

打开插件管理器，在browse页面选择安装以下插件

![Gnome桌面插件](https://raw.githubusercontent.com/doublenuo/ubuntu-image/main/image/20260403230118085.png)

### 安装主题

### 安装图标

### 安装光标

## 安装ROS

### ROS2

### ROS
