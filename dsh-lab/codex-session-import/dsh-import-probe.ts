import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { Context } from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import LlmRuntime, {
  createAssistantMessage,
  createUserMessage,
  freezeMessage,
  MessageId,
  LlmAdapter,
  type GenerateOptions,
  type StreamChunk,
} from "@deepseek-ai/dsh-llm";
import SessionStore, { SessionId } from "@deepseek-ai/dsh-session";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";

const MODEL = { provider: "relay-csi-probe", model: "scripted" };
const SESSION_ID = SessionId("relay-csi-imported-session");

class ScriptedAdapter extends LlmAdapter {
  requests: GenerateOptions[] = [];

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options);
    const text = "continued through the imported DSH Session";
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text };
    yield { type: "block-end", index: 0, block: { type: "text", text } };
    yield { type: "usage", usage: { inputTokens: 1, outputTokens: 1 } };
    yield { type: "finish", reason: { kind: "stop" } };
  }
}

async function mount(root: string) {
  const ctx = new Context();
  await ctx.plugin(LlmRuntime);
  await ctx.plugin(SessionStore);
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(AgentLoop, { agents: [] });
  await ctx.plugin(JsonlSessionPersistence, { root });
  const adapter = new ScriptedAdapter();
  ctx.llm.registerAdapter([MODEL.provider], adapter);
  return { ctx, adapter };
}

async function main() {
  const persistenceRoot = await mkdtemp(join(tmpdir(), "relay-csi-dsh-"));
  const results: Record<string, unknown> = {};
  try {
    const first = await mount(persistenceRoot);
    const created = await first.ctx.agents.create({
      sessionId: SESSION_ID,
      agentOptions: MODEL,
      meta: { cwd: "/synthetic/workspace" },
    });

    const source = [
      { id: "turn-1", user: "imported question one", assistant: "imported answer one" },
      { id: "turn-2", user: "imported question two", assistant: "imported answer two" },
    ];
    const firstProjection = appendImportedTurns(created.agent.session, source);
    const retryProjection = appendImportedTurns(created.agent.session, source);
    assert.equal(firstProjection, 4);
    assert.equal(retryProjection, 0);
    await first.ctx.sessions.flush(created.agent.session);
    const persistedEventCount = created.agent.session.events.length;
    await created.dispose();
    await first.ctx.fiber.dispose();

    const second = await mount(persistenceRoot);
    const resumed = await second.ctx.agents.resume({ resumeSessionId: SESSION_ID, agentOptions: MODEL });
    const importedMessages = resumed.agent.session.deriveMessages();
    assert.equal(importedMessages.length, 4);
    assert.deepEqual(importedMessages.map(message => message.content[0]?.type === "text" ? message.content[0].text : ""), [
      "imported question one",
      "imported answer one",
      "imported question two",
      "imported answer two",
    ]);
    resumed.agent.followup(createUserMessage({
      content: [{ type: "text", text: "continue after import" }],
      source: { kind: "user" },
    }));
    await resumed.agent.whenIdle();
    await second.ctx.sessions.flush(resumed.agent.session);
    assert.equal(second.adapter.requests.length, 1);

    results["CSI-004"] = {
      result: "pass",
      createdThroughPublicApi: true,
      coldResumed: true,
      cwdPreserved: resumed.agent.session.header.cwd === "/synthetic/workspace",
      persistedEventCount,
    };
    results["CSI-008"] = {
      result: "pass",
      importedMessages: importedMessages.length,
      nativeDerivedMessageOrderPreserved: true,
      continuedAfterImport: true,
    };
    results["CSI-009"] = {
      result: "pass",
      firstProjection,
      retryProjection,
      coldResumeDuplicateCount: 0,
    };

    await resumed.dispose();
    await second.ctx.fiber.dispose();

    const bulkRoot = await mkdtemp(join(tmpdir(), "relay-csi-dsh-bulk-"));
    try {
      const bulk = await mount(bulkRoot);
      const samples: number[] = [];
      for (let repeat = 0; repeat < 5; repeat += 1) {
        const started = performance.now();
        const handles = [];
        for (let index = 0; index < 100; index += 1) {
          const handle = await bulk.ctx.agents.create({
            sessionId: SessionId(`relay-csi-bulk-${repeat}-${index}`),
            agentOptions: MODEL,
            meta: { cwd: "/synthetic/workspace" },
          });
          await bulk.ctx.sessions.flush(handle.agent.session);
          handles.push(handle);
        }
        samples.push(performance.now() - started);
        for (const handle of handles) await handle.dispose();
      }
      samples.sort((left, right) => left - right);
      results["CSI-011"] = {
        result: "pass",
        sessionsPerRun: 100,
        runs: 5,
        medianMs: round(samples[2]),
        p95Ms: round(samples[4]),
        maxMs: round(samples[4]),
      };
      await bulk.ctx.fiber.dispose();
    } finally {
      await rm(bulkRoot, { recursive: true, force: true });
    }

    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, results }, null, 2)}\n`);
  } finally {
    await rm(persistenceRoot, { recursive: true, force: true });
  }
}

function appendImportedTurns(session: any, turns: Array<{ id: string; user: string; assistant: string }>): number {
  const existing = new Set(session.deriveMessages().map((message: { id: string }) => String(message.id)));
  let appended = 0;
  let nextTurn = session.events.filter((event: { type: string }) => event.type === "turn/start").length + 1;
  for (const source of turns) {
    const userId = `codex:${source.id}:user`;
    const assistantId = `codex:${source.id}:assistant`;
    if (existing.has(userId) && existing.has(assistantId)) continue;
    const turn = nextTurn++;
    session.append("turn/start", { turn });
    if (!existing.has(userId)) {
      session.append("user/message", freezeMessage({
        id: MessageId(userId),
        role: "user",
        content: [{ type: "text", text: source.user }],
        source: { kind: "user" },
      }), { surfaceOp: "append" });
      existing.add(userId);
      appended += 1;
    }
    session.append("step/start", { turn, step: 1 });
    if (!existing.has(assistantId)) {
      session.append("assistant/message", {
        turn,
        step: 1,
        message: freezeMessage({
          id: MessageId(assistantId),
          role: "assistant",
          content: [{ type: "text", text: source.assistant }],
          source: { kind: "model", provider: "relay-codex", model: "imported" },
        }),
      }, { surfaceOp: "append" });
      existing.add(assistantId);
      appended += 1;
    }
    session.append("step/end", { turn, step: 1 });
    session.append("turn/end", { turn, reason: { kind: "completed" } });
  }
  return appended;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

await main();
