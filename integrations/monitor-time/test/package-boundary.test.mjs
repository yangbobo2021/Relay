import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("MB05-001/002: Time is independently packable and imports only public Relay services", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const host = await readFile(new URL("../host-plugin.js", import.meta.url), "utf8");
  assert.equal(manifest.name, "relay-dsh-plugin-monitor-time");
  assert.equal(manifest.peerDependencies["relay-dsh-plugin-events"], "0.2.1");
  assert.equal(manifest.peerDependencies["relay-dsh-plugin-monitors"], "0.3.0");
  assert.match(host, /relayMonitorBundles/u);
  assert.match(host, /relayMonitorObservers/u);
  assert.doesNotMatch(host, /\.\.\/monitors|\.\.\/events|SQLite|RelayStore/u);
});
