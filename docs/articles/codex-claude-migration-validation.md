# Not Just a Working Demo: Why We Ran 162 Migration Tests for Two DSH Plugins

We use Codex and Claude Code to build Relay. They are also part of the routine
work behind the plugin repositories: implementation, tests, review, and debugging.
When we started using DeepSeek Harness (DSH) as a project entry point, we wanted
that work to continue. Moving to a different interface should not mean giving up
the capabilities and sessions we already rely on.

That is why we maintain two independently installable plugins for official DSH:

- **`relay-dsh-plugin-codex`** ([GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-codex) ·
  [npm](https://www.npmjs.com/package/relay-dsh-plugin-codex)) adds Codex App
  Server as a DSH conversation backend.
- **`relay-dsh-plugin-claude`** ([GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-claude) ·
  [npm](https://www.npmjs.com/package/relay-dsh-plugin-claude)) adds the Claude
  Code Agent SDK as a DSH conversation backend.

Neither plugin patches DSH core or requires a Relay checkout. After installation,
Codex and Claude Code appear as conversation modes inside DSH and continue using
its project, history, composer, and tool surfaces.

If the goal were only a demo, that would be enough: select a backend, send a
prompt, and record the answer. We intend to use these plugins over time, so “it
answered once” is not a useful acceptance standard.

## We Did Not Want Users to Find the Boundaries for Us

A successful chat hides many of the failures that matter in real work.

Did the model actually receive the attached image? Can a user watch a ten-minute
command make progress? Does Stop terminate the process, or only change the UI?
Can a session survive a host restart? Do project Skills, MCP servers, and settings
still apply? Can a secret used by a tool remain on disk even when it never appears
in the visible conversation?

Those paths decide whether a plugin can become part of daily development. Because
we use the plugins ourselves, we did not want to claim broad Codex or Claude
support and wait for users to identify every exception.

We chose to map the boundary first. A workflow that completes is supported. A
workflow that only partly completes is marked partial. A workflow that does not
complete remains a failure. The purpose is not to produce a flattering score. It
is to decide what to fix next and to tell users what work they can safely move.

## Where the 162 Tests Came From

We split real development work into 162 atomic requirements: 76 for Codex and 86
for Claude. Every requirement has its own case, run record, and reviewed result.

The matrix covers conversation and multi-turn context, images and files, code and
shell tools, tests and Git, Skills, MCP, project configuration, permissions,
environment variables, session import, host restarts, and long-context
continuation. These are not names collected for a checklist. They are paths we
reach while using Codex and Claude Code on actual repositories.

By August 29, 2026, all 162 cases had results. We retained 167 runs in total; five
were reviewed Codex reruns and do not inflate the requirement count.

| Plugin | Atomic capabilities | Supported | Partial | Unsupported |
| --- | ---: | ---: | ---: | ---: |
| `relay-dsh-plugin-codex` | 76 | 59 | 6 | 11 |
| `relay-dsh-plugin-claude` | 86 | 78 | 3 | 5 |

The cases, run evidence, and support matrices remain in the repositories:
[Codex validation](https://github.com/yangbobo2021/relay-dsh-plugin-codex/tree/main/validation/migration-compatibility) and
[Claude validation](https://github.com/yangbobo2021/relay-dsh-plugin-claude/tree/main/validation/migration-compatibility).

This table is the **August 29 problem-discovery snapshot**, not the current pass
rate. Codex `0.1.3` and Claude `0.1.4`, released the following day, fixed several
of those failures. We will publish new counts after the complete 162-case suite
has run again.

## What the Failures Made Us Reconsider

### Migration Is More Than Connecting an Interface

One test produced a result that was easy to misread. DSH stored and displayed the
user's image correctly, but the actual Codex rollout contained no image input.
The interface looked healthy while the model received incomplete information.

Claude exposed a related continuity gap. The plugin could create a new Session,
but it did not yet have a reliable path for importing an existing native Session.
Moving into DSH still meant starting over.

Those failures led us to repair Codex image transport and improve existing-session
selection and import in both plugins. The point is not to add two names to a mode
menu. It is to let users carry existing work forward.

### A Control Must Reflect the Real State

In another case, DSH reported a Codex task as interrupted, but a child process
still wrote its delayed file several seconds later. That is worse than having no
Stop button because the interface gives false certainty.

We changed targeted process termination and long-command output handling. The
rule is straightforward: running work should expose progress, and work reported
as stopped must actually stop. If cleanup cannot be confirmed, the plugin should
report a failure instead of displaying a successful cancellation.

### Invisible State Needs Testing Too

A secret missing from the chat transcript can still be present on disk. Validation
found persistence paths in Codex shell snapshots and Claude tool results.

Codex `0.1.3` disables persistent shell snapshots by default. Claude `0.1.4`
redacts sensitive environment values before tool results enter history. These
changes do not replace least-privilege configuration or prove that every
third-party tool is safe. They close the paths we could reproduce.

## Validation Is Part of Development, Not a Release Ceremony

The August 29 results did not end as a report. The two releases published the next
day addressed failures in image transport, process interruption, long-command
output, sensitive-value persistence, existing-session import, and tool routing.

This is the development loop we want to keep:

1. Use the plugins on real projects.
2. Reduce a problem to a repeatable case.
3. Repair the boundary between DSH and the native backend.
4. Run the case again and retain what remains unresolved.

That takes longer than writing a feature list, but it matches what we are trying
to build. `relay-dsh-plugin-codex` and `relay-dsh-plugin-claude` are not proofs that
two backends can be wired into DSH. We want them to carry continuous project work
and to keep an accurate account of what they do and do not support after upgrades.

## The Boundary Is Still Visible

The plugins cover the main conversation, coding, configuration, extension, and
session-continuation paths. They are not complete replacements for the native
Codex and Claude Code products.

Current boundaries include:

- DSH does not yet provide a general document and file attachment path.
- An imported Codex Thread or Claude Session should not have two active writers.
- An existing Codex Thread does not automatically refresh DSH tools installed later.
- Claude's CLI fallback remains a conservative text path and does not inherit all
  Agent SDK capabilities.
- The complete post-release 162-case regression has not yet produced a new public
  matrix.

These limits stay in the documentation. Users should decide whether to migrate a
task based on the capabilities it needs, not on a successful video alone.

## Install and Follow the Work

Stop the running DSH Web process, then install either or both plugins:

```bash
dsh plugin --profile web add relay-dsh-plugin-codex@0.1.3
dsh plugin --profile web add relay-dsh-plugin-claude@0.1.4
dsh web
```

- Codex plugin: [GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-codex) ·
  [npm](https://www.npmjs.com/package/relay-dsh-plugin-codex) ·
  [v0.1.3](https://github.com/yangbobo2021/relay-dsh-plugin-codex/releases/tag/v0.1.3)
- Claude plugin: [GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-claude) ·
  [npm](https://www.npmjs.com/package/relay-dsh-plugin-claude) ·
  [v0.1.4](https://github.com/yangbobo2021/relay-dsh-plugin-claude/releases/tag/v0.1.4)
- Relay: [GitHub](https://github.com/yangbobo2021/Relay) ·
  [plugin guide](../dsh-plugins.md)
- DeepSeek Harness: [official repository](https://github.com/deepseek-ai/deepseek-harness)

We want to keep using these plugins on real projects months from now, not merely
record a successful launch-day video. The 162 tests are not proof that the work is
finished. They move it from “this seems to work” to “we know where it works and
where we still have work to do.”
