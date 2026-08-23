import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientSource = await readFile(
  new URL("../src/client/index.ts", import.meta.url),
  "utf8",
);

test("advanced debugging stays additive to DSH's native conversation", () => {
  assert.match(clientSource, /conversation\.session\.header\.actions/);
  assert.match(clientSource, /conversation\.session\.header\.utilities/);
  assert.match(clientSource, /id: 'session-log-download'/);
  assert.match(clientSource, /priority: -100/);

  assert.doesNotMatch(clientSource, /name: 'conversation\.view'/);
  assert.doesNotMatch(clientSource, /name: 'conversation\.session'/);
  assert.doesNotMatch(clientSource, /name: 'conversation\.session\.header'/);
});
