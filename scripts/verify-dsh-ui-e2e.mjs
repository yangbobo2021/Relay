import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
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
  ["integrations/session-import", "relay-dsh-plugin-session-import"],
  ["integrations/codex", "relay-dsh-plugin-codex"],
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
  {
    id: "codex-real-terminal",
    plugins: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal", "relay-dsh-plugin-codex"],
    activePackages: ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal", "relay-dsh-plugin-codex", "relay-dsh-plugin-session-import"],
    views: ["Files", "Terminal"],
    workspace: true,
    realTerminal: true,
  },
];
const selectedIds = process.env.DSH_UI_E2E_SCENARIOS?.split(",");
const selectedScenarios = selectedIds === undefined ? scenarios : scenarios.filter(scenario => selectedIds.includes(scenario.id));
assert.ok(selectedScenarios.length > 0, "no matching UI E2E scenarios");
for (const id of selectedIds ?? []) assert.ok(scenarios.some(scenario => scenario.id === id), `unknown scenario: ${id}`);

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
  await writeFile(join(artifactRoot, "candidate-packages.json"), JSON.stringify({
    dshCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: dshRoot, encoding: "utf8" }).trim(),
    createdAt: new Date().toISOString(),
    node: process.version,
    scenarios: selectedScenarios.map(scenario => scenario.id),
    packages: [...tarballs].map(([name, path]) => ({ name, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") })),
  }, null, 2) + "\n");

  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? systemChromePath() ?? undefined,
    args: ["--no-sandbox"],
  });

  for (const scenario of selectedScenarios) {
    const port = await freePort();
    await verifyScenario(scenario, tarballs, port);
    console.log(`PASS ${scenario.id}`);
  }
} finally {
  await browser?.close().catch(() => {});
  if (!keepArtifacts) await rm(temporary, { recursive: true, force: true });
}

assert.equal(gitStatus(), "", "official DSH checkout changed during UI E2E verification");
console.log(`Verified ${selectedScenarios.length} DSH UI E2E scenarios against official DSH.`);

async function verifyScenario(scenario, tarballs, port) {
  const home = join(temporary, scenario.id);
  const env = { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: join(home, "agents") };
  if (scenario.realTerminal) {
    // Keep interactive zsh startup files out of the synthetic terminal fixture.
    env.ZDOTDIR = join(home, "shell-config");
    await mkdir(env.ZDOTDIR, { recursive: true });
    // CI/tool shells may export LC_ALL=C, making zsh echo UTF-8 bytes as escapes.
    // This fixture tests an explicit UTF-8 locale without changing user config.
    env.LC_ALL = process.env.DSH_UI_E2E_TERMINAL_LOCALE ?? (process.platform === "darwin" ? "en_US.UTF-8" : "C.UTF-8");
  }
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
    const launchUrl = output.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)?.[0];
    assert.ok(launchUrl, 'missing DSH launch token');
    await verifyBrowserScenario(scenario, port, launchUrl);
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

async function verifyBrowserScenario(scenario, port, launchUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.request.get(launchUrl);
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
    const graph = await page.evaluate(() => window.__DSH_BOOT__);
    for (const name of scenario.activePackages ?? scenario.plugins) {
      const batch = graph.batches.find(batch => batch.entries.includes(name));
      assert.ok(batch, `${scenario.id}: ${name} missing from boot graph`);
      const asset = await context.request.get(new URL(batch.url, `http://127.0.0.1:${port}`).href);
      assert.equal(asset.ok(), true, `${scenario.id}: ${name} combo asset unavailable`);
    }
    await dismissOfficialOnboarding(page, scenario.id);
    const workspace = scenario.workspace === true ? await connectFreshWorkspace(page, scenario.id) : undefined;
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
    if (scenario.views.includes("Terminal")) {
      if (scenario.realTerminal) await verifyRealTerminal(page, scenario.id, workspace);
      else await verifyTerminalView(page, scenario.id, scenario.workspace === true);
    }

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
  await page.locator('[contenteditable="true"][role="textbox"]').waitFor({ timeout: 15_000 });
  return workspace;
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
    await filter.fill("notes");
    await page.getByRole("treeitem", { name: "notes.md" }).click();
    const markdown = page.getByRole("article", { name: "File content notes.md" });
    await markdown.getByRole("heading", { name: "Relay DSH E2E" }).waitFor({ timeout: 10_000 });
    await markdown.getByText("Workbench plugin file preview.", { exact: true }).waitFor({ timeout: 10_000 });
    await page.screenshot({ path: join(artifactRoot, `${id}-markdown-preview.png`), fullPage: true });
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

async function verifyRealTerminal(page, id, workspace) {
  assert.ok(workspace);
  await openPanelMenu(page, id);
  await page.getByRole("menuitem", { name: "Terminal" }).click();
  const terminal = page.getByRole("region", { name: "Terminal" });
  const canvas = page.getByRole("application", { name: "Terminal canvas" });
  await canvas.waitFor({ state: "visible" });
  await waitFor(async () => await canvas.getAttribute("aria-busy") === "false", 30_000);
  const send = async command => {
    await terminal.locator(".xterm-helper-textarea").focus();
    await page.keyboard.insertText(command);
    await page.keyboard.press("Enter");
  };
  const waitFile = name => waitFor(() => existsSync(join(workspace, name)), 15_000);
  await send(`printf '%s\\n' "$PWD" "中文终端验证" > relay-terminal-cwd.txt; printf '%s\\n' "$$" > relay-terminal-shell.pid; cat relay-terminal-cwd.txt`);
  await waitFile("relay-terminal-cwd.txt");
  const cwdLines = (await readFile(join(workspace, "relay-terminal-cwd.txt"), "utf8")).trim().split("\n");
  assert.equal(await realpath(cwdLines[0]), await realpath(workspace), `${id}: shell cwd`);
  assert.equal(cwdLines[1], "中文终端验证", `${id}: Unicode keyboard input reaches the shell`);
  // The expected output is absent from the echoed command, so echo alone cannot pass.
  await send(`${shellQuote(process.execPath)} -e ${shellQuote('process.stdout.write("\\u001b[32m\\u8f93\\u51fa\\u56de\\u8def\\u5df2\\u901a\\u8fc7\\u001b[0m\\n")')}`);
  await waitFor(async () => (await terminal.locator(".xterm-rows").innerText()).includes("输出回路已通过"), 10_000);

  await send("stty size > relay-terminal-size-before.txt");
  await waitFile("relay-terminal-size-before.txt");
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.waitForTimeout(500);
  await send("stty size > relay-terminal-size-after.txt");
  await waitFile("relay-terminal-size-after.txt");
  const before = (await readFile(join(workspace, "relay-terminal-size-before.txt"), "utf8")).trim();
  const after = (await readFile(join(workspace, "relay-terminal-size-after.txt"), "utf8")).trim();
  assert.match(before, /^\d+ \d+$/);
  assert.match(after, /^\d+ \d+$/);
  assert.notEqual(before, after, `${id}: viewport resize reaches the real PTY`);

  const program = 'const fs=require("node:fs");fs.writeFileSync("relay-terminal-child.pid",String(process.pid));setTimeout(()=>fs.writeFileSync("relay-terminal-unwanted.txt","not cancelled"),5000)';
  await send(`${shellQuote(process.execPath)} -e ${shellQuote(program)}`);
  await waitFile("relay-terminal-child.pid");
  const childPid = Number(await readFile(join(workspace, "relay-terminal-child.pid"), "utf8"));
  assert.ok(childPid > 0);
  await page.keyboard.press("Control+c");
  await waitFor(() => !processAlive(childPid), 10_000);
  assert.equal(existsSync(join(workspace, "relay-terminal-unwanted.txt")), false, `${id}: cancelled process has no late file write`);
  await send("printf '%s\\n' resumed > relay-terminal-resumed.txt");
  await waitFile("relay-terminal-resumed.txt");
  assert.equal((await readFile(join(workspace, "relay-terminal-resumed.txt"), "utf8")).trim(), "resumed");

  await page.getByRole("button", { name: "Close terminal" }).click();
  await terminal.waitFor({ state: "hidden" });
  await openPanelMenu(page, id);
  await page.getByRole("menuitem", { name: "Terminal" }).click();
  await waitFor(async () => (await terminal.locator(".xterm-rows").innerText()).includes("中文终端验证"), 10_000);
  await send("printf '%s\\n' \"$$\" > relay-terminal-reattached.pid");
  await waitFile("relay-terminal-reattached.pid");
  const shellPid = Number(await readFile(join(workspace, "relay-terminal-shell.pid"), "utf8"));
  assert.equal(Number(await readFile(join(workspace, "relay-terminal-reattached.pid"), "utf8")), shellPid, `${id}: reopening panel reattaches existing shell`);
  await page.screenshot({ path: join(artifactRoot, `${id}-terminal-executed.png`), fullPage: true });
  await send("exit");
  await waitFor(() => !processAlive(shellPid), 10_000);
  await writeFile(join(artifactRoot, `${id}-terminal-evidence.json`), JSON.stringify({
    dshCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: dshRoot, encoding: "utf8" }).trim(),
    platform: process.platform, arch: process.arch,
    terminalLocale: process.env.DSH_UI_E2E_TERMINAL_LOCALE ?? (process.platform === "darwin" ? "en_US.UTF-8" : "C.UTF-8"),
    cwdMatchesWorkspace: true, unicodeRoundTrip: true, ptySize: { before, after },
    ctrlCProcessExited: true, cancelledSideEffectAbsent: true, shellUsableAfterCtrlC: true,
    reopenedPanelRetainsShellAndHistory: true, explicitExitTerminatesShell: true,
    modelTurns: 0,
  }, null, 2) + "\n");
  await page.getByRole("button", { name: "Close terminal" }).click();
  await page.setViewportSize({ width: 1440, height: 960 });
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
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
