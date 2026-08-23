import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dshRoot = join(root, "upstream", "deepseek-harness");
const temporary = mkdtempSync(join(tmpdir(), "relay-dsh-packages-"));
const supportPackages = [
  ["packages/plugin-sdk", "@relay/plugin-sdk"],
  ["packages/event-router", "@relay/event-router"],
  ["packages/runtime", "@relay/runtime"],
  ["packages/monitor-runtime", "@relay/monitor-runtime"],
  ["packages/event-runtime-plugin", "@relay/plugin-event-runtime"],
];
const dshPackages = [
  ["integrations/codex", "@relay/dsh-plugin-codex"],
  ["integrations/claude", "@relay/dsh-plugin-claude"],
  ["integrations/deepseek-harness", "@relay/plugin-events"],
];
const submoduleDirectories = new Set(dshPackages.slice(0, 2).map(([directory]) => directory));
const packages = [...supportPackages, ...dshPackages];

try {
  for (const [directory] of dshPackages) {
    if (submoduleDirectories.has(directory)) {
      assert.equal(gitStatus(directory), "", `${directory} must be clean before package verification`);
    }
    execFileSync("npm", ["run", "typecheck"], { cwd: join(root, directory), stdio: "inherit" });
    execFileSync("npm", ["run", "build"], { cwd: join(root, directory), stdio: "inherit" });
    if (submoduleDirectories.has(directory)) {
      assert.equal(gitStatus(directory), "", `${directory} build artifacts must be reproducible`);
    }
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
    if (dshPackages.some(([, packageName]) => packageName === name)) {
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
    for (const name of ["@relay/dsh-plugin-codex", "@relay/dsh-plugin-claude", "@relay/plugin-events"]) {
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
    for (const name of ["dsh-plugin-codex", "dsh-plugin-claude"]) {
      const manifest = JSON.parse(await (await import("node:fs/promises")).readFile("node_modules/@relay/" + name + "/package.json", "utf8"));
      assert.deepEqual(Object.keys(manifest.dependencies || {}).filter(key => key.startsWith("@relay/")), []);
    }
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", importProgram], { cwd: temporary, stdio: "inherit" });
  console.log(`Verified ${dshPackages.length} independently packed DSH plugins and their public entries.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

function gitStatus(directory) {
  return execFileSync("git", ["status", "--short"], { cwd: join(root, directory), encoding: "utf8" }).trim();
}
