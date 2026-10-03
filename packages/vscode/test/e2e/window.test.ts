import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { afterAll, beforeAll, expect, it } from 'vite-plus/test'

// Vitest's cwd is wherever `vp test` ran; anchor paths to this file instead.
const extensionDir = path.resolve(import.meta.dirname, '../..')
const workspaceDir = path.join(extensionDir, 'test/fixtures/workspace')
const cachePath = path.join(extensionDir, '.vscode-test')

let app: ElectronApplication
let page: Page
let scratch: string

beforeAll(async () => {
  const started = Date.now()
  const executablePath = await downloadAndUnzipVSCode({ version: 'stable', cachePath })
  console.log(`[e2e] vscode ready in ${Date.now() - started} ms: ${executablePath}`)
  scratch = mkdtempSync(path.join(tmpdir(), 'hero-synergy-e2e-'))
  app = await electron.launch({
    executablePath,
    args: [
      `--extensionDevelopmentPath=${extensionDir}`,
      `--user-data-dir=${path.join(scratch, 'user-data')}`,
      `--extensions-dir=${path.join(scratch, 'extensions')}`,
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
  console.log(`[e2e] window up in ${Date.now() - started} ms`)
})

afterAll(async () => {
  await app?.close()
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

/** Opens the command palette; the first key press is lost until the workbench takes focus. */
async function openCommandPalette(): Promise<void> {
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
}

it('opens a window with the extension loaded', async () => {
  await page.locator('.monaco-workbench').waitFor()
  // The development extension activates on startup (see package.json), so
  // Running Extensions lists it, by ID rather than display name.
  await openCommandPalette()
  await page.keyboard.type('Developer: Show Running Extensions')
  await page.keyboard.press('Enter')
  const listed = page.getByText(/dbarjs\.hero-synergy|Hero Synergy/)
  await expect.poll(() => listed.count(), { timeout: 30_000 }).toBeGreaterThan(0)
  if (process.env.E2E_SHOTS) {
    await page.screenshot({ path: path.join(process.env.E2E_SHOTS, 'running-extensions.png') })
  }
})
