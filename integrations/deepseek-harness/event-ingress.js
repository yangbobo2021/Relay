import { createHash, timingSafeEqual } from "node:crypto";

export const RELAY_EVENT_PATH = "/api/relay/events";

export function registerRelayEventIngress(ctx, {
  relayRuntime,
  token = process.env.RELAY_INGRESS_TOKEN,
  maxBodyBytes = 1_048_576,
} = {}) {
  if (!relayRuntime || typeof relayRuntime.handleEvent !== "function") {
    throw new Error("Relay event ingress requires a Relay runtime");
  }
  return ctx.webServer.register({
    kind: "exact",
    path: RELAY_EVENT_PATH,
    handler: createRelayEventHandler({ relayRuntime, token, maxBodyBytes }),
  });
}

export function createRelayEventHandler({ relayRuntime, token, maxBodyBytes = 1_048_576 }) {
  return async (request, response) => {
    if (request.method !== "POST") {
      writeJson(response, 405, { error: "method_not_allowed" }, { allow: "POST" });
      return;
    }
    if (!authorized(request, token)) {
      writeJson(response, 403, { error: "forbidden" });
      return;
    }

    try {
      const body = await readJson(request, maxBodyBytes);
      const event = normalizeEvent(body);
      const result = await relayRuntime.handleEvent(event);
      writeJson(response, 200, {
        accepted: true,
        duplicate: result.duplicate,
        event_id: result.event.event_id,
        state: result.event.state,
        deliveries: result.event.deliveries.map((delivery) => ({
          delivery_id: delivery.delivery_id,
          session_id: delivery.session_id,
          state: delivery.state,
          wait_ids: delivery.wait_ids,
        })),
      });
    } catch (error) {
      const status = error instanceof EventIngressError ? error.statusCode : 500;
      writeJson(response, status, {
        error: status === 413
          ? "payload_too_large"
          : status < 500 ? "invalid_event" : "event_delivery_failed",
        message: error?.message ?? String(error),
      });
    }
  };
}

function normalizeEvent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new EventIngressError(400, "event body must be a JSON object");
  }
  const type = requiredString(body.type, "type");
  const source = optionalString(body.source) ?? "webhook";
  const sourceEventId = optionalString(body.source_event_id);
  const fingerprint = optionalString(body.fingerprint)
    ?? createHash("sha256").update(`${source}\0${JSON.stringify(body)}`).digest("hex");
  return {
    ...body,
    type,
    source,
    fingerprint,
    ...(sourceEventId ? { source_event_id: sourceEventId } : {}),
  };
}

async function readJson(request, maxBodyBytes) {
  const contentType = String(request.headers?.["content-type"] ?? "").split(";", 1)[0].trim();
  if (contentType !== "application/json") {
    throw new EventIngressError(400, "content-type must be application/json");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw new EventIngressError(413, `event body exceeds ${maxBodyBytes} bytes`);
    }
    chunks.push(buffer);
  }
  if (size === 0) throw new EventIngressError(400, "event body is empty");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new EventIngressError(400, "event body is not valid JSON");
  }
}

function authorized(request, token) {
  if (isLoopback(request.socket?.remoteAddress)) return true;
  if (!token) return false;
  const authorization = String(request.headers?.authorization ?? "");
  if (!authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(String(token));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function requiredString(value, name) {
  const normalized = optionalString(value);
  if (!normalized) throw new EventIngressError(400, `${name} is required`);
  return normalized;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function writeJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(`${JSON.stringify(value)}\n`);
}

class EventIngressError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
