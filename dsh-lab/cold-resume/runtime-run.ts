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

import { installRelayAgentBridge } from "../../integrations/deepseek-harness/agent-bridge.js";
import { DshInboxAdapter } from "../../integrations/deepseek-harness/inbox-adapter.js";
import { RelayRuntime, RelayStore } from "../../packages/runtime/index.mjs";

const SESSION_ID = "relay-runtime-dsh-probe";
const MODEL = { provider: "relay-runtime-probe", model: "scripted" };

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

async function mountHarness(root: string, responses: StreamChunk[][]) {
  const ctx = new Context();
  await ctx.plugin(LlmRuntime);
  await ctx.plugin(SessionStore);
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(AgentLoop, { agents: [] });
  await ctx.plugin(JsonlSessionPersistence, { root });
  const adapter = new ScriptedAdapter(responses);
  ctx.llm.registerAdapter([MODEL.provider], adapter);
  return { ctx, adapter };
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "relay-dsh-runtime-"));
  const relayDatabase = join(root, "relay.sqlite");
  const dshSessions = join(root, "dsh-sessions");
  try {
    const first = await mountHarness(dshSessions, [
      toolCallResponse("call-register-reply", "relay_register_waits", {
        task_summary: "Resolve support case CASE-104.",
        waits: [customerReplyWait()],
      }),
      textResponse("I will wait for the customer's reply."),
    ]);
    const firstStore = new RelayStore(relayDatabase);
    let firstRuntime: RelayRuntime;
    const firstResolver = createApiRemoteAgentResolver(first.ctx, {
      agentOptions: () => MODEL,
      setup: () => (agentCtx) => installBridge(agentCtx, firstRuntime),
    });
    firstRuntime = new RelayRuntime({
      store: firstStore,
      router: unusedRouter(),
      inbox: dshInbox(first.ctx, firstResolver),
      workerId: "relay-first",
    });
    const created = await first.ctx.agents.create({
      sessionId: SessionId(SESSION_ID),
      agentOptions: MODEL,
      meta: { cwd: process.cwd() },
      setup: (agentCtx) => installBridge(agentCtx, firstRuntime),
    });
    created.agent.followup(createUserMessage({
      content: [{ type: "text", text: "Begin support case CASE-104." }],
      source: { kind: "user" },
    }));
    await created.agent.whenIdle();
    await first.ctx.sessions.flush(created.agent.session);
    assert.equal(firstRuntime.listWaits()[0].waits[0].status, "active");
    await created.dispose();
    firstStore.close();
    await first.ctx.fiber.dispose();

    const second = await mountHarness(dshSessions, [
      toolCallResponse("call-register-survey", "relay_register_waits", {
        task_summary: "Follow up after resolving support case CASE-104.",
        waits: [surveyWait()],
      }),
      textResponse("The fix is confirmed; I will wait for the survey."),
    ]);
    const secondStore = new RelayStore(relayDatabase);
    let secondRuntime: RelayRuntime;
    const secondResolver = createApiRemoteAgentResolver(second.ctx, {
      agentOptions: () => MODEL,
      setup: () => (agentCtx) => installBridge(agentCtx, secondRuntime),
    });
    secondRuntime = new RelayRuntime({
      store: secondStore,
      router: {
        async route() {
          return {
            disposition: "deliver",
            actionable: true,
            deliveries: [{
              session_id: SESSION_ID,
              wait_ids: ["wait-customer-reply"],
              relation: "customer confirmation for CASE-104",
              confidence: 1,
            }],
            evidence: ["same customer and support case"],
            summary: "The customer confirmed the fix.",
          };
        },
      },
      inbox: dshInbox(second.ctx, secondResolver),
      workerId: "relay-second",
    });

    const handled = await secondRuntime.handleEvent({
      event_id: "event-customer-confirmed",
      source: "test-mail",
      source_event_id: "message-customer-confirmed",
      fingerprint: "customer-confirmed-case-104",
      channel: "email",
      from: "customer@example.test",
      body: "The fix works now, thank you.",
    });

    assert.equal(handled.dispatchResults[0].status, "accepted");
    const projection = secondStore.inspectWaitRegistration(SESSION_ID);
    assert.equal("runs" in projection, false);
    assert.equal(projection.waits.find((wait) => wait.wait_id === "wait-customer-reply")?.status, "superseded");
    assert.equal(projection.waits.find((wait) => wait.wait_id === "wait-survey")?.status, "active");
    const persisted = await second.ctx.sessionPersistence.inspect(SessionId(SESSION_ID));
    const live = second.ctx.agents.get(SessionId(SESSION_ID));
    assert.ok(live, "the shared resolver resumed the existing DSH Agent");

    const result = {
      dshSessionId: live.id,
      relayRuns: 0,
      activeWait: "wait-survey",
      activationState: secondStore.getActivation(
        handled.dispatchResults[0].activationId,
      ).state,
      dshModelRequests: first.adapter.requests.length + second.adapter.requests.length,
      waitToolCalls: persisted.events.filter(
        (event) => event.type === "tool/call" && event.data.name === "relay_register_waits",
      ).length,
    };
    secondStore.close();
    await second.ctx.fiber.dispose();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function installBridge(agentCtx: Parameters<typeof installRelayAgentBridge>[0], runtime: RelayRuntime) {
  return installRelayAgentBridge(agentCtx, {
    sessionId: SESSION_ID,
    registerWaits: (input) => runtime.registerWaits(input),
    cancelWaits: (sessionId) => runtime.cancelWaits(sessionId),
  });
}

function dshInbox(ctx: Context, resolveAgent: ReturnType<typeof createApiRemoteAgentResolver>) {
  return new DshInboxAdapter({
    resolveAgent,
    async awaitDurable(agent) {
      await agent.whenIdle();
      await ctx.sessions.flush(agent.session);
    },
  });
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

function customerReplyWait() {
  return {
    wait_id: "wait-customer-reply",
    phase: "awaiting_customer_reply",
    exclusive: true,
    expected_event: "The customer replies to the support email.",
    caused_by: "The Agent sent a support response.",
    actors: ["customer@example.test"],
    entities: ["Support case CASE-104"],
    prior_exchange: "The Agent requested confirmation that the fix worked.",
  };
}

function surveyWait() {
  return {
    wait_id: "wait-survey",
    phase: "awaiting_survey",
    exclusive: true,
    expected_event: "The customer submits the satisfaction survey.",
    caused_by: "The support case was resolved.",
    actors: ["customer@example.test"],
    entities: ["Support case CASE-104"],
    prior_exchange: "The customer confirmed that the fix worked.",
  };
}

function unusedRouter() {
  return { async route() { throw new Error("router is not used"); } };
}

await main();
