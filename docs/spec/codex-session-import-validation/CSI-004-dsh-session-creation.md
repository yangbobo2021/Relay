# CSI-004: Plugin-Created DSH Session Completeness

## Record

- Priority: P0
- Status: verified
- Current conclusion: official DSH public APIs support create, timestamped seed persistence, projection checkpoints, cold resume, and continuation
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-004/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-004/`

## Risk

The official DSH plugin surface may not permit creation, persistence, and immediate
navigation of a complete Codex Session without modifying official DSH source.

## Risk Reproduction

Against the pinned official DSH revision, create a Session only through public Host
and plugin APIs. Set the Codex preset/provider, model, normalized cwd, title, and
import metadata; flush it; restart the Host; and resume it by Session ID. Observe the
sidebar before and after creation and restart.

Required data: public API call trace, sanitized serialized Session header and event
counts, screenshots of sidebar visibility, and the official DSH commit.

Pass condition: the Session appears without page reload or upstream edits, opens in
native Chat, survives restart, retains configuration, and invokes the Codex adapter
on its next submit. Before it is opened, its row must already expose the imported
title and source Thread recency rather than the Workspace basename and import time.

## Solution Direction

Use `ctx.agents.create` with a validated historical `seed`, normal Session
metadata/configuration APIs, `ctx.sessions.flush`, and an awaited
`ctx.sessionProjectionCache.write` durability barrier. Source user-message event
times carry the scan inventory's Codex `thread/list.updatedAt`; zero-turn imports use
that value as their header creation timestamp because DSH list recency otherwise has
no activity event to fold. The import must not substitute `thread/read.updatedAt`,
which can differ for older Threads.
If sidebar refresh lacks a public event, document the smallest generic upstream
extension required instead of patching the official checkout.

## Solution Validation

Create 1, 10, and 100 imported Sessions through the proposed plugin command. Cold
resume a sample from each batch and verify native navigation and submit behavior.
Immediately after each batch, query `session.list` before opening any row and assert
the title projection and exact source `updatedAt` millisecond values.

Solution gate: all Sessions persist and route correctly using only official extension
boundaries; any required upstream change is separately specified and accepted before
implementation proceeds.
