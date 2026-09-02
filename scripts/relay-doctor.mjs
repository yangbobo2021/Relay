#!/usr/bin/env node
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const dictionaries = {
  "en-US": {
    title: "Relay doctor",
    healthy: "Relay is ready. Warnings describe optional or local-host limitations.",
    failed: "Relay is not ready: {count} blocking check(s) failed.",
    help: "Usage: npm run doctor -- [--json] [--probe] [--locale en-US|zh-CN] [--timezone IANA] [--database PATH] [--dsh-home PATH] [--profile NAME] [--target-schema N]",
    status: { ok: "Healthy", warning: "Warning", failed: "Failed" },
    remediation: {
      github_secret_missing: "Configure the GitHub webhook secret in Waiting events or at the protected launch source.",
      github_token_missing: "Configure a project-scoped read-only GitHub token for pull request polling.",
      gmail_credentials_missing: "Configure a Gmail API token and either a Push token or both Pub/Sub OIDC settings before enabling email delivery.",
      gmail_oidc_incomplete: "Configure both RELAY_GMAIL_PUSH_AUDIENCE and RELAY_GMAIL_PUSH_SERVICE_ACCOUNT, or neither.",
      notification_unavailable: "Configure a notification provider or inspect escalations in Waiting events.",
      local_host_required: "Keep the DSH Host running for timely checks; overdue work recovers after restart.",
      migration_required: "Back up the database and start the candidate Relay Host once to apply the supported migration.",
      unsupported_downgrade: "Restore a database backup compatible with the older release; never downgrade this database in place.",
      profile_plugin_missing: "Install the missing packed Relay plugin into the selected DSH profile.",
      router_unconfigured: "Configure a provider and model in Waiting events, or keep exact-only routing intentionally.",
      router_configuration_incomplete: "Set both Semantic Router provider and model; a partial route is never activated.",
      schema_too_new: "Run this database only with the same or a newer compatible Relay release.",
      locale_unsupported: "Select en-US or zh-CN.",
      timezone_invalid: "Select a valid IANA timezone such as Asia/Shanghai.",
      profile_not_initialized: "Initialize the selected profile and install the required packed Relay plugins.",
      probe_not_requested: "Run doctor with --probe before release or after an upgrade.",
      database_locked: "Stop the conflicting Host and retry; do not delete the database.",
      database_corrupt: "Restore a verified backup and retain the damaged database for diagnosis.",
      missing_path: "Install or correct the missing path reported by this check.",
      permission_denied: "Grant the current user the required access and retry.",
      events_api_unsupported: "Install matching Events and integration plugin versions.",
      package_identity_mismatch: "Replace the package with the expected signed release artifact.",
      check_failed: "Inspect this check's JSON details and correct the reported layer.",
      generic: "Inspect this check's JSON details and correct the reported layer.",
    },
  },
  "zh-CN": {
    title: "Relay 诊断",
    healthy: "Relay 已就绪。警告项说明可选能力或本地主机限制。",
    failed: "Relay 尚未就绪：{count} 个阻断检查失败。",
    help: "用法：npm run doctor -- [--json] [--probe] [--locale en-US|zh-CN] [--timezone IANA] [--database 路径] [--dsh-home 路径] [--profile 名称] [--target-schema 版本]",
    status: { ok: "正常", warning: "警告", failed: "失败" },
    remediation: {
      github_secret_missing: "请在“等待事件”中配置 GitHub Webhook 密钥，或在受保护的启动来源中配置。",
      github_token_missing: "请配置项目范围、只读的 GitHub 令牌以轮询拉取请求。",
      gmail_credentials_missing: "启用邮件投递前，请配置 Gmail API 令牌，并配置 Push 令牌或完整的 Pub/Sub OIDC 设置。",
      gmail_oidc_incomplete: "请同时配置 RELAY_GMAIL_PUSH_AUDIENCE 和 RELAY_GMAIL_PUSH_SERVICE_ACCOUNT，或两者都不配置。",
      notification_unavailable: "请配置通知提供方，或在“等待事件”中查看升级事件。",
      local_host_required: "请保持 DSH Host 运行以便及时检查；逾期任务会在重启后恢复。",
      migration_required: "请先备份数据库，再启动一次候选 Relay Host 来执行受支持的迁移。",
      unsupported_downgrade: "请恢复与旧版本兼容的数据库备份；不要原地降级此数据库。",
      profile_plugin_missing: "请把缺失的 Relay 打包插件安装到所选 DSH 配置档。",
      router_unconfigured: "请在“等待事件”中配置提供方和模型，或明确保持仅精确路由。",
      router_configuration_incomplete: "请同时填写语义路由提供方和模型；Relay 不会启用不完整配置。",
      schema_too_new: "请仅使用同版本或更高兼容版本的 Relay 打开该数据库。",
      locale_unsupported: "请选择 en-US 或 zh-CN。",
      timezone_invalid: "请选择有效的 IANA 时区，例如 Asia/Shanghai。",
      profile_not_initialized: "请初始化所选配置档，并安装所需的 Relay 打包插件。",
      probe_not_requested: "发布前或升级后，请使用 --probe 运行诊断。",
      database_locked: "请停止占用数据库的 Host 后重试，不要删除数据库。",
      database_corrupt: "请恢复已验证的备份，并保留损坏数据库用于诊断。",
      missing_path: "请安装缺失组件或修正此诊断项报告的路径。",
      permission_denied: "请为当前用户授予所需访问权限后重试。",
      events_api_unsupported: "请安装版本匹配的 Events 与集成插件。",
      package_identity_mismatch: "请替换为预期的已签名发布产物。",
      check_failed: "请查看此诊断项的 JSON 详情并修复对应层。",
      generic: "请查看此诊断项的 JSON 详情并修复对应层。",
    },
  },
};

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const locale = args.locale ?? process.env.RELAY_LOCALE ?? "en-US";
const messages = dictionaries[locale] ?? dictionaries["en-US"];

if (args.help) {
  console.log(messages.help);
  process.exit(0);
}

const context = {
  root,
  dshHome: resolve(args["dsh-home"] ?? process.env.DSH_HOME ?? join(root, ".relay")),
  profile: args.profile ?? "web",
  targetSchema: args["target-schema"] == null ? null : Number(args["target-schema"]),
  databasePath: null,
  dshRoot: resolve(process.env.DSH_ROOT ?? join(root, "upstream", "deepseek-harness")),
  timezone: args.timezone ?? process.env.RELAY_TIMEZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
};
context.databasePath = resolve(args.database ?? process.env.RELAY_DATABASE_PATH ?? join(context.dshHome, "events.sqlite"));

const checks = [];
await runCheck("runtime.node", "blocking", async () => {
  const major = Number(process.versions.node.split(".")[0]);
  return major >= 22 ? healthy(`Node ${process.versions.node}`) : failed("node_unsupported", "Relay requires Node 22 or newer");
});
await runCheck("packages.events", "blocking", () => packageCheck("integrations/events", "relay-dsh-plugin-events"));
await runCheck("packages.monitors", "blocking", () => packageCheck("integrations/monitors", "relay-dsh-plugin-monitors"));
await runCheck("packages.monitor_time", "blocking", () => packageCheck("integrations/monitor-time", "relay-dsh-plugin-monitor-time"));
await runCheck("packages.monitor_process", "blocking", () => packageCheck("integrations/monitor-process", "relay-dsh-plugin-monitor-process"));
await runCheck("packages.monitor_author", "blocking", () => packageCheck("integrations/monitor-author", "relay-dsh-plugin-monitor-author"));
await runCheck("packages.github", "blocking", () => packageCheck("integrations/github", "relay-dsh-plugin-github"));
await runCheck("packages.router", "optional", () => packageCheck("integrations/semantic-router", "relay-dsh-plugin-semantic-router"));
await runCheck("packages.email", "optional", () => packageCheck("integrations/email", "relay-dsh-plugin-email"));
await runCheck("events.api", "blocking", async () => {
  const source = await readFile(join(root, "integrations/events/contracts/index.mjs"), "utf8");
  const version = Number(source.match(/EVENTS_API_VERSION\s*=\s*(\d+)/u)?.[1]);
  return version === 1 ? healthy("Relay Events API v1", { api_version: version })
    : failed("events_api_unsupported", `Expected Relay Events API v1, found ${Number.isFinite(version) ? version : "unknown"}`);
});
await runCheck("dsh.runtime", "blocking", async () => {
  const manifest = JSON.parse(await readFile(join(context.dshRoot, "package.json"), "utf8"));
  return healthy(`DSH ${manifest.version}`, { version: manifest.version });
});
await runCheck("profile.plugins", "blocking", async () => {
  const profileManifest = join(context.dshHome, "profiles", context.profile, "package.json");
  let manifest;
  try { manifest = JSON.parse(await readFile(profileManifest, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return warning("profile_not_initialized", "Selected DSH profile is not initialized", { profile: context.profile });
    throw error;
  }
  const installed = new Set(Object.keys(manifest.dependencies ?? {}));
  const required = ["relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-monitor-author", "relay-dsh-plugin-github"];
  const missing = required.filter(name => !installed.has(name));
  return missing.length === 0 ? healthy("Required Relay plugins are installed", { profile: context.profile, required })
    : failed("profile_plugin_missing", `Selected profile is missing ${missing.join(", ")}`, { profile: context.profile, missing });
});
await runCheck("storage.parent", "blocking", async () => {
  await access(dirname(context.databasePath), constants.R_OK | constants.W_OK);
  return healthy("Database parent is readable and writable", { path: redactPath(context.databasePath) });
});
await runCheck("storage.database", "blocking", async () => {
  try {
    await access(context.databasePath, constants.F_OK | constants.R_OK);
  } catch (error) {
    if (error.code === "ENOENT") return healthy("Database has not been created yet", { state: "not_created", path: redactPath(context.databasePath) });
    throw error;
  }
  const before = await stat(context.databasePath);
  const database = new DatabaseSync(context.databasePath, { readOnly: true });
  try {
    const integrity = database.prepare("PRAGMA quick_check").get().quick_check;
    const version = database.prepare("SELECT MAX(version) AS version FROM relay_schema").get().version;
    if (integrity !== "ok") return failed("database_corrupt", "SQLite quick_check failed", { schema_version: version });
    if (version > 10) return failed("schema_too_new", `Database schema ${version} is newer than this Relay build`, { schema_version: version });
    if (context.targetSchema != null && (!Number.isSafeInteger(context.targetSchema) || context.targetSchema < version)) {
      return failed("unsupported_downgrade", `Database schema ${version} cannot be downgraded to ${context.targetSchema}`, { schema_version: version, target_schema: context.targetSchema });
    }
    if (version < 10) return failed("migration_required", `Database schema ${version} requires a supported upgrade to schema 10`, { schema_version: version, target_schema: 10 });
    return healthy(`SQLite schema ${version}`, { schema_version: version, integrity });
  } finally {
    database.close();
    const after = await stat(context.databasePath);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error("read-only database check changed the file");
  }
});
await runCheck("github.webhook_secret", "blocking", async () => {
  const info = await credentialInfo("RELAY_GITHUB_WEBHOOK_SECRET");
  return info.configured
    ? healthy("GitHub webhook verification is configured", info)
    : failed("github_secret_missing", "Configure a GitHub webhook secret with at least 16 characters");
});
await runCheck("github.api_token", "warning", async () => {
  const info = await credentialInfo("RELAY_GITHUB_TOKEN");
  return info.configured ? healthy("GitHub API polling credential is configured", info)
    : warning("github_token_missing", "GitHub API polling is unavailable until a read token is configured");
});
await runCheck("email.credentials", "warning", async () => {
  const [api, push] = await Promise.all([credentialInfo("RELAY_GMAIL_TOKEN"), credentialInfo("RELAY_GMAIL_PUSH_TOKEN")]);
  const oidcAudience = Boolean(process.env.RELAY_GMAIL_PUSH_AUDIENCE?.trim());
  const oidcServiceAccount = Boolean(process.env.RELAY_GMAIL_PUSH_SERVICE_ACCOUNT?.trim());
  if (oidcAudience !== oidcServiceAccount) return warning("gmail_oidc_incomplete", "Gmail Pub/Sub OIDC configuration is incomplete", {
    api_configured: api.configured, oidc_audience_configured: oidcAudience, oidc_service_account_configured: oidcServiceAccount,
  });
  const oidc = oidcAudience && oidcServiceAccount;
  return api.configured && (push.configured || oidc)
    ? healthy("Gmail API and Push authentication are configured", {
      api: api.source, push_authentication: oidc ? "google_oidc" : "shared_token",
      ...(push.configured && !oidc ? { push: push.source } : {}),
    })
    : warning("gmail_credentials_missing", "Gmail requires an API credential and Push authentication", {
      api_configured: api.configured, push_token_configured: push.configured, push_oidc_configured: oidc,
    });
});
await runCheck("router.configuration", "optional", async () => {
  const { provider, model, source } = await routerConfiguration();
  if (!provider && !model) return warning("router_unconfigured", "Semantic Router is inactive; exact and trusted routing remain available");
  if (!provider || !model) return failed("router_configuration_incomplete", "Semantic Router requires both provider and model");
  return healthy("Semantic Router provider and model are configured", {
    provider: safeIdentifier(provider), model: safeIdentifier(model), source,
  });
});
await runCheck("runtime.locale", "blocking", async () => new Set(["en-US", "zh-CN"]).has(locale)
  ? healthy(`Locale ${locale}`, { locale }) : failed("locale_unsupported", `Unsupported locale ${locale}`));
await runCheck("runtime.timezone", "blocking", async () => {
  try { new Intl.DateTimeFormat(locale, { timeZone: context.timezone }).format(new Date()); }
  catch { return failed("timezone_invalid", `Invalid timezone ${context.timezone}`); }
  return healthy(`Timezone ${context.timezone}`, { timezone: context.timezone });
});
await runCheck("scheduler.availability", "warning", async () => warning(
  "local_host_required",
  "Durable overdue recovery is enabled, but checks cannot run while this local Host is stopped or the computer is powered off",
));
await runCheck("notification.provider", "warning", async () => process.env.RELAY_NOTIFICATION_PROVIDER
  ? healthy("Notification provider is configured", { provider: safeIdentifier(process.env.RELAY_NOTIFICATION_PROVIDER) })
  : warning("notification_unavailable", "Escalations remain visible in Relay, but no external notification provider is configured"));
await runCheck("probe.disposable", "optional", async () => args.probe
  ? disposableProbe()
  : warning("probe_not_requested", "Disposable ingress-to-inbox probe was not requested; run doctor with --probe"));

const blockingFailures = checks.filter(check => check.severity === "blocking" && check.status !== "healthy");
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  status: blockingFailures.length === 0 ? "healthy" : "failed",
  locale,
  checks,
  summary: { total: checks.length, healthy: checks.filter(c => c.status === "healthy").length, warnings: checks.filter(c => c.status === "warning").length, blocking_failures: blockingFailures.length },
};

if (args.json) console.log(JSON.stringify(report, null, 2));
else renderText(report, messages);
if (blockingFailures.length > 0) process.exitCode = 1;

async function runCheck(id, severity, operation) {
  try { checks.push({ id, severity, ...(await operation()) }); }
  catch (error) { checks.push({ id, severity, ...failed(classifyError(error), publicError(error)) }); }
}

async function packageCheck(directory, expectedName) {
  const manifest = JSON.parse(await readFile(join(root, directory, "package.json"), "utf8"));
  if (manifest.name !== expectedName) return failed("package_identity_mismatch", `Expected ${expectedName} but found ${manifest.name}`);
  return healthy(`${manifest.name} ${manifest.version}`, { name: manifest.name, version: manifest.version });
}

function healthy(message, details = {}) { return { status: "healthy", code: "ok", message, details, remediation: null }; }
function warning(code, message, details = {}) { return { status: "warning", code, message, details, remediation: remediationFor(code) }; }
function failed(code, message, details = {}) { return { status: "failed", code, message, details, remediation: remediationFor(code) }; }

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--json") result.json = true;
    else if (value === "--probe") result.probe = true;
    else if (value === "--help" || value === "-h") result.help = true;
    else if (["--locale", "--timezone", "--database", "--dsh-home", "--profile", "--target-schema"].includes(value)) {
      if (!values[index + 1]) throw new Error(`${value} requires a value`);
      result[value.slice(2)] = values[++index];
    } else throw new Error(`unknown option ${value}`);
  }
  return result;
}

function renderText(report, dictionary) {
  console.log(dictionary.title);
  for (const check of report.checks) {
    const translatedStatus = check.status === "healthy" ? dictionary.status.ok : check.status === "warning" ? dictionary.status.warning : dictionary.status.failed;
    console.log(`${check.status === "healthy" ? "✓" : check.status === "warning" ? "!" : "✗"} ${check.id}: ${translatedStatus}`);
    if (check.remediation) console.log(`  ${dictionary.remediation[check.code] ?? dictionary.remediation.generic}`);
  }
  console.log(report.status === "healthy" ? dictionary.healthy : dictionary.failed.replace("{count}", String(report.summary.blocking_failures)));
}

function classifyError(error) {
  if (error?.code === "ENOENT") return "missing_path";
  if (error?.code === "EACCES") return "permission_denied";
  if (/database is locked/iu.test(error?.message ?? "")) return "database_locked";
  if (/malformed|not a database/iu.test(error?.message ?? "")) return "database_corrupt";
  return "check_failed";
}

function publicError(error) {
  let message = String(error?.message ?? error)
    .replace(/Bearer\s+[^\s'"<>]+/giu, "Bearer [REDACTED]")
    .replace(/(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]+/gu, "[REDACTED]");
  for (const key of Object.keys(process.env).filter(key => /(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY)$/u.test(key))) {
    const secret = process.env[key];
    if (secret && secret.length >= 8) message = message.split(secret).join("[REDACTED]");
  }
  return message.length > 500 ? `${message.slice(0, 500)}…` : message;
}

function remediationFor(code) {
  return ({
    github_secret_missing: "Set RELAY_GITHUB_WEBHOOK_SECRET and configure the same value in GitHub.",
    github_token_missing: "Set a project-scoped read-only RELAY_GITHUB_TOKEN for PR, check, and review polling.",
    notification_unavailable: "Configure RELAY_NOTIFICATION_PROVIDER or inspect escalations in Waiting events.",
    local_host_required: "Keep the DSH Host running for timely checks; overdue work recovers after restart.",
    missing_path: "Install the missing component using the documented packed-plugin commands.",
    permission_denied: "Grant the current user read/write access to the Relay database directory.",
    database_locked: "Stop the conflicting process and run doctor again; do not delete the database.",
    database_corrupt: "Restore a verified backup and retain the damaged database for diagnosis.",
    migration_required: "Back up the database and start the candidate Relay Host once to apply the supported migration.",
    unsupported_downgrade: "Restore a compatible backup; Relay never downgrades a database in place.",
    profile_plugin_missing: "Install the missing packed Relay plugin into the selected DSH profile.",
  })[code] ?? "Inspect this check and correct the reported layer before release use.";
}

async function credentialInfo(ref) {
  const direct = process.env[ref];
  if (typeof direct === "string" && direct.length > 0) return { configured: true, source: "environment", writable: false };
  const credentialPath = join(context.dshHome, ".credentials.yaml");
  try {
    const text = await readFile(credentialPath, "utf8");
    const refs = text.match(/^refs:\s*\n((?:^[ \t]+.*(?:\n|$))*)/mu)?.[1] ?? "";
    if (new RegExp(`^\\s+${ref}:\\s*(?!["']{0,2}\\s*$).+`, "mu").test(refs)) {
      return { configured: true, source: "credential-store", writable: true };
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const [path, source] of [[join(process.cwd(), ".env"), "project-env"], [join(context.dshHome, ".env"), "user-env"]]) {
    try {
      const text = await readFile(path, "utf8");
      if (new RegExp(`^${ref}=.+$`, "mu").test(text)) return { configured: true, source, writable: false };
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return { configured: false, source: null, writable: true };
}

async function routerConfiguration() {
  const environment = {
    provider: process.env.RELAY_ROUTER_PROVIDER?.trim() ?? "",
    model: process.env.RELAY_ROUTER_MODEL?.trim() ?? "",
  };
  if (environment.provider || environment.model) return { ...environment, source: "environment" };
  for (const filename of ["settings.yaml", "settings.yml", "settings.json"]) {
    try {
      const text = await readFile(join(context.dshHome, filename), "utf8");
      if (filename.endsWith(".json")) {
        const section = JSON.parse(text)?.["relay-semantic-router"] ?? {};
        return {
          provider: typeof section.provider === "string" ? section.provider.trim() : "",
          model: typeof section.model === "string" ? section.model.trim() : "",
          source: "settings",
        };
      }
      const section = text.match(/^relay-semantic-router:\s*(?:#.*)?\n((?:^[ \t]+.*(?:\n|$))*)/mu)?.[1] ?? "";
      const value = key => decodeSimpleYamlScalar(section.match(new RegExp(`^[ \\t]+${key}:[ \\t]*(.*)$`, "mu"))?.[1]);
      const provider = value("provider");
      const model = value("model");
      if (provider || model) return { provider, model, source: "settings" };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return { provider: "", model: "", source: null };
}

function decodeSimpleYamlScalar(value) {
  if (typeof value !== "string") return "";
  const withoutComment = value.replace(/\s+#.*$/u, "").trim();
  if (!withoutComment || withoutComment === "null" || withoutComment === "~") return "";
  if ((withoutComment.startsWith('"') && withoutComment.endsWith('"'))
    || (withoutComment.startsWith("'") && withoutComment.endsWith("'"))) {
    return withoutComment.slice(1, -1).trim();
  }
  return withoutComment;
}

async function disposableProbe() {
  const directory = await mkdtemp(join(tmpdir(), "relay-doctor-probe-"));
  const marker = `doctor-${randomUUID()}`;
  let service;
  try {
    const [{ Context }, { RelayEventsService }, { createRelayEventHandler }] = await Promise.all([
      import("@deepseek-ai/cordis"),
      import(new URL("../integrations/events/events-service.js", import.meta.url)),
      import(new URL("../integrations/events/event-ingress.js", import.meta.url)),
    ]);
    const admitted = [];
    service = new RelayEventsService(new Context(), {
      databasePath: join(directory, "probe.sqlite"),
      dispatchPollIntervalMs: 60_000,
      inbox: { async deliver(value) { admitted.push(value); } },
    });
    await service.registerWaits({
      sessionId: marker,
      taskSummary: "Disposable Relay doctor probe",
      waits: [{
        wait_id: `${marker}-wait`, phase: "doctor", exclusive: true, expected_event: "relay.doctor.probe",
        caused_by: "Explicit disposable doctor probe", actors: [], entities: [], prior_exchange: "Disposable probe",
      }],
    });
    const handler = createRelayEventHandler({ relayRuntime: service });
    const request = Readable.from([JSON.stringify({ type: "relay.doctor.probe", source: "relay-doctor", source_event_id: marker })]);
    request.method = "POST";
    request.headers = { "content-type": "application/json" };
    request.socket = { remoteAddress: "127.0.0.1" };
    const response = { status: null, body: "", writeHead(status) { this.status = status; }, end(value = "") { this.body += value; } };
    await handler(request, response);
    const payload = JSON.parse(response.body);
    if (response.status !== 200 || payload.state !== "resolved" || admitted.length !== 1
      || admitted[0].deliveries[0].event.source_event_id !== marker) {
      throw new Error("disposable ingress-to-inbox probe did not reach durable admission");
    }
    return healthy("Disposable ingress-to-inbox probe passed and its isolated records were removed", {
      ingress_status: response.status, admitted: admitted.length, isolated_storage: true, cleanup: "completed",
    });
  } finally {
    if (service) await service.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

function redactPath(path) {
  const home = process.env.HOME;
  return home && path.startsWith(home) ? `$HOME${path.slice(home.length)}` : path;
}

function safeIdentifier(value) {
  return /^[a-z][a-z0-9._-]{0,63}$/u.test(value) ? value : "configured";
}
