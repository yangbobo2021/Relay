import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Context } from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import { createApiRemoteAgentResolver } from "@deepseek-ai/dsh-api-remotes";
import LlmRuntime, {
  CallId,
  createUserMessage,
  LlmAdapter,
  type GenerateOptions,
  type StreamChunk,
} from "@deepseek-ai/dsh-llm";
import SessionStore, { SessionId } from "@deepseek-ai/dsh-session";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";
import TypertRegistry from "@deepseek-ai/dsh-typert-registry";

import * as RelayHost from "../../integrations/deepseek-harness/host-plugin.js";

const SESSION_ID = SessionId("relay-timer-cold-resume");
const MODEL = { provider: "relay-timer-probe", model: "scripted" };

class ScriptedAdapter extends LlmAdapter {
  requests: GenerateOptions[] = [];

  constructor(private readonly responses: StreamChunk[][]) {
    super();
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options);
    const response = this.responses.shift();
    assert.ok(response, "scripted adapter response exhausted");
    for (const chunk of response) yield chunk;
  }
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "relay-dsh-timer-"));
  try {
    const ctx = new Context();
    await ctx.plugin(LlmRuntime);
    await ctx.plugin(SessionStore);
    await ctx.plugin(SystemPrompt);
    await ctx.plugin(ToolRuntime);
    await ctx.plugin(TypertRegistry);
    await ctx.plugin(AgentRegistry);
    await ctx.plugin(AgentLoop, { agents: [] });
    await ctx.plugin(JsonlSessionPersistence, { root: join(root, "sessions") });
    const adapter = new ScriptedAdapter([
      toolCallResponse("call-timer", "relay_schedule_timer", {
        task_summary: "Build the release after a short delay.",
        after_seconds: 1,
        resume_prompt: "Build the release artifact now and report the result.",
      }),
      textResponse("The release build is scheduled."),
      textResponse("The timer fired and the release build can continue."),
    ]);
    ctx.llm.registerAdapter([MODEL.provider], adapter);
    createApiRemoteAgentResolver(ctx, {
      agentOptions: () => MODEL,
    });
    await ctx.plugin(RelayHost, {
      databasePath: join(root, "relay.sqlite"),
      pollIntervalMs: 20,
    });
    const statusTrace: string[] = [];
    ctx.on("agent/status", ({ agent, status }) => {
      if (agent.id === SESSION_ID) statusTrace.push(status);
    });

    const created = await ctx.agents.create({
      sessionId: SESSION_ID,
      agentOptions: MODEL,
      meta: { cwd: process.cwd() },
    });
    created.agent.followup(createUserMessage({
      content: [{ type: "text", text: "Schedule the release build one second from now." }],
      source: { kind: "user" },
    }));
    await created.agent.whenIdle();
    await ctx.sessions.flush(created.agent.session);
    assert.equal(adapter.requests.length, 2);

    await created.dispose();
    assert.equal(ctx.agents.get(SESSION_ID), undefined);

    await waitFor(() => adapter.requests.length === 3, 5_000);
    const resumed = ctx.agents.get(SESSION_ID);
    assert.ok(resumed, "Relay should cold-resume the DSH Agent after the timer fires");
    await resumed.whenIdle();
    await ctx.sessions.flush(resumed.session);
    assert.deepEqual(
      statusTrace.slice(-2),
      ["running", "idle"],
      "Relay resume must use DSH's normal Agent activity lifecycle",
    );
    const persisted = await ctx.sessionPersistence.inspect(SESSION_ID);
    assert.ok(persisted.events.some(
      (event) => event.type === "tool/call" && event.data.name === "relay_schedule_timer",
    ));

    process.stdout.write(`${JSON.stringify({
      sessionId: resumed.id,
      coldResumed: true,
      resumeStatusTrace: statusTrace.slice(-2),
      modelRequests: adapter.requests.length,
      timerToolCalls: persisted.events.filter(
        (event) => event.type === "tool/call" && event.data.name === "relay_schedule_timer",
      ).length,
    }, null, 2)}\n`);
    await ctx.fiber.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function toolCallResponse(callId: string, name: string, args: object): StreamChunk[] {
  const id = CallId(callId);
  const argumentsJson = JSON.stringify(args);
  return [
    { type: "block-start", index: 0, blockType: "tool-call" },
    { type: "tool-call-delta", index: 0, id, name, argumentsDelta: argumentsJson },
    { type: "block-end", index: 0, block: { type: "tool-call", id, name, arguments: argumentsJson } },
    { type: "usage", usage: { inputTokens: 10, outputTokens: 10 } },
    { type: "finish", reason: { kind: "tool-calls" } },
  ];
}

function textResponse(text: string): StreamChunk[] {
  return [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "text-delta", index: 0, text },
    { type: "block-end", index: 0, block: { type: "text", text } },
    { type: "usage", usage: { inputTokens: 10, outputTokens: 10 } },
    { type: "finish", reason: { kind: "stop" } },
  ];
}

async function waitFor(predicate: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for Relay timer delivery");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

await main();
