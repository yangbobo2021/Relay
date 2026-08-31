# I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat

English | [中文](dsh-plugin-manager.zh.md)

DeepSeek Harness supports plugins, but installing one usually means finding the
right package name, running a command, checking the profile, and deciding
whether DSH needs a restart.

I built a standalone plugin called `relay-dsh-plugin-manager`. Install it once,
and you can search for and manage other DSH plugins directly from a
conversation.

![Plugin Manager searching for, confirming, and installing the Codex plugin in DSH](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/media/dsh-plugin-manager-demo.gif?raw=1)

_19-second demo: search for the Codex plugin, inspect the installation plan, confirm it separately, and finish the installation. [Watch the full 38-second MP4 at normal speed](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/media/dsh-plugin-manager-codex-install-demo.mp4?raw=1)._

## What it does

You can write requests such as:

```text
Find a workspace file browser plugin
Install relay-dsh-plugin-codex
List my installed plugins and their status
Disable example-dsh-plugin
```

Plugin Manager can:

- search npm and GitHub from a description of the capability you need;
- show a plugin's source, version, and basic information;
- install, update, enable, disable, or remove a plugin;
- show a plan first and wait for a separate confirmation before changing DSH.

Search and inspection are read-only. A vague request cannot immediately start
an installation.

## How it differs from a typical plugin marketplace

| Typical plugin marketplace | DSH Plugin Manager |
|---|---|
| Browse categories and lists | Describe the capability you need |
| Click an install button | Ask from the current conversation |
| Search mainly by name | Search with a natural-language requirement |
| Start after the click | Review a plan, then confirm separately |

This is not meant to replace a visual marketplace. A traditional marketplace is
better for browsing. Plugin Manager is useful when you are already working in
DSH and want to find or install something without leaving the conversation.

## Install it

The current release is a preview. Stop DSH Web, then run:

```bash
dsh plugin --profile web add relay-dsh-plugin-manager@next
dsh web
```

The manager itself still needs this one command. After that, other plugins can
be managed from Chat. KeySync's one-click DSH setup installs Plugin Manager
automatically.

The current release manages the running `web` profile. Some plugin changes may
still require a DSH restart.

## Links

- [GitHub: relay-dsh-plugin-manager](https://github.com/yangbobo2021/relay-dsh-plugin-manager)
- [npm: relay-dsh-plugin-manager](https://www.npmjs.com/package/relay-dsh-plugin-manager)
- [Relay DSH plugin catalog](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.md)
- [Official DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)

The plugin is developed in Relay but installs independently on official DSH. It
does not require a Relay fork.
