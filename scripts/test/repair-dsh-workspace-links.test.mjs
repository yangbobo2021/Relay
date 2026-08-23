import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

test("DSH workspace link repair removes only incomplete generated dependency directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "relay-dsh-links-"));
  const settingsModules = join(root, "packages/settings/settings-file/node_modules");
  const apiproxyModules = join(root, "packages/host/apiproxy/node_modules");
  const script = join(dirname(new URL(import.meta.url).pathname), "..", "repair-dsh-workspace-links.mjs");

  try {
    await mkdir(settingsModules, { recursive: true });
    await writeFile(join(settingsModules, "stale"), "stale");
    await mkdir(join(apiproxyModules, "fflate"), { recursive: true });
    await writeFile(join(apiproxyModules, "preserved"), "preserved");

    execFileSync(process.execPath, [script, root]);

    await assert.rejects(() => writeFile(join(settingsModules, "probe"), "probe"), /ENOENT/);
    await writeFile(join(apiproxyModules, "preserved"), "still-present");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
