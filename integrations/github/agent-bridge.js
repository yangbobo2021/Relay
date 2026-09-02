import { defineTool } from "@deepseek-ai/dsh-tools";

export function installGitHubAgentBridge(ctx, { sessionId, watchPullRequest }) {
  return ctx.tools.register(defineTool({
    name: "relay_watch_github_pull_request",
    description: "Durably watch one GitHub pull request and continue this same conversation on a meaningful change.",
    parameters: {
      pull_request: { type: "string", required: true },
      task_summary: { type: "string", required: true },
      cadence_seconds: { type: "integer" },
      next_action: { type: "string" },
      success_condition: { type: "string" },
      on_failure: { type: "string" },
      on_timeout: { type: "string" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          armed: { type: "boolean", required: true },
          sessionId: { type: "string", required: true },
          monitorId: { type: "string", required: true },
          waitId: { type: "string", required: true },
          pullRequest: { type: "string", required: true },
          nextCheckAt: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    async execute(args) {
      const result = await watchPullRequest({
        sessionId,
        pullRequest: args.pull_request,
        taskSummary: args.task_summary,
        cadenceSeconds: args.cadence_seconds,
        continuation: {
          next_action: args.next_action,
          success_condition: args.success_condition,
          on_failure: args.on_failure,
          on_timeout: args.on_timeout,
        },
      });
      return {
        armed: true,
        sessionId,
        monitorId: result.workflow.monitor_id,
        waitId: result.workflow.wait_id,
        pullRequest: result.workflow.target.stable_subject,
        ...(result.registration.monitors?.[0]?.next_check_at ? { nextCheckAt: result.registration.monitors[0].next_check_at } : {}),
      };
    },
  }));
}
