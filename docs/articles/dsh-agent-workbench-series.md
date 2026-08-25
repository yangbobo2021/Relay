# Turning DSH into a Multi-Agent Project Workbench

English | [中文](dsh-agent-workbench-series.zh.md)

This series follows one practical choice: use DeepSeek Harness as the daily
project entry point while keeping native DSH conversations, Codex, and Claude
Code available for the work each handles best. The aim is not to rebuild three
agents. It is to organize conversations by project, choose a backend by task,
and leave a clean boundary for real agent coordination later.

1. [One project, three AI conversation backends](one-project-three-agent-conversations.md): why one entry point, project organization, and cost/quality choices matter more than betting on one model.
2. [Give complex implementation work to Codex](codex-app-server-in-dsh.md): how Codex App Server runs as a real DSH conversation backend.
3. [Give analysis and review to Claude Code](claude-code-in-dsh.md): how a Claude Session continues across DSH turns.
4. [More than chat](dsh-project-workbench.md): how Files, Terminal, and Workbench put conversations back in a real project environment.
5. [From choosing agents to coordinating them](from-agent-choice-to-coordination.md): what works today and what still has to be built for handoffs and event-driven coordination.

For exact versions, installation commands, and the full plugin catalog, see the
[installation and architecture guide](no-fork-dsh-plugins.md). The demonstrations
in this series use official `@deepseek-ai/dsh@0.1.1-rc.2`, published npm packages,
and real model requests. They are not interface mockups.

Hands-on follow-up: [Import existing Codex conversations into DSH](import-existing-codex-conversations-into-dsh.md)
shows how titles, order, and history survive the move before the same Thread
continues inside DSH.

Multi-device case study: [Leave the Work PC Running](keysync-dsh-multi-device-agent-workbench.md)
shows how KeySync installs official DSH and how the plugin suite lets a phone or
another computer reopen the original session.
