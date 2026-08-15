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
import SessionStore, { SessionId } from "@deepseek-ai/dsh-session";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";

const SESSION_ID = SessionId("relay-cold-resume-probe");
const MODEL = { provider: "relay-probe", model: "scripted" };

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

async function mountHarness(root: string, response: string) {
  const ctx = new Context();
  await ctx.plugin(LlmRuntime);
  await ctx.plugin(SessionStore);
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(AgentLoop, { agents: [] });
  await ctx.plugin(JsonlSessionPersistence, { root });
  const adapter = new ScriptedAdapter([textResponse(response)]);
  ctx.llm.registerAdapter([MODEL.provider], adapter);
  return { ctx, adapter };
}

async function main() {
  const persistenceRoot = await mkdtemp(join(tmpdir(), "relay-dsh-cold-resume-"));
  try {
    const first = await mountHarness(persistenceRoot, "Waiting for the customer's reply.");
    const created = await first.ctx.agents.create({
      sessionId: SESSION_ID,
      agentOptions: MODEL,
      meta: { cwd: process.cwd() },
    });
    created.agent.followup(createUserMessage({
      content: [{ type: "text", text: "Begin support case CASE-104." }],
      source: { kind: "user" },
    }));
    await created.agent.whenIdle();
    await first.ctx.sessions.flush(created.agent.session);
    await created.dispose();
    await first.ctx.fiber.dispose();

    const second = await mountHarness(persistenceRoot, "The existing conversation continued.");
    const resumed = await second.ctx.agents.resume({
      resumeSessionId: SESSION_ID,
      agentOptions: MODEL,
    });
    const messagesBeforeResume = resumed.agent.session.deriveMessages().length;
    assert.ok(messagesBeforeResume > 0);
    resumed.agent.followup(createUserMessage({
      content: [{ type: "text", text: "A normal later user message." }],
      source: { kind: "user" },
    }));
    await resumed.agent.whenIdle();
    await second.ctx.sessions.flush(resumed.agent.session);

    const result = {
      dshSessionId: resumed.agent.id,
      messagesBeforeResume,
      modelRequests: first.adapter.requests.length + second.adapter.requests.length,
      turnEnds: resumed.agent.session.events.filter((event) => event.type === "turn/end").length,
    };
    await resumed.dispose();
    await second.ctx.fiber.dispose();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await rm(persistenceRoot, { recursive: true, force: true });
  }
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

await main();
