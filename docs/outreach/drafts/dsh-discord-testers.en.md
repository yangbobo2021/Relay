# Unpublished Draft: DSH Discord Tester Recruitment

Status: **prepared, not published; rules gate incomplete**

Target: DeepSeek official Discord → `harness` forum/channel

## Pre-publication check

| Check | Status | Evidence or remaining gate |
| --- | --- | --- |
| Accuracy | PASS | Uses the same pinned versions and evidence as the GitHub Discussion draft |
| Community rules | BLOCKED | Public invite and `harness` target were verified, but the current browser session is not logged into Discord, so server rules and pinned channel guidance could not be read |
| Links | PASS | The compact message uses the Codex repository, Claude repository, and suite guide; all resolved on 2026-08-26 |
| Visual | PASS | Attach the clean mode-menu screenshot only; do not attach the current terminal recording |
| Invite freshness | RECHECK | Invite `Ycq5dCaS4` reported expiry at 2026-09-12 04:01:33 UTC; recheck immediately before publication |
| External authorization | WAITING | Posting requires explicit confirmation in the current conversation after the rules gate passes |

## Proposed message

**Looking for 5 real DSH testers: 2 macOS, 2 Windows, 1 Linux.**

I added Codex App Server and Claude Code as normal options in DSH's New Session
mode menu — no DSH fork and no core patch. The plugins keep DSH's native chat,
approvals, questions, history, and session navigation.

Test versions: DSH `0.1.1-rc.2`, Codex plugin `0.1.1`, Claude plugin
`0.1.1-rc.2`.

```bash
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-codex@latest \
  relay-dsh-plugin-claude@next
npx @deepseek-ai/dsh@0.1.1-rc.2 web
```

- Codex repo: https://github.com/yangbobo2021/relay-dsh-plugin-codex
- Claude repo: https://github.com/yangbobo2021/relay-dsh-plugin-claude
- All five plugins and evidence: https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.md

If you can test, please reply with **OS/arch + installed? + mode appeared? +
first reply? + resume after restart?** A successful result is useful; a
reproducible failure should become an Issue in the matching repository. I will
track confirmed results publicly and summarize fixes back here.

Tester slots: macOS `0/2` · Windows `0/2` · Linux `0/1`

## Attachment

Use:

`integrations/codex/docs/images/dsh-new-session-backends.jpg`

Caption:

> Codex and Claude Code in the New Session mode menu, captured from official
> DSH `0.1.1-rc.2` at commit `b150a55` with both plugins installed.
