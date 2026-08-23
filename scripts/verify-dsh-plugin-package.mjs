import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dshRoot = join(root, "upstream", "deepseek-harness");
const temporary = mkdtempSync(join(tmpdir(), "relay-dsh-packages-"));
const packages = [
  ["packages/plugin-sdk", "@relay/plugin-sdk"],
  ["packages/event-router", "@relay/event-router"],
  ["packages/runtime", "@relay/runtime"],
  ["packages/monitor-runtime", "@relay/monitor-runtime"],
  ["packages/event-runtime-plugin", "@relay/plugin-event-runtime"],
  ["integrations/codex", "@relay/plugin-codex"],
  ["integrations/claude", "@relay/plugin-claude"],
  ["integrations/deepseek-harness", "@relay/dsh-core"],
  ["integrations/dsh-codex", "@relay/dsh-codex"],
  ["integrations/dsh-claude", "@relay/dsh-claude"],
];
const dshPackages = packages.slice(-3);

try {
  for (const [directory] of dshPackages) {
    execFileSync("npm", ["run", "typecheck"], { cwd: join(root, directory), stdio: "inherit" });
    execFileSync("npm", ["run", "build"], { cwd: join(root, directory), stdio: "inherit" });
    const lib = join(root, directory, "lib");
    for (const file of readdirSync(lib).filter(file => file.endsWith(".js"))) {
      assert.doesNotMatch(readFileSync(join(lib, file), "utf8"), /[ \t]+$/m, `${directory}/${file} has trailing whitespace`);
    }
  }
  const packed = packages.map(([directory, name]) => {
    const result = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
      cwd: join(root, directory), encoding: "utf8",
    }))[0];
    const paths = result.files.map(file => file.path);
    if (name.startsWith("@relay/dsh-")) {
      assert.ok(paths.includes("lib/host-plugin.js"), name);
      assert.ok(paths.includes("lib/client.js"), name);
      assert.ok(paths.includes("cordis.patch.yml"), name);
      assert.equal(paths.some(path => path.startsWith("src/") || path.startsWith("upstream/")), false, name);
    }
    return { name, tarball: join(temporary, result.filename), paths };
  });

  execFileSync("npm", ["init", "-y"], { cwd: temporary, stdio: "ignore" });
  execFileSync("npm", ["install", "--ignore-scripts", "--no-package-lock", "--omit=optional", ...packed.map(item => item.tarball)], {
    cwd: temporary, stdio: "inherit",
  });
  const peerDirectory = join(temporary, "node_modules", "@deepseek-ai");
  mkdirSync(peerDirectory, { recursive: true });
  for (const peer of ["cordis", "dsh-llm", "dsh-session", "dsh-tools", "dsh-typert-protocol"]) {
    const source = join(dshRoot, "node_modules", ".pnpm", "node_modules", "@deepseek-ai", peer);
    symlinkSync(source, join(peerDirectory, peer), "dir");
  }

  const importProgram = `
    import assert from "node:assert/strict";
    for (const name of ["@relay/dsh-core", "@relay/dsh-codex", "@relay/dsh-claude"]) {
      const manifest = (await import(name + "/package.json", { with: { type: "json" } })).default;
      assert.equal(manifest.main, "lib/host-plugin.js");
      const host = await import(name);
      assert.equal(typeof host.apply, "function", name);
      const typert = await import(name + "/typert");
      assert.ok(Object.keys(typert).length > 0, name);
      let definition;
      globalThis.window = { __ModuleLoader__: { load(value) { definition = value; } } };
      await import(name + "/client");
      assert.equal(definition.id, name);
      assert.equal(typeof definition.factory, "function");
    }
    const codex = JSON.parse(await (await import("node:fs/promises")).readFile("node_modules/@relay/dsh-codex/package.json", "utf8"));
    const claude = JSON.parse(await (await import("node:fs/promises")).readFile("node_modules/@relay/dsh-claude/package.json", "utf8"));
    assert.equal(codex.dependencies["@relay/dsh-core"], "0.1.0");
    assert.equal(claude.dependencies["@relay/dsh-core"], "0.1.0");
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", importProgram], { cwd: temporary, stdio: "inherit" });
  console.log(`Verified ${dshPackages.length} independently packed DSH plugins and their public entries.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
