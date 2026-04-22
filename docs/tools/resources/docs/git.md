# Git基础教程

Git 是一种分布式版本控制系统，它可以不受网络连接的限制，加上其它众多优点，目前已经成为程序开发人员做项目版本管理时的首选，非开发人员也可以用 Git 来做自己的文档版本管理工具。

Git的api非常多，但其实90%的需求都只需要用到几个基本功能即可。

动手学Git：[https://learngitbranching.js.org/?locale=zh_CN](https://learngitbranching.js.org/?locale=zh_CN)

## 日常提交

每天用的最多的就是这几个命令，拉取最新代码，写完代码提交推送，整个流程就是`status->pull->add->commit->push`

```bash
git status
git pull --rebase
git add *
git commit -m "这是一份提交信息"
git push origin
```

- `git status`查看当前工作区的状态,包括已修改但未暂存的文件，已暂存待提交的文件，未跟踪文件，add之前先status看一眼这是一个好习惯；
- `git pull --rebase`:拉取远程最新代码，并线性合并到当前分支；
- `git add *`:将修改加入暂存区, `*`不会包含隐藏文件，`.`是当前目录递归添加，会包括隐藏文件；
- `git commit -m "提交信息"`:提交代码到本地仓库,提交规范真的很重要，两个月以后你自己看git log会感谢当时认真写commit的自己，具体案例可以参考以下信息。
```bash
feat: 新增登录功能
fix: 修复接口超时问题
refactor: 重构用户模块
docs: 更新文档
```

## 撤销与回退

写错了代码想要撤回，或者提交了不该提交的东西想回退，根据情况不同，使用的命令也不同。

### 工作区

当你修改了文件，但是还没有add，想要回复原样。以下命令会把指定文件恢复成最近一次commit的状态，注意恢复之后这个文件的改动就没了，找不回来。

```bash
git checkout demo.py # 将demo.py恢复成上一次commit的状态
git restore demo.py # 与上述命令效果一样，更现代化的命令，语义化较强
```

有时候你需要恢复的文件较多，也可以将本地所有改动全部不要，回到最近一次commit的状态。

```bash
# 将本地所有改动恢复成上一次commit的状态
git reset --hard 
# 与上述命令效果一样，更现代化的命令，语义化较强，git restore不会删除新文件
git restore . & git clean -fd 
```

### 暂存区

当你修改了文件，已经add了，但还没有commit，这时候直接取消暂存,并按照上述工作区的处理方案即可。

```bash
git restore --staged demo.py # 取消暂存文件
```

### commit区

当你已经修改好了文件并且进行了commit操作，需要撤回这次commit，主要操作有以下三种：

```bash
# 撤销commit，代码停留在暂存区
git reset --soft HEAD~1
# 撤销commit，代码停留在工作区
git reset --mixed HEAD~1
# 撤销commit，代码全部回退到上一次commit
git reset --hard HEAD~1
```

如果要回退两个commit，也可以使用`HEAD~2`来实现。回退之后，本地的提交历史落后于远程分支，这时候直接`git push`会被拒绝，因为远程有你本地没有的提交，这时候需要强制`push`

```bash
# 强制push，覆盖远程历史，删除远程 commit
git push -f 
# 这个命令较安全，会检查远程分支有没有被别人改动，如果有则会拒绝提交，这对团队协作比较安全
git push --force-with-lease 
```


## 分支管理

团队协作离不开分支管理，日常用的分支命令就以下几个。

```bash
git branch # 查看本地分支
git branch -r # 查看远程分支
git branch -a # 查看本地和远程分支
git checkout -b dev # 新建并切换到该分支
git checkout dev # 切换到某个分支
git branch -D dev # 强制删除某个分支
```

`git checkout`切换分支要注意一点，如果当前分支有修改还没提交，且这些修改与目标分支存在冲突，则Git会拒绝切换分支，提示你要先处理掉冲突，这些要么先commit，要么先`git stash`暂存起来。

`git branch -D`强制删除本地不再使用的分支，若使用`git branch -d`则会检查这个分支是否已经合并到当前分支，若没合并会拒绝删除该分支，日常使用下推荐使用强制删除。

现代Git已经全面使用`switch`命令来替代`checkout`命令，因此也可以使用`switch`命令来创建和切换分支，语义化更强。

```bash
git switch dev # 切换分支
git switch -c dev # 新建并切换分支
```

### 分支合并

开发完一个分支以后，要把功能分支合并到主分支，主要使用merge命令。

```bash
# 切换到主分支
git switch main 
# 拉取最新代码
git pull
# 合并功能分支
git merge feature/login
# 推送到远程
git push
```

如果两个分支修改了同一部分代码，会产生冲突，Git无法自动合并分支，需要手动处理冲突，打开冲突文件，会有类似这样的标记。

```text
<<<<<<< HEAD
Creating a new branch is quick & simple.
=======
Creating a new branch is quick AND simple.
>>>>>>> feature1
```

### 多人协作

### rebase

## 标签管理

## GitHub

## 速查表

