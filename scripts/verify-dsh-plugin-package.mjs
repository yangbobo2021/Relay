import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pluginRoot = join(root, "integrations", "deepseek-harness");
const dshRoot = join(root, "upstream", "deepseek-harness");
const temporary = mkdtempSync(join(tmpdir(), "relay-dsh-package-"));

try {
  execFileSync("npm", ["run", "typecheck"], { cwd: pluginRoot, stdio: "inherit" });
  execFileSync("npm", ["run", "build"], { cwd: pluginRoot, stdio: "inherit" });
  const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
    cwd: pluginRoot,
    encoding: "utf8",
  }));
  const tarball = join(temporary, packed[0].filename);
  execFileSync("npm", ["init", "-y"], { cwd: temporary, stdio: "ignore" });
  execFileSync("npm", ["install", "--ignore-scripts", "--no-package-lock", tarball], {
    cwd: temporary,
    stdio: "inherit",
  });

  const installed = join(temporary, "node_modules", "relay-dsh-plugin");
  const manifest = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
  assert.equal(manifest.main, "lib/host-plugin.js");
  assert.notEqual(manifest.private, true);
  const paths = packed[0].files.map((file) => file.path);
  assert.ok(paths.includes("lib/host-plugin.js"));
  assert.ok(paths.includes("lib/client.js"));
  assert.ok(paths.includes("cordis.patch.yml"));
  assert.equal(paths.some((path) => path.startsWith("src/") || path.startsWith("upstream/")), false);

  const peerDirectory = join(temporary, "node_modules", "@deepseek-ai");
  mkdirSync(peerDirectory, { recursive: true });
  for (const peer of ["dsh-llm", "dsh-session", "dsh-tools", "dsh-typert-protocol"]) {
    const source = join(dshRoot, "node_modules", ".pnpm", "node_modules", "@deepseek-ai", peer);
    symlinkSync(source, join(peerDirectory, peer), "dir");
  }
  const importProgram = `
    import assert from "node:assert/strict";
    const host = await import("relay-dsh-plugin");
    assert.equal(typeof host.apply, "function");
    assert.equal(host.name, "relay-runtime-host");
    const typert = await import("relay-dsh-plugin/typert");
    assert.ok(Object.keys(typert).length > 0);
    let clientDefinition;
    globalThis.window = { __ModuleLoader__: { load(value) { clientDefinition = value; } } };
    await import("relay-dsh-plugin/client");
    assert.equal(clientDefinition.id, "relay-dsh-plugin");
    assert.equal(typeof clientDefinition.factory, "function");
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", importProgram], {
    cwd: temporary,
    stdio: "inherit",
  });
  console.log(`Verified clean installation and public entries of ${basename(tarball)} (${paths.length} files).`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
