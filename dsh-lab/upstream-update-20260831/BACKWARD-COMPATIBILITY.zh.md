# 新适配包误装旧 DSH 的发布风险

目标候选：DSH `0.1.2-alpha.2` / `0a53fb55bea101816fa226bb964ae2bed71c343b`。

**当前适配不能视作向后兼容发行；在安装/分发保护完成之前，不应覆盖旧版用户使用的发布通道。**
本记录不代表相关自动拦截已经实现，也不授权发布。本次没有改版本或 npm dist-tag。

## 已核对的缺口

1. 新 Codex Host 在模块顶层导入 `ToolCallId`，Workbench 客户端依赖新的
   `@deepseek-ai/dsh-client-store`。这不是仅修改开发依赖；运行时已经依赖新版接口。
2. 多个包把 DSH peer 范围更新为 `>=0.1.2-alpha.2 <0.1.3`，但它们多为 optional；
   Workbench、Session Import 的 peers 甚至没有宿主版本项。`engines` 目前只约束 Node。
   这些字段不构成已经验证有效的宿主拒装机制。
3. 当前 DSH `dsh plugin` 是 pnpm 转发器；Profile 默认 `autoInstallPeers: false`。
   管理器 `manifestPeerDependencies()` 排除 optional peers；现有批量依赖提示检查的是缺少包，
   不是根据实际 DSH 版本计算候选支持范围。不能把“声明了范围”当作“旧 DSH 会拒绝”。
4. 发布脚本目前以版本是否含 `-` 决定 `next` / `latest`，没有宿主兼容通道选择。
   即使改用独立 dist-tag，旧包的依赖范围仍可能匹配新版发行包；标签不是依赖隔离机制。
   例如 Codex/Claude 依赖 Import `^0.1.0`，Files/Terminal 依赖 Workbench `^0.1.0`。
5. 在插件的 `apply()` 里才检测版本可能太晚：不兼容的顶层 import、客户端 inject
   或模块依赖解析会先失败。加载保护必须覆盖这些前置阶段；只补提示文字不足以保证宿主能继续启动。
6. 只升级“新版管理器”也保护不了未升级管理器、直接 CLI 安装和 GitHub 未固定 ref 的用户。

## 发布前必须完成的保护

- 新、旧 DSH 使用明确分离的插件版本线和分发通道；新版破坏兼容时不要仅在旧 `0.1.x`
  范围里增加补丁版。保留旧 `latest` 及现有通道，先通过单独的新版测试通道分发。
- 同时调整插件间依赖范围，确保各自安装成一套同代组合，避免新旧 Import/Workbench/Events 混装。
- 对实际宿主版本做安装/更新前检查，并对旧管理器、CLI 和 GitHub 安装路径分别验证。
  自定义 metadata 必须有对应消费者；不能假设旧 DSH 会理解新字段。
- 设计加载前兼容保护或使用真正隔离的发行包，确保不支持的环境拒绝启用而不拖垮整个 DSH。
  若旧安装器无法拒绝，必须如实声明这一边界，不能用提示/可选 peer 冒充硬拦截。
- 加入四向矩阵：旧 DSH+旧插件、新 DSH+新插件、旧 DSH+新插件、新 DSH+旧插件。
  两个不支持的方向应明确拒绝、保留原有会话和 Profile，不能以“安装成功、启动崩溃”通过。
- 发布 CI 对版本线、dist-tag、依赖组合及反向安装测试设硬门槛；当前仍待实现。

## 已有证据

新 DSH+旧公开 Codex：第四批公开来源测试已出现 `CallId` 缺失导致启动失败。
旧 DSH+新候选：本轮使用本机已安装的官方 `0.1.1-rc.2` 运行时作为只读基线，另建临时
DSH_HOME；安装精确的当前 Codex/Import 候选 tarball，依赖 overrides 仅固定这两个候选来源。
**安装退出码为 0，包已登记为 Profile bundle；随后 Host 启动退出码为 1**：

```text
The requested module '@deepseek-ai/dsh-llm' does not provide an export named 'ToolCallId'
```

这直接证明当前旧宿主不会在安装前拦截该不兼容候选。详见
[backward-compatibility.json](backward-compatibility.json)。
新下载的 npm 基线初始化因网络等待取消，最终测试复用已安装官方运行时，并未修改日常 Profile。
测试不修改用户日常 3080 环境或正在体验的 56582 环境，不调用模型，也不调用 Claude。

源码依据：`integrations/codex/lib/host-plugin.js`、各插件 `package.json`、
`integrations/dsh-plugin-manager/src/source.ts` / `src/manager.ts`、
`integrations/codex/scripts/release-metadata.mjs`、官方 `apps/cli/src/plugin.ts` 和
`packages/boot/app-boot/src/profile.ts`。
