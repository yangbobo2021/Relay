import { timingSafeEqual } from "node:crypto";

import { EmailConnectorError, RELAY_GMAIL_PUSH_PATH } from "./contracts.mjs";
import { normalizeGmailMessage } from "./normalize.mjs";

export class GmailConnector {
  constructor({ relayEvents, boundSource, client, cursorStore }) {
    this.relayEvents = relayEvents;
    this.boundSource = boundSource;
    this.client = client;
    this.cursorStore = cursorStore;
  }

  async sync({ account, notifiedCursor, signal }) {
    const stored = this.cursorStore.get(account);
    if (!stored) {
      return { initialized: true, cursor: this.cursorStore.commit(account, String(notifiedCursor)), events: [] };
    }
    if (stored.status === "paused") throw new EmailConnectorError("connector_paused", "Gmail synchronization is paused", 409);
    let history;
    try { history = await this.client.listHistory({ cursor: stored.cursor, signal }); }
    catch (error) {
      if (error.errorClass === "cursor_expired" || error.errorClass === "cursor_invalid") {
        this.cursorStore.commit(account, stored.cursor, { status: "degraded", errorClass: error.errorClass });
        const recovered = await this.client.listRecentMessageIds({ signal, maxMessages: 500 });
        if (recovered.truncated) {
          throw new EmailConnectorError("resync_too_large", "Gmail bounded resync exceeded 500 recent messages");
        }
        const results = await this.processMessages({ account, messageIds: recovered.messageIds, signal });
        const cursor = this.cursorStore.commit(account, String(notifiedCursor));
        return { initialized: false, resynced: true, cursor, events: results };
      }
      throw error;
    }
    const results = await this.processMessages({ account, messageIds: history.messageIds, signal });
    const cursor = this.cursorStore.commit(account, String(history.cursor ?? notifiedCursor));
    return { initialized: false, resynced: false, cursor, events: results };
  }

  async processMessages({ account, messageIds, signal }) {
    const results = [];
    for (const messageId of messageIds) {
      const message = await this.client.getMessage({ messageId, signal });
      const event = normalizeGmailMessage(message, { account });
      const binding = resolveEmailBinding(this.relayEvents.listWaits(), event.stable_subject);
      results.push(await this.boundSource.handleEvent({ event, binding }));
    }
    return results;
  }
}

export function registerGmailPush(ctx, options) {
  return ctx.webServer.register({ kind: "exact", path: options.pushPath ?? RELAY_GMAIL_PUSH_PATH, handler: createGmailPushHandler(options) });
}

export function createGmailPushHandler({ connector, pushToken, verifyPush, maxBodyBytes = 262_144 } = {}) {
  if (typeof connector?.sync !== "function") throw new TypeError("Gmail push requires connector.sync()");
  const resolvePushToken = typeof pushToken === "function" ? pushToken : async () => pushToken;
  return async (request, response) => {
    if (request.method !== "POST") return writeJson(response, 405, { error: "method_not_allowed" }, { allow: "POST" });
    try {
      if (typeof verifyPush === "function") await verifyPush(request);
      else {
        const token = await resolvePushToken();
        if (typeof token !== "string" || token.length < 16) throw new EmailConnectorError("push_unconfigured", "Gmail push authentication is not configured", 503);
        if (!authorized(request.headers?.authorization, token)) return writeJson(response, 401, { error: "unauthorized" });
      }
      const body = await readJson(request, maxBodyBytes);
      const push = decodePush(body);
      const result = await connector.sync(push);
      return writeJson(response, 202, { accepted: true, initialized: result.initialized, resynced: Boolean(result.resynced), cursor: result.cursor.cursor, event_count: result.events.length });
    } catch (error) {
      const status = error instanceof EmailConnectorError ? error.statusCode
        : Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      return writeJson(response, status, { error: status === 413 ? "payload_too_large" : status < 500 ? error.errorClass : "email_sync_failed" });
    }
  };
}

export function resolveEmailBinding(registrations, stableSubject) {
  const candidates = [];
  for (const registration of registrations ?? []) for (const wait of registration.waits ?? []) {
    if (wait.status !== "active") continue;
    if ((wait.continuation?.artifacts ?? []).some(artifact => artifact.kind === "email_thread" && artifact.id === stableSubject)) candidates.push({ registration, wait });
  }
  if (candidates.length !== 1) return null;
  const [{ registration, wait }] = candidates;
  return { session_id: registration.session_id, wait_id: wait.wait_id, wait_version: wait.version, source_subject: stableSubject };
}

function decodePush(body) {
  if (!body?.message || typeof body.message.data !== "string") throw new EmailConnectorError("invalid_notification", "Gmail push message data is missing", 400);
  let value;
  try { value = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8")); }
  catch { throw new EmailConnectorError("invalid_notification", "Gmail push data is invalid", 400); }
  if (typeof value.emailAddress !== "string" || value.emailAddress.length > 320 || !/^\d+$/u.test(String(value.historyId))) {
    throw new EmailConnectorError("invalid_notification", "Gmail push account or history cursor is invalid", 400);
  }
  return { account: value.emailAddress, notifiedCursor: String(value.historyId) };
}

async function readJson(request, max) {
  if (String(request.headers?.["content-type"] ?? "").split(";", 1)[0].toLowerCase() !== "application/json") throw new EmailConnectorError("unsupported_media_type", "Gmail push must be JSON", 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > max) throw new EmailConnectorError("payload_too_large", "Gmail push is too large", 413);
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new EmailConnectorError("invalid_json", "Gmail push JSON is invalid", 400); }
}

function authorized(header, token) {
  const prefix = "Bearer ";
  if (typeof header !== "string" || !header.startsWith(prefix)) return false;
  const supplied = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function writeJson(response, status, value, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  response.end(`${JSON.stringify(value)}\n`);
}
