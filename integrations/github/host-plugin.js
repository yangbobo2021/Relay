import { installGitHubAgentBridge } from "./agent-bridge.js";
import { GitHubApiClient } from "./src/github-api.mjs";
import { createGitHubPullRequestObserver } from "./src/observer.mjs";
import { registerGitHubWebhook } from "./src/webhook.mjs";
import { createPullRequestWatchProposal } from "./src/workflow.mjs";
import { createGitHubPullRequestBundleType } from "./src/bundle-type.mjs";
import { authorizeProjectRepository, normalizeProjectPolicies, resolveProjectPolicy } from "./src/project-policy.mjs";
import { credentialRef } from "@deepseek-ai/dsh-credentials";

export const name = "relay-dsh-plugin-github";
export const inject = ["agents", "tools", "webServer", "credentials"];

const WEBHOOK_CURRENT = credentialRef("RELAY_GITHUB_WEBHOOK_SECRET");
const WEBHOOK_PREVIOUS = credentialRef("RELAY_GITHUB_WEBHOOK_SECRET_PREVIOUS");
const API_TOKEN = credentialRef("RELAY_GITHUB_TOKEN");

export function apply(ctx, config = {}) {
  const projectPolicies = normalizeProjectPolicies(config.projects);
  const fiber = ctx.inject(["relayEvents", "relayMonitorObservers", "relayMonitorBundles"], scope => {
    const outcome = { last_success_at: null, last_error_class: null };
    const configuredSecrets = async () => {
      const values = await Promise.all([WEBHOOK_CURRENT, WEBHOOK_PREVIOUS].map(ref => scope.credentials.resolve(ref)));
      return values.map(value => value?.value).filter(Boolean);
    };
    const client = new GitHubApiClient({
      getToken: async () => config.apiToken ?? (await scope.credentials.resolve(API_TOKEN))?.value ?? null,
      baseUrl: config.apiBaseUrl,
    });
    const projectCredentialRefs = new Map(projectPolicies.map(policy => [policy.id, credentialRef(policy.credential)]));
    const projectClients = new Map(projectPolicies.map(policy => {
      const tokenRef = projectCredentialRefs.get(policy.id);
      return [policy.id, new GitHubApiClient({
        getToken: async () => (await scope.credentials.resolve(tokenRef))?.value ?? null,
        baseUrl: policy.apiBaseUrl ?? config.apiBaseUrl,
      })];
    }));
    const observerOptions = {
      client,
      clientForMonitor(monitor) {
        const projectScope = monitor?.artifact?.project_scope;
        if (projectScope) return projectClients.get(projectScope) ?? null;
        return projectPolicies.length === 0 ? client : null;
      },
    };
    scope.effect(() => scope.relayMonitorObservers.register(createGitHubPullRequestObserver(observerOptions)), "relay GitHub observer");
    scope.effect(() => scope.relayMonitorObservers.register(createGitHubPullRequestObserver({
      ...observerOptions, id: "github",
    })), "relay GitHub legacy observer alias");
    scope.effect(() => scope.relayMonitorBundles.registerBundleType(createGitHubPullRequestBundleType({
      authorize({ cwd }) {
        return projectPolicies.length === 0 || resolveProjectPolicy(projectPolicies, cwd) != null;
      },
      async availability({ cwd }) {
        if (config.apiToken) return "available";
        const policy = projectPolicies.length > 0 ? resolveProjectPolicy(projectPolicies, cwd) : null;
        const ref = policy ? projectCredentialRefs.get(policy.id) : API_TOKEN;
        if (!ref) return "configuration_required";
        return (await scope.credentials.describe(ref)).configured ? "available" : "configuration_required";
      },
      create({ sessionId, taskSummary, parameters, authorization }) {
        const projectPolicy = projectPolicies.length > 0
          ? resolveProjectPolicy(projectPolicies, authorization.cwd)
          : null;
        if (projectPolicies.length > 0) authorizeProjectRepository(projectPolicy, parameters.pull_request);
        return createPullRequestWatchProposal({
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
          ...(projectPolicy ? { projectScope: projectPolicy.id } : {}),
        });
      },
    })), "relay GitHub Bundle Type");
    const boundSource = scope.relayEvents.registerBoundEventSource({ id: "relay.github", sources: ["github"] });
    scope.effect(() => () => boundSource.dispose(), "relay GitHub bound source");
    scope.effect(() => registerGitHubWebhook(scope, {
      relayEvents: scope.relayEvents,
      boundSource,
      webhookSecrets: config.webhookSecrets ?? config.webhookSecret ?? configuredSecrets,
      webhookPath: config.webhookPath,
      maxBodyBytes: positiveInteger(config.maxBodyBytes, 1_048_576),
      requestsPerMinute: positiveInteger(config.requestsPerMinute, 120),
      onOutcome(result) {
        if (result.ok) { outcome.last_success_at = result.at; outcome.last_error_class = null; }
        else outcome.last_error_class = result.errorClass;
      },
    }), "relay GitHub webhook");
    const management = scope.relayEvents.registerConnectorProvider({
      id: "relay.github",
      async inspect() {
        const [current, previous, api, projectApi] = await Promise.all([
          scope.credentials.describe(WEBHOOK_CURRENT), scope.credentials.describe(WEBHOOK_PREVIOUS), scope.credentials.describe(API_TOKEN),
          Promise.all([...projectCredentialRefs.values()].map(ref => scope.credentials.describe(ref))),
        ]);
        const configuredSecretCount = Array.isArray(config.webhookSecrets)
          ? config.webhookSecrets.filter(secret => typeof secret === "string" && secret.length > 0).length
          : typeof config.webhookSecrets === "function" ? 1
          : typeof config.webhookSecret === "string" && config.webhookSecret.length > 0 ? 1 : 0;
        const secretCount = configuredSecretCount || Number(current.configured) + Number(previous.configured);
        return {
          kind: "github",
          state: secretCount > 0 ? outcome.last_error_class ? "degraded" : "healthy" : "unconfigured",
          webhook_path: config.webhookPath ?? "/api/relay/github/webhook",
          secret_count: secretCount,
          secret_writable: configuredSecretCount === 0 && current.writable && previous.writable,
          api_polling: api.configured || Boolean(config.apiToken) || projectApi.some(item => item.configured),
          project_policy_count: projectPolicies.length,
          configured_project_credential_count: projectApi.filter(item => item.configured).length,
          ...outcome,
        };
      },
      async execute(action, input) {
        if (action === "rotate_secret") {
          const secret = input?.secret;
          if (typeof secret !== "string" || secret.length < 16 || secret.length > 4096) throw new Error("GitHub webhook secret must contain 16 to 4096 characters");
          const [currentInfo, previousInfo] = await Promise.all([
            scope.credentials.describe(WEBHOOK_CURRENT), scope.credentials.describe(WEBHOOK_PREVIOUS),
          ]);
          if (!currentInfo.writable || !previousInfo.writable) throw new Error("GitHub webhook secrets are controlled by a read-only environment source");
          const current = await scope.credentials.resolve(WEBHOOK_CURRENT);
          if (current?.value) await scope.credentials.set(WEBHOOK_PREVIOUS, current.value);
          await scope.credentials.set(WEBHOOK_CURRENT, secret);
          return;
        }
        if (action === "revoke_secret") {
          const [currentInfo, previousInfo] = await Promise.all([
            scope.credentials.describe(WEBHOOK_CURRENT), scope.credentials.describe(WEBHOOK_PREVIOUS),
          ]);
          if (!currentInfo.writable || !previousInfo.writable) throw new Error("GitHub webhook secrets are controlled by a read-only environment source");
          await scope.credentials.unset(WEBHOOK_CURRENT);
          await scope.credentials.unset(WEBHOOK_PREVIOUS);
          return;
        }
        throw new Error(`unsupported GitHub connector action ${action}`);
      },
    });
    scope.effect(() => () => management(), "relay GitHub management");

    const attach = agent => {
      if (!scope.agents.roots().includes(agent)) return;
      const projectPolicy = projectPolicies.length > 0
        ? resolveProjectPolicy(projectPolicies, agent.session.header.cwd)
        : null;
      scope.effect(() => installGitHubAgentBridge(agent.ctx, {
        sessionId: agent.id,
        watchPullRequest: async input => {
          if (projectPolicies.length > 0) authorizeProjectRepository(projectPolicy, input.pullRequest);
          const proposal = await scope.relayMonitorBundles.instantiateBundleType({
            typeId: "github.pull-request",
            bundleVersion: 1,
            sessionId: input.sessionId,
            taskSummary: input.taskSummary,
            authorization: { sessionId: input.sessionId, cwd: agent.session.header.cwd },
            parameters: {
              pull_request: input.pullRequest,
              ...(input.cadenceSeconds === undefined ? {} : { cadence_seconds: input.cadenceSeconds }),
              ...(input.continuation?.next_action === undefined ? {} : { next_action: input.continuation.next_action }),
              ...(input.continuation?.success_condition === undefined ? {} : { success_condition: input.continuation.success_condition }),
              ...(input.continuation?.on_failure === undefined ? {} : { on_failure: input.continuation.on_failure }),
              ...(input.continuation?.on_timeout === undefined ? {} : { on_timeout: input.continuation.on_timeout }),
            },
          });
          const registration = await scope.relayEvents.registerWaits(proposal);
          return { proposal, registration, workflow: proposal.workflow };
        },
      }), "relay GitHub tools");
    };
    scope.effect(() => scope.on("agent/created", ({ agent }) => attach(agent)), "relay GitHub agent bridge");
    for (const agent of scope.agents.roots()) attach(agent);
  });
  ctx.effect(() => () => fiber.dispose(), "relay GitHub injection");
}

export { createGitHubPullRequestBundleType } from "./src/bundle-type.mjs";

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
