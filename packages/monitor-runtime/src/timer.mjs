import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export class TimerObserver {
  constructor({ clock = () => new Date() } = {}) {
    this.clock = clock;
  }

  async observe() {
    return { observed_at: this.clock().toISOString() };
  }
}

export function createTimerWait({
  sessionId,
  afterSeconds,
  resumePrompt,
  taskSummary = resumePrompt,
  now = new Date(),
  idFactory = randomUUID,
}) {
  assert.equal(typeof sessionId, "string", "timer sessionId is required");
  assert.ok(Number.isSafeInteger(afterSeconds) && afterSeconds > 0, "afterSeconds must be a positive safe integer");
  assert.equal(typeof resumePrompt, "string", "timer resumePrompt is required");
  assert.ok(resumePrompt.trim().length > 0, "timer resumePrompt cannot be empty");
  assert.equal(typeof taskSummary, "string", "timer taskSummary is required");
  assert.ok(taskSummary.trim().length > 0, "timer taskSummary cannot be empty");
  assert.ok(now instanceof Date && Number.isFinite(now.getTime()), "timer now must be a valid Date");

  const timerId = `timer-${idFactory()}`;
  const waitId = `wait-${timerId}`;
  const deadline = new Date(now.getTime() + afterSeconds * 1000).toISOString();
  return {
    sessionId,
    taskSummary: taskSummary.trim(),
    context: { timer_id: timerId, deadline, resume_prompt: resumePrompt.trim() },
    waits: [{
      wait_id: waitId,
      phase: "waiting_for_time",
      exclusive: true,
      exclusive_owner_key: timerId,
      expected_event: `The Relay timer reaches ${deadline}.`,
      caused_by: "The Agent delegated a future continuation to Relay.",
      actors: [],
      entities: [timerId],
      prior_exchange: resumePrompt.trim(),
    }],
    monitors: [{
      monitor_id: timerId,
      wait_id: waitId,
      lifecycle: "one_shot",
      detector: {
        kind: "deadline_reached",
        timer_id: timerId,
        deadline,
        event_type: "timer.elapsed",
        resume_prompt: resumePrompt.trim(),
      },
      schedule: { interval_seconds: afterSeconds, jitter_seconds: 0 },
      capabilities: { clock: true },
      artifact: { kind: "builtin", name: "relay.timer" },
    }],
    timer: { timer_id: timerId, wait_id: waitId, deadline },
  };
}
