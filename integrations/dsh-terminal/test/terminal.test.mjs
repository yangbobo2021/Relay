import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { TERMINAL_DESCRIPTORS } from "../remote-schema.js";
import { RelayTerminalProviderRegistry } from "../provider-registry.js";
import { readFile } from "node:fs/promises";

test("terminal owns only the interactive terminal Remote contract", () => {
  assert.equal(TERMINAL_DESCRIPTORS.length, 5);
  assert.deepEqual(new Set(TERMINAL_DESCRIPTORS.map(item => item.service)), new Set(["relayWorkbenchTerminal"]));
  assert.ok(TERMINAL_DESCRIPTORS.every(item => item.id.startsWith("relay-dsh-plugin-terminal#")));
});

test("terminal Host resolves the Agent lookup lazily so provider-less startup is order independent", async () => {
  const source = await readFile(new URL("../host-plugin.js", import.meta.url), "utf8");
  assert.match(source, /const resolveAgent = async[\s\S]*lookups\.get\("agent"\)/);
  assert.doesNotMatch(source, /export async function apply\(ctx\) \{\n\s+const lookup/);
});

test("terminal providers register through a versioned Cordis service and expose explicit disposal", () => {
  const ctx = new Context();
  const registry = new RelayTerminalProviderRegistry(ctx);
  const provider = {
    id: "future-backend", title: "Future Backend",
    whenReady: async () => {}, request: async () => ({}), subscribeNotification: () => () => {},
  };
  const dispose = registry.register(provider);
  assert.equal(registry.apiVersion, 1);
  assert.equal(registry.get("future-backend"), provider);
  assert.deepEqual(registry.list(), [provider]);
  assert.throws(() => registry.register(provider), /already registered/);
  dispose();
  assert.deepEqual(registry.list(), []);
});
