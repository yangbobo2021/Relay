import { createHmac, timingSafeEqual } from "node:crypto";

import { GitHubConnectorError, RELAY_GITHUB_WEBHOOK_PATH } from "./contracts.mjs";
import { normalizeGitHubWebhook } from "./normalize.mjs";

export function registerGitHubWebhook(ctx, options) {
  const path = options.webhookPath ?? RELAY_GITHUB_WEBHOOK_PATH;
  return ctx.webServer.register({ kind: "exact", path, handler: createGitHubWebhookHandler(options) });
}

export function createGitHubWebhookHandler({
  relayEvents,
  boundSource,
  webhookSecrets,
  maxBodyBytes = 1_048_576,
  requestsPerMinute = 120,
  clock = () => Date.now(),
  onOutcome = () => {},
} = {}) {
  if (typeof relayEvents?.handleEvent !== "function" || typeof relayEvents?.listWaits !== "function") throw new TypeError("GitHub webhook requires Relay Events");
  if (typeof boundSource?.handleEvent !== "function" || typeof boundSource?.dismissEvent !== "function") {
    throw new TypeError("GitHub webhook requires a bound source capability with handleEvent() and dismissEvent()");
  }
  const resolveSecrets = typeof webhookSecrets === "function" ? webhookSecrets : async () => webhookSecrets;
  const limiter = createFixedWindowLimiter(requestsPerMinute, clock);
  return async (request, response) => {
    if (request.method !== "POST") return writeJson(response, 405, { error: "method_not_allowed" }, { allow: "POST" });
    if (!limiter.take()) return writeJson(response, 429, { error: "rate_limited" }, { "retry-after": "60" });
    const contentType = String(header(request, "content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") return writeJson(response, 415, { error: "unsupported_media_type" });
    const encoding = String(header(request, "content-encoding") ?? "identity").trim().toLowerCase();
    if (encoding !== "identity") return writeJson(response, 415, { error: "unsupported_content_encoding" });
    try {
      const rawBody = await readBoundedBody(request, maxBodyBytes);
      const secrets = normalizeSecrets(await resolveSecrets());
      verifySignature(rawBody, header(request, "x-hub-signature-256"), secrets);
      const deliveryId = requiredHeader(request, "x-github-delivery", 256);
      const eventName = requiredHeader(request, "x-github-event", 128);
      const payload = parseBoundedJson(rawBody);
      const event = normalizeGitHubWebhook({ eventName, deliveryId, rawBody, payload });
      const result = event.type === "github.unsupported"
        ? await boundSource.dismissEvent({ event, summary: `GitHub event ${event.provider_event} is not supported by this Connector.` })
        : await boundSource.handleEvent({ event, binding: resolveGitHubBinding(relayEvents.listWaits(), event.stable_subject) });
      safeOutcome(onOutcome, { ok: true, at: new Date(clock()).toISOString(), errorClass: null });
      return writeJson(response, 202, {
        accepted: true,
        duplicate: Boolean(result.duplicate),
        event_id: result.event.event_id,
        state: result.event.state,
        disposition: result.event.decision?.disposition ?? null,
      });
    } catch (error) {
      const status = error instanceof GitHubConnectorError ? error.statusCode
        : Number.isInteger(error?.statusCode) ? error.statusCode
        : /reused with conflicting content/u.test(error?.message ?? "") ? 409 : 500;
      safeOutcome(onOutcome, { ok: false, at: new Date(clock()).toISOString(), errorClass: error?.errorClass ?? (status === 409 ? "conflicting_delivery" : "github_delivery_failed") });
      return writeJson(response, status, {
        error: status === 401 ? "invalid_signature" : status === 413 ? "payload_too_large"
          : status === 429 ? "rate_limited" : status === 503 && error?.errorClass === "global_concurrency_limited" ? "temporarily_overloaded"
          : status === 409 ? "conflicting_delivery" : status < 500 ? error.errorClass ?? "invalid_request" : "github_delivery_failed",
      });
    }
  };
}

function safeOutcome(listener, value) {
  try { listener(value); } catch { /* status reporting cannot change webhook acknowledgement */ }
}

export function resolveGitHubBinding(registrations, stableSubject) {
  if (!stableSubject) return null;
  const candidates = [];
  for (const registration of registrations ?? []) {
    for (const wait of registration.waits ?? []) {
      if (wait.status !== "active") continue;
      const artifacts = wait.continuation?.artifacts ?? [];
      const matchesArtifact = artifacts.some(artifact => artifact.kind === "github_pull_request" && String(artifact.id).toLowerCase() === stableSubject.toLowerCase());
      const matchesMonitor = (registration.monitors ?? []).some(monitor => monitor.wait_id === wait.wait_id && monitor.artifact?.name === "github.pull_request" && String(monitor.artifact.stable_subject).toLowerCase() === stableSubject.toLowerCase());
      if (matchesArtifact || matchesMonitor) candidates.push({ registration, wait });
    }
  }
  if (candidates.length !== 1) return null;
  const [{ registration, wait }] = candidates;
  return { session_id: registration.session_id, wait_id: wait.wait_id, wait_version: wait.version, source_subject: stableSubject };
}

function verifySignature(body, signature, secrets) {
  if (typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/iu.test(signature)) {
    throw new GitHubConnectorError("invalid_signature", "GitHub signature is missing or malformed", 401);
  }
  const supplied = Buffer.from(signature.slice(7).toLowerCase(), "hex");
  let matched = false;
  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(body).digest();
    matched = timingSafeEqual(supplied, expected) || matched;
  }
  if (!matched) throw new GitHubConnectorError("invalid_signature", "GitHub signature did not match", 401);
}

async function readBoundedBody(request, maxBodyBytes) {
  const length = Number(header(request, "content-length"));
  if (Number.isFinite(length) && length > maxBodyBytes) throw new GitHubConnectorError("payload_too_large", "GitHub payload is too large", 413);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new GitHubConnectorError("payload_too_large", "GitHub payload is too large", 413);
    chunks.push(buffer);
  }
  if (size === 0) throw new GitHubConnectorError("invalid_payload", "GitHub payload is empty", 400);
  return Buffer.concat(chunks);
}

function parseBoundedJson(rawBody) {
  let value;
  try { value = JSON.parse(rawBody.toString("utf8")); }
  catch { throw new GitHubConnectorError("invalid_json", "GitHub payload is not valid JSON", 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new GitHubConnectorError("invalid_payload", "GitHub payload must be an object", 400);
  let keys = 0;
  const visit = (node, depth) => {
    if (depth > 32) throw new GitHubConnectorError("payload_too_complex", "GitHub payload nesting is too deep", 413);
    if (!node || typeof node !== "object") return;
    for (const child of Object.values(node)) {
      keys += 1;
      if (keys > 10_000) throw new GitHubConnectorError("payload_too_complex", "GitHub payload has too many fields", 413);
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return value;
}

function requiredHeader(request, name, max) {
  const value = header(request, name);
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new GitHubConnectorError("invalid_headers", `${name} is missing or invalid`, 400);
  return value.trim();
}

function header(request, name) {
  const headers = request.headers ?? {};
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function normalizeSecrets(value) {
  const secrets = (Array.isArray(value) ? value : [value]).filter(secret => typeof secret === "string" && secret.length >= 16 && secret.length <= 4096);
  if (secrets.length === 0) throw new GitHubConnectorError("webhook_unconfigured", "GitHub webhook verification is not configured", 503);
  return secrets;
}

function createFixedWindowLimiter(limit, clock) {
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new TypeError("requestsPerMinute must be positive");
  let window = Math.floor(clock() / 60_000);
  let used = 0;
  return { take() {
    const current = Math.floor(clock() / 60_000);
    if (current !== window) { window = current; used = 0; }
    if (used >= limit) return false;
    used += 1;
    return true;
  } };
}

function writeJson(response, status, value, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  response.end(`${JSON.stringify(value)}\n`);
}
