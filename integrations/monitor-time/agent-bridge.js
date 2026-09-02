import { defineTool } from "@deepseek-ai/dsh-tools";

export function installTimeAgentBridge(ctx, { sessionId, scheduleTimer }) {
  if (!sessionId) throw new Error("Relay Time bridge requires the current DSH session id");
  if (typeof scheduleTimer !== "function") throw new Error("scheduleTimer callback is required");
  return ctx.tools.register(defineTool({
    name: "relay_schedule_timer",
    description: "Continue this conversation after a durable positive delay or RFC3339 deadline.",
    parameters: {
      task_summary: { type: "string", required: true },
      after_seconds: { type: "integer" },
      deadline: { type: "string" },
      allow_immediate: { type: "boolean" },
      resume_prompt: { type: "string", required: true },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          scheduled: { type: "boolean", required: true },
          sessionId: { type: "string", required: true },
          timerId: { type: "string", required: true },
          dueAt: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    async execute(args) {
      const timer = await scheduleTimer({
        sessionId,
        taskSummary: args.task_summary,
        afterSeconds: args.after_seconds,
        deadline: args.deadline,
        allowImmediate: args.allow_immediate ?? false,
        resumePrompt: args.resume_prompt,
      });
      return { scheduled: true, sessionId, timerId: timer.timer_id, dueAt: timer.deadline };
    },
  }));
}
