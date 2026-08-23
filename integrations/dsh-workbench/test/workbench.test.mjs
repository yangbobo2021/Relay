import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { WorkbenchController } from "../src/client/layout/service.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("workbench owns a generic layout and two keyed extension regions", async () => {
  const source = await readFile(join(root, "src/client/layout/index.ts"), "utf8");
  assert.match(source, /'workbench\.side\.view': \{ kind: 'keyed'/);
  assert.match(source, /'workbench\.bottom\.view': \{ kind: 'keyed'/);
  assert.doesNotMatch(source, /workbench\.(?:side|bottom)\.(?:files|terminal)/);
});

test("workbench is the only Relay plugin that replaces the official layout", async () => {
  const patch = await readFile(join(root, "cordis.patch.yml"), "utf8");
  assert.match(patch, /- id: ui-layout\n\s+disabled: true/);
  assert.match(patch, /@relay\/dsh-plugin-workbench/);
});

test("a future plugin can register and open side and bottom views through the public contract", () => {
  const calls = [];
  const workbench = new WorkbenchController();
  workbench.attachPanels({
    activateSideView: id => calls.push(["side", id]),
    activateBottomView: id => calls.push(["bottom", id]),
  });
  const disposeSide = workbench.registerView({ id: "outline", region: "side", title: "Outline" });
  workbench.registerView({ id: "problems", region: "bottom", title: "Problems" });
  assert.deepEqual(workbench.getSnapshot().views.map(view => `${view.region}:${view.id}`), ["bottom:problems", "side:outline"]);
  workbench.openView("side", "outline");
  workbench.openView("bottom", "problems");
  assert.deepEqual(calls, [["side", "outline"], ["bottom", "problems"]]);
  assert.throws(() => workbench.registerView({ id: "outline", region: "side", title: "Duplicate" }), /already registered/);
  disposeSide();
  assert.deepEqual(workbench.getSnapshot().views.map(view => view.id), ["problems"]);
});
