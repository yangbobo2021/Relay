import assert from "node:assert/strict";
import test from "node:test";
import { FILES_DESCRIPTORS } from "../remote-schema.js";

test("files owns only the workspace Remote contract", () => {
  assert.equal(FILES_DESCRIPTORS.length, 2);
  assert.deepEqual(new Set(FILES_DESCRIPTORS.map(item => item.service)), new Set(["relayWorkspaceFiles"]));
  assert.ok(FILES_DESCRIPTORS.every(item => item.id.startsWith("relay-dsh-plugin-files#")));
});
