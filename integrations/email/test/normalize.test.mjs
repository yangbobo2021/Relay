import assert from "node:assert/strict";
import test from "node:test";

import { normalizeGmailMessage } from "../src/normalize.mjs";

test("EP15-002/005: multipart Gmail normalization prefers text, bounds evidence, and blocks executable attachments", () => {
  const message = gmailMessage({
    parts: [
      { mimeType: "text/html", body: { data: Buffer.from("<b>HTML fallback</b>").toString("base64url") } },
      { mimeType: "text/plain", body: { data: Buffer.from("你好, approved").toString("base64url") } },
      { mimeType: "application/x-msdownload", filename: "invoice.exe", body: { attachmentId: "attachment-secret-id", size: 1234 } },
    ],
  });
  const event = normalizeGmailMessage(message, { account: "agent@example.test" });
  assert.equal(event.type, "email.received");
  assert.equal(event.body_summary, "你好, approved");
  assert.equal(event.stable_subject, "gmail:agent@example.test:thread-1");
  assert.equal(event.attachments[0].disposition, "blocked");
  assert.equal(event.attachments[0].size_bytes, 1234);
  assert.match(event.fingerprint, /^[a-f0-9]{64}$/u);
});

test("EP15-002: HTML-only, reply headers, Unicode names, and empty subjects remain bounded", () => {
  const message = gmailMessage({
    headers: [
      { name: "From", value: "购买者 <buyer@example.test>" },
      { name: "To", value: "agent@example.test" },
      { name: "In-Reply-To", value: "<previous@example.test>" },
    ],
    parts: [{ mimeType: "text/html", body: { data: Buffer.from("<p>Approved &amp; ready</p><script>bad()</script>").toString("base64url") } }],
  });
  const event = normalizeGmailMessage(message, { account: "agent@example.test" });
  assert.match(event.body_summary, /Approved & ready/u);
  assert.ok(!event.body_summary.includes("bad()"));
  assert.equal(event.subject, "");
  assert.equal(event.thread_evidence.in_reply_to, "<previous@example.test>");
  assert.equal(event.message_kind, "reply");
});

test("EP15-002: forward, BCC, quoted history, list, automated response, and delivery failure are canonical", () => {
  const forward = normalizeGmailMessage(gmailMessage({
    headers: [
      { name: "From", value: "\"购买者, 上海\" <buyer@example.test>" },
      { name: "To", value: "agent@example.test" },
      { name: "Bcc", value: "\"审计, 组\" <audit@example.test>, hidden@example.test" },
      { name: "Reply-To", value: "support@example.test" },
      { name: "Subject", value: "Fwd: 已批准 ✅" },
    ],
    parts: [{ mimeType: "text/plain", body: { data: Buffer.from(
      "Please continue.\n\n---------- Forwarded message ---------\nFrom: earlier@example.test\n> quoted history",
    ).toString("base64url") } }],
  }), { account: "agent@example.test" });
  assert.equal(forward.message_kind, "forward");
  assert.deepEqual(forward.bcc, ['"审计, 组" <audit@example.test>', "hidden@example.test"]);
  assert.deepEqual(forward.reply_to, ["support@example.test"]);
  assert.equal(forward.body_summary, "Please continue.");
  assert.match(forward.quoted_history_summary, /Forwarded message/u);

  const mailingList = normalizeGmailMessage(gmailMessage({
    headers: [
      { name: "From", value: "team@example.test" },
      { name: "List-Id", value: "Relay Users <relay.example.test>" },
      { name: "List-Unsubscribe", value: "<mailto:unsubscribe@example.test>" },
      { name: "Subject", value: "Release" },
    ],
  }), { account: "agent@example.test" });
  assert.equal(mailingList.message_kind, "mailing_list");
  assert.equal(mailingList.automation_evidence.list_id, "Relay Users <relay.example.test>");

  const automated = normalizeGmailMessage(gmailMessage({
    headers: [
      { name: "From", value: "bot@example.test" },
      { name: "Auto-Submitted", value: "auto-replied" },
      { name: "Precedence", value: "bulk" },
      { name: "Subject", value: "Out of office" },
    ],
  }), { account: "agent@example.test" });
  assert.equal(automated.message_kind, "automated");

  const failure = normalizeGmailMessage(gmailMessage({
    headers: [
      { name: "From", value: "MAILER-DAEMON@example.test" },
      { name: "Subject", value: "Delivery Status Notification" },
    ],
    parts: [
      { mimeType: "message/delivery-status", body: { data: Buffer.from("Action: failed").toString("base64url") } },
      { mimeType: "application/pkcs7-mime", filename: "details.p7m", body: { attachmentId: "encrypted", size: 100 } },
      { mimeType: "application/pdf", filename: "large.pdf", body: { attachmentId: "large", size: 30_000_000 } },
    ],
  }), { account: "agent@example.test" });
  assert.equal(failure.message_kind, "delivery_failure");
  assert.deepEqual(failure.attachments.map(item => item.disposition),
    ["encrypted_metadata_only", "oversized_metadata_only"]);
});

function gmailMessage({ parts, headers } = {}) {
  return {
    id: "message-1", threadId: "thread-1", internalDate: "1788048000000",
    payload: {
      mimeType: "multipart/alternative",
      headers: headers ?? [
        { name: "From", value: "buyer@example.test" },
        { name: "To", value: "agent@example.test" },
        { name: "Subject", value: "Approved" },
      ],
      parts: parts ?? [],
    },
  };
}
