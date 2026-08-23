import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const dshRoot = process.argv[2];
if (!dshRoot) throw new Error("usage: repair-dsh-workspace-links.mjs <dsh-root>");

const root = resolve(dshRoot);
const checks = [
  ["packages/settings/settings-file/node_modules", "chokidar"],
  ["packages/host/apiproxy/node_modules", "fflate"],
];

for (const [modulesPath, dependency] of checks) {
  const modules = join(root, modulesPath);
  if (existsSync(modules) && !existsSync(join(modules, dependency))) {
    rmSync(modules, { recursive: true, force: true });
  }
}
