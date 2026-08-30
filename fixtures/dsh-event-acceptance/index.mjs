// Synthetic acceptance driver. Installed only into a disposable test DSH_HOME.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { LlmAdapter } from "@deepseek-ai/dsh-llm";

export const inject = ["relayEvents", "relayMonitorObservers", "llm", "agents", "sessions"];
export function apply(ctx) {
  assert.ok(process.env.RELAY_ACCEPTANCE_REPORT, "fixture requires an explicit report path");
  const adapter = new ReplayAdapter();
  ctx.llm.registerAdapter(["relay-acceptance"], adapter);
  const timer = setTimeout(() => void run(ctx, adapter).then(
    result => writeFile(process.env.RELAY_ACCEPTANCE_REPORT, JSON.stringify({ ok: true, ...result })),
    error => writeFile(process.env.RELAY_ACCEPTANCE_REPORT, JSON.stringify({ ok: false, error: error.stack })),
  ), 100);
  ctx.effect(() => () => clearTimeout(timer));
}

class ReplayAdapter extends LlmAdapter {
  requests = [];
  async * stream(request) {
    this.requests.push(request);
    let text = "The existing acceptance conversation continued.";
    if (request.model === "router") {
      assert.equal(request.tools, undefined);
      const prompt = request.messages.flatMap(m => m.content).filter(b => b.type === "text").map(b => b.text).join("");
      const data = JSON.parse(prompt.split("<routing_data>\n")[1].split("\n</routing_data>")[0]);
      text = JSON.stringify({ disposition: "deliver", actionable: true,
        deliveries: [{ session_id: data.sessions[0].session_id, wait_ids: [data.sessions[0].waits[0].wait_id], relation: "synthetic approval", confidence: 1 }],
        evidence: ["synthetic fixture"], summary: "acceptance route" });
    }
    yield { type: "text-delta", index: 0, text };
    yield { type: "usage", usage: { inputTokens: 10, outputTokens: 10 } };
    yield { type: "finish", reason: { kind: "stop" } };
  }
}

async function run(ctx, adapter) {
  assert.equal(ctx.relayEvents.routerProvider?.id, "relay.semantic-router");
  const handle = await ctx.agents.create({
    sessionId: "relay-acceptance-owner", agentOptions: { provider: "relay-acceptance", model: "conversation" },
    meta: { cwd: process.cwd(), title: "Synthetic Events acceptance" },
  });
  const sessionId = handle.agent.id;
  await ctx.relayEvents.registerWaits({ sessionId, taskSummary: "Synthetic approval",
    waits: [wait("acceptance-approval", "approved")] });
  const event = { event_id: "acceptance-semantic", source: "fixture", fingerprint: "acceptance-semantic", type: "provider.message", body: "Synthetic approval." };
  await ctx.relayEvents.handleEvent(event);
  await handle.agent.whenIdle();
  const delivered = () => handle.agent.session.deriveMessages().filter(m => m.role === "user" && m.source?.plugin === "relay").length;
  const before = delivered();
  assert.equal(before, 1);
  await ctx.relayEvents.handleEvent(event);
  await handle.agent.whenIdle();
  assert.equal(delivered(), before);
  const deadline = new Date(Date.now() + 100).toISOString();
  await ctx.relayEvents.registerWaits({ sessionId, taskSummary: "Synthetic timer",
    waits: [wait("acceptance-timer-wait", "timer.elapsed")],
    monitors: [{ monitor_id: "acceptance-timer", wait_id: "acceptance-timer-wait", lifecycle: "one_shot",
      observer: { provider: "clock" }, artifact: { kind: "builtin" },
      detector: { kind: "deadline_reached", deadline, event_type: "timer.elapsed" }, schedule: { interval_seconds: 1 },
    }],
  });
  await new Promise(resolve => setTimeout(resolve, 150));
  const timerResult = await ctx.relayEvents.checkMonitor("acceptance-timer", { force: true });
  await handle.agent.whenIdle();
  await ctx.sessions.flush(handle.agent.session);
  assert.equal(delivered(), 2);
  assert.equal(adapter.requests.filter(r => r.model === "router").length, 1, "bound timer bypasses semantic routing");
  assert.equal(timerResult.monitor.state, "completed");
  // Leave a future timer visible for optional interactive management QA.
  await ctx.relayEvents.registerWaits({ sessionId, taskSummary: "Synthetic pending timer for management QA",
    waits: [wait("acceptance-pending-wait", "timer.elapsed")],
    monitors: [{ monitor_id: "acceptance-pending", wait_id: "acceptance-pending-wait", lifecycle: "one_shot",
      observer: { provider: "clock" }, artifact: { kind: "builtin" },
      detector: { kind: "deadline_reached", deadline: new Date(Date.now() + 86_400_000).toISOString(), event_type: "timer.elapsed" },
      schedule: { interval_seconds: 3600 },
    }],
  });
  return { sessionId, routedMessages: before, totalDeliveredMessages: 2, semanticCalls: 1, timerCompleted: true };
}

function wait(wait_id, expected_event) {
  return { wait_id, expected_event, exclusive: true, phase: "waiting", caused_by: "synthetic fixture",
    actors: [], entities: [], prior_exchange: "Continue the acceptance conversation." };
}
