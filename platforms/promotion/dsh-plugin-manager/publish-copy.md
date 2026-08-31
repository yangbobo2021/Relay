# DSH Plugin Manager Publishing Copy

Source articles:

- Chinese: `docs/articles/dsh-plugin-manager.zh.md`
- English: `docs/articles/dsh-plugin-manager.md`

## Reddit

Title:

```text
I made a DSH plugin that finds and installs other plugins from chat
```

Body:

```text
DeepSeek Harness already supports plugins, but installing one still means finding the right package and using the CLI.

I built relay-dsh-plugin-manager so, after one initial install, you can ask DSH to find, inspect, install, update, enable, disable, or remove plugins from the current conversation.

It is different from a normal visual marketplace: you describe the capability you need, DSH searches npm and GitHub, and every change shows a plan first. A separate confirmation is required before the profile is modified.

The video is a real 38-second run: search for the Codex plugin, inspect the plan, confirm it, and finish the install.

GitHub: https://github.com/yangbobo2021/relay-dsh-plugin-manager
npm: https://www.npmjs.com/package/relay-dsh-plugin-manager

Current status: preview release, focused on the running web profile. Some plugin changes still require a DSH restart.
```

## GitHub Discussion - Official DSH

Title:

```text
Show: Manage DSH plugins from Chat with inspectable plans and confirmation
```

Body:

~~~~markdown
I built [`relay-dsh-plugin-manager`](https://github.com/yangbobo2021/relay-dsh-plugin-manager), a conversation-first plugin manager for official DeepSeek Harness.

After one initial installation, a user can ask DSH to find, inspect, install, update, enable, disable, or remove plugins from the current conversation.

This is deliberately different from a visual plugin marketplace:

- start with a capability request instead of browsing a catalog;
- search npm and GitHub, then inspect candidates before reporting them;
- keep search and inspection read-only;
- show an immutable operation plan and require a separate confirmation before changing the running `web` profile.

[Watch the 38-second real DSH run](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/media/dsh-plugin-manager-codex-install-demo.mp4?raw=1): it searches for `relay-dsh-plugin-codex`, shows the exact npm version and restart impact, waits for a later confirmation, installs it, and verifies the result.

Install the preview:

```bash
dsh plugin --profile web add relay-dsh-plugin-manager@next
dsh web
```

- GitHub: https://github.com/yangbobo2021/relay-dsh-plugin-manager
- npm: https://www.npmjs.com/package/relay-dsh-plugin-manager

Current boundary: the first release manages the running `web` profile. Some plugin changes still require a restart. The manager is independently installable and does not require a DSH fork.
~~~~

## GitHub Discussion - Relay

Title:

```text
Relay DSH Plugin Manager: find and install plugins from Chat
```

Body:

Use the official DSH Discussion body, followed by:

~~~~markdown
The plugin is developed in Relay's integration workspace but is released as an independent npm package for official DSH.

- [English README](https://github.com/yangbobo2021/relay-dsh-plugin-manager/blob/main/README.md)
- [中文 README](https://github.com/yangbobo2021/relay-dsh-plugin-manager/blob/main/README.zh.md)
~~~~

## Chinese Platforms

Title:

```text
我给 DeepSeek Harness 做了一个能在对话里安装插件的插件
```

Use `docs/articles/dsh-plugin-manager.zh.md` as the body.

Suggested tags:

```text
DeepSeek Harness, AI Agent, 开源, 插件
```

## English Article Platforms

Title:

```text
I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat
```

Use `docs/articles/dsh-plugin-manager.md` as the body.

DEV tags:

```text
opensource, ai, productivity, tools
```
