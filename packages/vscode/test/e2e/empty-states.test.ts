import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import {
  _electron as electron,
  type ElectronApplication,
  type FrameLocator,
  type Page,
} from 'playwright'
import { afterAll, beforeAll, expect, it, onTestFailed } from 'vite-plus/test'

import {
  createClaudeStub,
  createEmptyWorkspace,
  writeUserSettings,
} from '../fixtures/workspace.mjs'

/**
 * The end-to-end tier for the Tree's empty states, each in a window of its own against a fixture
 * workspace: no user-invoked skill, skills but no tracker doc, and a tracker doc but no map. A
 * stub `claude` answers the plugin list with `[]` and records what a session is started with.
 * Opt-in by `vp test --project e2e`.
 */

const extensionDir = path.resolve(import.meta.dirname, '../..')
const cachePath = path.join(extensionDir, '.vscode-test')
const failuresDir = path.join(extensionDir, 'out-test/e2e-failures')

// Setup and Chart a map are commands of the skills the fixture installs.
const ALL_SKILLS = ['wayfinder', 'to-spec', 'setup-matt-pocock-skills', 'grill-me']

let executablePath: string
let scratch: string

beforeAll(async () => {
  executablePath = await downloadAndUnzipVSCode({ version: 'stable', cachePath })
  // Electron's IPC socket lives under the user data dir; Unix caps socket paths at 107 characters.
  scratch = mkdtempSync(path.join(tmpdir(), 'hs-e-'))
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

interface Window {
  readonly app: ElectronApplication
  readonly page: Page
  readonly tree: FrameLocator
  readonly workspace: string
  readonly claude: ReturnType<typeof createClaudeStub>
}

// VS Code marks a view's webview with `purpose=webviewView` in the iframe's source.
const VIEW_WEBVIEW = 'iframe.webview[src*="purpose=webviewView"]'

/**
 * The environment a window starts with: this process's, minus the variables a ticket session sets
 * (the test may itself run in one), so a plain terminal in the window can be seen to carry none.
 */
function cleanEnv(home: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !name.startsWith('HERO_SYNERGY_')) env[name] = value
  }
  // On macOS a window with a HOME of its own never shows the Activity Bar item (seen on CI), so it
  // keeps the real one there; the machines that run it have no personal skills to find.
  return process.platform === 'darwin' ? env : { ...env, HOME: home }
}

/**
 * Opens a window on a fresh workspace with the Tree showing. HOME is a folder of its own (but on
 * macOS, see {@link cleanEnv}), so the machine running the test has no personal skills to find.
 */
async function openWindow(options: { trackerDoc: boolean; skills: string[] }): Promise<Window> {
  // A retry gets a window of its own: a user data dir that remembers the side bar open would make
  // the click on the Activity Bar item close it. The names stay short because Electron's socket
  // lives under the user data dir and macOS caps socket paths at 104 characters.
  const parent = mkdtempSync(path.join(scratch, 'w-'))
  mkdirSync(path.join(parent, 'home'), { recursive: true })
  const workspace = createEmptyWorkspace(path.join(parent, 'repo'), options)
  const claude = createClaudeStub(parent)
  writeUserSettings(path.join(parent, 'ud'), { 'heroSynergy.claude.path': claude.claude })
  const app = await electron.launch({
    executablePath,
    env: cleanEnv(path.join(parent, 'home')),
    args: [
      `--extensionDevelopmentPath=${extensionDir}`,
      `--user-data-dir=${path.join(parent, 'ud')}`,
      `--extensions-dir=${path.join(parent, 'extensions')}`,
      '--disable-extensions',
      '--disable-workspace-trust',
      '--disable-updates',
      '--skip-welcome',
      '--skip-release-notes',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      workspace,
    ],
  })
  const page = await app.firstWindow()
  await page.locator('.monaco-workbench').waitFor()
  const shown = page.locator('.activitybar .action-item.checked [aria-label^="Hero Synergy"]')
  if ((await shown.count()) === 0) {
    await page.locator('.activitybar [aria-label^="Hero Synergy"]').first().click()
  }
  const tree = page.frameLocator(VIEW_WEBVIEW).frameLocator('iframe#active-frame')
  return { app, page, tree, workspace, claude }
}

async function captureFailure(window: Window | undefined, name: string): Promise<void> {
  if (window === undefined) return
  mkdirSync(failuresDir, { recursive: true })
  await window.page
    .screenshot({ path: path.join(failuresDir, `${name}-${Date.now()}.png`) })
    .catch(() => {})
}

/** Runs a test body in its own window, closed afterwards even when the body throws. */
async function inWindow(
  name: string,
  options: { trackerDoc: boolean; skills: string[] },
  body: (window: Window) => Promise<void>,
): Promise<void> {
  let window: Window | undefined
  onTestFailed(() => captureFailure(window, name))
  try {
    window = await openWindow(options)
    await body(window)
  } finally {
    await window?.app.close()
  }
}

/** The texts of every match, polled; an icon span in front of a label leaves a space to trim. */
const textsOf = (window: Window, selector: string) =>
  expect.poll(
    async () =>
      (await window.tree.locator(selector).allTextContents()).map((text) =>
        text.replace(/\s+/g, ' ').trim(),
      ),
    { timeout: 60_000 },
  )

it('leads with both install commands when no user-invoked skill is found', async () => {
  await inWindow('no-skills', { trackerDoc: true, skills: [] }, async (window) => {
    await textsOf(window, '.command').toEqual([
      'claude plugins install mattpocock-skills',
      'npx skills@latest add mattpocock/skills',
    ])
    await textsOf(window, '.run').toEqual(['Install the plugin', 'Install with npx'])
    await textsOf(window, '.pick').toEqual(['Pick one, never both.'])
  })
})

it('leads with Setup when skills are found but the repo has no tracker doc', async () => {
  await inWindow('no-tracker-doc', { trackerDoc: false, skills: ALL_SKILLS }, async (window) => {
    await textsOf(window, '.message').toEqual(['This repo has no issue tracker set up.'])
    await textsOf(window, '.run').toEqual(['Setup'])
    await textsOf(window, '.command').toEqual(['claude /setup-matt-pocock-skills'])
    await textsOf(window, '.pick').toEqual([])
  })
})

it('leads with Chart a map when the tracker doc has no map, and ▶ opens a plain terminal', async () => {
  await inWindow('no-map', { trackerDoc: true, skills: ALL_SKILLS }, async (window) => {
    await textsOf(window, '.message').toEqual(['No maps yet.'])
    await textsOf(window, '.run').toEqual(['Chart a map'])
    await textsOf(window, '.command').toEqual(["claude -n 'Chart a map' /wayfinder"])

    await window.tree.locator('.run').click()
    // The stub records how it was started: the wayfinder command with no input.
    await expect.poll(() => existsSync(window.claude.argvFile), { timeout: 60_000 }).toBe(true)
    expect(readFileSync(window.claude.argvFile, 'utf8')).toBe('-n\nChart a map\n/wayfinder\n')
    // A plain terminal: no ticket, no events file.
    expect(readFileSync(window.claude.envFile, 'utf8')).toBe('\n\n')
    expect(readFileSync(window.claude.cwdFile, 'utf8').trim()).toBe(realpathSync(window.workspace))
  })
})
