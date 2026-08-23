import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dshRoot = join(root, "upstream", "deepseek-harness");
const dshBin = join(dshRoot, "apps", "cli", "lib", "bin.js");
const temporary = await mkdtemp(join(tmpdir(), "relay-official-dsh-"));
const packages = [
  ["packages/plugin-sdk", "@relay/plugin-sdk"],
  ["packages/event-router", "@relay/event-router"],
  ["packages/runtime", "@relay/runtime"],
  ["packages/monitor-runtime", "@relay/monitor-runtime"],
  ["packages/event-runtime-plugin", "@relay/plugin-event-runtime"],
  ["integrations/codex", "@relay/dsh-plugin-codex"],
  ["integrations/claude", "@relay/dsh-plugin-claude"],
  ["integrations/deepseek-harness", "@relay/plugin-events"],
];

const cleanBefore = gitStatus();
assert.equal(cleanBefore, "", "official DSH checkout must be clean before install verification");

try {
  const tarballs = new Map(packages.map(([directory, name]) => {
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
      cwd: join(root, directory), encoding: "utf8",
    }))[0];
    return [name, join(temporary, packed.filename)];
  }));

  await verifyScenario("codex-only", ["@relay/dsh-plugin-codex"], tarballs, 3191);
  await verifyScenario("claude-only", ["@relay/dsh-plugin-claude"], tarballs, 3192);
  await verifyScenario("events-only", ["@relay/plugin-events"], tarballs, 3193);
  await verifyScenario("codex-and-claude", ["@relay/dsh-plugin-codex", "@relay/dsh-plugin-claude"], tarballs, 3194);
  await verifyScenario("all-plugins", ["@relay/dsh-plugin-codex", "@relay/dsh-plugin-claude", "@relay/plugin-events"], tarballs, 3195);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

assert.equal(gitStatus(), "", "official DSH checkout changed during install verification");
console.log("Verified isolated and combined Codex, Claude, and Events plugins against the clean official DSH build.");

async function verifyScenario(id, selected, tarballs, port) {
  const home = join(temporary, id);
  const env = { ...process.env, DSH_HOME: home };
  execFileSync(process.execPath, [dshBin, "plugin", "--profile", "web", "install"], {
    cwd: dshRoot, env, stdio: "ignore",
  });
  const profile = join(home, "profiles", "web");
  const overrides = ["", "overrides:", ...[...tarballs].map(([name, path]) => `  '${name}': file:${path}`), ""].join("\n");
  await appendFile(join(profile, "pnpm-workspace.yaml"), overrides);
  execFileSync(process.execPath, [dshBin, "plugin", "--profile", "web", "add", ...selected.map(name => tarballs.get(name))], {
    cwd: dshRoot, env, stdio: "ignore",
  });

  const manifest = JSON.parse(await readFile(join(profile, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [...selected].sort(), `${id}: only requested plugins are direct`);
  for (const name of selected) assert.ok(manifest.dsh.profile.bundles.includes(name), `${id}: ${name} is a profile layer`);
  for (const backend of ["@relay/dsh-plugin-codex", "@relay/dsh-plugin-claude"]) {
    if (!selected.includes(backend)) continue;
    const installed = JSON.parse(await readFile(join(profile, "node_modules", ...backend.split("/"), "package.json"), "utf8"));
    assert.deepEqual(Object.keys(installed.dependencies ?? {}).filter(name => name.startsWith("@relay/")), [], `${id}: ${backend} is Relay-independent`);
  }

  const dump = execFileSync(process.execPath, [dshBin, "web", "--dump-config"], {
    cwd: dshRoot, env, encoding: "utf8",
  });
  for (const name of selected) assert.match(dump, new RegExp(name.replace("/", "\\/")), `${id}: ${name} composes`);
  if (!selected.includes("@relay/dsh-plugin-codex")) assert.doesNotMatch(dump, /relay-codex-host/, `${id}: no Codex host`);
  if (!selected.includes("@relay/dsh-plugin-claude")) assert.doesNotMatch(dump, /relay-claude-host/, `${id}: no Claude host`);
  if (!selected.includes("@relay/plugin-events")) assert.doesNotMatch(dump, /relay-runtime-host/, `${id}: no Events host`);
  await bootAndProbe(id, env, port, selected);
}

async function bootAndProbe(id, env, port, selected) {
  const child = spawn(process.execPath, [dshBin, "web", "--no-open", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: dshRoot, env, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  try {
    await waitFor(() => output.includes(`http://127.0.0.1:${port}`) || child.exitCode !== null, 20_000);
    assert.equal(child.exitCode, null, `${id}: DSH Host exited before serving\n${output}`);
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.ok, true, `${id}: Web root did not respond`);
    assert.match(await response.text(), /<html/i, `${id}: Web root is not HTML`);
    for (const name of selected) {
      const asset = await fetch(`http://127.0.0.1:${port}/plugins/${name}/client.js`);
      assert.equal(asset.ok, true, `${id}: ${name} client asset is unavailable`);
    }
  } finally {
    if (child.exitCode === null) child.kill("SIGINT");
    await Promise.race([
      new Promise(resolve => child.once("exit", resolve)),
      new Promise(resolve => setTimeout(resolve, 5_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for official DSH Web boot");
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function gitStatus() {
  return execFileSync("git", ["status", "--short"], { cwd: dshRoot, encoding: "utf8" }).trim();
}
