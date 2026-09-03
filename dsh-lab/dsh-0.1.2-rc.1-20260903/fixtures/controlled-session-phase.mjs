import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { Context } from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import LlmRuntime, { createUserMessage, LlmAdapter } from "@deepseek-ai/dsh-llm";
import SessionStore, { SessionId } from "@deepseek-ai/dsh-session";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import SessionProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";

const phase = process.env.RELAY_DSH_ACCEPT_PHASE;
const persistenceRoot = process.env.RELAY_DSH_ACCEPT_PERSISTENCE_ROOT;
const statePath = process.env.RELAY_DSH_ACCEPT_STATE;
const runtimeVersion = process.env.RELAY_DSH_ACCEPT_RUNTIME_VERSION;

assert.ok(["create", "resume", "verify"].includes(phase), "unknown acceptance phase");
assert.ok(persistenceRoot, "RELAY_DSH_ACCEPT_PERSISTENCE_ROOT is required");
assert.ok(statePath, "RELAY_DSH_ACCEPT_STATE is required");
assert.ok(runtimeVersion, "RELAY_DSH_ACCEPT_RUNTIME_VERSION is required");

const DONOR_ID = SessionId("relay-alpha3-upgrade-donor");
const SEEDED_ID = SessionId("relay-alpha3-upgrade-seeded");
const MODEL = { provider: "relay-controlled", model: "deterministic-stream" };
const FIRST_MARKER = "ALPHA3_HISTORY_MARKER_47A1";
const SEEDED_MARKER = "ALPHA3_SEEDED_STREAM_8D2B";
const RC1_MARKER = "RC1_CONTINUATION_STREAM_19CF";

class ScriptedAdapter extends LlmAdapter {
  constructor(responses) {
    super();
    this.responses = [...responses];
    this.requests = [];
    this.emitted = [];
  }

  async *stream(options) {
    this.requests.push(options);
    const text = this.responses.shift();
    assert.ok(text, "scripted response exhausted");
    const chunks = [
      { type: "block-start", index: 0, blockType: "text" },
      { type: "text-delta", index: 0, text: text.slice(0, Math.ceil(text.length / 2)) },
      { type: "text-delta", index: 0, text: text.slice(Math.ceil(text.length / 2)) },
      { type: "block-end", index: 0, block: { type: "text", text } },
      { type: "usage", usage: { inputTokens: 7, outputTokens: 11 } },
      { type: "finish", reason: { kind: "stop" } },
    ];
    for (const chunk of chunks) {
      this.emitted.push(chunk.type);
      await Promise.resolve();
      yield chunk;
    }
  }
}

function sessionEvents(session) {
  if (typeof session.snapshotEvents === "function") return session.snapshotEvents();
  if (Array.isArray(session.events)) return session.events;
  throw new Error("unsupported DSH Session event surface");
}

function digest(events) {
  return createHash("sha256").update(JSON.stringify(events)).digest("hex");
}

function assertContiguous(events) {
  assert.deepEqual(events.map((event) => event.seq), events.map((_, index) => index));
  assert.equal(new Set(events.map((event) => event.seq)).size, events.length);
}

function messageTexts(session) {
  return session.deriveMessages().flatMap((message) =>
    message.content.filter((block) => block.type === "text").map((block) => block.text));
}

async function mount(responses) {
  const ctx = new Context();
  await ctx.plugin(LlmRuntime);
  await ctx.plugin(SessionStore);
  await ctx.plugin(SessionProjectionRegistry);
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(AgentLoop, { agents: [] });
  await ctx.plugin(JsonlSessionPersistence, { root: persistenceRoot });
  const adapter = new ScriptedAdapter(responses);
  ctx.llm.registerAdapter([MODEL.provider], adapter);
  return { ctx, adapter };
}

async function prompt(agent, text) {
  agent.followup(createUserMessage({
    content: [{ type: "text", text }],
    source: { kind: "user" },
  }));
  await agent.whenIdle();
}

async function createPhase() {
  const { ctx, adapter } = await mount([FIRST_MARKER, SEEDED_MARKER]);
  const donor = await ctx.agents.create({
    sessionId: DONOR_ID,
    agentOptions: MODEL,
    meta: { cwd: process.cwd() },
  });
  await prompt(donor.agent, "Create the exact alpha.3 persistence fixture.");
  await ctx.sessions.flush(donor.agent.session);
  const seed = structuredClone(sessionEvents(donor.agent.session));
  assertContiguous(seed);

  const seeded = await ctx.agents.create({
    sessionId: SEEDED_ID,
    agentOptions: MODEL,
    meta: { cwd: process.cwd(), seedLength: seed.length },
    seed,
  });
  await prompt(seeded.agent, "Append a suffix to the seeded alpha.3 Session.");
  await ctx.sessions.flush(seeded.agent.session);
  const events = structuredClone(sessionEvents(seeded.agent.session));
  assertContiguous(events);
  assert.ok(messageTexts(seeded.agent.session).includes(FIRST_MARKER));
  assert.ok(messageTexts(seeded.agent.session).includes(SEEDED_MARKER));
  assert.deepEqual(adapter.emitted, [
    "block-start", "text-delta", "text-delta", "block-end", "usage", "finish",
    "block-start", "text-delta", "text-delta", "block-end", "usage", "finish",
  ]);
  const state = { events, digest: digest(events), seedLength: seed.length };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  const result = summarize(seeded.agent.session, events, adapter, state.seedLength);
  await seeded.dispose();
  await donor.dispose();
  await ctx.fiber.dispose();
  return result;
}

async function resumePhase() {
  const baseline = JSON.parse(await readFile(statePath, "utf8"));
  const { ctx, adapter } = await mount([RC1_MARKER]);
  const resumed = await ctx.agents.resume({ resumeSessionId: SEEDED_ID, agentOptions: MODEL });
  const before = structuredClone(sessionEvents(resumed.agent.session));
  assert.deepEqual(before.slice(0, baseline.events.length), baseline.events,
    "rc.1 cold restore changed the alpha.3 persisted prefix");
  const migration = before.slice(baseline.events.length);
  assert.deepEqual(migration.map((event) => event.type), ["session/end-seed"],
    "rc.1 may append only its one-time seed-boundary migration event");
  assert.ok(messageTexts(resumed.agent.session).includes(FIRST_MARKER));
  assert.ok(messageTexts(resumed.agent.session).includes(SEEDED_MARKER));
  await prompt(resumed.agent, "Continue the same Session after the rc.1 upgrade.");
  await ctx.sessions.flush(resumed.agent.session);
  const events = structuredClone(sessionEvents(resumed.agent.session));
  assert.deepEqual(events.slice(0, before.length), before, "rc.1 continuation changed the restored prefix");
  assertContiguous(events);
  assert.ok(events.length > before.length);
  assert.ok(messageTexts(resumed.agent.session).includes(RC1_MARKER));
  assert.deepEqual(adapter.emitted, [
    "block-start", "text-delta", "text-delta", "block-end", "usage", "finish",
  ]);
  const state = { events, digest: digest(events), seedLength: baseline.seedLength };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  const result = summarize(resumed.agent.session, events, adapter, baseline.seedLength);
  result.restoredPrefixEvents = before.length;
  result.alpha3PrefixEvents = baseline.events.length;
  result.migrationEvents = migration.map((event) => event.type);
  await resumed.dispose();
  await ctx.fiber.dispose();
  return result;
}

async function verifyPhase() {
  const baseline = JSON.parse(await readFile(statePath, "utf8"));
  const { ctx, adapter } = await mount([]);
  const resumed = await ctx.agents.resume({ resumeSessionId: SEEDED_ID, agentOptions: MODEL });
  const events = structuredClone(sessionEvents(resumed.agent.session));
  assert.deepEqual(events.slice(0, baseline.events.length), baseline.events,
    "second rc.1 cold restart changed the previously persisted prefix");
  const lifecycleBoundary = events.slice(baseline.events.length);
  assert.deepEqual(lifecycleBoundary.map((event) => event.type), ["session/end-seed"],
    "each seeded Session resume may append only its documented lifecycle boundary");
  assertContiguous(events);
  assert.equal(adapter.requests.length, 0, "cold restore unexpectedly invoked the model adapter");
  for (const marker of [FIRST_MARKER, SEEDED_MARKER, RC1_MARKER]) {
    assert.ok(messageTexts(resumed.agent.session).includes(marker));
  }
  const result = summarize(resumed.agent.session, events, adapter, baseline.seedLength);
  result.restoredPrefixEvents = baseline.events.length;
  result.lifecycleEvents = lifecycleBoundary.map((event) => event.type);
  await resumed.dispose();
  await ctx.fiber.dispose();
  return result;
}

function summarize(session, events, adapter, expectedSeedLength) {
  const inheritedEventCount = Number(session.inheritedEventCount ?? session.header.seedLength ?? 0);
  assert.equal(inheritedEventCount, expectedSeedLength);
  return {
    phase,
    runtimeVersion,
    sessionId: session.id,
    eventSurface: typeof session.snapshotEvents === "function" ? "snapshotEvents" : "events",
    eventCount: events.length,
    eventDigest: digest(events),
    inheritedEventCount,
    turnEnds: events.filter((event) => event.type === "turn/end").length,
    modelRequests: adapter.requests.length,
    emittedChunkTypes: adapter.emitted,
  };
}

const result = phase === "create"
  ? await createPhase()
  : phase === "resume"
    ? await resumePhase()
    : await verifyPhase();

process.stdout.write(`${JSON.stringify(result)}\n`);
