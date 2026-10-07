import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { afterAll, beforeAll, expect, it, onTestFailed } from 'vite-plus/test'

/**
 * The end-to-end tier: a real VS Code launched through Playwright's Electron support against the
 * fixture workspace on the local markdown tracker, driven from the outside. Opt-in by
 * `vp test --project e2e`; plain `vp test` never reaches this file (root vite.config.ts).
 */

// Vitest's cwd is wherever `vp test` ran; anchor paths to this file instead.
const extensionDir = path.resolve(import.meta.dirname, '../..')
const workspaceDir = path.join(extensionDir, 'test/fixtures/workspace')
// Shared with the host tier (`.vscode-test.mjs` caches next to itself), so one download serves both.
const cachePath = path.join(extensionDir, '.vscode-test')
// A failed test leaves a screenshot and the window's text here; CI uploads the directory.
const failuresDir = path.join(extensionDir, 'out-test/e2e-failures')

let app: ElectronApplication
let page: Page
let scratch: string

beforeAll(async () => {
  const executablePath = await downloadAndUnzipVSCode({ version: 'stable', cachePath })
  // Electron's IPC socket lives under the user data dir; Unix caps socket paths at 107 characters.
  scratch = mkdtempSync(path.join(tmpdir(), 'hero-synergy-e2e-'))
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
})
