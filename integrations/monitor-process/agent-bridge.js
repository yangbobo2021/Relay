import { defineTool } from "@deepseek-ai/dsh-tools";

export function installProcessAgentBridge(ctx, { sessionId, cwd, issueHandle }) {
  if (!sessionId || typeof cwd !== "string" || typeof issueHandle !== "function") throw new Error("Process bridge requires authenticated Session, project cwd, and issuer");
  return ctx.tools.register(defineTool({
    name: "relay_issue_process_handle",
    description: "Issue a Session- and project-bound read-only Handle for an existing process before authoring a custom exit Monitor.",
    parameters: { pid: { type: "integer", required: true } },
    output: {
      schema: {
        type: "object", additionalProperties: false, properties: {
          issued: { type: "boolean", required: true }, handle: { type: "string", required: true },
          identity: { type: "string", required: true }, pid: { type: "integer", required: true },
          startIdentity: { type: "string", required: true }, projectRoot: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    async execute(args) {
      return { issued: true, ...await issueHandle({ pid: args.pid, authorization: { sessionId, cwd } }) };
    },
  }));
}
