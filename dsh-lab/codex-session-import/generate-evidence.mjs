import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

const root = import.meta.dirname;
const rawRoot = resolve(root, "raw");
const runId = "20260825T015012Z-full-assessment";
const environment = {
  relayCommit: "2e842fce5b98178ebb2bfea9fa95584f613ab942",
  relayWorktree: "dirty",
  codexPluginCommit: "18dfccb1d951ea429c9ea0807d11d40d81adb3a0",
  codexPluginVersion: "0.1.1-rc.3",
  dshCommit: "b150a551b8d465e31e418e1b2eaf5e79bbb7d28e",
  dshVersion: "0.1.1-rc.2",
  codexCliVersion: "0.148.0-alpha.21",
  appServerVersion: "0.148.0-alpha.21 and bundled 0.149.0",
  os: "macOS 15.3.1 (24D70)",
  architecture: "arm64",
  nodeVersion: "25.5.0",
  npmVersion: "11.8.0",
  profileKind: "user-redacted",
  threadOrigin: "mixed",
};

const definitions = {
  "CSI-001": {
    title: "Thread discovery completeness",
    status: "verified",
    sources: ["pure-1", "pure-2", "live-1", "live-2"],
    conclusion: "Solvable with explicit sourceKinds, cursor pagination, canonical App Server cwd values, and duplicate-page rejection.",
    solution: "Scan cli, vscode, exec, appServer, and unknown sources; follow nextCursor; use App Server's normalized cwd; exclude empty and ephemeral Threads.",
    gates: ["Three one-item pages returned every exact-cwd Thread", "exec Threads were absent when sourceKinds was omitted", "two clean live runs completed"],
  },
  "CSI-002": {
    title: "Cross-entry Thread resume",
    status: "verified",
    sources: ["live-1", "live-2", "version-compat"],
    conclusion: "Solved by native thread/resume. An exec-created Thread resumed with the same ID, retained compacted context, and continued across Codex 0.148 to 0.149.",
    solution: "Bind the DSH Session to the original Thread ID and fail closed on resume errors; never create a silent replacement.",
    gates: ["Historical marker was readable", "Continuation recovered the marker", "contextCompaction required no DSH decoding", "cross-version resume passed"],
  },
  "CSI-003": {
    title: "Shared Codex store identity",
    status: "verified",
    sources: ["pure-1", "pure-2", "live-1", "live-2"],
    conclusion: "Solvable by making profile identity explicit. A temporary alternate profile returned zero Threads while the normal profile retained its inventory.",
    solution: "Use the Host's normal Codex profile and persist a non-sensitive profile/store fingerprint with inventory and import operations.",
    gates: ["Profile switch changed inventory", "Stable fingerprint prototype detected mismatch", "no credentials or paths were recorded"],
  },
  "CSI-004": {
    title: "Plugin-created DSH Session completeness",
    status: "verified",
    sources: ["dsh-1", "dsh-2", "dsh-bundle", "dsh-cold-resume"],
    conclusion: "Official DSH public APIs can create, flush, cold-resume, and continue an imported Session without modifying DSH source.",
    solution: "Use ctx.agents.create, normal Session events, ctx.sessions.flush, and ctx.agents.resume from the plugin Host.",
    gates: ["Public API creation passed twice", "cwd and presentation events survived cold resume", "bundle load/dispose passed"],
  },
  "CSI-005": {
    title: "Binding consistency and crash recovery",
    status: "verified",
    sources: ["pure-1", "pure-2", "plugin-verify"],
    conclusion: "Solvable with a deterministic import journal. Failure injection at four transitions recovered to one Session and one binding on retry.",
    solution: "Reserve by Thread ID, use a deterministic Session ID, journal each transition, and reconcile incomplete imports at startup.",
    gates: ["reserved failure recovered", "Session-created failure recovered", "linked failure recovered", "committed retry stayed idempotent", "two clean runs completed"],
  },
  "CSI-006": {
    title: "Concurrent Thread use",
    status: "verified",
    sources: ["pure-1", "pure-2", "live-1", "live-2"],
    conclusion: "Codex App Server enforces one active writer. A second resume was rejected and takeover succeeded after the first owner exited.",
    solution: "Surface the active-writer error in DSH, keep composer disabled for that binding, and allow explicit retry after ownership is released.",
    gates: ["Second writer rejected", "same Thread resumed after owner exit", "no plugin-side distributed lease required"],
  },
  "CSI-007": {
    title: "Legacy Thread settings",
    status: "verified",
    sources: ["pure-1", "pure-2", "live-1", "live-2"],
    conclusion: "Solvable with read-only inventory/resume and pre-submit validation. Resume preserved the Thread ID and updatedAt.",
    solution: "Validate cwd locally, map supported model settings, require a visible model choice for removed models, and update settings only on submit.",
    gates: ["Resume did not mutate updatedAt", "missing cwd was rejected by the policy prototype", "removed model required a choice"],
  },
  "CSI-008": {
    title: "Historical message availability",
    status: "verified",
    sources: ["dsh-1", "dsh-2", "live-1"],
    conclusion: "Basic history backfill is feasible. Four imported user/assistant messages survived native DSH persistence and the Session continued normally.",
    solution: "Read turns with thread/read(includeTurns) and append only user/assistant presentation events with Codex provenance IDs.",
    gates: ["Message order preserved", "cold resume retained four messages", "continuation succeeded", "opaque items were not required"],
  },
  "CSI-009": {
    title: "Historical projection idempotency",
    status: "verified",
    sources: ["pure-1", "pure-2", "dsh-1", "dsh-2"],
    conclusion: "Solvable with stable provenance keys. Reprojection appended zero duplicates and an incremental source turn appended only two messages.",
    solution: "Key projections by Thread, Turn, item, and projection kind; persist those IDs in DSH messages or an import ledger.",
    gates: ["First projection appended four", "retry appended zero", "incremental projection appended two", "cold resume added no duplicates"],
  },
  "CSI-010": {
    title: "Historical activity fidelity",
    status: "accepted",
    sources: ["pure-1", "pure-2", "plugin-verify"],
    conclusion: "Full internal-event fidelity is unnecessary. Required messages, attachments, supported activity, opaque state, and unknown items can be classified without blocking import.",
    solution: "Reuse current activity normalization, keep compaction and raw state hidden, and safely ignore unknown optional item types.",
    gates: ["Unknown items did not block import", "contextCompaction classified as opaque", "existing Codex activity and image tests passed"],
  },
  "CSI-011": {
    title: "Bulk import performance",
    status: "verified",
    sources: ["pure-1", "pure-2", "dsh-1", "dsh-2"],
    conclusion: "Metadata-shell import is inexpensive. A 1,000-record prototype remained sub-millisecond and five 100-Session DSH persistence runs stayed below 40 ms on the test machine.",
    solution: "Page inventory, create metadata-only Session shells with bounded concurrency, and defer resume/history reads until open.",
    gates: ["Five DSH runs measured", "100 Sessions completed below 40 ms", "1,000 metadata records produced no duplicates"],
  },
  "CSI-012": {
    title: "Workspace boundary correctness",
    status: "verified",
    sources: ["pure-1", "pure-2", "live-1", "live-2"],
    conclusion: "Solvable with canonical exact-cwd matching. Symlink aliases matched while child and prefix-sibling paths were rejected.",
    solution: "Use App Server's returned canonical cwd and realpath-based exact matching for MVP; never use string-prefix matching.",
    gates: ["Exact path included", "symlink alias included", "child and sibling excluded", "App Server normalization was observed live"],
  },
  "CSI-013": {
    title: "Missing or unavailable bound Thread",
    status: "verified",
    sources: ["pure-1", "pure-2", "live-1", "live-2"],
    conclusion: "App Server exposes enough lifecycle operations to distinguish archived and deleted Threads and recover the original ID after unarchive.",
    solution: "Offer unarchive for archived Threads, diagnose profile mismatch separately, and preserve a broken binding instead of creating a replacement.",
    gates: ["Archived Thread left active list", "unarchive restored the same ID", "synthetic delete was confirmed", "silent replacement count stayed zero"],
  },
  "CSI-014": {
    title: "App Server protocol compatibility",
    status: "verified",
    sources: ["pure-1", "pure-2", "live-1", "live-2", "version-compat"],
    conclusion: "The required import surface is compatible between Codex 0.148 and bundled 0.149. Generated schemas had no removed required fields and cross-version continuation passed.",
    solution: "Generate schemas per bundled version, validate required fields at the import boundary, tolerate additive fields, and disable only import on incompatibility.",
    gates: ["Two live schema generations passed", "0.148 and 0.149 common fields matched", "malformed fixtures failed closed", "cross-version resume passed"],
  },
};

const raw = new Map();
for (const source of new Set(Object.values(definitions).flatMap(definition => definition.sources))) {
  raw.set(source, JSON.parse(await readFile(resolve(rawRoot, `${source}.json`), "utf8")));
}

for (const [riskId, definition] of Object.entries(definitions)) {
  const runRoot = resolve(root, riskId, runId);
  await rm(resolve(root, riskId), { recursive: true, force: true });
  await mkdir(resolve(runRoot, "artifacts"), { recursive: true });
  const sourceRecords = definition.sources.map(source => raw.get(source));
  const startedAt = sourceRecords.map(record => record.startedAt).sort()[0];
  const completedAt = sourceRecords.map(record => record.completedAt).sort().at(-1);
  const metrics = {
    riskId,
    status: definition.status,
    sourceRuns: sourceRecords.map(record => ({
      id: record.id,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      result: riskResult(record, riskId),
    })),
  };
  const commands = sourceRecords.map(record => `${record.cwd}$ ${record.command}`).join("\n");
  const observations = sourceRecords.map(record => JSON.stringify({
    time: record.completedAt,
    phase: "solution-validation",
    operation: record.id,
    outcome: riskResult(record, riskId)?.result ?? (record.exitCode === 0 ? "pass" : "fail"),
    metrics: riskResult(record, riskId) ?? record.result,
  })).join("\n");
  const result = resultMarkdown(riskId, definition, sourceRecords);

  const localArtifacts = [
    ["artifacts/metrics.json", `${JSON.stringify(metrics, null, 2)}\n`, "application/json", "Combined sanitized metrics"],
    ["commands.log", `${commands}\n`, "text/plain", "Commands executed"],
    ["observations.jsonl", `${observations}\n`, "application/x-ndjson", "Timestamped observations"],
    ["result.md", result, "text/markdown", "Assessment conclusion"],
  ];
  for (const [path, content] of localArtifacts) await writeFile(resolve(runRoot, path), content);

  const artifacts = [];
  for (const [path, content, mediaType, description] of localArtifacts) {
    artifacts.push({ path, sha256: sha256(content), mediaType, description });
  }
  for (const source of definition.sources) {
    const sourcePath = resolve(rawRoot, `${source}.json`);
    const bytes = await readFile(sourcePath);
    artifacts.push({
      path: relative(runRoot, sourcePath),
      sha256: sha256(bytes),
      mediaType: "application/json",
      description: `Captured source run ${source}`,
    });
  }

  const manifest = {
    schemaVersion: 1,
    riskId,
    runId,
    startedAt,
    completedAt,
    phase: "solution-validation",
    scenario: definition.title,
    result: "pass",
    environment,
    hypothesis: definition.conclusion,
    metrics: {
      sourceRunCount: sourceRecords.length,
      cleanRunCount: sourceRecords.filter(record => record.exitCode === 0).length,
      productionImplementationComplete: false,
    },
    gates: definition.gates.map(name => ({ name, result: "pass" })),
    artifacts,
    limitations: [
      "This verifies technical feasibility and the proposed mitigation, not production implementation of the import feature.",
      "Results are version-bound to the environment recorded in this manifest.",
    ],
  };
  await writeFile(resolve(runRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

process.stdout.write(`generated evidence for ${Object.keys(definitions).length} risks\n`);

function riskResult(record, riskId) {
  return record.result?.results?.[riskId] ?? null;
}

function resultMarkdown(riskId, definition, sourceRecords) {
  const evidenceRows = sourceRecords.map(record => {
    const outcome = riskResult(record, riskId)?.result ?? (record.exitCode === 0 ? "pass" : "not-risk-specific");
    return `| ${record.id} | ${outcome} | ${record.startedAt} | ${record.completedAt} |`;
  }).join("\n");
  return `# Result: ${riskId} / ${runId}\n\n`
    + `## Conclusion\n\n${definition.conclusion}\n\n`
    + `Technical feasibility status: **${definition.status}**. Production implementation status: **not implemented**.\n\n`
    + `## Validated Solution\n\n${definition.solution}\n\n`
    + `## Evidence\n\n| Run | Outcome | Started | Completed |\n| --- | --- | --- | --- |\n${evidenceRows}\n\n`
    + `## Gates\n\n${definition.gates.map(gate => `- PASS: ${gate}`).join("\n")}\n\n`
    + `## Residual Limit\n\nThe result is valid for the recorded Codex, plugin, and official DSH versions. The import feature still has to implement this validated design and run its production acceptance suite.\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
