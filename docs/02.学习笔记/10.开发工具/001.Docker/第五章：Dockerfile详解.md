# Dockerfile 指令详解

**Dockerfile** 是一种用于描述如何构建 Docker 镜像的文本文件，它通过一系列声明式指令定义镜像的基础环境、软件安装、文件复制、环境变量、启动命令等内容。Docker 根据 Dockerfile 中的指令自动执行构建流程，最终生成一个可运行的 Docker 镜像。

Dockerfile 最大的优势是**将镜像构建过程从手动操作变成可描述、可重复执行的代码**。传统方式中，如果通过运行容器后手动安装软件、修改配置，再使用 `docker commit` 保存镜像，整个过程是黑箱的，其他人无法知道镜像是如何生成的，也难以复现。而 Dockerfile 将所有操作明确记录下来，例如安装了哪些软件、复制了哪些文件、设置了哪些环境变量，使镜像的构建过程透明、可审查。Dockerfile 还具有很强的**可重复性和自动化能力**。同一个 Dockerfile 在不同机器上执行可以生成基本一致的镜像，这使开发环境、测试环境和生产环境能够保持统一，避免“我的电脑可以运行，你那里不能运行”的环境差异问题。此外，Dockerfile 天然支持**版本管理**。由于 Dockerfile 本质上是普通文本文件，可以直接提交到 Git 仓库，与代码一起管理。Dockerfile 还利用 Docker 镜像的**分层存储机制**提高构建效率。每条 Dockerfile 指令都会生成一个镜像层。

因此，Dockerfile 的核心价值可以概括为Dockerfile 是镜像的构建说明书，它通过代码化方式描述镜像如何生成，使镜像构建过程具有可重复、可维护、可自动化和可版本控制的特点，是现代容器开发中创建镜像的标准方式。

## Dockerfile基本结构

Dockerfile 是一个用于**自动构建 Docker 镜像的文本文件**。它由一系列按照顺序执行的指令组成，Docker 会根据这些指令逐步构建镜像。一个典型的 Dockerfile 可以抽象为:

- 基础镜像
- 镜像元数据
- 安装软件、创建环境、配置工作目录和环境变量
- 声明端口和数据卷
- 指定容器启动的执行命令

使用Dockerfile构建镜像的基本命令格式为：

```bash
docker build [options] 上下文路径/URL
```
## RUN执行命令

RUN 是 Dockerfile 中最常用的指令，主要用于在镜像构建阶段执行命令来修改镜像。包括安装依赖、编译程序、下载文件、配置系统等等命令，由于镜像分层机制每一个 RUN 都会在当前层之上创建新的一层，RUN命令的基本格式包括`Shell`格式和`Exec`格式。

```bash
RUN <command> # Shell格式
RUN ["executable", "param1", "param2"] # Exec格式
```

其中`Shell`格式默认通过`/bin/bash -c`来执行命令，可以使用环境变量、管道和重定向等Shell特性，而`Exec`格式则直接调用可执行文件，不经过Shell，可以有效的避免Shell字符串解析问题。

由于每一个 RUN 指令都会新建一层镜像，为了减少镜像体积和层数，应使用 `&&` 来连接命令，同时在安装完软件后，应该立即清除缓存可以显著减小镜像体积。

```bash
# 推荐的写法
RUN apt update && \
    apt install -y curl vim && \
    rm -rf /var/lib/apt/lists/* 

# 不推荐的写法，每一个RUN都会有一个镜像层
RUN apt update
RUN apt install -y curl vim
RUN rm -rf /var/lib/apt/lists/*
```

不过，**不要为了减少层数而机械地把所有命令塞进一个 `RUN`**。现代 Docker 的构建缓存和 BuildKit 已经能够很好地处理分层，实际编写 Dockerfile 时更应该关注**可读性、缓存命中率和最终镜像体积**。
## COPY复制文件

## ADD命令

## CMD命令

## ENTRYPOINT命令

## ENV命令

## ARG命令

## VOLUME命令

## EXPOSE命令

## WORKDIR命令

## USER命令

## HEALTHCHECK命令

## ONBUILD命令

## LABEL命令

## SHELL命令

## 多阶段构建