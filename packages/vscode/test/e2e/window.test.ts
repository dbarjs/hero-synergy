import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { afterAll, beforeAll, expect, it, onTestFailed } from 'vite-plus/test'

import { createWorkspace } from '../fixtures/workspace.mjs'

/**
 * The end-to-end tier: a real VS Code launched through Playwright's Electron support against the
 * fixture workspace on the local markdown tracker, driven from the outside. Opt-in by
 * `vp test --project e2e`; plain `vp test` never reaches this file (root vite.config.ts).
 */

// Vitest's cwd is wherever `vp test` ran; anchor paths to this file instead.
const extensionDir = path.resolve(import.meta.dirname, '../..')
// Shared with the host tier (`.vscode-test.mjs` caches next to itself), so one download serves both.
const cachePath = path.join(extensionDir, '.vscode-test')
// A failed test leaves a screenshot and the window's text here; CI uploads the directory.
const failuresDir = path.join(extensionDir, 'out-test/e2e-failures')

let app: ElectronApplication
let page: Page
let scratch: string
// A copy of the fixture workspace that is a git repo of its own: the fixture sits inside this repo,
// and the scout would resolve the window to this repo's root and its GitHub tracker.
let workspaceDir: string

beforeAll(async () => {
  const executablePath = await downloadAndUnzipVSCode({ version: 'stable', cachePath })
  // Electron's IPC socket lives under the user data dir; Unix caps socket paths at 107 characters.
  scratch = mkdtempSync(path.join(tmpdir(), 'hero-synergy-e2e-'))
  workspaceDir = createWorkspace(path.join(scratch, 'repo'))
  app = await electron.launch({
    executablePath,
    args: [
      `--extensionDevelopmentPath=${extensionDir}`,
      `--user-data-dir=${path.join(scratch, 'user-data')}`,
      `--extensions-dir=${path.join(scratch, 'extensions')}`,
      // Keeps the development extension, drops everything else.
      '--disable-extensions',
      '--disable-workspace-trust',
      '--disable-updates',
      '--skip-welcome',
      '--skip-release-notes',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      workspaceDir,
    ],
  })
  page = await app.firstWindow()
})

afterAll(async () => {
  await app?.close()
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

/** Saves what the window showed when a test failed, named after the test and the attempt. */
async function captureFailure(name: string): Promise<void> {
  mkdirSync(failuresDir, { recursive: true })
  const stamp = `${name}-${Date.now()}`
  await page.screenshot({ path: path.join(failuresDir, `${stamp}.png`) }).catch(() => {})
  const text = await page
    .locator('.monaco-workbench')
    .innerText()
    .catch((error: unknown) => `innerText failed: ${String(error)}`)
  writeFileSync(path.join(failuresDir, `${stamp}.txt`), text)
}

/** Runs a palette command by name: focus the window, open the palette, filter, pick the one row. */
async function runCommand(title: string): Promise<void> {
  // A key press before the renderer has focus is lost; a click gives it focus deterministically.
  await page.locator('.monaco-workbench').click({ position: { x: 5, y: 5 } })
  const palette = page.locator('.quick-input-widget')
  await expect
    .poll(
      async () => {
        await page.keyboard.press('F1')
        return palette.isVisible()
      },
      { timeout: 30_000, interval: 1_000 },
    )
    .toBe(true)
  await palette.locator('input').fill(`>${title}`)
  const row = palette.locator('.quick-input-list .monaco-list-row', { hasText: title })
  await row.first().waitFor({ timeout: 10_000 })
  await page.keyboard.press('Enter')
}

it('opens a window with the extension loaded', async () => {
  onTestFailed(() => captureFailure('extension-loaded'))
  await page.locator('.monaco-workbench').waitFor()
  // The fixture workspace carries docs/agents/issue-tracker.md, the extension's activation event,
  // so Running Extensions lists it (by ID, not display name).
  await runCommand('Developer: Show Running Extensions')
  const editor = page.locator('.runtime-extensions-editor')
  await editor.waitFor({ timeout: 30_000 })
  const listed = editor.locator('.extension', { hasText: /dbarjs\.hero-synergy|Hero Synergy/ })
  await expect.poll(() => listed.count(), { timeout: 30_000 }).toBeGreaterThan(0)
  // Newer builds open the editor modally, over the workbench; close it so the next test can click.
  await page.keyboard.press('Escape')
  await page.locator('.monaco-modal-editor-block').waitFor({ state: 'hidden' })
})

/** The Tree's page: the webview inside its iframe inside the workbench. */
const tree = () => page.frameLocator('iframe.webview').first().frameLocator('iframe#active-frame')

/** Every row as it reads left to right: its label with the `#number`, then each trailing mark. */
const treeRows = (): Promise<string[]> =>
  tree()
    .locator('[role="treeitem"]')
    .evaluateAll((rows) => {
      const text = (element: Element | null): string =>
        (element?.textContent ?? '').replace(/\s+/g, ' ').trim()
      return rows.map((row) =>
        [text(row.querySelector('.label')), ...[...row.querySelectorAll('.trail > *')].map(text)]
          .filter((part) => part !== '')
          .join(' | '),
      )
    })

const row = (label: string) =>
  tree().locator('[role="treeitem"]').filter({ hasText: label }).first()

it('shows the fixture workspace maps and tickets in the Tree', async () => {
  onTestFailed(() => captureFailure('tree'))
  await page.locator('.monaco-workbench').waitFor()
  // A click on the Activity Bar item of the open view would close the side bar, and a retry runs
  // in the same window, so click only when the view is not the one showing.
  const shown = page.locator('.activitybar .action-item.checked [aria-label^="Hero Synergy"]')
  if ((await shown.count()) === 0) {
    await page.locator('.activitybar [aria-label^="Hero Synergy"]').first().click()
  }
  await expect
    .poll(() => treeRows().catch(() => []), { timeout: 60_000, interval: 1_000 })
    .not.toEqual([])

  // The marks are codicons: a font that did not load leaves every icon blank.
  await expect
    .poll(
      () =>
        tree()
          .locator('body')
          .evaluate(() =>
            [...document.fonts].some(
              (font) => font.family.includes('codicon') && font.status === 'loaded',
            ),
          ),
      { timeout: 15_000 },
    )
    .toBe(true)

  // The most urgent map is open; the others and the Finished fold are closed.
  await expect
    .poll(treeRows, { timeout: 15_000 })
    .toEqual([
      '#3 Cockpit colors | 2 takeable | 1/5',
      "Map A palette for the Cockpit's tree and detail, decided and recorded as tokens.",
      '#4 Row density | claimed | HITL',
      '#1 Palette | next | HITL',
      '#3 Contrast audit | task',
      '#2 Dark mode | waits on #1 | AFK',
      'Fog | 1',
      'Decisions | 1',
      '#2 Billing rewrite | nothing takeable | 1/3',
      'Finished | 1 maps',
    ])

  await row('Decisions').click()
  await row('Fog').click()
  await row('#2 Billing rewrite').click()
  await row('Finished').click()
  // Each click is a round trip to the host and back, so the Tree settles a moment after the last.
  await expect
    .poll(treeRows, { timeout: 15_000 })
    .toEqual([
      '#3 Cockpit colors | 2 takeable | 1/5',
      "Map A palette for the Cockpit's tree and detail, decided and recorded as tokens.",
      '#4 Row density | claimed | HITL',
      '#1 Palette | next | HITL',
      '#3 Contrast audit | task',
      '#2 Dark mode | waits on #1 | AFK',
      'Fog | 1',
      'Spacing, once the palette is fixed.',
      'Decisions | 1',
      '#5 Icon set Codicons: they ship with VS Code',
      '#2 Billing rewrite | nothing takeable | 1/3',
      'Map Billing v2 decided: every question it depends on is answered, ready for `/to-spec`.',
      '#2 Refund policy | claimed | HITL',
      '#3 Invoice numbering | waits on #2 | HITL',
      'Fog | 1',
      'Decisions | 1',
      'Finished | 1 maps',
      '#1 Archive search | 2/2',
    ])
})

it('collects again when Refresh is pressed and the Tree updates', async () => {
  onTestFailed(() => captureFailure('refresh'))
  // Someone resolves the palette ticket from the terminal.
  writeFileSync(
    path.join(workspaceDir, '.scratch/cockpit-colors/issues/01-palette.md'),
    '# Palette\n\nType: prototype\nStatus: resolved\n\n## Question\n\nWhich colors?\n\n## Answer\n\nFive.\n',
  )
  // The title bar's button, by its exact label: the Explorer has a hidden "Refresh Explorer".
  await page.locator('.part.sidebar .action-label[aria-label="Refresh"]:visible').click()
  await expect
    .poll(async () => (await treeRows())[0], { timeout: 30_000, interval: 500 })
    .toBe('#3 Cockpit colors | 2 takeable | 2/5')
  const rows = await treeRows()
  expect(rows.slice(2, 5)).toEqual([
    '#4 Row density | claimed | HITL',
    '#2 Dark mode | next | AFK',
    '#3 Contrast audit | task',
  ])
})
