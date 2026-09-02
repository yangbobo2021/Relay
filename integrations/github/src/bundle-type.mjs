import { createPullRequestWatchProposal } from "./workflow.mjs";

export function createGitHubPullRequestBundleType({ authorize, availability, create = createPullRequestWatchProposal } = {}) {
  return {
    api_version: 1,
    type_id: "github.pull-request",
    bundle_version: 1,
    origin: { kind: "plugin", plugin_id: "relay-github", plugin_version: "0.2.0" },
    event_types: ["github.pull_request.transition"],
    parameter_schema: {
      type: "object",
      additionalProperties: false,
      required: ["pull_request"],
      properties: {
        pull_request: { type: "string", minLength: 3, maxLength: 512 },
        cadence_seconds: { type: "integer", minimum: 30, maximum: 86_400 },
        next_action: { type: "string", maxLength: 8_000 },
        success_condition: { type: "string", maxLength: 8_000 },
        on_failure: { type: "string", maxLength: 8_000 },
        on_timeout: { type: "string", maxLength: 8_000 },
      },
    },
    capabilities: ["github.pull-request.read"],
    lifecycle: ["one_shot"],
    locales: {
      "en-US": {
        name: "GitHub pull request",
        description: "Wait for a meaningful pull-request, check, or review transition.",
        permissions: "Reads one authorized repository's pull request, checks, and reviews.",
        remediation: "Configure a project-scoped GitHub token and repository policy.",
      },
      "zh-CN": {
        name: "GitHub 拉取请求",
        description: "等待拉取请求、检查或评审发生有意义的变化。",
        permissions: "读取一个已授权仓库的拉取请求、检查和评审。",
        remediation: "请配置项目范围的 GitHub Token 和仓库策略。",
      },
    },
    ...(authorize ? { authorize } : {}),
    ...(availability ? { availability } : {}),
    async create({ sessionId, taskSummary, parameters, authorization, signal }) {
      return create({
        sessionId,
        taskSummary,
        pullRequest: parameters.pull_request,
        cadenceSeconds: parameters.cadence_seconds,
        continuation: {
          next_action: parameters.next_action,
          success_condition: parameters.success_condition,
          on_failure: parameters.on_failure,
          on_timeout: parameters.on_timeout,
        },
        authorization,
        signal,
      });
    },
  };
}
