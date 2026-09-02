import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { linkDshWorkspacePackagesInto, prepareDshLocalWorkspaceLinks } from "./lib/dsh-local-workspace-links.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dshRoot = resolve(process.env.DSH_ROOT ?? join(root, "upstream", "deepseek-harness"));
const temporary = mkdtempSync(join(tmpdir(), "relay-dsh-packages-"));
const availablePackages = [
  ["integrations/codex", "relay-dsh-plugin-codex"],
  ["integrations/claude", "relay-dsh-plugin-claude"],
  ["integrations/events", "relay-dsh-plugin-events"],
  ["integrations/semantic-router", "relay-dsh-plugin-semantic-router"],
  ["integrations/monitors", "relay-dsh-plugin-monitors"],
  ["integrations/dsh-workbench", "relay-dsh-plugin-workbench"],
  ["integrations/dsh-files", "relay-dsh-plugin-files"],
  ["integrations/dsh-terminal", "relay-dsh-plugin-terminal"],
];
const dshPackages = process.argv.includes("--events-only")
  ? availablePackages.filter(([directory]) => /integrations\/(events|semantic-router|monitors)$/.test(directory))
  : availablePackages;
const packages = dshPackages;
const hostOnly = new Set(["relay-dsh-plugin-semantic-router", "relay-dsh-plugin-monitors"]);

try {
  for (const [directory] of dshPackages) {
    const before = gitStatus(directory);
    execFileSync("npm", ["run", "typecheck"], { cwd: join(root, directory), stdio: "inherit" });
    execFileSync("npm", ["run", "build"], { cwd: join(root, directory), stdio: "inherit" });
    assert.equal(gitStatus(directory), before, `${directory} build must not alter tracked sources`);
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
      if (!hostOnly.has(name)) assert.ok(paths.includes("lib/client.js"), name);
      assert.ok(paths.includes("cordis.patch.yml"), name);
      assert.equal(paths.some(path => path.startsWith("src/") || path.startsWith("upstream/")), false, name);
    }
    return { name, tarball: join(temporary, result.filename), paths };
  });

  execFileSync("npm", ["init", "-y"], { cwd: temporary, stdio: "ignore" });
  execFileSync("npm", ["install", "--ignore-scripts", "--no-package-lock", "--omit=optional", ...packed.map(item => item.tarball)], {
    cwd: temporary, stdio: "inherit",
  });
  linkDshWorkspacePackagesInto(dshRoot, join(temporary, "node_modules"));
  prepareDshLocalWorkspaceLinks(dshRoot);

  const importProgram = `
    import assert from "node:assert/strict";
    for (const name of ${JSON.stringify(dshPackages.map(([, name]) => name))}) {
      const manifest = (await import(name + "/package.json", { with: { type: "json" } })).default;
      assert.equal(manifest.main, "lib/host-plugin.js");
      const host = await import(name);
      assert.equal(typeof host.apply, "function", name);
      if (${JSON.stringify([...hostOnly])}.includes(name)) continue;
      const typert = await import(name + "/typert");
      assert.ok(Object.keys(typert).length > 0, name);
      let definition;
      globalThis.window = { __ModuleLoader__: { load(value) { definition = value; } } };
      await import(name + "/client");
      assert.equal(definition.id, name);
      assert.equal(typeof definition.factory, "function");
    }
    for (const name of ${JSON.stringify(dshPackages.map(([, name]) => name).filter(name => /-(codex|claude)$/.test(name)))}) {
      const manifest = JSON.parse(await (await import("node:fs/promises")).readFile("node_modules/" + name + "/package.json", "utf8"));
      assert.deepEqual(Object.keys(manifest.dependencies || {}).filter(key => key.startsWith("@relay/") || key.startsWith("relay-dsh-plugin-")), []);
    }
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", importProgram], {
    cwd: temporary,
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --preserve-symlinks`.trim() },
    stdio: "inherit",
  });
  console.log(`Verified ${dshPackages.length} independently packed DSH plugins and their public entries.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

function gitStatus(directory) {
  return execFileSync("git", ["status", "--short"], { cwd: join(root, directory), encoding: "utf8" }).trim();
}
