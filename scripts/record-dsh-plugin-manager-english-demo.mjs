import { spawn, execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(root, 'upstream/deepseek-harness/apps/cli/lib/bin.js')
const credentials = process.env.DSH_DEMO_CREDENTIALS
const outputDir = resolve(process.env.DSH_DEMO_OUTPUT_DIR ?? '.artifacts/dsh-plugin-manager-english-demo')
const managerVersion = process.env.DSH_DEMO_MANAGER_VERSION ?? '0.1.0-rc.3'
const target = process.env.DSH_DEMO_TARGET ?? 'relay-dsh-plugin-codex'
const targetVersion = process.env.DSH_DEMO_TARGET_VERSION ?? '0.1.2'

if (credentials === undefined) {
  throw new Error('DSH_DEMO_CREDENTIALS must point to a configured DSH credentials file')
}

await mkdir(outputDir, { recursive: true })
const temporary = await mkdtemp(join(await realpath(tmpdir()), 'relay-dsh-manager-english-demo-'))
const home = join(temporary, 'home')
const agentsHome = join(temporary, 'agents')
const workspace = join(temporary, 'workspace')
const profile = join(home, 'profiles', 'web')
const workspaceId = randomUUID()
const events = []
const waits = []
let server
let browser
let recordedContext
let video
let startedAt = 0

try {
  await mkdir(workspace, { recursive: true })
  await mkdir(agentsHome, { recursive: true })
  run(process.execPath, [
    cli, 'plugin', '--profile', 'web', 'add', '--save-exact',
    `relay-dsh-plugin-manager@${managerVersion}`,
  ], { DSH_HOME: home })
  await copyFile(credentials, join(home, '.credentials.yaml'))
  await writeFile(join(home, 'settings.yaml'), [
    'ui-onboarding:',
    '  welcomeNoticeVersion: 2026-08-13.1',
    'locale:',
    '  preference: en',
    '',
  ].join('\n'))
  await mkdir(join(home, 'storages'), { recursive: true })
  await writeFile(join(home, 'storages', 'workspace.json'), `${JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, workspaceIds: [workspaceId], archivedSessionIds: [] },
    tables: {
      workspaces: {
        [workspaceId]: {
          path: await realpath(workspace),
          title: 'Plugin Demo',
          sessionIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    },
  }, null, 2)}\n`)

  const ready = launchDsh(home, agentsHome)
  server = ready.child
  const url = await ready.url
  browser = await chromium.launch({ headless: true, channel: 'chrome' })

  const setup = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' })
  const setupPage = await setup.newPage()
  await setupPage.goto(url, { waitUntil: 'load' })
  await setupPage.getByRole('button', { name: 'New session', exact: true }).first().waitFor({ timeout: 30_000 })
  const workspaceRow = setupPage.getByRole('treeitem', { name: 'Plugin Demo', exact: true })
  await workspaceRow.click()
  await setupPage.getByRole('button', { name: 'New session in Plugin Demo', exact: true }).click()
  await setupPage.getByRole('textbox', { name: 'Describe what you want to build', exact: true })
    .waitFor({ timeout: 30_000 })
  await assertEnglish(setupPage, 'setup')
  const storageState = await setup.storageState()
  await setup.close()

  recordedContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    storageState,
    recordVideo: { dir: outputDir, size: { width: 1280, height: 720 } },
  })
  const page = await recordedContext.newPage()
  video = page.video()
  await page.goto(url, { waitUntil: 'load' })
  const activeComposer = page.locator('textarea:enabled:not([aria-label="Terminal input"])').last()
  if (!(await activeComposer.isVisible().catch(() => false))) {
    await page.getByRole('treeitem', { name: 'New Session', exact: true }).last().click()
  }
  await activeComposer.waitFor({ timeout: 30_000 })
  await installRecordingChrome(page)
  await assertEnglish(page, 'recording start')
  startedAt = Date.now()
  mark('recording-ready')

  await caption(page, '1. Find the exact plugin from Chat')
  const searchPrompt = `/plugins Find ${target}. Show the exact npm version and source. Do not install it. Reply in English only.`
  await runTurn(page, searchPrompt, {
    id: 'search',
    tool: `plugin_discover · search`,
  })
  await assertTargetDependency(undefined, 'search')
  await pause(page, 1_800)

  await caption(page, '2. Create an install plan - no changes yet')
  const planPrompt = `Plan the installation of ${target}@${targetVersion}. Do not execute it. Reply in English only.`
  await runTurn(page, planPrompt, {
    id: 'plan',
    tool: 'plugin_manage · plan',
  })
  await assertTargetDependency(undefined, 'plan')
  await pause(page, 1_800)

  await caption(page, '3. Confirm in a separate message')
  await runTurn(page, 'Confirm. Install it now using the pending plan. Reply in English only.', {
    id: 'install',
    tool: 'plugin_manage · execute',
  })
  await page.getByText(target, { exact: false }).last().waitFor({ timeout: 30_000 })
  await assertEnglish(page, 'final result')
  await pause(page, 3_000)
  await page.screenshot({ path: join(outputDir, 'dsh-plugin-manager-english-success.png') })
  mark('final-proof')

  await page.close()
  await recordedContext.close()
  recordedContext = undefined
  const recordedPath = await video.path()
  const rawPath = join(outputDir, 'dsh-plugin-manager-english-raw.webm')
  await rename(recordedPath, rawPath)

  const manifest = await assertTargetDependency(targetVersion, 'install')
  await writeFile(join(outputDir, 'timeline.json'), `${JSON.stringify({
    url,
    officialDshCommit: git(['-C', resolve(root, 'upstream/deepseek-harness'), 'rev-parse', 'HEAD']).trim(),
    managerVersion,
    target: `${target}@${targetVersion}`,
    events,
    waits,
  }, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ rawPath, events, waits, installed: manifest.dependencies[target] }, null, 2)}\n`)
} finally {
  if (recordedContext !== undefined) await recordedContext.close().catch(() => {})
  if (browser !== undefined) await browser.close().catch(() => {})
  if (server !== undefined) await stopChild(server)
  await rm(temporary, { recursive: true, force: true })
}

function at() {
  return Number(((Date.now() - startedAt) / 1000).toFixed(3))
}

function mark(name) {
  events.push({ name, at: at() })
}

async function runTurn(page, prompt, options) {
  const composer = page.locator('textarea:enabled:not([aria-label="Terminal input"])').last()
  await composer.pressSequentially(prompt, { delay: 18 })
  mark(`${options.id}-typed`)
  const wait = { id: options.id, start: at(), tool: undefined, end: undefined }
  waits.push(wait)
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  mark(`${options.id}-submitted`)
  await page.getByRole('button', { name: `Tool call ${options.tool}`, exact: true }).waitFor({ timeout: 180_000 })
  wait.tool = at()
  mark(`${options.id}-tool`)
  await page.getByRole('button', { name: 'Stop generating', exact: true })
    .waitFor({ state: 'hidden', timeout: 180_000 })
  wait.end = at()
  mark(`${options.id}-result`)
}

async function assertTargetDependency(expected, stage) {
  const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
  const actual = manifest.dependencies?.[target]
  if (actual !== expected) {
    throw new Error(`${stage} dependency mismatch for ${target}: expected ${String(expected)}, got ${String(actual)}`)
  }
  return manifest
}

function run(file, args, extraEnv = {}) {
  return execFileSync(file, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  })
}

function git(args) {
  return run('git', args)
}

function launchDsh(dshHome, agentsHome) {
  const child = spawn(process.execPath, [cli, 'web', '--host', '127.0.0.1', '--port', '0', '--no-open'], {
    cwd: root,
    env: { ...process.env, DSH_HOME: dshHome, DSH_AGENTS_HOME: agentsHome },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  const url = new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error(`DSH readiness timed out\n${output}`)), 45_000)
    const inspect = chunk => {
      output = (output + chunk.toString()).slice(-64 * 1024)
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u.exec(output)
      if (match?.[1] === undefined) return
      clearTimeout(timer)
      resolveUrl(match[1])
    }
    child.stdout.on('data', inspect)
    child.stderr.on('data', inspect)
    child.once('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimeout(timer)
      reject(new Error(`DSH exited before readiness (code=${code}, signal=${signal})\n${output}`))
    })
  })
  return { child, url }
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const closed = new Promise(resolveClose => child.once('close', resolveClose))
  child.kill('SIGTERM')
  await Promise.race([closed, new Promise(resolveWait => setTimeout(resolveWait, 5_000))])
}

async function assertEnglish(page, stage) {
  const visible = await page.locator('body').innerText()
  if (/[\u3400-\u9fff]/u.test(visible)) throw new Error(`${stage} contains visible CJK text`)
  const language = await page.evaluate(() => document.documentElement.lang)
  if (language !== 'en') throw new Error(`${stage} document language is ${JSON.stringify(language)}`)
}

async function pause(page, milliseconds) {
  await page.waitForTimeout(milliseconds)
}

async function caption(page, text) {
  await page.evaluate(value => {
    const element = document.querySelector('#relay-demo-caption')
    if (!(element instanceof HTMLElement)) return
    element.classList.remove('show')
    window.setTimeout(() => {
      element.textContent = value
      element.classList.add('show')
    }, 120)
  }, text)
  await pause(page, 320)
}

async function installRecordingChrome(page) {
  await page.addStyleTag({ content: `
    #relay-demo-caption {
      position: fixed; z-index: 2147483646; top: 18px; right: 24px;
      max-width: 440px; padding: 10px 14px; border: 1px solid rgba(255,255,255,.16);
      border-radius: 6px; background: rgba(17,24,39,.94); color: #fff;
      box-shadow: 0 12px 32px rgba(15,23,42,.24); font: 600 14px/1.35 system-ui;
      letter-spacing: 0; opacity: 0; transform: translateY(-8px);
      transition: opacity .22s ease, transform .22s ease; pointer-events: none;
    }
    #relay-demo-caption.show { opacity: 1; transform: translateY(0); }
  ` })
  await page.evaluate(() => {
    const captionElement = document.createElement('div')
    captionElement.id = 'relay-demo-caption'
    document.body.append(captionElement)
  })
}
