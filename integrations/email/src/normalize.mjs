import { createHash } from "node:crypto";

import { EmailConnectorError } from "./contracts.mjs";

export function normalizeGmailMessage(message, { account }) {
  if (!message || typeof message !== "object") throw new EmailConnectorError("malformed_message", "Gmail message is invalid");
  const messageId = required(message.id, "message id", 512);
  const threadId = required(message.threadId, "thread id", 512);
  const headers = new Map((message.payload?.headers ?? []).slice(0, 500)
    .filter(header => typeof header?.name === "string" && typeof header?.value === "string")
    .map(header => [header.name.toLowerCase(), header.value]));
  const mime = collectMime(message.payload, { attachments: [], text: [], html: [], deliveryStatus: false }, 0);
  const body = mime.text.join("\n").trim() || stripHtml(mime.html.join("\n")).trim();
  const summarized = summarizeBody(body);
  const messageKind = classifyMessage(headers, summarized, mime);
  const normalized = {
    source: "gmail",
    source_event_id: messageId,
    type: "email.received",
    account: required(account, "account", 320),
    provider_message_id: messageId,
    provider_thread_id: threadId,
    stable_subject: `gmail:${account}:${threadId}`,
    from: bounded(headers.get("from"), 1000),
    to: splitAddresses(headers.get("to")),
    cc: splitAddresses(headers.get("cc")),
    bcc: splitAddresses(headers.get("bcc")),
    reply_to: splitAddresses(headers.get("reply-to")),
    subject: bounded(headers.get("subject"), 2000),
    provider_message_id_header: bounded(headers.get("message-id"), 1000),
    thread_evidence: {
      in_reply_to: bounded(headers.get("in-reply-to"), 1000),
      references: bounded(headers.get("references"), 4000),
    },
    received_at: normalizeTimestamp(message.internalDate),
    message_kind: messageKind,
    automation_evidence: {
      auto_submitted: bounded(headers.get("auto-submitted"), 256),
      precedence: bounded(headers.get("precedence"), 256),
      list_id: bounded(headers.get("list-id"), 1000),
    },
    body_summary: summarized.current.slice(0, 8000),
    quoted_history_summary: summarized.quoted.slice(0, 4000),
    body_truncated: body.length > 8000,
    attachments: mime.attachments.slice(0, 100),
  };
  normalized.fingerprint = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return normalized;
}

function collectMime(part, result, depth) {
  if (!part || depth > 20) return result;
  const mimeType = String(part.mimeType ?? "application/octet-stream").toLowerCase();
  if (mimeType === "message/delivery-status") result.deliveryStatus = true;
  const filename = bounded(part.filename, 512);
  const size = Number(part.body?.size ?? 0);
  if (filename || part.body?.attachmentId) {
    result.attachments.push({
      filename: filename || "unnamed",
      mime_type: mimeType.slice(0, 256),
      size_bytes: Number.isSafeInteger(size) && size >= 0 ? Math.min(size, 1_000_000_000) : null,
      attachment_id: bounded(part.body?.attachmentId, 512),
      disposition: attachmentDisposition(filename, mimeType, size),
    });
  } else if (typeof part.body?.data === "string") {
    const decoded = decodeBase64Url(part.body.data, 2_000_000);
    if (mimeType === "text/plain") result.text.push(decoded);
    else if (mimeType === "text/html") result.html.push(decoded);
  }
  for (const child of (part.parts ?? []).slice(0, 200)) collectMime(child, result, depth + 1);
  return result;
}

function decodeBase64Url(value, maxBytes) {
  const buffer = Buffer.from(value, "base64url");
  if (buffer.length > maxBytes) throw new EmailConnectorError("message_too_large", "Email text part is too large");
  return buffer.toString("utf8");
}

function splitAddresses(value) {
  if (typeof value !== "string") return [];
  const addresses = [];
  let current = "";
  let quoted = false;
  let angleDepth = 0;
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    else if (!quoted && character === "<") angleDepth += 1;
    else if (!quoted && character === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (character === "," && !quoted && angleDepth === 0) {
      if (current.trim()) addresses.push(current.trim().slice(0, 320));
      current = "";
      if (addresses.length >= 100) break;
    } else current += character;
  }
  if (addresses.length < 100 && current.trim()) addresses.push(current.trim().slice(0, 320));
  return addresses;
}

function stripHtml(value) {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ").replace(/&nbsp;/giu, " ").replace(/&lt;/giu, "<").replace(/&gt;/giu, ">").replace(/&amp;/giu, "&");
}

function attachmentDisposition(filename, mimeType, size) {
  if (/\.(?:exe|dll|com|bat|cmd|js|jar|scr|ps1|sh|dmg|pkg)$/iu.test(filename ?? "")
    || /(?:x-msdownload|x-executable|x-sh|java-archive)/iu.test(mimeType)) return "blocked";
  if (/\.(?:p7m|gpg|pgp)$/iu.test(filename ?? "") || /(?:pkcs7|pgp-encrypted)/iu.test(mimeType)) return "encrypted_metadata_only";
  if (Number.isFinite(size) && size > 25_000_000) return "oversized_metadata_only";
  return "metadata_only";
}

function summarizeBody(body) {
  const marker = /(?:^|\n)(?:On .{0,500} wrote:|[- ]{2,}(?:Original|Forwarded) Message[- ]{2,}|From:\s.+\nSent:\s.+)/imu;
  const match = marker.exec(body);
  if (match) return {
    current: body.slice(0, match.index).trim(),
    quoted: body.slice(match.index).trim(),
  };
  const lines = body.split("\n");
  const quoted = lines.filter(line => /^\s*>/u.test(line));
  return {
    current: lines.filter(line => !/^\s*>/u.test(line)).join("\n").trim(),
    quoted: quoted.join("\n").trim(),
  };
}

function classifyMessage(headers, summarized, mime) {
  const subject = headers.get("subject") ?? "";
  const from = headers.get("from") ?? "";
  if (mime.deliveryStatus || /mailer-daemon|postmaster/iu.test(from)
    || /(?:delivery status notification|undeliver(?:ed|able)|mail delivery failed)/iu.test(subject)) return "delivery_failure";
  if (headers.has("list-id") || headers.has("list-unsubscribe")) return "mailing_list";
  const autoSubmitted = (headers.get("auto-submitted") ?? "").trim().toLowerCase();
  const precedence = (headers.get("precedence") ?? "").trim().toLowerCase();
  if ((autoSubmitted && autoSubmitted !== "no") || /^(?:bulk|list|junk)$/u.test(precedence)) return "automated";
  if (/^(?:fwd?|转发)\s*:/iu.test(subject) || /forwarded message/iu.test(summarized.quoted)) return "forward";
  if (headers.has("in-reply-to") || headers.has("references") || /^(?:re|回复|答复)\s*:/iu.test(subject)) return "reply";
  return "message";
}

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function required(value, name, max) {
  if (typeof value !== "string" || !value || value.length > max) throw new EmailConnectorError("malformed_message", `${name} is invalid`);
  return value;
}

function bounded(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
