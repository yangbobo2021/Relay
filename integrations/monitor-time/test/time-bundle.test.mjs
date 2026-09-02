import assert from "node:assert/strict";
import test from "node:test";

import { Context } from "@deepseek-ai/cordis";
import { RelayMonitorBundleRegistry } from "../../monitors/src/bundle-registry.mjs";
import { RelayMonitorObserverRegistry } from "../../monitors/src/observer-registry.mjs";
import { createTimeBundleType, createTimeProvider, createTimerWait } from "../src/time-bundle.mjs";

test("MB05-002: Time extension registers localized type and owns clock observation/detection", async () => {
  const ctx = new Context();
  const bundles = new RelayMonitorBundleRegistry(ctx);
  const observers = new RelayMonitorObserverRegistry(ctx);
  bundles.registerBundleType(createTimeBundleType({ clock: () => new Date("2026-08-30T00:00:30.000Z") }));
  observers.register(createTimeProvider({ clock: () => new Date("2026-08-30T00:00:30.000Z") }));
  const [entry] = await bundles.listBundleTypes({ locale: "zh-CN" });
  assert.equal(entry.type_id, "time.deadline");
  assert.equal(entry.name, "截止时间计时器");
  assert.deepEqual(entry.capabilities, ["clock.read"]);
  assert.deepEqual(entry.event_types, ["timer.elapsed"]);
  const monitor = { observer: { provider: "clock.read" }, detector: {
    kind: "time.deadline", timer_id: "timer-1", deadline: "2026-08-30T00:00:30.000Z", event_type: "timer.elapsed",
  } };
  const current = await observers.observe({ monitor });
  assert.equal((await observers.detect({ monitor, previous: null, current }))[0].key, "timer-1:2026-08-30T00:00:30.000Z");
});

test("MB05-003: relative timer proposal is bound to the authenticated Session", () => {
  const proposal = createTimerWait({
    sessionId: "session-timer", afterSeconds: 30, resumePrompt: "Continue the deployment.",
    now: new Date("2026-08-30T00:00:00.000Z"), idFactory: () => "fixed",
  });
  assert.equal(proposal.timer.deadline, "2026-08-30T00:00:30.000Z");
  assert.equal(proposal.monitors[0].observer.provider, "clock.read");
  assert.equal(proposal.monitors[0].detector.kind, "time.deadline");
  assert.equal(proposal.sessionId, "session-timer");
  assert.deepEqual(proposal.timer.intent, { kind: "relative", after_seconds: 30 });
});

test("MB05-004: absolute deadline validates timezone, calendar, future policy, and boundary input", () => {
  const base = { sessionId: "s", resumePrompt: "恢复部署", now: new Date("2026-08-30T00:00:00.000Z"), idFactory: () => "absolute" };
  const proposal = createTimerWait({ ...base, deadline: "2026-08-30T08:30:00+08:00" });
  assert.equal(proposal.timer.deadline, "2026-08-30T00:30:00.000Z");
  assert.deepEqual(proposal.timer.intent, { kind: "absolute", input: "2026-08-30T08:30:00+08:00", immediate: false });
  for (const deadline of ["2026-08-30T00:30:00", "not-a-date", "2026-08-29T23:59:59Z", "2026-02-30T00:00:00Z"]) {
    assert.throws(() => createTimerWait({ ...base, deadline }), /deadline/u);
  }
  assert.throws(() => createTimerWait({ ...base, afterSeconds: 1, deadline: "2026-08-30T00:30:00Z" }), /exactly one/u);
  for (const afterSeconds of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createTimerWait({ ...base, afterSeconds, deadline: undefined }), /positive safe integer/u);
  }
  const immediate = createTimerWait({ ...base, deadline: "2026-08-29T23:59:59Z", allowImmediate: true });
  assert.equal(immediate.timer.deadline, base.now.toISOString());
});

test("MB05-007: legacy clock/deadline_reached data retains its Event key and deadline semantics", async () => {
  const provider = createTimeProvider({ id: "clock", clock: () => new Date("2026-08-30T00:00:30.000Z") });
  const monitor = { monitor_id: "legacy-timer", detector: {
    kind: "deadline_reached", timer_id: "legacy-timer", deadline: "2026-08-30T00:00:30.000Z",
    event_type: "timer.elapsed", resume_prompt: "continue",
  } };
  const current = await provider.observe({ monitor });
  const [event] = await provider.detect({ monitor, previous: { observed_at: "2026-08-30T00:00:29.000Z" }, current });
  assert.equal(event.key, "legacy-timer:2026-08-30T00:00:30.000Z");
  assert.equal(event.type, "timer.elapsed");
  assert.equal(event.data.resume_prompt, "continue");
});
