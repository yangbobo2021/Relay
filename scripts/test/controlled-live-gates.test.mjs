import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("EP15-011: controlled-live Gmail cannot pass or start without every protected external prerequisite", () => {
  const keys = [
    "RELAY_GMAIL_TOKEN", "RELAY_GMAIL_PUSH_AUDIENCE", "RELAY_GMAIL_PUSH_SERVICE_ACCOUNT",
    "RELAY_CONTROLLED_GMAIL_ACCOUNT", "RELAY_CONTROLLED_GMAIL_THREAD_ID",
    "RELAY_CONTROLLED_GMAIL_READY_FILE", "RELAY_CONTROLLED_GMAIL_BASELINE_FILE",
    "RELAY_CONTROLLED_GMAIL_DELIVERY_FILE", "RELAY_CONTROLLED_GMAIL_REDELIVERY_FILE",
    "RELAY_CONTROLLED_WEB_PORT",
  ];
  const env = { ...process.env };
  for (const key of keys) env[key] = "";
  const result = spawnSync(process.execPath,
    [join(root, "scripts/verify-dsh-official-install.mjs"), "--gmail-controlled-live"],
    { cwd: root, env, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires protected RELAY_GMAIL_TOKEN/u);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /AUDIT_RESULT .*"ok":true/u);
});
