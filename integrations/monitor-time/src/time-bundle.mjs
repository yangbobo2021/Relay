import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export function createTimeBundleType({ clock = () => new Date(), idFactory = randomUUID } = {}) {
  return {
    api_version: 1,
    type_id: "time.deadline",
    bundle_version: 1,
    origin: { kind: "plugin", plugin_id: "relay-monitor-time", plugin_version: "0.1.0" },
    event_types: ["timer.elapsed"],
    parameter_schema: {
      type: "object",
      additionalProperties: false,
      required: ["resume_prompt"],
      properties: {
        after_seconds: { type: "integer", minimum: 1 },
        deadline: { type: "string", minLength: 20, maxLength: 64 },
        allow_immediate: { type: "boolean" },
        resume_prompt: { type: "string", minLength: 1, maxLength: 8_000 },
      },
      oneOf: [
        { required: ["after_seconds"], not: { required: ["deadline"] } },
        { required: ["deadline"], not: { required: ["after_seconds"] } },
      ],
    },
    capabilities: ["clock.read"],
    lifecycle: ["one_shot"],
    locales: {
      "en-US": {
        name: "Deadline timer",
        description: "Continue the current conversation after a durable deadline.",
        permissions: "Reads Relay's host clock; no network, files, or credentials.",
        remediation: "Install or enable the Relay Time Monitor extension.",
      },
      "zh-CN": {
        name: "截止时间计时器",
        description: "在持久化截止时间到达后继续当前会话。",
        permissions: "仅读取 Relay 主机时钟；不访问网络、文件或凭据。",
        remediation: "请安装或启用 Relay Time Monitor 扩展。",
      },
    },
    async availability() { return "available"; },
    async create({ sessionId, taskSummary, parameters }) {
      return createTimerWait({
        sessionId,
        taskSummary,
        afterSeconds: parameters.after_seconds,
        deadline: parameters.deadline,
        allowImmediate: parameters.allow_immediate ?? false,
        resumePrompt: parameters.resume_prompt,
        now: clock(),
        idFactory,
      });
    },
  };
}

export function createTimeProvider({ id = "clock.read", clock = () => new Date() } = {}) {
  return Object.freeze({
    id,
    async observe({ monitor }) {
      assert.ok(["time.deadline", "deadline_reached"].includes(monitor.detector?.kind), `${id} supports only Time deadline detectors`);
      const now = clock();
      assert.ok(now instanceof Date && Number.isFinite(now.getTime()), "clock.read returned an invalid Date");
      return { observed_at: now.toISOString() };
    },
    detect: detectTimeEvents,
  });
}

export function createTimerWait({
  sessionId,
  afterSeconds,
  deadline: absoluteDeadline,
  allowImmediate = false,
  resumePrompt,
  taskSummary = resumePrompt,
  now = new Date(),
  idFactory = randomUUID,
}) {
  assert.equal(typeof sessionId, "string", "timer sessionId is required");
  assert.ok(sessionId.trim(), "timer sessionId cannot be empty");
  assert.notEqual(afterSeconds != null, absoluteDeadline != null, "provide exactly one of afterSeconds or deadline");
  assert.equal(typeof resumePrompt, "string", "timer resumePrompt is required");
  assert.ok(resumePrompt.trim().length > 0, "timer resumePrompt cannot be empty");
  assert.equal(typeof taskSummary, "string", "timer taskSummary is required");
  assert.ok(taskSummary.trim().length > 0, "timer taskSummary cannot be empty");
  assert.ok(now instanceof Date && Number.isFinite(now.getTime()), "timer now must be a valid Date");
  assert.equal(typeof allowImmediate, "boolean", "allowImmediate must be boolean");

  const resolved = resolveDeadline({ afterSeconds, absoluteDeadline, now, allowImmediate });
  const timerId = `timer-${idFactory()}`;
  const waitId = `wait-${timerId}`;
  const deadline = resolved.deadline;
  return {
    sessionId,
    taskSummary: taskSummary.trim(),
    context: { timer_id: timerId, deadline, deadline_intent: resolved.intent, resume_prompt: resumePrompt.trim() },
    waits: [{
      wait_id: waitId,
      phase: "waiting_for_time",
      exclusive: true,
      exclusive_owner_key: timerId,
      expected_event: "timer.elapsed",
      caused_by: "The Agent delegated a future continuation to Relay.",
      actors: [],
      entities: [timerId],
      prior_exchange: resumePrompt.trim(),
      continuation: {
        next_action: resumePrompt.trim(),
        success_condition: "The requested Relay deadline has elapsed.",
        constraints: [],
        artifacts: [{ kind: "relay_timer", id: timerId, label: deadline }],
        on_failure: "Report that the durable timer failed.",
        on_timeout: resumePrompt.trim(),
      },
    }],
    monitors: [{
      monitor_id: timerId,
      wait_id: waitId,
      lifecycle: "one_shot",
      detector: {
        kind: "time.deadline",
        timer_id: timerId,
        deadline,
        event_type: "timer.elapsed",
        resume_prompt: resumePrompt.trim(),
      },
      observer: { provider: "clock.read" },
      schedule: { interval_seconds: resolved.intervalSeconds, jitter_seconds: 0 },
      capabilities: { "clock.read": true },
      artifact: {
        kind: "trusted-provider",
        name: "relay.time.deadline",
        type_id: "time.deadline",
        bundle_version: 1,
        plugin_id: "relay-monitor-time",
        plugin_version: "0.1.0",
      },
    }],
    timer: { timer_id: timerId, wait_id: waitId, deadline, intent: resolved.intent },
  };
}

export function detectTimeEvents({ monitor, current }) {
  const detector = monitor.detector;
  assert.ok(["time.deadline", "deadline_reached"].includes(detector?.kind), "Time provider requires a deadline detector");
  assert.equal(typeof detector.deadline, "string", "Time deadline requires deadline");
  assert.equal(detector.event_type, "timer.elapsed", "Time provider emits only timer.elapsed");
  assert.equal(typeof current?.observed_at, "string", "deadline observation requires observed_at");
  const deadline = Date.parse(detector.deadline);
  const observedAt = Date.parse(current.observed_at);
  assert.ok(Number.isFinite(deadline), "time.deadline deadline must be an ISO timestamp");
  assert.ok(Number.isFinite(observedAt), "deadline observation observed_at must be an ISO timestamp");
  if (observedAt < deadline) return [];
  return [{
    type: "timer.elapsed",
    key: `${detector.timer_id}:${detector.deadline}`,
    data: { deadline: detector.deadline, observed_at: current.observed_at, resume_prompt: detector.resume_prompt },
  }];
}

function resolveDeadline({ afterSeconds, absoluteDeadline, now, allowImmediate }) {
  if (afterSeconds != null) {
    assert.ok(Number.isSafeInteger(afterSeconds) && afterSeconds > 0, "afterSeconds must be a positive safe integer");
    const timestamp = now.getTime() + afterSeconds * 1000;
    assert.ok(Number.isFinite(timestamp) && timestamp <= 8_640_000_000_000_000, "afterSeconds must be a positive safe integer within the Date range");
    return {
      deadline: new Date(timestamp).toISOString(),
      intervalSeconds: afterSeconds,
      intent: { kind: "relative", after_seconds: afterSeconds },
    };
  }
  assert.equal(typeof absoluteDeadline, "string", "deadline must be an RFC3339 string with an explicit timezone");
  const parts = absoluteDeadline.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/u);
  assert.ok(parts, "deadline must be an RFC3339 string with an explicit timezone");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, zoneHourText, zoneMinuteText] = parts;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  assert.ok(month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate(), "deadline must be a valid RFC3339 timestamp");
  assert.ok(Number(hourText) <= 23 && Number(minuteText) <= 59 && Number(secondText) <= 59, "deadline must be a valid RFC3339 timestamp");
  if (zone !== "Z") assert.ok(Number(zoneHourText) <= 23 && Number(zoneMinuteText) <= 59, "deadline must have a valid timezone offset");
  const timestamp = Date.parse(absoluteDeadline);
  assert.ok(Number.isFinite(timestamp), "deadline must be a valid RFC3339 timestamp");
  assert.ok(timestamp > now.getTime() || allowImmediate, "deadline must be in the future unless allowImmediate is true");
  const dueTimestamp = timestamp <= now.getTime() ? now.getTime() : timestamp;
  return {
    deadline: new Date(dueTimestamp).toISOString(),
    intervalSeconds: Math.max(1, Math.ceil((dueTimestamp - now.getTime()) / 1000)),
    intent: { kind: "absolute", input: absoluteDeadline, immediate: timestamp <= now.getTime() },
  };
}
