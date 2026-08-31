# Codex and Claude plugin migration validation — final result

Status date: 2026-08-29

## Executive verdict

Neither plugin is yet a drop-in replacement for every task users previously completed in native Codex or Claude.
Both already cover the core text/coding/configuration/extension/continuation path, but their remaining gaps are
material enough that migration should be capability-gated rather than presented as universal parity.

| Plugin | Atomic items | Supported | Partial | Unsupported | Migration assessment |
| --- | ---: | ---: | ---: | ---: | --- |
| Codex | 76 | 59 (77.6%) | 6 (7.9%) | 11 (14.5%) | Core coding usable; multimodal, approval, safe interruption and some extension flows block broad migration |
| Claude SDK | 86 | 78 (90.7%) | 3 (3.5%) | 5 (5.8%) | Broadest parity; generic attachments, native-Session import, local plugin path and redaction remain gaps |

## Shared migration coverage

Both plugins successfully cover plain/Unicode/Markdown conversation, multi-turn context, model/effort selection,
workspace file operations, tests, Git inspection, public Web access, user questions, Skills, STDIO/project/HTTP
MCP, user/project configuration, layered project instructions, workspace policy, PATH/Unicode cwd, browser reload,
Host restart and long-context continuation.

## Shared blockers

| Blocker | Codex | Claude | User impact |
| --- | --- | --- | --- |
| Generic file/document intake | Text/source and CSV unavailable | Text/source and PDF unavailable | Existing document-centric workflows cannot migrate through composer attachments |
| Long-command output streaming | No intermediate DSH output | No intermediate DSH output | Users cannot monitor progress reliably |
| Secret redaction | Secret persisted in shell snapshots | Secret persisted in SDK/native tool result | Do not position either plugin as safe for secret-bearing output |

## Important product differences

- Codex cannot currently receive user images for understanding/OCR/editing, although generated images render and
  persist. Claude SDK supports the complete tested image path.
- Claude supports DSH approval cards and safe Bash interruption. Codex lacks the approval answerer and its aborted
  child process can continue executing.
- Codex supports deterministic import/continuation of an existing eligible Thread, but discovery is not
  user-inspectable. Claude has no supported native Session import/bind path at all.
- Claude plugin Skills/agents/MCP/Hooks are broadly functional; Codex plugin Hooks are skipped through App Server,
  and existing Codex Threads do not refresh new DSH tools.
- Claude's default SDK backend is the validated product. Its CLI fallback is text-only and must not inherit SDK
  image, DSH-tool or extension conclusions.

## Release recommendation

Use task-capability routing in migration UX:

1. Allow migration for the supported core paths listed in each plugin matrix.
2. Warn or keep users on the native product when a workflow depends on an unsupported/partial item.
3. Treat secret redaction, Codex process interruption and Codex approval flow as release-blocking safety gaps.
4. Treat generic attachments as a shared high-impact parity gap; address Claude native-Session import and Codex
   image input next because they directly prevent existing work from moving.

## Traceability

- Codex independent matrix: `../../integrations/codex/validation/migration-compatibility/reports/support-matrix.md`
- Claude independent matrix: `../../integrations/claude/validation/migration-compatibility/reports/support-matrix.md`
- Claude SDK/CLI boundary: `../../integrations/claude/validation/migration-compatibility/reports/backend-applicability.md`
- Codex catalog/runs: `../../integrations/codex/docs/spec/migration-compatibility/requirements.md`,
  `../../integrations/codex/validation/migration-compatibility/runs/`
- Claude catalog/runs: `../../integrations/claude/docs/spec/migration-compatibility/requirements.md`,
  `../../integrations/claude/validation/migration-compatibility/runs/`
- Final structural/self-review audit: `plugin-migration-validation-audit.md`

Coverage audit: 162 atomic requirements, 162 case files, 167 recorded runs, 162 unique requirement results,
no missing requirement, case or result. Codex retains five reviewed reruns; Claude is one run per item.
