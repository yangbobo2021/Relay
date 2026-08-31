# 小白 3 步上手 DeepSeek Harness：一键安装，手机接着用

很多人想试 DeepSeek Harness，最后却卡在安装环境、打开终端和输入命令上。

这篇只讲最简单的一条路：用 KeySync 在电脑上装好 DSH，再用手机打开电脑上的同一个 DSH。全程分三步，不需要先安装 Node，也不用敲命令。

开始前，只要准备两样东西：

1. 一台保持联网的电脑。
2. 一个可用的 DeepSeek API Key。如果还没有，可以到 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建。

## 第一步：安装 KeySync

打开 [KeySync 下载页](https://sublang.ai/keysync/download)，选择自己的电脑系统。

- Mac 选择 `macOS (Apple Silicon)`。
- Windows 普通用户选择 `安装包 (x64)`。
- Linux 选择与电脑对应的 `AppImage`。

![KeySync 下载页，支持 macOS、Windows 和 Linux](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-beginner-tutorial/00-keysync-download-zh.png)

下载后按普通软件的方式安装并打开 KeySync，然后注册或登录账号。

到这里就可以了。不用另外安装 Node，也不用打开终端。

## 第二步：安装、配置并打开 DSH

### 1. 一键安装 DeepSeek Harness

在 KeySync 的“设备和应用”页面找到 `DeepSeek Harness`，点击右侧的“一键安装”。

![在 KeySync 中一键安装 DeepSeek Harness](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-beginner-tutorial/01-one-click-install-dsh.jpg)

接下来等一会儿。KeySync 会自动完成安装，页面显示“已安装”就说明成功了。

### 2. 配置 DeepSeek 模型

在 DeepSeek Harness 这一行点击“配置模型”，然后选择：

`我已经有` → `手动创建`

API Key 就是 DeepSeek 提供的一串字符，复制后粘贴即可，不要把它发给别人。

按下面填写：

- 模型服务类型：选择 `DeepSeek`
- 模型服务名称：自己起一个容易认的名字，例如“我的 DeepSeek”
- API Key：粘贴刚才准备好的 DeepSeek API Key
- 默认模型：保留页面自动填写的内容即可

先点“测试”。测试成功后，再点“创建模型服务”。创建完成后，它会自动连接到 DeepSeek Harness。

![填写 DeepSeek API Key 并测试模型](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-beginner-tutorial/02-configure-deepseek-model.png)

### 3. 打开 DeepSeek Harness

回到“设备和应用”页面。如果先看到“启动”，就先点“启动”。当 DeepSeek Harness 这一行出现“停止”按钮时，说明 DSH 已经打开。此时点击旁边的“打开”，进入对话页面。

![在 KeySync 客户端里启动、停止和打开 DeepSeek Harness](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-beginner-tutorial/03-dsh-running-stop-open.png)

看到 DeepSeek Harness 的对话页面，就说明电脑端已经全部完成，可以直接创建任务了。

## 第三步：用手机远程打开电脑上的 DSH

出门前先确认三件事：

1. 电脑没有关机，并且可以上网。
2. KeySync 正在运行。
3. DeepSeek Harness 这一行可以看到“停止”按钮。

然后在手机浏览器打开 [KeySync 网页版](https://keysync.sublang.ai)，登录与电脑端相同的 KeySync 账号。

手机和电脑不需要连接同一个 Wi-Fi，也不用另外设置网络。

找到自己的电脑，再找到 `DeepSeek Harness`，点击“远程打开”。

![在手机上找到电脑并点击远程打开 DeepSeek Harness](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-beginner-tutorial/04-phone-remote-open.png)

页面打开后，看到的就是电脑上已经打开的 DSH。原来的对话和任务都还在，可以直接继续。

![手机浏览器中打开电脑上的 DeepSeek Harness](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-beginner-tutorial/05-phone-dsh-opened.png)

任务实际仍在电脑上处理，手机只是远程打开它。所以关掉手机页面不会把电脑上的任务搬走，也不用重新开一个对话。

## 遇到问题先看这里

- 手机显示电脑离线：检查电脑是否开机、联网，KeySync 是否正在运行。
- 看不到“远程打开”：检查电脑端的 DeepSeek Harness 是否已经打开。正常打开后，电脑端会显示“停止”按钮。
- 模型测试失败：重新检查 API Key，并确认 DeepSeek 账号可以正常使用。

整个过程可以简单记成：

**电脑装 KeySync → 一键装 DSH → 配好 DeepSeek → 手机登录 KeySync → 远程打开 DSH。**

KeySync 是第三方产品，不是 DeepSeek Harness 官方客户端，也不是开源项目。它把 DSH 的安装、启动和远程访问整理成了更适合普通用户的桌面操作。KeySync 客户端和远程访问目前都完全免费，没有隐藏收费。

相关链接：

- [下载 KeySync](https://sublang.ai/keysync/download)
- [DeepSeek 开放平台](https://platform.deepseek.com/)
- [DeepSeek Harness 官方项目](https://github.com/deepseek-ai/deepseek-harness)
