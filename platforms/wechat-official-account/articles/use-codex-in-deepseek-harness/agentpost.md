# 不用来回切软件：在 DSH 里直接用 Codex

你平时用 Codex 写代码，又想把项目和对话都放在 DeepSeek Harness 里管理，不必在两个软件之间反复切换。

装好一个插件，新建对话时选择 **Codex**，就能直接在 DeepSeek Harness 的页面里让 Codex 读取项目、回答问题。

> 这篇文章只做一件事：带你完成第一次 Codex 对话。照着下面 3 步操作即可。

## 先认清三个名字

- **DeepSeek Harness**：DeepSeek 开源的 AI 工作界面，简称 **DSH**。你可以在里面添加项目文件夹、建立对话。
- **Codex**：OpenAI 的 AI 编程助手。它可以在你允许的项目里读取文件、修改代码和运行命令。
- **Codex 插件**：给 DSH 增加 Codex 对话入口的小组件。装好后，新建对话时会多出一个 Codex 选项。

下面不讲复杂原理，先把它用起来。

## 开始前，只检查三件事

1. 在终端输入 `node --version`，显示 22.13 或更高版本。
2. 输入 `pnpm --version`，能够看到版本号。
3. 你已经登录 Codex，并且平时能够正常使用它。

“终端”就是输入电脑命令的窗口。macOS 可以打开“终端”，Windows 可以打开 PowerShell。

如果 DSH 正在运行，先回到启动它的终端，按 `Ctrl + C` 停止。

## 第 1 步：用官方命令启动 DSH

DeepSeek 官方目前推荐用下面的命令快速启动 DSH：

```bash
npx @deepseek-ai/dsh web
```

第一次运行会下载所需文件。启动成功后，浏览器通常会自动打开；也可以手动访问终端显示的地址，一般是 `http://127.0.0.1:3080`。

能看到 DSH 页面，就说明基础环境正常。安装插件前，再按一次 `Ctrl + C` 停止 DSH。

## 第 2 步：安装 Codex 插件

DSH 官方提供了 `dsh plugin` 命令管理插件。输入下面这条命令：

```bash
dsh plugin --profile web add relay-dsh-plugin-codex@latest
```

这句话的意思是：给 DSH 的网页界面安装最新版 Codex 插件。

如果终端提示找不到 `dsh` 命令，说明你之前只临时运行过 DSH，还没有把命令安装到电脑中。先执行：

```bash
npm install --global @deepseek-ai/dsh
```

完成后，再重新执行上面的 `dsh plugin` 命令。

安装结束后，用下面的命令重新启动 DSH：

```bash
dsh web
```

## 第 3 步：新建一段 Codex 对话

打开 DSH 后，先点击左侧的 **Add workspace**，选择一个测试项目文件夹。

再点击 **New Session**。找到输入框上方的 **Standard mode**，点开后选择 **Codex**。

![在 DSH 的新建对话菜单中选择 Codex](https://agentpost.com.cn/uploads/0b47eeb571cd4bb88f8c25fb468e36c0.jpg "在 DSH 的新建对话菜单中选择 Codex")

看到 Codex 选项，说明插件已经被 DSH 识别。

第一次建议发送一条只读任务：

> 先不要修改文件。请告诉我这个项目是做什么的，并列出三个主要文件。

如果页面顶部显示 **Codex**，并且它能根据项目内容回答问题，就说明接入成功。

![Codex 在 DSH 中读取项目并返回回答](https://agentpost.com.cn/uploads/51b3bd78d7f84d899c01d7389278d95a.jpg "Codex 在 DSH 中读取项目并返回回答")

> 成功的标准只有两个：菜单里能选 Codex；发送问题后能收到结合项目内容的回答。

## 没成功，先检查这三处

### 菜单里没有 Codex

彻底停止并重新启动 DSH。插件是在启动时加载的，安装后不重启，菜单不会变化。

仍然看不到时，输入下面的命令检查插件：

```bash
dsh plugin --profile web why relay-dsh-plugin-codex
```

### 输入框不能发送消息

通常是还没有选择项目文件夹。点击 **Add workspace**，选好文件夹后再新建对话。

### 第一条消息提示登录失败

先在同一个电脑账户中完成 Codex 登录，再重启 DSH。插件负责把 Codex 接入 DSH，但不会替你登录账号。

## 最后提醒一句

第一次请选测试项目，并先让 Codex 只读文件。确认一切正常后，再交给它修改任务。

如果你只使用 Codex，不需要在 DSH 中管理项目和对话，直接使用 Codex 会更简单。这个插件适合已经在用 DSH、希望把 Codex 对话也放到同一个页面的人。

- [DeepSeek Harness 官方项目](https://github.com/deepseek-ai/deepseek-harness)
- [Codex 插件](https://github.com/yangbobo2021/relay-dsh-plugin-codex)
