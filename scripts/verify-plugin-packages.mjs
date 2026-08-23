import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temporary = mkdtempSync(join(tmpdir(), "relay-plugin-packages-"));
const packages = [
  ["packages/plugin-sdk", "@relay/plugin-sdk"],
  ["packages/event-router", "@relay/event-router"],
  ["packages/runtime", "@relay/runtime"],
  ["packages/monitor-runtime", "@relay/monitor-runtime"],
  ["packages/event-runtime-plugin", "@relay/plugin-event-runtime"],
  ["packages/dsh-plugin-contracts", "@relay/dsh-plugin-contracts"],
];

try {
  const tarballs = packages.map(([directory]) => {
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
      cwd: join(root, directory),
      encoding: "utf8",
    }));
    assert.equal(packed.length, 1, `${directory} must produce one package`);
    assert.ok(packed[0].files.some((file) => file.path === "package.json"));
    return join(temporary, packed[0].filename);
  });

  execFileSync("npm", ["init", "-y"], { cwd: temporary, stdio: "ignore" });
  execFileSync("npm", [
    "install",
    "--ignore-scripts",
    "--no-package-lock",
    "--omit=optional",
    ...tarballs,
  ], { cwd: temporary, stdio: "inherit" });

  const importProgram = `
    import assert from "node:assert/strict";
    const packages = ${JSON.stringify(packages.map(([, name]) => name))};
    for (const name of packages) {
      const entry = await import(name);
      assert.ok(Object.keys(entry).length > 0, name + " has no public exports");
    }
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", importProgram], {
    cwd: temporary,
    stdio: "inherit",
  });
  console.log(`Verified ${packages.length} independently packed plugin and library entries.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
