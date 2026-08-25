import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Context } from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import LlmRuntime, {
  createUserMessage,
  LlmAdapter,
  type GenerateOptions,
  type StreamChunk,
} from "@deepseek-ai/dsh-llm";
import SessionStore from "@deepseek-ai/dsh-session";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import SessionProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import SessionProjectionCache from "@deepseek-ai/dsh-session-projection-cache";
import SessionTitle from "@deepseek-ai/dsh-session-title";
import Storage from "@deepseek-ai/dsh-storage";
import { DomainFacility } from "@deepseek-ai/dsh-storage-domain";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";

import {
  MemoryMediaPool,
  MemoryStorageBackend,
} from "../../upstream/deepseek-harness/packages/storage/storage-domain/tests/helpers/memory-backend.ts";

import { DshCodexImportTarget } from "../../integrations/codex/dsh-import-target.js";

const MODEL = { provider: "relay-codex", model: "codex-test" };
const SESSION_ID = "codex-import-delivery-probe";
const WORKSPACE = "/synthetic/workspace";

class ScriptedAdapter extends LlmAdapter {
  requests: GenerateOptions[] = [];

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options);
    const text = "continued after import";
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text };
    yield { type: "block-end", index: 0, block: { type: "text", text } };
    yield { type: "usage", usage: { inputTokens: 1, outputTokens: 1 } };
    yield { type: "finish", reason: { kind: "stop" } };
  }
}

async function mount(root: string, projectionMedia: MemoryMediaPool) {
  const ctx = new Context();
  await ctx.plugin(LlmRuntime);
  await ctx.plugin(Storage);
  ctx.storage.backend.register("memory", new MemoryStorageBackend(projectionMedia));
  const storageDomain = new DomainFacility(ctx, { backend: "memory", routes: {} });
  ctx.storage.mount("domain", storageDomain);
  ctx.provide("storageDomain", storageDomain);
  await ctx.plugin(SessionStore);
  await ctx.plugin(SessionProjectionRegistry);
  await ctx.plugin(SessionTitle, {
    fallbackMaxWords: 5,
    fallbackMaxBytes: 40,
    maxTitleBytes: 40,
  });
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(AgentLoop, { agents: [] });
  await ctx.plugin(JsonlSessionPersistence, { root });
  await ctx.plugin(SessionProjectionCache, { writeEveryEvents: 200, writeIntervalMs: 5000 });
  const adapter = new ScriptedAdapter();
  ctx.llm.registerAdapter([MODEL.provider], adapter);
  const attached = new Set<string>();
  ctx.provide("workspaceRegistry", {
    async resolveByPath(path: string) {
      if (path !== WORKSPACE) return undefined;
      return { attachSession: async (sessionId: string) => { attached.add(String(sessionId)); } };
    },
  } as never);
  return { ctx, adapter, attached };
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "relay-codex-delivery-dsh-"));
  const projectionMedia = new MemoryMediaPool();
  try {
    const thread = {
      id: "synthetic-codex-thread",
      name: null,
      preview: "synthetic imported question",
      cwd: WORKSPACE,
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_123,
      turns: [
        {
          id: "source-turn-1",
          status: "completed",
          items: [
            { type: "userMessage", id: "source-user-1", content: [{ type: "text", text: "synthetic imported question" }] },
            { type: "contextCompaction", id: "source-compact-1" },
            { type: "agentMessage", id: "source-answer-1", text: "synthetic imported answer", phase: "final_answer" },
          ],
        },
      ],
    };
    const binding = {
      sessionId: SESSION_ID,
      threadId: thread.id,
      config: { ...MODEL, cwd: WORKSPACE },
      bindingMode: "imported",
      importState: "reserved",
    };
    const runtime = {
      readThread: async () => structuredClone({ ...thread, updatedAt: thread.updatedAt - 100 }),
    };

    const first = await mount(root, projectionMedia);
    const firstTarget = new DshCodexImportTarget({ ctx: first.ctx, runtime });
    const transaction = await firstTarget.prepare({ thread, binding, workspaceCwd: WORKSPACE });
    const projected = await firstTarget.hydrate(transaction);
    const immediateProjection = first.ctx.sessionProjectionCache.cachedSnapshot(transaction.agent.session.header);
    assert.equal(immediateProjection?.values.title, thread.preview);
    const importedPromptAt = transaction.agent.session.events
      .filter(event => event.type === "user/message" && event.data.source.kind === "user")
      .at(-1)?.time;
    assert.equal(importedPromptAt, thread.updatedAt * 1000);
    assert.equal(
      Math.max(transaction.agent.session.header.createdAt, importedPromptAt ?? 0),
      thread.updatedAt * 1000,
    );
    await firstTarget.attach(transaction);
    await firstTarget.finalize(transaction);
    await firstTarget.release(transaction);
    assert.deepEqual(projected, { projectedMessages: 0, projectedTurns: 0, skippedItems: 1 });
    assert.deepEqual([...first.attached], [SESSION_ID]);
    await first.ctx.fiber.dispose();

    const second = await mount(root, projectionMedia);
    const secondTarget = new DshCodexImportTarget({ ctx: second.ctx, runtime });
    const resumed = await secondTarget.prepare({ thread, binding, workspaceCwd: WORKSPACE });
    const retryProjection = await secondTarget.hydrate(resumed);
    const historical = resumed.agent.session.deriveMessages();
    assert.deepEqual(retryProjection, { projectedMessages: 0, projectedTurns: 0, skippedItems: 1 });
    assert.deepEqual(historical.map(message => message.content[0]?.type === "text" ? message.content[0].text : ""), [
      "synthetic imported question",
      "synthetic imported answer",
    ]);
    resumed.agent.followup(createUserMessage({
      content: [{ type: "text", text: "continue the imported session" }],
      source: { kind: "user" },
    }));
    await resumed.agent.whenIdle();
    await second.ctx.sessions.flush(resumed.agent.session);
    assert.equal(second.adapter.requests.length, 1);
    assert.equal(resumed.agent.session.deriveMessages().length, 4);
    await secondTarget.release(resumed);
    await second.ctx.fiber.dispose();

    const third = await mount(root, projectionMedia);
    const thirdTarget = new DshCodexImportTarget({ ctx: third.ctx, runtime });
    const continued = await thirdTarget.prepare({ thread, binding, workspaceCwd: WORKSPACE });
    assert.equal(continued.agent.session.deriveMessages().length, 4);

    thread.turns.push(
      {
        id: "source-turn-2",
        status: "completed",
        items: [
          { type: "userMessage", id: "source-user-2", content: [{ type: "text", text: "added outside DSH" }] },
          { type: "agentMessage", id: "source-answer-2", text: "external answer", phase: "final_answer" },
        ],
      },
      {
        id: "source-turn-interrupted",
        status: "interrupted",
        items: [
          { type: "userMessage", id: "source-user-interrupted", content: [{ type: "text", text: "interrupted outside DSH" }] },
          { type: "agentMessage", id: "source-answer-interrupted", text: "interrupted answer", phase: "commentary" },
        ],
      },
      {
        id: "source-turn-failed",
        status: "failed",
        error: { message: "synthetic external failure" },
        items: [
          { type: "userMessage", id: "source-user-failed", content: [{ type: "text", text: "failed outside DSH" }] },
          { type: "agentMessage", id: "source-answer-failed", text: "failed answer", phase: "commentary" },
        ],
      },
      {
        id: "source-turn-running",
        status: "inProgress",
        items: [
          { type: "userMessage", id: "source-user-running", content: [{ type: "text", text: "still running" }] },
        ],
      },
    );
    const openSync = await thirdTarget.sync(binding);
    assert.deepEqual(openSync, { projectedMessages: 6, projectedTurns: 3, skippedItems: 1 });
    assert.deepEqual(
      continued.agent.session.deriveMessages().slice(-6).map(message => (
        message.content[0]?.type === "text" ? message.content[0].text : ""
      )),
      [
        "added outside DSH",
        "external answer",
        "interrupted outside DSH",
        "interrupted answer",
        "failed outside DSH",
        "failed answer",
      ],
    );
    const repeatedOpenSync = await thirdTarget.sync(binding);
    assert.deepEqual(repeatedOpenSync, { projectedMessages: 0, projectedTurns: 0, skippedItems: 1 });
    await thirdTarget.release(continued);

    const emptyThread = {
      id: "synthetic-empty-thread",
      name: null,
      preview: "",
      cwd: WORKSPACE,
      createdAt: 1_600_000_000,
      updatedAt: 1_700_000_456,
      turns: [],
    };
    const emptyBinding = {
      ...binding,
      sessionId: "codex-import-empty-delivery-probe",
      threadId: emptyThread.id,
    };
    const emptyTarget = new DshCodexImportTarget({
      ctx: third.ctx,
      runtime: { readThread: async () => structuredClone(emptyThread) },
    });
    const empty = await emptyTarget.prepare({
      thread: emptyThread,
      binding: emptyBinding,
      workspaceCwd: WORKSPACE,
    });
    assert.deepEqual(await emptyTarget.hydrate(empty), {
      projectedMessages: 0,
      projectedTurns: 0,
      skippedItems: 0,
    });
    assert.equal(empty.agent.session.header.createdAt, emptyThread.updatedAt * 1000);
    assert.match(
      String(third.ctx.sessionProjectionCache.cachedSnapshot(empty.agent.session.header)?.values.title ?? ""),
      /^Codex /,
    );
    await emptyTarget.attach(empty);
    await emptyTarget.finalize(empty);
    await emptyTarget.release(empty);
    await third.ctx.fiber.dispose();

    const fourth = await mount(root, projectionMedia);
    const fourthTarget = new DshCodexImportTarget({
      ctx: fourth.ctx,
      runtime: { readThread: async () => structuredClone(emptyThread) },
    });
    const emptyResumed = await fourthTarget.prepare({
      thread: emptyThread,
      binding: emptyBinding,
      workspaceCwd: WORKSPACE,
    });
    assert.equal(emptyResumed.agent.session.deriveMessages().length, 0);
    assert.match(fourth.ctx.sessionTitle.get(emptyResumed.agent.session)?.title ?? "", /^Codex /);
    await fourthTarget.release(emptyResumed);
    await fourth.ctx.fiber.dispose();

    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      dshSessionId: "sha256:synthetic",
      created: true,
      coldResumed: true,
      projectedMessages: historical.length,
      retryProjectedMessages: retryProjection.projectedMessages,
      continued: true,
      continuedColdResumed: true,
      openSyncProjectedMessages: openSync.projectedMessages,
      openSyncProjectedTurns: openSync.projectedTurns,
      repeatedOpenSyncProjectedMessages: repeatedOpenSync.projectedMessages,
      interruptedTurnProjected: true,
      failedTurnProjected: true,
      runningTurnDeferred: true,
      emptyHistoryColdResumed: true,
      immediateTitleProjection: true,
      sourceUpdatedAtPreserved: true,
    }, null, 2)}\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await main();
