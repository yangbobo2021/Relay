import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

export function createCodexCliRoutingAdapter({
  model,
  timeoutMs = 180_000,
  command = "codex",
  processRunner = runProcess,
} = {}) {
  return {
    name: "codex-cli",
    model: model ?? "configured-default",
    async call({ prompt, schemaPath }) {
      const runDirectory = await mkdtemp(join(tmpdir(), "relay-routing-"));
      const outputPath = join(runDirectory, "output.json");
      const args = [
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--sandbox",
        "read-only",
        "--color",
        "never",
        "--json",
        "--output-schema",
        schemaPath,
        "--output-last-message",
        outputPath,
      ];
      if (model) {
        args.push("--model", model);
      }
      args.push("-");

      const startedAt = performance.now();
      try {
        const processResult = await processRunner(command, args, {
          cwd: runDirectory,
          input: prompt,
          timeoutMs,
          outputPath,
        });
        const rawOutput = await readFile(outputPath, "utf8");
        const output = JSON.parse(rawOutput);
        const usage = extractUsage(processResult.stdout);

        return {
          output,
          telemetry: {
            model_calls: 1,
            latency_ms: Math.round(performance.now() - startedAt),
            input_tokens: usage.input_tokens,
            cached_input_tokens: usage.cached_input_tokens,
            output_tokens: usage.output_tokens,
          },
        };
      } finally {
        await rm(runDirectory, { recursive: true, force: true });
      }
    },
  };
}

function extractUsage(stdout) {
  const usage = {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
  };

  for (const line of stdout.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const event = JSON.parse(line);
      visit(event, (value) => {
        if (value && typeof value === "object") {
          for (const key of Object.keys(usage)) {
            if (Number.isFinite(value[key])) {
              usage[key] = Math.max(usage[key], value[key]);
            }
          }
        }
      });
    } catch {
      // Diagnostics that are not JSON do not affect the structured result.
    }
  }

  return usage;
}

function visit(value, callback) {
  callback(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, callback);
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      visit(item, callback);
    }
  }
}

function runProcess(command, args, { cwd, input, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`codex exec timed out after ${timeoutMs} ms`));
      } else if (code !== 0) {
        reject(new Error(`codex exec exited ${code}: ${stderr.slice(-2000)}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.stdin.end(input);
  });
}
