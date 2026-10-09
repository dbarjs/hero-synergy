// The capture run: the real Cockpit, in a real VS Code driven by Playwright, on the demo workspace
// and the e2e tier's stub `claude`, shot for the READMEs. Every shot and the loop come from the
// running extension; nothing is drawn by hand.
//
//   vp run capture              (from packages/vscode) build, then shoot into out-capture/
//   node test/capture/capture.mts [--out <dir>]
//
// Linux without a display re-runs itself under `xvfb-run`. Needs `ffmpeg` on PATH for the loop.

import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from '@vscode/test-electron'
import {
  _electron as electron,
  type ElectronApplication,
  type Locator,
  type Page,
} from 'playwright'

import { createClaudeStub, writeUserSettings } from '../fixtures/workspace.mjs'
import {
  claimTicket,
  createDemoWorkspace,
  registryEntries,
  SCENE,
  sessionName,
  type ShownStatus,
} from './demo.mts'
import {
  concatList,
  contactSheet,
  cropRect,
  type Frame,
  gifArgs,
  iconSquare,
  mp4Args,
  type Rect,
  type Shot,
  trimFrames,
  unionRect,
  webpArgs,
  webpEncoder,
} from './media.mts'
import { type CapturedFile, KEPT } from './refresh.mts'

const extensionDir = path.resolve(import.meta.dirname, '../..')
const cachePath = path.join(extensionDir, '.vscode-test')

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: path.join(extensionDir, 'out-capture') },
    // Skips the minute the sessions spend ageing: for working on the script, not for the shots.
    quick: { type: 'boolean', default: false },
  },
})
const outDir = path.resolve(values.out)

// xvfb's default screen is 1280 × 1024 at 8 bits; the window is shot at device scale 2.
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

/** The window's size in CSS pixels; shots are twice that. */
const WINDOW = { width: 1440, height: 900 }
/** The side bar's width in CSS pixels: wide enough for a ticket title beside its session. */
const SIDEBAR_WIDTH = 480
/** Where the run keeps the demo repo, the window's profile and the VSIX; removed at the end. */
const SCRATCH = '/tmp/hero-synergy'
const SCALE = 2

const THEMES = { dark: 'Default Dark Modern', light: 'Default Light Modern' } as const

const userSettings = (theme: keyof typeof THEMES, claude: string) => ({
  'heroSynergy.claude.path': claude,
  'workbench.colorTheme': THEMES[theme],
  'workbench.startupEditor': 'none',
  'workbench.tips.enabled': false,
  'workbench.enableExperiments': false,
  'workbench.secondarySideBar.defaultVisibility': 'hidden',
  'workbench.layoutControl.enabled': false,
  'window.commandCenter': false,
  'window.restoreWindows': 'none',
  'chat.disableAIFeatures': true,
  'chat.commandCenter.enabled': false,
  'editor.minimap.enabled': false,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.ignoreRecommendations': true,
  'git.openRepositoryInParentFolders': 'never',
  'terminal.integrated.enablePersistentSessions': false,
  'terminal.integrated.showExitAlert': false,
  'terminal.integrated.hideOnStartup': 'always',
})

const VIEW_WEBVIEW = 'iframe.webview[src*="purpose=webviewView"]'
const PANEL_WEBVIEW = 'iframe.webview:not([src*="purpose=webviewView"])'

async function main(): Promise<void> {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const executablePath = await downloadAndUnzipVSCode({ version: 'stable', cachePath })
  // A fixed, short path: the Focus pane prints the plugin's path inside it, so a random temp name
  // would show in the shots. Short also because Electron's IPC socket lives under the user data
  // dir, and Unix caps socket paths at 107 characters.
  const scratch = SCRATCH
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(scratch, { recursive: true })
  const workspace = createDemoWorkspace(path.join(scratch, 'repo'))
  const stub = createClaudeStub(path.join(scratch, 'repo'))
  const configDir = path.join(scratch, 'claude-config')
  const sessionsDir = path.join(configDir, 'sessions')
  mkdirSync(sessionsDir, { recursive: true })
  const userData = path.join(scratch, 'user-data')
  const extensionsDir = path.join(scratch, 'extensions')
  writeUserSettings(userData, userSettings('dark', stub.claude))
  // The VSIX the registries get, installed into an empty extensions directory: the window is a
  // user's window, not an Extension Development Host, and runs nothing else.
  const vsix = path.join(scratch, 'hero-synergy.vsix')
  execFileSync(
    path.join(extensionDir, 'node_modules/.bin/vsce'),
    ['package', '--no-dependencies', '--allow-unused-files-pattern', '--out', vsix],
    {
      cwd: extensionDir,
      stdio: 'inherit',
    },
  )
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executablePath)
  // Inside a VS Code terminal or a dev container the `code` script forwards to the window that
  // owns this hook; without it the install stays in the scratch directories.
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
    env: { ...localEnv, CLAUDE_CONFIG_DIR: configDir },
    args: [
      `--user-data-dir=${userData}`,
      `--extensions-dir=${extensionsDir}`,
      '--disable-workspace-trust',
      '--disable-updates',
      '--skip-welcome',
      '--skip-release-notes',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      `--force-device-scale-factor=${SCALE}`,
      workspace,
    ],
  })
  const shots: Shot[] = []
  try {
    const page = await app.firstWindow()
    await sizeWindow(app, page)
    const scene = new Scene(page, workspace, stub, sessionsDir)
    await scene.setUp()

    await scene.selectNone()
    shots.push(
      await scene.shoot(
        'tree-dark.png',
        'The Tree: the map unfolded, its frontier, sessions in every status',
        await scene.treeContent(),
      ),
    )
    shots.push(
      await scene.shoot(
        'badge.png',
        'The Activity Bar badge: two sessions need you',
        await scene.badgeArea(),
      ),
    )
    shots.push(
      await scene.shoot(
        'badge-icon.png',
        'The Hero Synergy icon and its badge alone, as the listing shows them',
        await scene.badgeIcon(),
      ),
    )

    await scene.openFocus(SCENE.launched)
    shots.push(
      await scene.shoot(
        'focus-pane.png',
        `The Focus pane of ${sessionName(SCENE.launched)}: Work ticket and its exact command`,
        await scene.treeContent(),
      ),
    )
    await scene.openFocus(SCENE.waiting)
    shots.push(
      await scene.shoot(
        'focus-pane-session.png',
        `The Focus pane of ${sessionName(SCENE.waiting)}: its session waiting for you`,
        await scene.treeContent(),
      ),
    )
    await scene.selectNone()

    await scene.openMapDetail()
    shots.push(
      await scene.shoot(
        'detail-map.png',
        'The Detail of the map: destination, decisions, fog, out of scope',
        await scene.detailContent(),
      ),
    )
    shots.push(
      await scene.shoot(
        'window-map.png',
        'The whole window: the Tree beside the Detail of the map',
        await scene.window(),
      ),
    )
    await scene.openTicketDetail(SCENE.neighbourhood)
    shots.push(
      await scene.shoot(
        'detail-ticket.png',
        `The Detail of ${sessionName(SCENE.neighbourhood)}: its question and neighbourhood`,
        await scene.detailContent(),
      ),
    )
    await scene.closeEditors()

    const loop = await scene.recordLaunch(path.join(scratch, 'frames'))
    shots.push(...encodeLoop(loop.frames, loop.crop, path.join(scratch, 'frames')))
    shots.push(
      await scene.shoot(
        'terminal.png',
        `The terminal of ${sessionName(SCENE.launched)} beside the Tree and its Detail`,
        await scene.window(),
      ),
    )

    writeUserSettings(userData, userSettings('light', stub.claude))
    await scene.waitForTheme('vs')
    await scene.selectNone()
    shots.push(
      await scene.shoot('tree-light.png', 'The Tree in Light Modern', await scene.treeContent()),
    )
  } catch (error) {
    // What the window showed when a step timed out, next to the shots taken so far.
    const page = app.windows()[0]
    await page?.screenshot({ path: path.join(outDir, 'failure.png') }).catch(() => {})
    // And the Cockpit's output channel, which says why a launch did not happen.
    const logs = readdirSync(path.join(userData, 'logs'), { recursive: true, encoding: 'utf8' })
    for (const log of logs.filter((file) => file.endsWith('Hero Synergy.log'))) {
      cpSync(path.join(userData, 'logs', log), path.join(outDir, 'failure-output.log'))
    }
    throw error
  } finally {
    await app.close()
    rmSync(scratch, { recursive: true, force: true })
  }

  const version = execFileSync('git', ['-C', extensionDir, 'rev-parse', '--short', 'HEAD'])
    .toString()
    .trim()
  writeFileSync(
    path.join(outDir, 'README.md'),
    contactSheet(
      'Hero Synergy capture',
      [
        `Taken by \`vp run capture\` from ${version} on ${process.platform}, VS Code stable, device scale ${SCALE}.`,
        'The workspace is the demo map on the local tracker; `claude` is the e2e tier’s stub, so the terminal stays empty.',
      ],
      shots,
    ),
  )
  console.log(`${shots.length} files in ${outDir}`)
  // `vp run refresh-media` copies these; a run without one of them is no run to copy from.
  const missing = KEPT.filter((file) => !shots.some((shot) => shot.file === file))
  if (missing.length > 0) throw new Error(`The capture made no ${missing.join(', ')}`)
}

async function sizeWindow(app: ElectronApplication, page: Page): Promise<void> {
  const browserWindow = await app.browserWindow(page)
  await browserWindow.evaluate((win, size) => {
    win.unmaximize()
    win.setContentSize(size.width, size.height)
  }, WINDOW)
  const fits = await page
    .waitForFunction(
      (size) => window.innerWidth === size.width && window.innerHeight === size.height,
      WINDOW,
      { timeout: 10_000 },
    )
    .then(() => true)
    .catch(() => false)
  if (!fits) {
    // A screen smaller than the window (the macOS runner's) clamps it: shoot the size it got.
    const got = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }))
    console.log(`window is ${got.width} × ${got.height}, not ${WINDOW.width} × ${WINDOW.height}`)
    WINDOW.width = got.width
    WINDOW.height = got.height
  }
}

class Scene {
  readonly page: Page
  readonly workspace: string
  readonly stub: ReturnType<typeof createClaudeStub>
  readonly sessionsDir: string

  constructor(
    page: Page,
    workspace: string,
    stub: ReturnType<typeof createClaudeStub>,
    sessionsDir: string,
  ) {
    this.page = page
    this.workspace = workspace
    this.stub = stub
    this.sessionsDir = sessionsDir
  }

  readonly started = Date.now()
  private registryWrites = 0
  private live: Array<{ ticket: number; status: ShownStatus; sessionId?: string }> = []

  tree() {
    return this.page.frameLocator(VIEW_WEBVIEW).frameLocator('iframe#active-frame')
  }

  detail() {
    return this.page.frameLocator(PANEL_WEBVIEW).frameLocator('iframe#active-frame')
  }

  row(label: string): Locator {
    return this.tree().locator('[role="treeitem"]').filter({ hasText: label }).first()
  }

  ticketRow(number: number): Locator {
    return this.row(sessionName(number))
  }

  sessionText(number: number): Promise<string> {
    return this.ticketRow(number)
      .locator('.session')
      .textContent({ timeout: 1_000 })
      .then((text) => (text ?? '').trim())
      .catch(() => '')
  }

  async waitForSession(number: number, pattern: RegExp, timeout = 30_000): Promise<void> {
    await until(
      async () => pattern.test(await this.sessionText(number)),
      timeout,
      `${sessionName(number)} ${pattern}`,
    )
  }

  /** Serves the live sessions as the registry and touches the sessions directory, as Claude Code does. */
  serveRegistry(): void {
    writeFileSync(
      this.stub.registryFile,
      JSON.stringify(registryEntries(this.workspace, this.live, this.started)),
    )
    writeFileSync(
      path.join(this.sessionsDir, 'touch.json'),
      JSON.stringify({ n: (this.registryWrites += 1) }),
    )
  }

  async setUp(): Promise<void> {
    const page = this.page
    await page.locator('.monaco-workbench').waitFor({ timeout: 60_000 })
    const shown = page.locator('.activitybar .action-item.checked [aria-label^="Hero Synergy"]')
    if ((await shown.count()) === 0) {
      await page.locator('.activitybar [aria-label^="Hero Synergy"]').first().click()
    }
    await this.ticketRow(SCENE.launched).waitFor({ timeout: 60_000 })
    // The sessions start apart, so their ages read like a working day: the Tree shows the time
    // since the registry's last change, and only waiting makes it grow.
    const first = values.quick ? Date.now() - 65_000 : Date.now()
    this.addSession(SCENE.working, 'working')
    await this.widenSidebar()
    await this.runCommand('Notifications: Clear All Notifications')
    await until(
      () =>
        this.tree()
          .locator('body')
          .evaluate(() =>
            [...document.fonts].some(
              (font) => font.family.includes('codicon') && font.status === 'loaded',
            ),
          ),
      15_000,
      'the codicon font',
    )

    // The ended session: ▶ on its ticket, the stub starts and exits, the terminal is closed.
    writeFileSync(
      this.stub.scriptFile,
      '800 SessionStart startup\n1600 SessionEnd prompt_input_exit\n',
    )
    await this.play(SCENE.ended)
    await this.waitForSession(SCENE.ended, /^ended · exited$/)
    writeFileSync(this.stub.scriptFile, '')
    await this.killTerminals()

    await this.closeEditors()
    await this.waitForSession(SCENE.working, /^working · /)
    // Each from when the one before it was added: the steps above take as long as they take.
    await sleepUntil(first + 25_000)
    this.addSession(SCENE.approval, 'needs approval')
    await this.waitForSession(SCENE.approval, /^needs approval · /)
    await sleep(values.quick ? 0 : 20_000)
    this.addSession(SCENE.waiting, 'waiting for you')
    await this.waitForSession(SCENE.waiting, /^waiting for you · /)
    await sleep(values.quick ? 0 : 12_000)
    await sleepUntil(first + 65_000)
  }

  /**
   * Clicks ▶ on a ticket's row until its session shows. A click that lands while the Tree
   * re-renders is lost now and then; the host starts one terminal however many clicks reach it.
   */
  async play(number: number): Promise<number> {
    const row = this.ticketRow(number)
    let shown = 0
    await until(
      async () => {
        // Read first: an ended session offers ▶ again, and a second click would relaunch it.
        if (/^(starting|live|working|ended)/.test(await this.sessionText(number))) {
          shown = Date.now()
          return true
        }
        await row.locator('.play').click()
        return false
      },
      15_000,
      `${sessionName(number)} to start`,
      1_000,
    )
    return shown
  }

  addSession(ticket: number, status: ShownStatus): void {
    this.live = [...this.live, { ticket, status }]
    this.serveRegistry()
  }

  /** Drags the sash between the side bar and the editor until the side bar is SIDEBAR_WIDTH wide. */
  async widenSidebar(): Promise<void> {
    const sidebar = await this.sidebar()
    const edge = sidebar.x + sidebar.width
    const y = sidebar.y + sidebar.height / 2
    // The vertical sash nearest the side bar's right edge, by its centre.
    const sashes = await this.page.locator('.monaco-sash.vertical:visible').all()
    let best: { x: number; distance: number } | null = null
    for (const sash of sashes) {
      const box = await sash.boundingBox()
      if (box === null || box.y > y || box.y + box.height < y) continue
      const x = box.x + box.width / 2
      if (best === null || Math.abs(x - edge) < best.distance)
        best = { x, distance: Math.abs(x - edge) }
    }
    if (best === null) throw new Error('No sash beside the side bar')
    const delta = SIDEBAR_WIDTH - sidebar.width
    await this.page.mouse.move(best.x, y)
    await this.page.waitForTimeout(300)
    await this.page.mouse.down()
    await this.page.mouse.move(best.x + delta, y, { steps: 20 })
    await this.page.mouse.up()
    await until(
      async () => Math.abs((await this.sidebar()).width - SIDEBAR_WIDTH) <= 2,
      5_000,
      'the side bar to widen',
    )
  }

  /** The side bar from its top to the bottom of the Tree's last row or pane, not the empty rest. */
  async treeContent(): Promise<Rect> {
    // The Tree works out a session's age when it renders, never on a timer: a collect brings the
    // ages up to now before the shot.
    await this.page.locator('.part.sidebar .action-label[aria-label="Refresh"]:visible').click()
    await this.page.waitForTimeout(1_000)
    await this.blurTree()
    const sidebar = await this.sidebar()
    const frame = await this.rectOf(VIEW_WEBVIEW)
    const bottom = await this.tree()
      .locator('body')
      .evaluate(() =>
        Math.max(
          ...[...document.querySelectorAll('[role="treeitem"], .pane')].map(
            (element) => element.getBoundingClientRect().bottom,
          ),
        ),
      )
    return { ...sidebar, height: Math.min(sidebar.height, frame.y + bottom + 12 - sidebar.y) }
  }

  async killTerminals(): Promise<void> {
    await this.runCommand('Terminal: Kill All Terminals')
    await this.page.waitForTimeout(500)
    await this.runCommand('View: Close Panel').catch(() => {})
  }

  async runCommand(title: string): Promise<void> {
    const page = this.page
    await page
      .locator('.part.titlebar')
      .click({ position: { x: 300, y: 10 } })
      .catch(() => {})
    const palette = page.locator('.quick-input-widget')
    await until(
      async () => {
        await page.keyboard.press('F1')
        return palette.isVisible()
      },
      30_000,
      'the command palette',
    )
    await palette.locator('input').fill(`>${title}`)
    const row = palette.locator('.quick-input-list .monaco-list-row', { hasText: title })
    await row.first().waitFor({ timeout: 10_000 })
    await page.keyboard.press('Enter')
    await palette.waitFor({ state: 'hidden' })
  }

  async closeEditors(): Promise<void> {
    await this.runCommand('View: Close All Editors')
  }

  /** Closes the Focus pane, if one is open. */
  async selectNone(): Promise<void> {
    const pane = this.tree().locator('.pane')
    if ((await pane.count()) === 0) return
    await pane.locator('.close').first().click()
    await until(async () => (await pane.count()) === 0, 10_000, 'the Focus pane to close')
    await this.blurTree()
  }

  async blurTree(): Promise<void> {
    await this.page.mouse.move(WINDOW.width - 10, WINDOW.height / 2)
  }

  async openFocus(number: number): Promise<void> {
    await this.selectNone()
    await this.ticketRow(number).locator('.label').click()
    await this.tree().locator('.pane .command, .pane .session').first().waitFor({ timeout: 15_000 })
    await this.blurTree()
  }

  async openMapDetail(): Promise<void> {
    await this.row('Map Search for the docs site').press('Enter')
    await this.detail()
      .locator('h1')
      .filter({ hasText: 'Docs search' })
      .waitFor({ timeout: 30_000 })
    await this.settle()
  }

  async openTicketDetail(number: number): Promise<void> {
    await this.ticketRow(number).press('Enter')
    await this.detail()
      .locator('h1')
      .filter({ hasText: sessionName(number) })
      .waitFor({ timeout: 30_000 })
    await this.detail().locator('.neighbourhood .neighbour').first().waitFor({ timeout: 15_000 })
    await this.settle()
  }

  /** Lets hover fades and caret blinks finish before a shot. */
  async settle(): Promise<void> {
    await this.blurTree()
    await this.page.waitForTimeout(600)
  }

  async rectOf(selector: string): Promise<Rect> {
    const box = await this.page.locator(selector).first().boundingBox()
    if (box === null) throw new Error(`${selector} is not on screen`)
    return box
  }

  sidebar(): Promise<Rect> {
    return this.rectOf('.part.sidebar')
  }

  editor(): Promise<Rect> {
    return this.rectOf('.part.editor')
  }

  /** The editor part from its tab bar to the bottom of the Detail's content, not the empty rest. */
  async detailContent(): Promise<Rect> {
    const editor = await this.editor()
    const frame = await this.rectOf(PANEL_WEBVIEW)
    const bottom = await this.detail()
      .locator('body')
      .evaluate(() =>
        Math.max(
          ...[...document.body.querySelectorAll('*')]
            .filter((element) => element.children.length === 0)
            .map((element) => element.getBoundingClientRect().bottom),
        ),
      )
    return { ...editor, height: Math.min(editor.height, frame.y + bottom + 32 - editor.y) }
  }

  async window(): Promise<Rect> {
    return { x: 0, y: 0, ...WINDOW }
  }

  async sidebarAndPanel(): Promise<Rect> {
    return unionRect([
      await this.rectOf('.part.activitybar'),
      await this.sidebar(),
      await this.rectOf('.part.panel'),
    ])
  }

  async badgeArea(): Promise<Rect> {
    const item = await this.rectOf('.activitybar .action-item:has([aria-label^="Hero Synergy"])')
    const bar = await this.rectOf('.part.activitybar')
    // The activity bar from its top down to two items below the Cockpit's: the badge in context.
    return { x: bar.x, y: bar.y, width: bar.width, height: item.y + item.height * 3 - bar.y }
  }

  async badgeIcon(): Promise<Rect> {
    const item = '.activitybar .action-item:has([aria-label^="Hero Synergy"])'
    return iconSquare(
      await this.rectOf(`${item} .action-label`),
      await this.rectOf('.part.activitybar'),
    )
  }

  async shoot(file: CapturedFile, caption: string, rect: Rect): Promise<Shot> {
    await this.page.waitForTimeout(300)
    const clip = cropRect(rect, WINDOW)
    await this.page.screenshot({ path: path.join(outDir, file), clip, animations: 'disabled' })
    console.log(`shot ${file}`)
    return { file, caption }
  }

  async waitForTheme(kind: 'vs' | 'vs-dark'): Promise<void> {
    await until(
      async () =>
        (await this.page.locator('.monaco-workbench').getAttribute('class'))
          ?.split(' ')
          .includes(kind) ?? false,
      30_000,
      `the ${kind} theme`,
    )
    await this.page.waitForTimeout(1_000)
  }

  /**
   * The loop: ▶ on the frontier ticket, its terminal opening as `#<number> <title>`, the row going
   * from starting to working to waiting for you. Frames are screenshots at CSS scale, timed.
   */
  async recordLaunch(framesDir: string): Promise<{ frames: Frame[]; crop: Rect }> {
    mkdirSync(framesDir, { recursive: true })
    await this.selectNone()
    // The ticket's Detail above and its Focus pane under its row, so the loop shows the command ▶
    // runs. The panel opens on Problems: opened on Terminal with none running, it starts a shell.
    // Panel first: the Tree must hold focus after, or the first click on ▶ only focuses the webview.
    await this.page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+Shift+M' : 'Control+Shift+M',
    )
    await this.page.locator('.part.panel').waitFor()
    await this.ticketRow(SCENE.launched).press('Enter')
    await this.detail()
      .locator('h1')
      .filter({ hasText: sessionName(SCENE.launched) })
      .waitFor({ timeout: 30_000 })
    await this.ticketRow(SCENE.launched).locator('.label').focus()
    await this.blurTree()
    const crop = cropRect(await this.window(), WINDOW)
    const frames: Frame[] = []
    let recording = true
    const start = Date.now()
    const grab = (async () => {
      while (recording) {
        const file = `frame-${String(frames.length).padStart(4, '0')}.png`
        await this.page.screenshot({
          path: path.join(framesDir, file),
          clip: crop,
          scale: 'css',
          animations: 'allow',
        })
        frames.push({ file, at: Date.now() - start })
      }
    })()

    let started: number
    try {
      started = await this.playLaunch()
    } finally {
      recording = false
      await grab
    }
    // The loop opens two seconds before the session shows, however many clicks ▶ took.
    const kept = trimFrames(frames, started - start - 2_000)
    console.log(`loop: ${kept.length} frames over ${kept.at(-1)?.at ?? 0} ms`)
    return { frames: kept, crop }
  }

  /** Plays the launch and returns when its session first showed, in epoch milliseconds. */
  async playLaunch(): Promise<number> {
    await this.page.waitForTimeout(1_200)
    // The pointer travels to ▶ the way a hand would, so the click reads in the loop.
    const row = this.ticketRow(SCENE.launched)
    await row.hover()
    await this.page.waitForTimeout(700)
    writeFileSync(this.stub.scriptFile, '1500 SessionStart startup\n')
    const started = await this.play(SCENE.launched)
    await this.waitForSession(SCENE.launched, /^live|^working/, 15_000)
    // The session claims its ticket first, as /wayfinder does.
    claimTicket(this.workspace, SCENE.launched)
    this.live = [
      ...this.live,
      { ticket: SCENE.launched, status: 'working', sessionId: 'stub-session' },
    ]
    this.serveRegistry()
    await this.waitForSession(SCENE.launched, /^working · /)
    await this.page.waitForTimeout(2_500)
    this.live = this.live.map((session) =>
      session.ticket === SCENE.launched ? { ...session, status: 'waiting for you' } : session,
    )
    this.serveRegistry()
    await this.waitForSession(SCENE.launched, /^waiting for you · /)
    await this.page.waitForTimeout(2_000)
    return started
  }
}

function encodeLoop(frames: Frame[], crop: Rect, framesDir: string): Shot[] {
  const list = path.join(framesDir, 'frames.ffconcat')
  writeFileSync(list, concatList(frames, 1_500))
  const width = Math.min(crop.width, 1200)
  const encoder = webpEncoder(execFileSync('ffmpeg', ['-hide_banner', '-encoders']).toString())
  const outputs: Array<[CapturedFile, string[]]> = [
    ['launch.mp4', mp4Args({ list, width: crop.width, fps: 30 }, path.join(outDir, 'launch.mp4'))],
    ...(encoder === null
      ? []
      : [
          [
            'launch.webp',
            webpArgs({ list, width, fps: 15 }, path.join(outDir, 'launch.webp'), encoder),
          ] as [CapturedFile, string[]],
        ]),
    ['launch.gif', gifArgs({ list, width, fps: 12 }, path.join(outDir, 'launch.gif'))],
  ]
  if (encoder === null) console.log('loop: this ffmpeg has no WebP encoder, so no launch.webp')
  return outputs.map(([file, args]) => {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' })
    console.log(`loop ${file}`)
    return {
      file,
      caption: `The loop as ${path.extname(file).slice(1).toUpperCase()}: ▶, the named terminal, starting to working to waiting for you`,
    }
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sleepUntil(time: number): Promise<void> {
  return sleep(Math.max(0, time - Date.now()))
}

async function until(
  check: () => Promise<boolean>,
  timeout: number,
  what: string,
  interval = 200,
): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error(`Timed out waiting for ${what}`)
}

await main()
