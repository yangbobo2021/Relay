import { randomUUID } from "node:crypto";

export const CODEX_DYNAMIC_TOOLS = [
  {
    type: "function",
    name: "relay_wait_for_event",
    description: "Pause this DSH Session until Relay receives a matching external event.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["event_type", "description"],
      properties: {
        event_type: { type: "string", minLength: 1, description: "Stable external event type to match." },
        description: { type: "string", minLength: 1, description: "What work should continue after the event." },
      },
    },
  },
  {
    type: "function",
    name: "relay_cancel_waits",
    description: "Cancel active Relay waits owned by this DSH Session.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
];

export async function handleCodexServerRequest(ctx, { adapter, relayRuntime, runtime, request }) {
  const threadId = request.params?.threadId;
  const sessionId = threadId ? adapter.dshSessionForThread(threadId) : null;
  const agent = sessionId ? ctx.agents.get(sessionId) : null;
  if (!agent) {
    runtime.rejectRequest(request.id, new Error("Codex request has no owning live DSH Session"));
    return;
  }

  try {
    if (request.method === "item/tool/call" || request.method === "item/dynamicTool/call") {
      await handleRelayTool(relayRuntime, runtime, request, agent);
      return;
    }
    if (isApproval(request.method)) {
      const outcome = await ctx.approval.request({
        agent,
        toolName: approvalToolName(request),
        reason: approvalReason(request),
      });
      await runtime.resolveRequest(request.id, {
        action: outcome === "allowed-once" ? "accept" : "decline",
      });
      return;
    }
    if (request.method === "item/tool/requestUserInput") {
      const questions = normalizeQuestions(request.params?.questions ?? []);
      const answer = await ctx.userQuestions.ask({ agent, questions });
      await runtime.resolveRequest(request.id, { answers: normalizeAnswers(answer) });
      return;
    }
    runtime.rejectRequest(request.id, new Error(`Unsupported Codex interaction ${request.method}`));
  } catch (error) {
    runtime.rejectRequest(request.id, error);
  }
}

async function handleRelayTool(relayRuntime, runtime, request, agent) {
  const tool = request.params.tool;
  const args = plainObject(request.params.arguments);
  if (tool === "relay_wait_for_event") {
    const eventType = requiredString(args.event_type, "event_type");
    const description = requiredString(args.description, "description");
    const waitId = `wait-${randomUUID()}`;
    await relayRuntime.registerWaits({
      sessionId: agent.id,
      taskSummary: description,
      context: { runtime: "dsh-codex", cwd: agent.session.header.cwd },
      waits: [{
        wait_id: waitId,
        phase: "external_event",
        exclusive: true,
        expected_event: eventType,
        caused_by: "Codex requested an external-event continuation.",
        actors: ["codex"],
        entities: [eventType],
        prior_exchange: description,
      }],
    });
    runtime.respondDynamicTool(request.id, true, `Waiting for ${eventType} (${waitId}).`);
    return;
  }
  if (tool === "relay_cancel_waits") {
    relayRuntime.cancelWaits(agent.id);
    runtime.respondDynamicTool(request.id, true, "Active Relay waits were cancelled.");
    return;
  }
  runtime.respondDynamicTool(request.id, false, `Unknown Relay tool ${tool}.`);
}

function isApproval(method) {
  return method === "item/commandExecution/requestApproval"
    || method === "item/fileChange/requestApproval"
    || method === "item/permissions/requestApproval"
    || method === "execCommandApproval"
    || method === "applyPatchApproval";
}

function approvalToolName(request) {
  if (request.method.includes("fileChange") || request.method === "applyPatchApproval") return "Codex file change";
  if (request.method.includes("permissions")) return "Codex permissions";
  return "Codex command";
}

function approvalReason(request) {
  const command = request.params?.command;
  if (typeof command === "string" && command.trim()) return command.trim();
  if (Array.isArray(command)) return command.join(" ");
  return request.params?.reason ?? "Codex requires permission to continue.";
}

function normalizeQuestions(input) {
  return input.slice(0, 3).map((question, index) => ({
    id: requiredString(question.id ?? `question-${index + 1}`, "question id"),
    header: String(question.header ?? "Codex").slice(0, 12),
    question: requiredString(question.question ?? question.prompt, "question"),
    options: Array.isArray(question.options)
      ? question.options.slice(0, 3).map(option => typeof option === "string"
        ? { label: option, description: option }
        : { label: String(option.label), description: String(option.description ?? option.label) })
      : [],
    multiSelect: Boolean(question.multiSelect),
  }));
}

function normalizeAnswers(answer) {
  if (!Array.isArray(answer?.answers)) return {};
  return Object.fromEntries(answer.answers.map((item) => [
    item.id,
    item.custom ? [...item.selected, item.custom] : item.selected,
  ]));
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}
