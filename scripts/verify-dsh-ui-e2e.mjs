import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { prepareDshLocalWorkspaceLinks } from "./lib/dsh-local-workspace-links.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dshRoot = resolve(process.env.DSH_ROOT ?? join(root, "upstream", "deepseek-harness"));
const dshBin = join(dshRoot, "apps", "cli", "lib", "bin.js");
const webDist = join(dshRoot, "apps", "web", "dist", "index.html");
const temporary = await mkdtemp(join(tmpdir(), "relay-dsh-ui-e2e-"));
const artifactRoot = resolve(process.env.DSH_UI_E2E_ARTIFACT_DIR ?? join(temporary, "artifacts"));
const keepArtifacts = process.env.DSH_UI_E2E_KEEP_ARTIFACTS === "1" || process.env.DSH_UI_E2E_ARTIFACT_DIR !== undefined;

const packages = [
  ["integrations/dsh-workbench", "relay-dsh-plugin-workbench"],
  ["integrations/dsh-files", "relay-dsh-plugin-files"],
  ["integrations/dsh-terminal", "relay-dsh-plugin-terminal"],
];

const scenarios = [
  {
    id: "workbench-only",
    plugins: ["relay-dsh-plugin-workbench"],
    views: [],
  },
  {
    id: "files-with-workbench",
    plugins: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files"],
    activePackages: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files"],
    views: ["Files"],
  },
  {
    id: "terminal-with-workbench",
    plugins: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-terminal"],
    activePackages: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-terminal"],
    views: ["Terminal"],
  },
  {
    id: "files-terminal-with-workbench",
    plugins: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal"],
    activePackages: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal"],
    views: ["Files", "Terminal"],
    workspace: true,
  },
  {
    id: "workbench-files-terminal-explicit",
    plugins: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal"],
    activePackages: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal"],
    views: ["Files", "Terminal"],
    workspace: true,
  },
];

assert.ok(existsSync(dshBin), `official DSH CLI build is missing: ${dshBin}`);
assert.ok(existsSync(webDist), `official DSH Web dist is missing: ${webDist}; run pnpm run build in the official DSH checkout first`);
assert.equal(gitStatus(), "", "official DSH checkout must be clean before UI E2E verification");
prepareDshLocalWorkspaceLinks(dshRoot);
await mkdir(artifactRoot, { recursive: true });

let browser;
try {
  const tarballs = new Map(packages.map(([directory, name]) => {
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
      cwd: join(root, directory), encoding: "utf8",
    }))[0];
    return [name, join(temporary, packed.filename)];
  }));

  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? systemChromePath() ?? undefined,
    args: ["--no-sandbox"],
  });

  for (const scenario of scenarios) {
    const port = await freePort();
    await verifyScenario(scenario, tarballs, port);
  }
} finally {
  await browser?.close().catch(() => {});
  if (!keepArtifacts) await rm(temporary, { recursive: true, force: true });
}

assert.equal(gitStatus(), "", "official DSH checkout changed during UI E2E verification");
console.log("Verified DSH Workbench UI E2E installs, Web boot, panel menu, Files empty state, workspace file preview, and Terminal view scenarios against official DSH.");

async function verifyScenario(scenario, tarballs, port) {
  const home = join(temporary, scenario.id);
  const env = { ...process.env, DSH_HOME: home };
  execFileSync(process.execPath, [dshBin, "plugin", "--profile", "web", "install"], {
    cwd: dshRoot, env, stdio: "ignore",
  });
  const profile = join(home, "profiles", "web");
  const overrides = ["", "overrides:", ...[...tarballs].map(([name, path]) => `  '${name}': file:${path}`), ""].join("\n");
  await appendFile(join(profile, "pnpm-workspace.yaml"), overrides);
  if (scenario.workspace === true) await pinBrowseDirectoryPicker(profile);
  execFileSync(process.execPath, [dshBin, "plugin", "--profile", "web", "add", ...scenario.plugins.map(name => tarballs.get(name))], {
    cwd: dshRoot, env, stdio: "ignore",
  });

  const manifest = JSON.parse(await readFile(join(profile, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [...scenario.plugins].sort(), `${scenario.id}: only requested plugins are direct dependencies`);

  const dump = execFileSync(process.execPath, [dshBin, "web", "--dump-config"], {
    cwd: dshRoot, env, encoding: "utf8",
  });
  assertConfig(scenario, dump);

  const child = spawn(process.execPath, ["--expose-internals", dshBin, "web", "--no-open", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: dshRoot, env, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  try {
    await waitFor(() => output.includes(`http://127.0.0.1:${port}`) || child.exitCode !== null, 20_000);
    assert.equal(child.exitCode, null, `${scenario.id}: DSH Host exited before serving\n${output}`);
    await assertPluginAssets(scenario, port);
    await verifyBrowserScenario(scenario, port);
  } finally {
    if (child.exitCode === null) child.kill("SIGINT");
    await Promise.race([
      new Promise(resolve => child.once("exit", resolve)),
      new Promise(resolve => setTimeout(resolve, 5_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

async function pinBrowseDirectoryPicker(profile) {
  await writeFile(join(profile, "cordis.patch.yml"), [
    "# E2E pins the in-browser directory picker. The official auto chooser may",
    "# select a native OS dialog on developer machines, which Playwright cannot",
    "# inspect in a cross-platform browser test.",
    "- id: directory-picker",
    "  disabled: true",
    "- insert:",
    "    - id: directory-picker-browse",
    "      name: '@deepseek-ai/dsh-host-directory-picker-browse'",
    "    - id: ui-directory-picker-browse",
    "      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'",
    "",
  ].join("\n"), "utf8");
}

function assertConfig(scenario, dump) {
  const activePackages = scenario.activePackages ?? scenario.plugins;
  for (const name of activePackages) assert.match(dump, new RegExp(escapeRegExp(name)), `${scenario.id}: ${name} composes`);
  const workbenchHost = /relay-(?:files-|terminal-)?workbench-host/;
  if (activePackages.includes("relay-dsh-plugin-workbench")) assert.match(dump, workbenchHost, `${scenario.id}: Workbench host composes`);
  else assert.doesNotMatch(dump, workbenchHost, `${scenario.id}: no Workbench host`);
  if (!activePackages.includes("relay-dsh-plugin-files")) assert.doesNotMatch(dump, /relay-files-host/, `${scenario.id}: no Files host`);
  if (!activePackages.includes("relay-dsh-plugin-terminal")) assert.doesNotMatch(dump, /relay-terminal-host/, `${scenario.id}: no Terminal host`);
}

async function assertPluginAssets(scenario, port) {
  const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(rootResponse.ok, true, `${scenario.id}: Web root did not respond`);
  assert.match(await rootResponse.text(), /<html/i, `${scenario.id}: Web root is not HTML`);
  for (const name of scenario.activePackages ?? scenario.plugins) {
    const asset = await fetch(`http://127.0.0.1:${port}/plugins/${name}/client.js`);
    assert.equal(asset.ok, true, `${scenario.id}: ${name} client asset is unavailable`);
  }
}

async function verifyBrowserScenario(scenario, port) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => { errors.push(`pageerror: ${error.message}`); });
  page.on("requestfailed", request => {
    const url = request.url();
    if (!url.startsWith(`http://127.0.0.1:${port}`)) return;
    errors.push(`requestfailed: ${request.method()} ${url} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("response", response => {
    const url = response.url();
    if (!url.startsWith(`http://127.0.0.1:${port}`)) return;
    if (response.status() >= 400 && !url.endsWith("/favicon.ico")) errors.push(`http ${response.status()}: ${url}`);
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await dismissOfficialOnboarding(page, scenario.id);
    if (scenario.workspace === true) await connectFreshWorkspace(page, scenario.id);
    await page.screenshot({ path: join(artifactRoot, `${scenario.id}-loaded.png`), fullPage: true });
    assert.deepEqual(errors, [], `${scenario.id}: browser reported runtime/resource errors`);

    if (scenario.views.length === 0) {
      assert.equal(await page.getByRole("button", { name: "Open panel menu" }).count(), 0, `${scenario.id}: empty Workbench should not show a phantom panel menu`);
      assert.equal(await page.getByText("Files").count(), 0, `${scenario.id}: Files should not appear`);
      assert.equal(await page.getByText("Terminal").count(), 0, `${scenario.id}: Terminal should not appear`);
      return;
    }

    await openPanelMenu(page, scenario.id);
    for (const view of scenario.views) await expectMenuItem(page, scenario.id, view);
    if (!scenario.views.includes("Files")) await expectNoMenuItem(page, scenario.id, "Files");
    if (!scenario.views.includes("Terminal")) await expectNoMenuItem(page, scenario.id, "Terminal");
    await page.keyboard.press("Escape");

    if (scenario.views.includes("Files")) await verifyFilesView(page, scenario.id, scenario.workspace === true);
    if (scenario.views.includes("Terminal")) await verifyTerminalView(page, scenario.id, scenario.workspace === true);

    await page.screenshot({ path: join(artifactRoot, `${scenario.id}-interacted.png`), fullPage: true });
    assert.deepEqual(errors, [], `${scenario.id}: browser reported runtime/resource errors after interaction`);
  } finally {
    await context.close();
  }
}

async function connectFreshWorkspace(page, id) {
  const workspaceParent = join(temporary, `${id}-workspace-parent`);
  const workspace = join(workspaceParent, "workspace");
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, "relay-e2e.txt"), "RELAY_DSH_FILES_E2E_OK\n", "utf8");
  await writeFile(join(workspace, "notes.md"), "# Relay DSH E2E\n\nWorkbench plugin file preview.\n", "utf8");

  const dialog = page.getByRole("dialog", { name: "Select Workspace Directory" });
  const triggers = [
    page.getByRole("button", { name: "Add workspace" }),
    page.getByPlaceholder("Choose a workspace to start"),
    page.getByRole("button", { name: "Choose workspace" }),
    page.getByRole("textbox", { name: "Choose workspace" }),
  ];
  for (const trigger of triggers) {
    if (await trigger.count() === 0) continue;
    await trigger.first().click();
    if (await waitForLocator(dialog, 1_000)) break;
  }
  if (!await waitForLocator(dialog, 1_000)) {
    await page.screenshot({ path: join(artifactRoot, `${id}-workspace-picker-missing.png`), fullPage: true });
    const controls = await page.locator("button, textarea, input").evaluateAll(elements => elements.map(element => ({
      tag: element.tagName.toLowerCase(),
      text: (element.textContent ?? "").trim(),
      aria: element.getAttribute("aria-label"),
      placeholder: element.getAttribute("placeholder"),
      disabled: element.hasAttribute("disabled"),
    })));
    throw new Error(`${id}: workspace picker did not open. Visible controls: ${JSON.stringify(controls)}`);
  }
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await dialog.getByRole("button", { name: "Edit path" }).click();
  const pathInput = dialog.locator('input[aria-label="Edit path"]');
  await pathInput.fill(workspace);
  await pathInput.press("Enter");
  await dialog.getByRole("button", { name: "Open", exact: true }).click();
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  await page.locator('textarea:enabled[placeholder="Describe what you want to build"]').waitFor({ timeout: 15_000 });
}

async function dismissOfficialOnboarding(page, id) {
  for (let step = 0; step < 4; step += 1) {
    const current = page.getByRole("dialog").first();
    if (await current.count() === 0) return;
    await current.waitFor({ state: "visible", timeout: 15_000 });
    const configureLater = current.getByRole("button", { name: /^(Configure later|稍后配置)$/ });
    if (await configureLater.count() > 0) {
      await configureLater.first().click();
    } else {
      const continueButton = current.getByRole("button", { name: /^(Continue|继续)$/ });
      assert.ok(await continueButton.count() > 0, `${id}: official onboarding is visible but has no supported dismissal button`);
      await continueButton.first().click();
    }
    await page.waitForTimeout(300);
  }
  assert.equal(await page.getByRole("dialog").count(), 0, `${id}: official onboarding did not complete after supported dismissals`);
}

async function openPanelMenu(page, id) {
  const button = page.getByRole("button", { name: "Open panel menu" });
  await button.waitFor({ state: "visible", timeout: 15_000 });
  await button.click();
  await page.getByRole("menu", { name: "Workbench panels" }).waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(await button.getAttribute("aria-expanded"), "true", `${id}: panel menu did not open`);
}

async function expectMenuItem(page, id, name) {
  const item = page.getByRole("menuitem", { name });
  assert.equal(await item.count(), 1, `${id}: expected one ${name} menu item`);
  await item.first().waitFor({ state: "visible", timeout: 5_000 });
}

async function expectNoMenuItem(page, id, name) {
  assert.equal(await page.getByRole("menuitem", { name }).count(), 0, `${id}: ${name} menu item should not exist`);
}

async function verifyFilesView(page, id, hasWorkspace) {
  await openPanelMenu(page, id);
  await page.getByRole("menuitem", { name: "Files" }).click();
  const files = page.getByRole("region", { name: "Files" });
  await files.waitFor({ state: "visible", timeout: 10_000 });
  if (hasWorkspace) {
    await page.getByRole("tree", { name: "Workspace files" }).waitFor({ state: "visible", timeout: 10_000 });
    const filter = page.getByRole("textbox", { name: "Filter files" });
    await filter.waitFor({ state: "visible", timeout: 10_000 });
    await filter.fill("relay-e2e");
    const file = page.getByRole("treeitem", { name: "relay-e2e.txt" });
    await file.waitFor({ state: "visible", timeout: 10_000 });
    await file.click();
    await page.getByRole("article", { name: "File content relay-e2e.txt" }).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByText("RELAY_DSH_FILES_E2E_OK").waitFor({ state: "visible", timeout: 10_000 });
    await page.screenshot({ path: join(artifactRoot, `${id}-files-preview.png`), fullPage: true });
  } else {
    await page.getByText("Open a workspace session to browse files.").waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await page.getByRole("tree", { name: "Workspace files" }).count(), 0, `${id}: Files tree should wait for an active workspace session`);
    await page.screenshot({ path: join(artifactRoot, `${id}-files-empty.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Close side panel" }).click();
  await files.waitFor({ state: "hidden", timeout: 10_000 });
}

async function verifyTerminalView(page, id, hasWorkspace) {
  await openPanelMenu(page, id);
  await page.getByRole("menuitem", { name: "Terminal" }).click();
  const terminal = page.getByRole("region", { name: "Terminal" });
  await terminal.waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("application", { name: "Terminal canvas" }).waitFor({ state: "visible", timeout: 10_000 });
  const newTerminal = page.getByRole("button", { name: "New terminal" });
  await newTerminal.waitFor({ state: "visible", timeout: 10_000 });
  if (hasWorkspace) {
    const unavailable = page.getByText("no interactive terminal provider is installed");
    if (!await waitForLocator(unavailable, 10_000)) {
      await page.screenshot({ path: join(artifactRoot, `${id}-terminal-provider-missing.png`), fullPage: true });
      throw new Error(`${id}: Terminal did not show the missing-provider state. Terminal text: ${JSON.stringify(await terminal.textContent())}`);
    }
    await waitFor(async () => !(await newTerminal.isDisabled()), 10_000);
    await page.screenshot({ path: join(artifactRoot, `${id}-terminal-provider-empty.png`), fullPage: true });
  } else {
    assert.equal(await newTerminal.isDisabled(), true, `${id}: New terminal should be disabled without an active workspace session`);
    await page.screenshot({ path: join(artifactRoot, `${id}-terminal-no-workspace.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Close terminal" }).click();
  await terminal.waitFor({ state: "hidden", timeout: 10_000 });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.equal(typeof address, "object", "free port probe returned a pipe address");
  const port = address.port;
  await new Promise(resolvePromise => server.close(resolvePromise));
  return port;
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!await predicate()) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for official DSH Web boot");
    await new Promise(resolvePromise => setTimeout(resolvePromise, 50));
  }
}

async function waitForLocator(locator, timeoutMs) {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

function gitStatus() {
  return execFileSync("git", ["status", "--short"], { cwd: dshRoot, encoding: "utf8" }).trim();
}

function systemChromePath() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  return candidates.find(candidate => existsSync(candidate));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
