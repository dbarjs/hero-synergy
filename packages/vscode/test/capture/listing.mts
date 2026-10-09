// PROTOTYPE, throwaway (#119): renders the listing README in the Extensions view of a fresh VS Code,
// from the packaged VSIX, and shoots its details page top to bottom.
//
//   node test/capture/listing.mts [--out <dir>]
//
// The README's images are fetched from GitHub, so the branch they point at must be pushed.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from '@vscode/test-electron'
import { _electron as electron } from 'playwright'

const extensionDir = path.resolve(import.meta.dirname, '../..')
const { values } = parseArgs({
  options: { out: { type: 'string', default: path.join(extensionDir, 'out-listing') } },
})
const outDir = path.resolve(values.out)

if (process.platform === 'linux' && !process.env.DISPLAY) {
  const run = spawnSync(
    'xvfb-run',
    [
      '-a',
      '-s',
      '-screen 0 3000x2000x24',
      process.execPath,
      ...process.execArgv,
      ...process.argv.slice(1),
    ],
    { stdio: 'inherit' },
  )
  process.exit(run.status ?? 1)
}

const WINDOW = { width: 1440, height: 900 }
const scratch = '/tmp/hs-listing'

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
rmSync(scratch, { recursive: true, force: true })
mkdirSync(scratch, { recursive: true })
const executablePath = await downloadAndUnzipVSCode({
  version: 'stable',
  cachePath: path.join(extensionDir, '.vscode-test'),
})
const userData = path.join(scratch, 'user-data')
const extensionsDir = path.join(scratch, 'extensions')
const vsix = path.join(scratch, 'hero-synergy.vsix')
execFileSync(
  path.join(extensionDir, 'node_modules/.bin/vsce'),
  [
    'package',
    '--no-dependencies',
    '--no-gitHubIssueLinking',
    '--allow-unused-files-pattern',
    '--out',
    vsix,
  ],
  { cwd: extensionDir, stdio: 'inherit' },
)
const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executablePath)
const { VSCODE_IPC_HOOK_CLI: _hook, ...localEnv } = process.env
execFileSync(
  cli!,
  [
    ...cliArgs,
    `--user-data-dir=${userData}`,
    `--extensions-dir=${extensionsDir}`,
    '--install-extension',
    vsix,
  ],
  { stdio: 'inherit', env: localEnv },
)

const app = await electron.launch({
  executablePath,
  env: localEnv as Record<string, string>,
  args: [
    `--user-data-dir=${userData}`,
    `--extensions-dir=${extensionsDir}`,
    '--disable-workspace-trust',
    '--disable-updates',
    '--skip-welcome',
    '--skip-release-notes',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--force-device-scale-factor=2',
    scratch,
  ],
})
try {
  const page = await app.firstWindow()
  const win = await app.browserWindow(page)
  await win.evaluate((w, size) => {
    w.unmaximize()
    w.setContentSize(size.width, size.height)
  }, WINDOW)
  await page.waitForSelector('.monaco-workbench', { timeout: 60_000 })
  await page.waitForTimeout(3_000)
  await page.keyboard.press('F1')
  await page.keyboard.type('Extensions: Show Installed Extensions')
  await page.waitForTimeout(800)
  await page.keyboard.press('Enter')
  const item = page.locator('.extension-list-item', { hasText: 'Hero Synergy' }).first()
  await item.waitFor({ timeout: 30_000 })
  await item.click()
  const frame = page.frameLocator('iframe.webview').frameLocator('iframe#active-frame')
  await frame.locator('body').waitFor({ timeout: 30_000 })
  await page.mouse.move(WINDOW.width / 2, WINDOW.height - 20)
  await page.waitForTimeout(6_000)
  await page.screenshot({ path: path.join(outDir, 'listing-00.png') })
  // Scroll the README a screen at a time until it stops moving.
  const box = await page.locator('iframe.webview').first().boundingBox()
  let last = ''
  for (let i = 1; i < 12; i++) {
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 100)
    await page.mouse.wheel(0, 650)
    await page.waitForTimeout(2_000)
    const shot = await page.screenshot({
      path: path.join(outDir, `listing-${String(i).padStart(2, '0')}.png`),
    })
    const key = shot.toString('base64').slice(-4000)
    if (key === last) break
    last = key
  }
} finally {
  await app.close()
}
