// Synthetic acceptance driver. Installed only into a disposable test DSH_HOME.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createUserMessage, LlmAdapter } from "@deepseek-ai/dsh-llm";

export const inject = ["relayEvents", "relayMonitorObservers", "relayMonitorBundles", "llm", "agents", "agentPresets", "sessions"];
export function apply(ctx) {
  assert.ok(process.env.RELAY_ACCEPTANCE_REPORT, "fixture requires an explicit report path");
  const adapter = new ReplayAdapter();
  ctx.llm.registerAdapter(["relay-acceptance"], adapter);
  for (let index = 0; index < 22; index += 1) {
    const suffix = String(index).padStart(2, "0");
    ctx.effect(() => ctx.relayMonitorBundles.registerBundleType(acceptanceBundleType(suffix)), `synthetic Monitor Bundle Type ${suffix}`);
  }
  installManagementFaultFixtures(ctx);
  const timer = setTimeout(() => void run(ctx, adapter).then(
    result => writeFile(process.env.RELAY_ACCEPTANCE_REPORT, JSON.stringify({ ok: true, ...result })),
    error => writeFile(process.env.RELAY_ACCEPTANCE_REPORT, JSON.stringify({ ok: false, error: error.stack })),
  ), 100);
  ctx.effect(() => () => clearTimeout(timer));
}

function acceptanceBundleType(suffix) {
  return {
    api_version: 1,
    type_id: `acceptance.bundle-${suffix}`,
    bundle_version: 1,
    origin: { kind: "plugin", plugin_id: "relay-dsh-event-acceptance-fixture", plugin_version: "0.0.0" },
    event_types: [`acceptance.bundle_${suffix}.changed`],
    parameter_schema: { type: "object", additionalProperties: false, properties: {} },
    capabilities: [],
    lifecycle: ["one_shot"],
    locales: {
      "en-US": {
        name: `Acceptance Bundle ${suffix}`,
        description: "Synthetic packed extension used only for catalog delivery acceptance.",
        permissions: "No host capabilities.",
        remediation: "Reinstall the disposable acceptance fixture.",
      },
      "zh-CN": {
        name: `验收 Bundle ${suffix}`,
        description: "仅用于目录交付验收的合成打包扩展。",
        permissions: "不使用主机能力。",
        remediation: "请重新安装一次性验收插件。",
      },
    },
    create() { throw new Error("Synthetic catalog-only Bundle Type must not be instantiated"); },
  };
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
      text = data.event.content_summary === "force-safe-escalation"
        ? JSON.stringify({ disposition: "escalate", actionable: true, deliveries: [],
          evidence: ["sanitized acceptance escalation"], summary: "A user must select the safe owner." })
        : JSON.stringify({ disposition: "deliver", actionable: true,
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
  if (process.env.RELAY_CONTROLLED_GITHUB_CODEX_LOOP === "1") {
    return await runControlledGitHubCodexLoop(ctx);
  }
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
  const escalation = await ctx.relayEvents.handleEvent({
    event_id: "acceptance-escalation", source: "fixture", fingerprint: "acceptance-escalation",
    type: "provider.ambiguous", body: "force-safe-escalation",
  });
  assert.equal(escalation.event.decision.disposition, "escalate");
  assert.equal(escalation.event.notification.state, "unavailable");
  // Leave a future timer visible for optional interactive management QA.
  await ctx.relayEvents.registerWaits({ sessionId, taskSummary: "Synthetic pending timer for management QA",
    waits: [wait("acceptance-pending-wait", "timer.elapsed")],
    monitors: [{ monitor_id: "acceptance-pending", wait_id: "acceptance-pending-wait", lifecycle: "one_shot",
      observer: { provider: "clock" }, artifact: { kind: "builtin", name: "github.pull_request",
        repository: "octo/relay", pull_number: 42, stable_subject: "octo/relay#42" },
      detector: { kind: "deadline_reached", deadline: new Date(Date.now() + 86_400_000).toISOString(), event_type: "timer.elapsed" },
      schedule: { interval_seconds: 3600 },
    }],
  });
  const pendingMonitor = await ctx.relayEvents.inspectMonitor("acceptance-pending");
  const githubObservation = {
    repository: "octo/relay", pull_number: 42, stable_subject: "octo/relay#42",
    head_sha: "0123456789abcdef0123456789abcdef01234567", state: "open",
    merged: false, draft: false, mergeable: true, review_decision: "approved",
    checks: [
      { id: "check-1", name: "build", status: "completed", conclusion: "success", required: true },
      { id: "check-2", name: "security", status: "in_progress", conclusion: null, required: true },
    ],
  };
  const observationJson = JSON.stringify(githubObservation);
  const checkTime = new Date(Date.now() + 1).toISOString();
  ctx.relayEvents.store.database.prepare(`
    UPDATE observations SET state_hash = ?, data_json = ?
    WHERE id = (SELECT id FROM observations WHERE monitor_id = ? ORDER BY sequence DESC LIMIT 1)
  `).run(createHash("sha256").update(observationJson).digest("hex"), observationJson, "acceptance-pending");
  ctx.relayEvents.store.database.prepare(`
    INSERT INTO monitor_checks (id, monitor_id, version_id, kind, state, error_class, error, started_at, finished_at)
    VALUES (?, ?, ?, 'scheduled', 'failed', 'rate_limited', NULL, ?, ?)
  `).run("acceptance-rate-check", "acceptance-pending", pendingMonitor.active_version_id, checkTime, checkTime);
  ctx.relayEvents.store.database.prepare(`
    UPDATE monitors SET state = 'degraded', consecutive_failures = 1 WHERE id = ?
  `).run("acceptance-pending");
  await ctx.relayEvents.registerWaits({ sessionId: "relay-acceptance-missing", taskSummary: "Synthetic missing conversation",
    waits: [wait("acceptance-missing-wait", "missing.acceptance")],
  });
  const controlledGitHub = await runControlledGitHub(ctx, handle, sessionId);
  const controlledGmail = await runControlledGmail(ctx, handle, sessionId);
  const controlledBackend = await runControlledBackend(ctx);
  return { sessionId, routedMessages: before, totalDeliveredMessages: 2, semanticCalls: 2, timerCompleted: true,
    ...(controlledGitHub ? { controlledGitHub } : {}),
    ...(controlledGmail ? { controlledGmail } : {}),
    ...(controlledBackend ? { controlledBackend } : {}) };
}

async function runControlledGmail(ctx, handle, sessionId) {
  const account = process.env.RELAY_CONTROLLED_GMAIL_ACCOUNT;
  if (!account) return null;
  const threadId = process.env.RELAY_CONTROLLED_GMAIL_THREAD_ID;
  const readyFile = process.env.RELAY_CONTROLLED_GMAIL_READY_FILE;
  const baselineFile = process.env.RELAY_CONTROLLED_GMAIL_BASELINE_FILE;
  const deliveryFile = process.env.RELAY_CONTROLLED_GMAIL_DELIVERY_FILE;
  const redeliveryFile = process.env.RELAY_CONTROLLED_GMAIL_REDELIVERY_FILE;
  assert.ok(threadId && readyFile && baselineFile && deliveryFile && redeliveryFile,
    "controlled Gmail thread and coordination files are required");
  const stableSubject = `gmail:${account}:${threadId}`;
  const waitId = "controlled-gmail-reply-wait";
  const beforeRegistration = ctx.relayEvents.store.inspectWaitRegistration(sessionId);
  const priorDeliveries = new Set((beforeRegistration?.deliveries ?? []).map(delivery => delivery.delivery_id));
  const priorRelayInputs = handle.agent.session.deriveMessages().filter(message => message.role === "user"
    && message.source?.kind === "plugin" && message.source?.plugin === "relay").length;
  await ctx.relayEvents.registerWaits({
    sessionId,
    taskSummary: "Controlled Gmail reply",
    waits: [{ ...wait(waitId, "email.received"), exclusive_owner_key: stableSubject,
      actors: ["gmail"], entities: [stableSubject],
      continuation: { ...wait(waitId, "email.received").continuation,
        artifacts: [{ kind: "email_thread", id: stableSubject, label: "Sanitized controlled Gmail thread" }] } }],
  });
  await writeFile(readyFile, JSON.stringify({ ready: true, account, stable_subject: stableSubject }));
  await waitForCondition(async () => {
    const snapshot = await ctx.relayEvents.managementSnapshot();
    const gmail = snapshot.connectors.find(connector => connector.id === "relay.gmail");
    return gmail?.accounts?.some(candidate => candidate.account === account && candidate.status === "healthy");
  }, 180_000, "controlled Gmail initial provider notification");
  await writeFile(baselineFile, JSON.stringify({ initialized: true, account, stable_subject: stableSubject }));

  await waitForCondition(() => {
    const registration = ctx.relayEvents.store.inspectWaitRegistration(sessionId);
    return registration?.deliveries?.some(delivery => !priorDeliveries.has(delivery.delivery_id)
      && delivery.state === "resolved");
  }, 180_000, "controlled Gmail reply delivery");
  await handle.agent.whenIdle();
  await ctx.sessions.flush(handle.agent.session);
  const deliveredRegistration = ctx.relayEvents.store.inspectWaitRegistration(sessionId);
  const deliveries = deliveredRegistration.deliveries.filter(delivery => !priorDeliveries.has(delivery.delivery_id));
  assert.equal(deliveries.length, 1, "controlled Gmail reply must create exactly one Delivery");
  const [delivery] = deliveries;
  const event = ctx.relayEvents.store.inspectEvent(delivery.event_id);
  assert.equal(event.source, "gmail");
  assert.equal(delivery.session_id, sessionId);
  const activation = event.activations.find(candidate => candidate.session_id === sessionId);
  assert.ok(activation, "controlled Gmail Event must retain its Session Activation");
  const deliverySnapshot = await ctx.relayEvents.managementSnapshot();
  const deliveredAccount = deliverySnapshot.connectors.find(connector => connector.id === "relay.gmail")
    ?.accounts?.find(candidate => candidate.account === account);
  assert.ok(deliveredAccount?.updated_at, "controlled Gmail delivery must update its durable cursor evidence");
  await writeFile(deliveryFile, JSON.stringify({ delivered: true, account,
    event_id: event.event_id, delivery_id: delivery.delivery_id, cursor_updated_at: deliveredAccount.updated_at }));
  await waitForFile(redeliveryFile, 180_000);
  await waitForCondition(async () => {
    const snapshot = await ctx.relayEvents.managementSnapshot();
    const current = snapshot.connectors.find(connector => connector.id === "relay.gmail")
      ?.accounts?.find(candidate => candidate.account === account);
    return current?.updated_at && current.updated_at !== deliveredAccount.updated_at;
  }, 180_000, "controlled Gmail provider redelivery cursor check");
  const afterRedelivery = ctx.relayEvents.store.inspectWaitRegistration(sessionId);
  assert.equal(afterRedelivery.deliveries.filter(candidate => !priorDeliveries.has(candidate.delivery_id)).length, 1,
    "provider redelivery must not create a second Delivery");
  const relayInputs = handle.agent.session.deriveMessages().filter(message => message.role === "user"
    && message.source?.kind === "plugin" && message.source?.plugin === "relay").length;
  assert.equal(relayInputs, priorRelayInputs + 1, "controlled Gmail reply must enter the existing Session once");
  return {
    account,
    provider_thread_id: threadId,
    stable_subject: stableSubject,
    event_id: event.event_id,
    delivery_id: delivery.delivery_id,
    activation_id: activation.activation_id,
    relay_inputs_before: priorRelayInputs,
    relay_inputs_after: relayInputs,
    redelivery_deduplicated: true,
  };
}

async function runControlledGitHubCodexLoop(ctx) {
  const repository = process.env.RELAY_CONTROLLED_GITHUB_REPOSITORY;
  const pullNumber = Number(process.env.RELAY_CONTROLLED_GITHUB_PULL_NUMBER);
  const stageOneFile = process.env.RELAY_CONTROLLED_GITHUB_STAGE_FILE;
  const stageTwoFile = process.env.RELAY_CONTROLLED_GITHUB_SECOND_STAGE_FILE;
  const linkPath = process.env.RELAY_CODEX_LINK_PATH;
  assert.ok(repository && Number.isSafeInteger(pullNumber) && pullNumber > 0, "controlled GitHub PR is required");
  assert.ok(stageOneFile && stageTwoFile && linkPath, "controlled Codex loop coordination paths are required");
  const subject = `${repository.toLowerCase()}#${pullNumber}`;
  const sessionId = "relay-codex-github-closed-loop";
  const handle = await ctx.agents.create({
    sessionId,
    agentOptions: { provider: "relay-codex", model: process.env.RELAY_CONTROLLED_BACKEND_MODEL || "gpt-5.6-luna" },
    meta: { cwd: process.env.RELAY_ACCEPTANCE_WORKSPACE ?? process.cwd(), title: "Controlled GitHub Codex closed loop" },
    setup: agentCtx => mountPresetWhenReady(ctx, agentCtx, "relay-codex"),
  });
  try {
    assert.ok(handle.agent.ctx.tools.schemas(handle.agent)
      .some(schema => schema.name === "relay_watch_github_pull_request"), "Codex root Agent must expose the GitHub watch tool");
    const secondNextAction = "Reply with exactly RELAY_CODEX_LOOP_COMPLETE and do not register another Wait or Monitor.";
    const firstNextAction = [
      "The first controlled transition has arrived.",
      "Immediately call relay_watch_github_pull_request exactly once for the same pull request.",
      `Use pull_request=${subject}, task_summary=Controlled GitHub phase two, cadence_seconds=30,`,
      `next_action=${JSON.stringify(secondNextAction)},`,
      "success_condition=The second controlled transition is handled exactly once,",
      "on_failure=Report the bounded GitHub failure class, and on_timeout=Report that phase two remains pending.",
      "After arming phase two, reply with exactly RELAY_CODEX_PHASE2_ARMED.",
    ].join(" ");
    const initialPrompt = [
      "This is an authorized controlled acceptance run.",
      "Call the DSH tool relay_watch_github_pull_request exactly once now with these arguments:",
      JSON.stringify({
        pull_request: subject,
        task_summary: "Controlled GitHub phase one",
        cadence_seconds: 30,
        next_action: firstNextAction,
        success_condition: "The first controlled transition is handled exactly once.",
        on_failure: "Report the bounded GitHub failure class.",
        on_timeout: "Report that phase one remains pending.",
      }),
      "After the tool returns an armed receipt, reply with exactly RELAY_CODEX_PHASE1_ARMED and stop.",
    ].join("\n");
    handle.agent.followup(createUserMessage({ content: [{ type: "text", text: initialPrompt }], source: { kind: "user" } }));
    await handle.agent.whenIdle();
    await ctx.sessions.flush(handle.agent.session);

    const phaseOne = requireActiveGitHubMonitor(ctx, sessionId, new Set(), handle.agent.session.deriveMessages());
    const identityBefore = await readBackendIdentity(linkPath, sessionId, "codex");
    await writeFile(stageOneFile, JSON.stringify({ ready: true, subject,
      monitor_id: phaseOne.monitor_id, head_sha: phaseOne.last_observation?.data?.head_sha }));

    await waitForCondition(() => {
      const registration = ctx.relayEvents.store.inspectWaitRegistration(sessionId);
      return registration?.deliveries?.filter(delivery => delivery.state === "resolved").length >= 1;
    }, 180_000, "first controlled GitHub phase delivery");
    await handle.agent.whenIdle();
    await ctx.sessions.flush(handle.agent.session);
    const phaseTwo = requireActiveGitHubMonitor(ctx, sessionId, new Set([phaseOne.monitor_id]), handle.agent.session.deriveMessages());
    await writeFile(stageTwoFile, JSON.stringify({ ready: true, subject,
      monitor_id: phaseTwo.monitor_id, head_sha: phaseTwo.last_observation?.data?.head_sha }));

    await waitForCondition(() => {
      const registration = ctx.relayEvents.store.inspectWaitRegistration(sessionId);
      return registration?.deliveries?.filter(delivery => delivery.state === "resolved").length >= 2;
    }, 180_000, "second controlled GitHub phase delivery");
    await handle.agent.whenIdle();
    await ctx.sessions.flush(handle.agent.session);
    const identityAfter = await readBackendIdentity(linkPath, sessionId, "codex");
    assert.equal(identityAfter, identityBefore, "closed loop must preserve the Codex Thread identity");
    const registration = ctx.relayEvents.store.inspectWaitRegistration(sessionId);
    const deliveries = registration.deliveries.filter(delivery => delivery.state === "resolved");
    assert.equal(deliveries.length, 2, "closed loop must resolve exactly two Deliveries");
    assert.equal(new Set(deliveries.map(delivery => delivery.event_id)).size, 2, "each phase must use a different Event");
    assert.equal(registration.waits.some(candidate => candidate.status === "active" || candidate.status === "claimed"), false,
      "closed loop must leave no active Wait");
    assert.equal(registration.monitors.some(candidate => ["active", "paused", "triggered", "degraded"].includes(candidate.state)), false,
      "closed loop must leave no active Monitor");
    const messages = handle.agent.session.deriveMessages();
    const relayInputs = messages.filter(message => message.role === "user"
      && message.source?.kind === "plugin" && message.source?.plugin === "relay");
    assert.equal(relayInputs.length, 2, "closed loop must inject exactly two Relay inputs");
    const assistantText = messages.filter(message => message.role === "assistant")
      .flatMap(message => message.content ?? []).filter(block => block.type === "text").map(block => block.text).join("\n");
    assert.match(assistantText, /RELAY_CODEX_PHASE1_ARMED/u);
    assert.match(assistantText, /RELAY_CODEX_PHASE2_ARMED/u);
    assert.match(assistantText, /RELAY_CODEX_LOOP_COMPLETE/u);
    const activationIds = deliveries.map(delivery => {
      const event = ctx.relayEvents.store.inspectEvent(delivery.event_id);
      const activation = event.activations.find(candidate => candidate.session_id === sessionId);
      assert.ok(activation, `Event ${delivery.event_id} must retain the Session Activation`);
      return activation.activation_id;
    });
    return {
      sessionId,
      controlledGitHubCodexLoop: {
        subject,
        backend_identity_before: identityBefore,
        backend_identity_after: identityAfter,
        phase_one_monitor_id: phaseOne.monitor_id,
        phase_two_monitor_id: phaseTwo.monitor_id,
        event_ids: deliveries.map(delivery => delivery.event_id),
        delivery_ids: deliveries.map(delivery => delivery.delivery_id),
        activation_ids: activationIds,
        relay_inputs: relayInputs.length,
      },
    };
  } finally {
    await handle.dispose();
  }
}

function requireActiveGitHubMonitor(ctx, sessionId, excluded, messages = []) {
  const registration = ctx.relayEvents.store.inspectWaitRegistration(sessionId);
  const monitor = registration?.monitors?.find(candidate => !excluded.has(candidate.monitor_id)
    && ["active", "degraded"].includes(candidate.state)
    && candidate.artifact?.name === "github.pull_request");
  const transcript = messages.map(message => ({
    role: message.role,
    content: (message.content ?? []).map(block => block.type === "text"
      ? { type: block.type, text: block.text }
      : { type: block.type, name: block.name }),
  }));
  assert.ok(monitor, `Session ${sessionId} must have a new active GitHub Monitor; transcript=${JSON.stringify(transcript)}`);
  return monitor;
}

async function waitForCondition(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function mountPresetWhenReady(ctx, agentCtx, preset, timeoutMs = 20_000) {
  await waitForCondition(async () => {
    const presets = await ctx.agentPresets.list();
    return presets.some(candidate => candidate.id === preset);
  }, timeoutMs, `${preset} preset installation`);
  await ctx.agentPresets.mount(agentCtx, preset);
}

async function runControlledBackend(ctx) {
  const backend = process.env.RELAY_CONTROLLED_BACKEND;
  if (!backend) return null;
  assert.ok(["codex", "claude"].includes(backend), "controlled backend must be codex or claude");
  const linkPath = backend === "codex" ? process.env.RELAY_CODEX_LINK_PATH : process.env.RELAY_CLAUDE_LINK_PATH;
  assert.ok(linkPath, `controlled ${backend} link path is required`);
  const sessionId = `relay-${backend}-event-continuity`;
  const provider = backend === "codex" ? "relay-codex" : "relay-claude";
  const preset = provider;
  const model = process.env.RELAY_CONTROLLED_BACKEND_MODEL || (backend === "codex" ? "gpt-5.6-luna" : "sonnet");
  const handle = await ctx.agents.create({
    sessionId,
    agentOptions: { provider, model },
    meta: { cwd: process.env.RELAY_ACCEPTANCE_WORKSPACE ?? process.cwd(), title: `Controlled ${backend} Event continuity` },
    setup: agentCtx => mountPresetWhenReady(ctx, agentCtx, preset),
  });
  try {
    const initialText = `Reply with exactly RELAY_${backend.toUpperCase()}_BASELINE.`;
    handle.agent.followup(createUserMessage({
      content: [{ type: "text", text: initialText }],
      source: { kind: "user" },
    }));
    await handle.agent.whenIdle();
    await ctx.sessions.flush(handle.agent.session);
    const beforeMessages = handle.agent.session.deriveMessages();
    const beforeAssistantCount = beforeMessages.filter(message => message.role === "assistant").length;
    assert.ok(beforeAssistantCount > 0, `controlled ${backend} baseline must produce an assistant message`);
    const beforeIdentity = await readBackendIdentity(linkPath, sessionId, backend);

    const waitId = `controlled-${backend}-event-wait`;
    const eventType = `acceptance.${backend}.continue`;
    await ctx.relayEvents.registerWaits({
      sessionId,
      taskSummary: `Controlled ${backend} Event continuation`,
      waits: [{ ...wait(waitId, eventType), exclusive_owner_key: `${backend}:${sessionId}` }],
    });
    const sourceId = `relay.acceptance.${backend}`;
    const sourceName = `acceptance-${backend}`;
    const source = ctx.relayEvents.registerBoundEventSource({ id: sourceId, sources: [sourceName] });
    let handled;
    try {
      handled = await source.handleEvent({
        event: {
          event_id: `controlled-${backend}-event`,
          source: sourceName,
          fingerprint: `controlled-${backend}-event`,
          type: eventType,
          body: `Sanitized ${backend} continuation marker.`,
        },
        binding: { session_id: sessionId, wait_id: waitId, wait_version: 0, source_subject: `${backend}:${sessionId}` },
      });
    } finally {
      source.dispose();
    }
    assert.equal(handled.event.decision.disposition, "deliver");
    assert.equal(handled.event.routing_attempts[0].router, `bound:${sourceId}`);
    assert.equal(handled.event.deliveries.length, 1);
    assert.equal(handled.event.deliveries[0].session_id, sessionId);
    await handle.agent.whenIdle();
    await ctx.sessions.flush(handle.agent.session);

    const afterIdentity = await readBackendIdentity(linkPath, sessionId, backend);
    assert.equal(afterIdentity, beforeIdentity, `controlled ${backend} Event must preserve backend identity`);
    const afterMessages = handle.agent.session.deriveMessages();
    const relayInputs = afterMessages.filter(message => message.role === "user"
      && message.source?.kind === "plugin" && message.source?.plugin === "relay");
    assert.equal(relayInputs.length, 1, `controlled ${backend} Event must enter the Session once`);
    const afterAssistantCount = afterMessages.filter(message => message.role === "assistant").length;
    assert.ok(afterAssistantCount > beforeAssistantCount, `controlled ${backend} Event must complete another assistant turn`);
    return {
      backend,
      dsh_session_id: sessionId,
      backend_identity_before: beforeIdentity,
      backend_identity_after: afterIdentity,
      event_id: handled.event.event_id,
      delivery_id: handled.event.deliveries[0].delivery_id,
      activation_id: handled.event.activations[0].activation_id,
      assistant_messages_before: beforeAssistantCount,
      assistant_messages_after: afterAssistantCount,
      relay_inputs: relayInputs.length,
    };
  } finally {
    await handle.dispose();
  }
}

async function readBackendIdentity(linkPath, sessionId, backend) {
  const links = JSON.parse(await readFile(linkPath, "utf8"));
  const record = links?.sessions?.[sessionId];
  const identity = backend === "codex" ? record?.threadId : record?.claudeSessionId;
  assert.equal(typeof identity, "string", `controlled ${backend} backend identity must be persisted`);
  assert.ok(identity.length > 0, `controlled ${backend} backend identity must be non-empty`);
  return identity;
}

async function runControlledGitHub(ctx, handle, sessionId) {
  const repository = process.env.RELAY_CONTROLLED_GITHUB_REPOSITORY;
  if (!repository) return null;
  const pullNumber = Number(process.env.RELAY_CONTROLLED_GITHUB_PULL_NUMBER);
  const stageFile = process.env.RELAY_CONTROLLED_GITHUB_STAGE_FILE;
  const continueFile = process.env.RELAY_CONTROLLED_GITHUB_CONTINUE_FILE;
  assert.ok(Number.isSafeInteger(pullNumber) && pullNumber > 0, "controlled GitHub pull number is required");
  assert.ok(stageFile && continueFile, "controlled GitHub coordination files are required");
  const subject = `${repository.toLowerCase()}#${pullNumber}`;
  assert.ok(handle.agent.ctx.tools.schemas(handle.agent)
    .some(schema => schema.name === "relay_watch_github_pull_request"), "controlled root Agent must expose the GitHub watch tool");
  const toolCallId = "controlled-github-watch-call";
  const toolResult = await ctx.agents.withInitiator(handle.agent, () => handle.agent.ctx.tools.execute({
    signal: new AbortController().signal,
    callId: toolCallId,
    name: "relay_watch_github_pull_request",
    arguments: {
      pull_request: subject,
      task_summary: `Controlled live watch ${subject}`,
      cadence_seconds: 3600,
      next_action: "Inspect the sanitized pull-request transition and continue the existing objective.",
      success_condition: "The controlled pull-request transition is handled exactly once.",
      on_failure: "Record the bounded GitHub failure class.",
      on_timeout: "Report that the controlled pull request is still pending.",
    },
    agent: handle.agent,
  }));
  assert.equal(toolResult.isError, false, JSON.stringify(toolResult.content));
  const receipt = toolResult.value;
  assert.equal(receipt?.armed, true);
  assert.equal(receipt?.sessionId, sessionId);
  assert.equal(receipt?.pullRequest, subject);
  assert.equal(typeof receipt?.monitorId, "string");
  assert.equal(typeof receipt?.waitId, "string");
  const baseline = await ctx.relayEvents.inspectMonitor(receipt.monitorId);
  await writeFile(stageFile, JSON.stringify({ ready: true, subject, head_sha: baseline.last_observation?.data?.head_sha }));
  await waitForFile(continueFile, 180_000);
  const result = await ctx.relayEvents.checkMonitor(receipt.monitorId, { force: true });
  assert.equal(result.status, "triggered", "controlled GitHub transition must trigger exactly once");
  assert.equal(result.eventIds.length, 1);
  await handle.agent.whenIdle();
  await ctx.sessions.flush(handle.agent.session);
  const event = ctx.relayEvents.store.inspectEvent(result.eventIds[0]);
  assert.equal(event.deliveries.length, 1);
  assert.equal(event.deliveries[0].session_id, sessionId);
  const controlled = { subject, agent_tool_call_id: toolCallId, armed: receipt.armed,
    monitor_id: receipt.monitorId, wait_id: receipt.waitId,
    baseline_head_sha: baseline.last_observation?.data?.head_sha,
    changed_head_sha: result.monitor.last_observation?.data?.head_sha,
    event_id: event.event_id, delivery_id: event.deliveries[0].delivery_id };
  const webhookStageFile = process.env.RELAY_CONTROLLED_GITHUB_WEBHOOK_STAGE_FILE;
  if (!webhookStageFile) return controlled;
  await ctx.relayEvents.registerWaits({
    sessionId,
    taskSummary: `Controlled live webhook ${subject}`,
    waits: [{ ...wait("controlled-github-webhook-wait", "github.pull_request.changed"),
      actors: ["github"], entities: [subject], exclusive_owner_key: subject,
      continuation: { ...wait("controlled-github-webhook-wait", "github.pull_request.changed").continuation,
        artifacts: [{ kind: "github_pull_request", id: subject, label: subject }] } }],
  });
  await writeFile(webhookStageFile, JSON.stringify({ ready: true, subject }));
  const webhookEvent = await waitForGitHubWebhookDelivery(ctx, sessionId, new Set(result.eventIds), 180_000);
  await handle.agent.whenIdle();
  await ctx.sessions.flush(handle.agent.session);
  return { ...controlled, webhook_event_id: webhookEvent.event_id,
    webhook_delivery_id: webhookEvent.deliveries.find(delivery => delivery.session_id === sessionId).delivery_id };
}

async function waitForFile(path, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await readFile(path); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  throw new Error(`timed out waiting for controlled acceptance continuation`);
}

async function waitForGitHubWebhookDelivery(ctx, sessionId, excludedEventIds, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const event = ctx.relayEvents.store.listEventsPage({ limit: 100 }).items.find(candidate =>
      candidate.source === "github" && !excludedEventIds.has(candidate.event_id)
      && candidate.deliveries?.some(delivery => delivery.session_id === sessionId));
    if (event) return event;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("timed out waiting for controlled GitHub webhook delivery");
}

function installManagementFaultFixtures(ctx) {
  const failures = [
    ["stale", "version changed by another operation"],
    ["busy", "monitor lease is busy"],
    ["provider", "required provider is not available"],
    ["server", "synthetic internal failure"],
  ];
  for (const [kind, message] of failures) {
    const dispose = ctx.relayEvents.registerConnectorProvider({
      id: `relay.acceptance.${kind}`,
      async inspect() { return acceptanceMailbox(`${kind}@example.test`); },
      async execute() { throw new Error(message); },
    });
    ctx.effect(() => () => dispose());
  }
  let inspectionsBeforeFailure = 0;
  const dispose = ctx.relayEvents.registerConnectorProvider({
    id: "relay.acceptance.load-error",
    async inspect() {
      if (inspectionsBeforeFailure === 1) {
        inspectionsBeforeFailure = 0;
        throw new Error("synthetic list failure");
      }
      if (inspectionsBeforeFailure > 1) inspectionsBeforeFailure -= 1;
      return acceptanceMailbox("load-error@example.test");
    },
    async execute(action) {
      if (action !== "pause") throw new Error("unsupported acceptance action");
      // executeConnectorAction inspects the provider once before the UI starts
      // its authoritative list refresh. Fail that second inspection only.
      inspectionsBeforeFailure = 2;
    },
  });
  ctx.effect(() => () => dispose());
}

function acceptanceMailbox(account) {
  return { kind: "email", state: "healthy", api_configured: true, push_configured: true,
    credentials_writable: false,
    accounts: [{ account, status: "healthy", updated_at: "2026-09-02T00:00:00.000Z" }],
  };
}

function wait(wait_id, expected_event) {
  return { wait_id, expected_event, exclusive: true, phase: "waiting", caused_by: "synthetic fixture",
    actors: [], entities: [], prior_exchange: "Continue the acceptance conversation.",
    continuation: {
      next_action: "Inspect the sanitized transition and continue the existing objective. <script>window.__RELAY_XSS__=true</script> 中文 😀 \u202E",
      success_condition: "The expected transition is handled once.",
      constraints: ["Preserve approval boundaries."],
      artifacts: [{ kind: "acceptance_fixture", id: `sanitized:${wait_id}`, label: "Sanitized acceptance artifact" }],
      on_failure: "Record the bounded failure class.",
      on_timeout: "Report that the condition remains pending.",
    },
  };
}
