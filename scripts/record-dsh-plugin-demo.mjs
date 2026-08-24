import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import playwright from 'playwright'

const url = process.env.DSH_DEMO_URL ?? 'http://127.0.0.1:4387'
const storageState = process.env.DSH_DEMO_STORAGE_STATE
const outputDir = resolve(process.env.DSH_DEMO_OUTPUT_DIR ?? '.artifacts/dsh-plugin-demo')
const browserExecutable = process.env.DSH_DEMO_BROWSER

if (storageState === undefined) {
  throw new Error('DSH_DEMO_STORAGE_STATE must point to an onboarded official DSH browser state')
}

await mkdir(outputDir, { recursive: true })
const browser = await playwright.chromium.launch({
  headless: true,
  ...(browserExecutable === undefined ? { channel: 'chrome' } : { executablePath: browserExecutable }),
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState,
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()
const video = page.video()
const startedAt = Date.now()
const events = []
const waits = []

const at = () => Number(((Date.now() - startedAt) / 1000).toFixed(3))
const mark = (name) => { events.push({ name, at: at() }) }

page.on('pageerror', error => { console.error(`browser error: ${error.stack ?? error.message}`) })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: 'New session' }).first().waitFor({ timeout: 30_000 })

await installRecordingChrome(page)
await closeVisiblePanel(page, 'Close terminal')
await closeVisiblePanel(page, 'Close side panel')
await page.getByRole('button', { name: 'New session' }).first().click()
await composer(page).waitFor({ timeout: 30_000 })

await caption(page, 'One official DSH. Five installable plugins.')
await pause(page, 1_800)
await openModeMenu(page)
mark('mode-menu')
await pause(page, 2_000)

await caption(page, 'Codex conversations | Codex App Server')
await chooseMode(page, 'Codex', /Select model, current GPT/)
mark('codex-selected')
await pause(page, 1_200)
await runTurn(
  page,
  'Respond with exactly: Codex App Server is live inside DSH.',
  'Codex App Server is live inside DSH.',
  'codex',
)
await pause(page, 2_000)

await caption(page, 'Workspace files | real project content')
await openPanel(page, 'Files')
const files = page.getByRole('region', { name: 'Files' })
await files.waitFor({ timeout: 30_000 })
const filter = files.getByRole('textbox', { name: 'Filter files' })
await filter.fill('README.md')
const readme = files.getByRole('treeitem', { name: 'README.md', exact: true })
await readme.waitFor({ timeout: 30_000 })
await readme.click()
const fileContent = files.getByRole('article', { name: 'File content README.md' })
await fileContent.waitFor({ timeout: 30_000 })
if (!(await fileContent.innerText()).includes('Relay')) throw new Error('Files did not render the Relay README')
mark('files-opened')
await pause(page, 2_800)
await page.screenshot({ path: join(outputDir, 'dsh-plugin-suite-live.png') })

await closeVisiblePanel(page, 'Close side panel')
await caption(page, 'Interactive terminal | live workspace shell')
await openPanel(page, 'Terminal')
const terminal = page.getByRole('region', { name: 'Terminal' })
await terminal.waitFor({ timeout: 30_000 })
const terminalCanvas = terminal.getByRole('application', { name: 'Terminal canvas' })
await terminalCanvas.waitFor({ timeout: 30_000 })
await page.waitForFunction(() => {
  const canvas = document.querySelector('[role="application"][aria-label="Terminal canvas"]')
  const terminalRegion = document.querySelector('section[aria-label="Terminal"]')
  return canvas?.getAttribute('aria-busy') !== 'true' && (terminalRegion?.textContent?.length ?? 0) > 20
}, null, { timeout: 30_000 })
await pause(page, 1_200)
const terminalInput = terminal.locator('textarea[aria-label="Terminal input"]')
await terminalInput.waitFor({ timeout: 30_000, state: 'attached' })
await terminalInput.focus()
await page.keyboard.press('Control+C')
await pause(page, 400)
const terminalMarker = 'RELAY_DSH_PLUGINS_ARE_LIVE'
await page.keyboard.type(`echo ${terminalMarker}`, { delay: 55 })
await page.keyboard.press('Enter')
try {
  await page.waitForFunction(marker => {
    const text = document.querySelector('section[aria-label="Terminal"]')?.textContent ?? ''
    return text.split(marker).length - 1 >= 2
  }, terminalMarker, { timeout: 30_000 })
} catch (error) {
  await page.screenshot({ path: join(outputDir, 'terminal-recording-failure.png') })
  console.error(`terminal screen: ${JSON.stringify(await terminal.innerText())}`)
  throw error
}
mark('terminal-executed')
await pause(page, 2_500)

await closeVisiblePanel(page, 'Close terminal')
await page.getByRole('button', { name: 'New session' }).first().click()
await composer(page).waitFor({ timeout: 30_000 })
await caption(page, 'Claude Code conversations | Claude Agent SDK')
await openModeMenu(page)
await pause(page, 1_000)
await chooseOpenMode(page, 'Claude Code', /Select model, current Claude/)
mark('claude-selected')
await pause(page, 1_200)
await runTurn(
  page,
  'Respond with exactly: Claude Code is live inside DSH.',
  'Claude Code is live inside DSH.',
  'claude',
)
await pause(page, 2_000)

await caption(page, 'No fork. No DSH core patches.')
await pause(page, 2_800)

await page.close()
await context.close()
await browser.close()

const recordedPath = await video.path()
const rawPath = join(outputDir, 'dsh-plugin-suite-raw.webm')
await rename(recordedPath, rawPath)
await writeFile(join(outputDir, 'timeline.json'), `${JSON.stringify({ events, waits }, null, 2)}\n`)
console.log(JSON.stringify({ rawPath, events, waits }, null, 2))

function composer(targetPage) {
  return targetPage.locator('textarea:enabled:not([aria-label="Terminal input"])').last()
}

async function pause(targetPage, milliseconds) {
  await targetPage.waitForTimeout(milliseconds)
}

async function closeVisiblePanel(targetPage, name) {
  const button = targetPage.getByRole('button', { name })
  if (await button.isVisible().catch(() => false)) await button.click({ force: true })
}

async function openModeMenu(targetPage) {
  const button = targetPage.getByRole('button', { name: /^(Standard mode|Codex|Claude Code)$/ }).last()
  await button.click()
  await targetPage.getByRole('menuitem').filter({ hasText: /^Codex/ }).waitFor()
}

async function chooseOpenMode(targetPage, name, modelAria) {
  await targetPage.getByRole('menuitem').filter({ hasText: new RegExp(`^${name}`) }).click()
  await targetPage.getByRole('button', { name: modelAria }).waitFor({ timeout: 30_000 })
}

async function chooseMode(targetPage, name, modelAria) {
  await chooseOpenMode(targetPage, name, modelAria)
}

async function runTurn(targetPage, prompt, marker, id) {
  const input = composer(targetPage)
  await input.pressSequentially(prompt, { delay: 32 })
  const send = targetPage.getByRole('button', { name: 'Send message', exact: true })
  await send.waitFor({ state: 'visible' })
  const wait = { id, start: at(), end: undefined }
  waits.push(wait)
  await send.click()
  await targetPage.getByText(marker, { exact: false }).last().waitFor({ timeout: 180_000 })
  await targetPage.locator('[data-chat-flow-kind="assistant-step"]').last().waitFor({ timeout: 30_000 })
  await targetPage.waitForFunction(() => document.querySelectorAll('[data-streaming="true"]').length === 0, null, {
    timeout: 30_000,
  })
  wait.end = at()
  mark(`${id}-reply`)
}

async function openPanel(targetPage, name) {
  await targetPage.getByRole('button', { name: 'Open panel menu' }).click()
  const menu = targetPage.getByRole('menu', { name: 'Workbench panels' })
  await menu.waitFor()
  await menu.getByRole('menuitem', { name, exact: true }).click()
}

async function caption(targetPage, text) {
  await targetPage.evaluate(value => {
    const element = document.querySelector('#relay-demo-caption')
    if (!(element instanceof HTMLElement)) return
    element.classList.remove('show')
    window.setTimeout(() => {
      element.textContent = value
      element.classList.add('show')
    }, 120)
  }, text)
  await pause(targetPage, 320)
}

async function installRecordingChrome(targetPage) {
  await targetPage.addStyleTag({ content: `
    #relay-demo-caption {
      position: fixed; z-index: 2147483646; top: 68px; right: 24px;
      max-width: 420px; padding: 10px 14px; border: 1px solid rgba(255,255,255,.16);
      border-radius: 6px; background: rgba(17,24,39,.94); color: #fff;
      box-shadow: 0 12px 32px rgba(15,23,42,.24); font: 600 14px/1.35 system-ui;
      letter-spacing: 0; opacity: 0; transform: translateY(-8px);
      transition: opacity .22s ease, transform .22s ease; pointer-events: none;
    }
    #relay-demo-caption.show { opacity: 1; transform: translateY(0); }
    #relay-demo-cursor {
      position: fixed; z-index: 2147483647; width: 18px; height: 18px;
      border: 2px solid #2563eb; border-radius: 50%; background: rgba(37,99,235,.12);
      box-shadow: 0 0 0 3px rgba(255,255,255,.8); pointer-events: none;
      transform: translate(-50%,-50%); transition: width .12s ease, height .12s ease;
    }
    #relay-demo-cursor.click { width: 30px; height: 30px; }
  ` })
  await targetPage.evaluate(() => {
    const caption = document.createElement('div')
    caption.id = 'relay-demo-caption'
    document.body.append(caption)
    const cursor = document.createElement('div')
    cursor.id = 'relay-demo-cursor'
    document.body.append(cursor)
    document.addEventListener('pointermove', event => {
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
    }, true)
    document.addEventListener('pointerdown', () => {
      cursor.classList.add('click')
      window.setTimeout(() => { cursor.classList.remove('click') }, 180)
    }, true)
  })
}
