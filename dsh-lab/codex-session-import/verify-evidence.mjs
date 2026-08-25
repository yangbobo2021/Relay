import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

const root = import.meta.dirname;
const relayRoot = resolve(root, "../..");
const specRoot = resolve(relayRoot, "docs/spec/codex-session-import-validation");
const schema = JSON.parse(await readFile(resolve(root, "evidence-manifest.schema.json"), "utf8"));
const register = JSON.parse(await readFile(resolve(root, "risk-register.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);

let manifests = 0;
let artifacts = 0;
for (const risk of register.risks) {
  const docs = (await readdir(specRoot)).filter(name => name.startsWith(`${risk.id}-`) && name.endsWith(".md"));
  assert.equal(docs.length, 1, `${risk.id} must have one specification`);
  const spec = await readFile(resolve(specRoot, docs[0]), "utf8");
  assert.match(spec, new RegExp(`- Status: ${risk.status}\\b`));
  assert.match(spec, new RegExp(`- Implementation status: ${risk.implementationStatus.replaceAll("-", " ")}\\b`));

  for (const runId of risk.acceptedRuns) {
    const manifestPath = resolve(root, risk.id, runId, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.ok(validate(manifest), `${manifestPath}: ${JSON.stringify(validate.errors)}`);
    assert.equal(manifest.riskId, risk.id);
    assert.equal(manifest.runId, runId);
    for (const artifact of manifest.artifacts) {
      const path = resolve(dirname(manifestPath), artifact.path);
      assert.ok(existsSync(path), `missing artifact ${path}`);
      const digest = createHash("sha256").update(await readFile(path)).digest("hex");
      assert.equal(digest, artifact.sha256, `hash mismatch for ${path}`);
      artifacts += 1;
    }
    manifests += 1;
  }
}

const deliveryRoot = resolve(root, "delivery-acceptance/20260825");
const deliveryText = await readFile(resolve(deliveryRoot, "result.json"), "utf8");
assert.doesNotMatch(deliveryText, /\/Users\//, "delivery result contains a private home path");
assert.doesNotMatch(deliveryText, /01[a-z0-9]{6,}-[a-z0-9-]{20,}/i, "delivery result contains a live Thread ID");
const delivery = JSON.parse(deliveryText);
assert.equal(delivery.rawThreadIdRecorded, false);
assert.equal(delivery.syntheticThreadDeleted, true);
assert.equal(delivery.assertions.unknownEventError, false);
for (const screenshot of delivery.screenshots) {
  assert.match(screenshot.path, /^[a-z0-9-]+\.png$/);
  const path = resolve(deliveryRoot, screenshot.path);
  const digest = createHash("sha256").update(await readFile(path)).digest("hex");
  assert.equal(digest, screenshot.sha256, `hash mismatch for ${path}`);
  artifacts += 1;
}

const markdown = [
  ...(await readdir(specRoot)).filter(name => name.endsWith(".md")).map(name => resolve(specRoot, name)),
  resolve(relayRoot, "docs/spec/README.md"),
  resolve(root, "README.md"),
];
for (const file of markdown) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
    if (/^[a-z]+:/i.test(match[1])) continue;
    const target = resolve(dirname(file), match[1]);
    assert.ok(existsSync(target), `${file} has broken link ${match[1]}`);
  }
}

process.stdout.write(`${JSON.stringify({ risks: register.risks.length, manifests, artifacts, markdownFiles: markdown.length })}\n`);
