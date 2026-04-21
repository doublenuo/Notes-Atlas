Git基础教程

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
- `git commit -m "提交信息"`:提交代码到本地仓库,提交规范真的很重要，两个月以后你自己看git log会感谢当时认真写commit的自己，具体案例可以参考一下文档。
```bash
feat: 新增登录功能
fix: 修复接口超时问题
refactor: 重构用户模块
docs: 更新文档
```

## 分支管理

## 速查表

