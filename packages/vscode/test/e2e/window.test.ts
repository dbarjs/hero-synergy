import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { renderCommand } from '@hero-synergy/core'
import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import {
  _electron as electron,
  type ElectronApplication,
  type Locator,
  type Page,
} from 'playwright'
import { afterAll, beforeAll, expect, it, onTestFailed } from 'vite-plus/test'

import { createLaunchableWorkspace, writeUserSettings } from '../fixtures/workspace.mjs'

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
// What the stub `claude` named in the user settings records when a session starts, the script it
// plays on start (one status event per line) and when it wrote each event.
let argvFile: string
let scriptFile: string
let writtenFile: string

beforeAll(async () => {
  const executablePath = await downloadAndUnzipVSCode({ version: 'stable', cachePath })
  // Electron's IPC socket lives under the user data dir; Unix caps socket paths at 107 characters.
  scratch = mkdtempSync(path.join(tmpdir(), 'hero-synergy-e2e-'))
  const launchable = createLaunchableWorkspace(path.join(scratch, 'repo'))
  workspaceDir = launchable.workspace
  argvFile = launchable.argvFile
  scriptFile = launchable.scriptFile
  writtenFile = launchable.writtenFile
  // The setting is machine-scoped: the window reads it from the user settings, not the repo.
  writeUserSettings(path.join(scratch, 'user-data'), {
    'heroSynergy.claude.path': launchable.claude,
  })
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
// VS Code marks a view's webview with `purpose=webviewView` in the iframe's source; a panel's has none.
const VIEW_WEBVIEW = 'iframe.webview[src*="purpose=webviewView"]'
const PANEL_WEBVIEW = 'iframe.webview:not([src*="purpose=webviewView"])'

const tree = () => page.frameLocator(VIEW_WEBVIEW).frameLocator('iframe#active-frame')

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

/** The Detail's page: the webview of the editor tab, the one that is not a view. */
const detail = () => page.frameLocator(PANEL_WEBVIEW).frameLocator('iframe#active-frame')

/** The editor tab the Detail is in, by the `#number title` it carries. */
const detailTab = (title: string) =>
  page.locator('.part.editor .tabs-container .tab', { hasText: title })

/** What a locator's text is, polled: Vitest's `expect` has no Playwright matchers. */
const textOf = (locator: Locator, timeout = 30_000) =>
  expect.poll(async () => (await locator.textContent()) ?? '', { timeout })
const textsOf = (locator: Locator, timeout = 30_000) =>
  expect.poll(() => locator.allTextContents(), { timeout })
const attributeOf = (locator: Locator, name: string, timeout = 30_000) =>
  expect.poll(() => locator.getAttribute(name), { timeout })

/** A neighbourhood column's entries as they read: `#number title state`. */
const neighbours = (column: 'waits-on' | 'clears-the-way'): Promise<string[]> =>
  detail()
    .locator(`.neighbourhood .${column} .neighbour`)
    .evaluateAll((items) =>
      items.map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim()),
    )

it('opens the Detail on Enter and follows the selection', async () => {
  onTestFailed(() => captureFailure('detail'))
  await row('#1 Palette').press('Enter')

  await detailTab('#1 Palette').waitFor({ timeout: 30_000 })
  await detail().locator('h1').filter({ hasText: '#1 Palette' }).waitFor({ timeout: 30_000 })
  // The body went through the Markdown renderer: `## Question` is a heading.
  await textOf(detail().locator('.body h2')).toBe('Question')
  await textOf(detail().locator('.body')).toContain('Which five colors')
  await textsOf(detail().locator('.neighbourhood .column h2')).toEqual([
    'Waits on',
    'Clears the way for',
  ])
  expect(await neighbours('waits-on')).toEqual([])
  expect(await neighbours('clears-the-way')).toEqual(['#2 Dark mode open'])
  // The Tree shows the same selection.
  await attributeOf(row('#1 Palette'), 'aria-selected').toBe('true')

  // Another row updates the one Detail instead of opening a second.
  await row('#3 Contrast audit').click()
  await detail().locator('h1').filter({ hasText: '#3 Contrast audit' }).waitFor()
  await detailTab('#3 Contrast audit').waitFor()
  await expect.poll(() => page.locator('.part.editor .tabs-container .tab').count()).toBe(1)
})

it('selects a neighbour clicked in the Detail and unfolds its map', async () => {
  onTestFailed(() => captureFailure('detail-neighbour'))
  await row('#1 Palette').click()
  await detail().locator('h1').filter({ hasText: '#1 Palette' }).waitFor()

  // Fold the map away: the Tree no longer shows the tickets.
  await row('#3 Cockpit colors').click()
  await expect.poll(treeRows, { timeout: 15_000 }).not.toContain('#2 Dark mode | waits on #1 | AFK')

  await detail().locator('.clears-the-way .neighbour', { hasText: '#2 Dark mode' }).click()
  await detail().locator('h1').filter({ hasText: '#2 Dark mode' }).waitFor()
  await attributeOf(row('#2 Dark mode'), 'aria-selected', 15_000).toBe('true')
  await row('#2 Dark mode').waitFor({ state: 'visible' })
  expect(await neighbours('waits-on')).toEqual(['#1 Palette open'])
})

it('opens a map at the section its Fog or Decisions row names', async () => {
  onTestFailed(() => captureFailure('detail-sections'))
  await row('Fog').press('Enter')
  await detail().locator('h1').filter({ hasText: '#3 Cockpit colors' }).waitFor({ timeout: 30_000 })
  await attributeOf(detail().locator('.section.fog'), 'class').toMatch(/targeted/)
  await textOf(detail().locator('.section.fog')).toContain('Spacing, once the palette is fixed.')
  await textsOf(detail().locator('.section h2')).toEqual([
    'Destination',
    'Decisions so far',
    'Not yet specified',
    'Out of scope',
  ])
  await textOf(detail().locator('.section.out-of-scope')).toContain('Custom user themes')

  await row('Decisions').first().press('Enter')
  await attributeOf(detail().locator('.section.decisions'), 'class').toMatch(/targeted/)
  await attributeOf(detail().locator('.section.fog'), 'class').not.toMatch(/targeted/)
  await textOf(detail().locator('.section.decisions')).toContain('Codicons')
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

it('launches the next ticket from ▶ with the command the Focus pane showed', async () => {
  onTestFailed(() => captureFailure('launch'))
  // Open the pane under the next ticket (an AFK one: it launches like any other).
  await row('#2 Dark mode').click()
  const command = tree().locator('.pane .command')
  await command.waitFor({ timeout: 15_000 })
  const shown = (await command.innerText()).trim()
  expect(shown).toMatch(/^claude -n '#2 Dark mode' --plugin-dir /)
  expect(shown).not.toContain(' -w ')
  expect(await tree().locator('.pane .shared').innerText()).toContain('shares the checkout')

  await row('#2 Dark mode').locator('.play').click()

  // The stub records its argv when VS Code starts it as the terminal's own process.
  await expect.poll(() => existsSync(argvFile), { timeout: 30_000, interval: 500 }).toBe(true)
  const argv = readFileSync(argvFile, 'utf8').trimEnd().split('\n')
  expect(renderCommand(['claude', ...argv])).toBe(shown)

  // The terminal is named like the session, and the row now offers focus terminal, not ▶.
  await expect
    .poll(() => page.locator('.part.panel').filter({ hasText: '#2 Dark mode' }).count(), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0)
  await expect.poll(() => row('#2 Dark mode').locator('.play').count(), { timeout: 15_000 }).toBe(0)
  await expect
    .poll(() => row('#2 Dark mode').locator('.focus-terminal').count(), { timeout: 15_000 })
    .toBe(1)
})

/** When the stub wrote the event of this hook, in epoch milliseconds; null before it did. */
const writtenAt = (hook: string): number | null => {
  if (!existsSync(writtenFile)) return null
  const line = readFileSync(writtenFile, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(`${hook} `))
  return line === undefined ? null : Number(line.slice(hook.length + 1))
}

it('shows a session live, then ended "exited", as its status events arrive', async () => {
  onTestFailed(() => captureFailure('session-status'))
  // The stub plays this on start, as the status plugin would write it: a start, then an exit.
  writeFileSync(scriptFile, '1500 SessionStart startup\n2500 SessionEnd prompt_input_exit\n')
  const ticket = row('#3 Contrast audit')
  await ticket.locator('.play').click()
  const session = ticket.locator('.session')
  const sessionText = async () => ((await session.textContent().catch(() => '')) ?? '').trim()

  await expect.poll(sessionText, { timeout: 30_000, interval: 50 }).toMatch(/^live · \d+[smhd]$/)
  const sawLive = Date.now()
  const started = writtenAt('SessionStart')
  expect(started).not.toBeNull()
  // About a second from the event to the Tree.
  expect(sawLive - (started ?? 0)).toBeLessThan(2_000)

  await expect.poll(sessionText, { timeout: 30_000, interval: 50 }).toBe('ended · exited')
  const sawEnded = Date.now()
  const finished = writtenAt('SessionEnd')
  expect(finished).not.toBeNull()
  expect(sawEnded - (finished ?? 0)).toBeLessThan(2_000)

  // The Focus pane says the same, with the age; an ended session offers ▶ again.
  await ticket.click()
  await expect
    .poll(() => tree().locator('.pane .session dd').innerText(), { timeout: 15_000 })
    .toMatch(/^ended: exited · \d+[smhd] ago$/)
  await expect.poll(() => ticket.locator('.play').count(), { timeout: 15_000 }).toBe(1)
})

it('reopens the Detail on the last selection after the window reloads', async () => {
  onTestFailed(() => captureFailure('detail-reload'))
  await row('#3 Contrast audit').click()
  await detail().locator('h1').filter({ hasText: '#3 Contrast audit' }).waitFor()

  await runCommand('Developer: Reload Window')
  // The serializer hands the panel back; its tab and its page carry the stored selection.
  await detailTab('#3 Contrast audit').waitFor({ timeout: 60_000 })
  await detail().locator('h1').filter({ hasText: '#3 Contrast audit' }).waitFor({ timeout: 60_000 })
  await expect.poll(() => page.locator('.part.editor .tabs-container .tab').count()).toBe(1)
})

/** The title bar's Refresh, by its exact label: the Explorer has a hidden "Refresh Explorer". */
const refresh = () =>
  page.locator('.part.sidebar .action-label[aria-label="Refresh"]:visible').click()

it('marks a legacy map for its loud ticket and ends its Detail with the Drift section', async () => {
  onTestFailed(() => captureFailure('drift-legacy-map'))
  // A map in the Fog form an older mattpocock-skills wrote (quiet), with a ticket that waits on a
  // name instead of a number (loud).
  const mapDir = path.join(workspaceDir, '.scratch/legacy-notes')
  mkdirSync(path.join(mapDir, 'issues'), { recursive: true })
  writeFileSync(
    path.join(mapDir, 'map.md'),
    '# Legacy notes\n\n## Destination\n\nName the thing.\n\n## Notes\n\nThe old form.\n\n## Decisions so far\n\n## Fog\n\n- Later.\n',
  )
  writeFileSync(path.join(mapDir, 'issues/01-pick-a-name.md'), pickAName('naming-convention'))
  await refresh()

  await expect
    .poll(() => row('#4 Legacy notes').locator('.warn').count(), { timeout: 30_000, interval: 500 })
    .toBe(1)
  // A map with no drift beside it stays unmarked. (Cockpit colors is marked since the refresh test
  // resolved #1 without recording it in the map: a real `closed-unrecorded`.)
  expect(await row('#2 Billing rewrite').locator('.warn').count()).toBe(0)

  await row('#4 Legacy notes').click()
  await row('Map Name the thing.').press('Enter')
  await detail().locator('h1').filter({ hasText: '#4 Legacy notes' }).waitFor({ timeout: 30_000 })
  await textsOf(detail().locator('.section h2')).toEqual([
    'Destination',
    'Decisions so far',
    'Not yet specified',
    'Out of scope',
    'Drift',
  ])
  await textOf(detail().locator('#section-drift')).toContain('naming-convention')
  expect(await detail().locator('.chip').count()).toBe(1)
})

it('keeps a dismissed drift entry hidden after the window reloads, until its detail changes', async () => {
  onTestFailed(() => captureFailure('drift-dismiss'))
  await row('#1 Pick a name').click()
  await detail().locator('h1').filter({ hasText: '#1 Pick a name' }).waitFor({ timeout: 30_000 })
  await detail().locator('#section-drift .dismiss').first().click()
  await expect.poll(() => detail().locator('#section-drift').count(), { timeout: 30_000 }).toBe(0)

  await runCommand('Developer: Reload Window')
  await detailTab('#1 Pick a name').waitFor({ timeout: 60_000 })
  await detail().locator('h1').filter({ hasText: '#1 Pick a name' }).waitFor({ timeout: 60_000 })
  expect(await detail().locator('#section-drift').count()).toBe(0)

  // The ticket now waits on another name: the same code at a new detail shows again.
  writeFileSync(
    path.join(workspaceDir, '.scratch/legacy-notes/issues/01-pick-a-name.md'),
    pickAName('naming-rules'),
  )
  await refresh()
  await textOf(detail().locator('#section-drift')).toContain('naming-rules')
})

function pickAName(slug: string): string {
  return `# Pick a name\n\nType: grilling\nBlocked by: ${slug}\n\n## Question\n\nWhat is it called?\n`
}
