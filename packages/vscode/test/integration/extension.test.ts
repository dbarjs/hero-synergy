import assert from 'node:assert/strict'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import * as vscode from 'vscode'

import type { ExtensionApi } from '../../src/extension.ts'

/**
 * The extension-host tier: Mocha inside a real VS Code, started by
 * `vp run --filter hero-synergy test:integration` on the floor and on stable (ADR 0004).
 * Only what needs the live `vscode` API belongs here; everything else is Vitest.
 *
 * The window is the fixture workspace on the local markdown tracker, copied into its own git
 * repo (`.vscode-test.mjs`). The tests run in order and share one window: the first looks at the
 * extension before the Tree has been shown, the rest show it.
 */

const extension = (): vscode.Extension<ExtensionApi> => {
  const found = vscode.extensions.getExtension<ExtensionApi>('dbarjs.hero-synergy')
  assert.ok(found, 'the development extension is installed in the host')
  return found
}

/** Polls until the condition holds; the host has no event for "the view model went out". */
async function until(what: string, condition: () => boolean, timeout = 15_000): Promise<void> {
  const deadline = Date.now() + timeout
  while (!condition()) {
    if (Date.now() > deadline) assert.fail(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const api = (): ExtensionApi => {
  const exports = extension().exports
  assert.ok(exports, 'the extension has activated and returned its API')
  return exports
}

describe('hero-synergy in the extension host', () => {
  it('runs on a VS Code at or above the floor', () => {
    const [major, minor] = vscode.version.split('.').map(Number)
    assert.ok(major !== undefined && minor !== undefined, `parses ${vscode.version}`)
    assert.ok(major > 1 || (major === 1 && minor >= 105), `${vscode.version} is below 1.105`)
    // Which Node each build runs the tests on; the register records 22.19 (1.105) and 24.21 (1.140).
    console.log(
      `[host] vscode ${vscode.version} electron ${process.versions.electron} node ${process.version} ${process.platform}-${process.arch}`,
    )
  })

  it('activates on the tracker doc, without anyone asking, and spawns nothing', async () => {
    // Never calls `activate()`: only the `workspaceContains` activation event can get it going.
    await until('the extension to activate on the tracker doc', () => extension().isActive)
    assert.deepEqual(api().state(), {
      viewResolved: false,
      spawnedProcesses: 0,
      viewModel: null,
      detailOpen: false,
      detailView: null,
      badge: 0,
    })
    assert.equal(vscode.window.terminals.length, 0)
  })

  it('resolves the view when it is shown and collects once', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.heroSynergy')
    await until('the view to resolve', () => api().state().viewResolved)
    await until('the view model to go out', () => api().state().viewModel?.kind === 'maps')

    const { viewModel, spawnedProcesses } = api().state()
    assert.equal(viewModel?.kind, 'maps')
    if (viewModel?.kind !== 'maps') return
    // Cockpit colors is takeable, Billing rewrite stuck, Archive search finished and folded.
    assert.deepEqual(
      viewModel.maps.map(({ number, title }) => `#${number} ${title}`),
      ['#3 Cockpit colors', '#2 Billing rewrite'],
    )
    assert.deepEqual(
      viewModel.finished?.maps.map(({ number, title }) => `#${number} ${title}`),
      ['#1 Archive search'],
    )
    // `git rev-parse` for the repo root, then the stub `claude plugin list --json` for skill
    // discovery; the remote is not needed on a local tracker.
    assert.equal(spawnedProcesses, 2)
  })

  it('collects again on the Refresh command', async () => {
    const before = api().state().spawnedProcesses
    await vscode.commands.executeCommand('heroSynergy.refresh')
    await until('the refresh to collect', () => api().state().spawnedProcesses > before)
    assert.equal(api().state().viewModel?.kind, 'maps')
  })

  it('rejects a malformed message from the webview and accepts a valid one', async () => {
    assert.equal(await api().receive({ type: 'expand' }), false, 'expand without a key')
    assert.equal(await api().receive({ type: 'run-action' }), false, 'a type nobody sends')
    assert.equal(await api().receive('refresh'), false, 'not an object')
    assert.equal(await api().receive({ type: 'expand', key: 'map:2' }), true)
  })

  it('confirms a selection in the view model and drops it again', async () => {
    assert.equal(await api().receive({ type: 'select', key: 'map:3:map' }), true)
    const confirmed = api().state().viewModel
    assert.equal(confirmed?.kind === 'maps' && confirmed.selection?.key, 'map:3:map')

    assert.equal(await api().receive({ type: 'select', key: null }), true)
    const closed = api().state().viewModel
    assert.equal(closed?.kind === 'maps' && closed.selection, null)
    assert.equal(await api().receive({ type: 'select' }), false, 'select without a key')
  })
  /** The tabs the Detail panel has open: a webview editor of the Detail's view type. */
  const detailTabs = (): vscode.Tab[] =>
    vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter(
        (tab) =>
          tab.input instanceof vscode.TabInputWebview &&
          tab.input.viewType.endsWith('heroSynergy.detail'),
      )

  it('opens the Detail from the command on the first map, and follows the selection', async () => {
    assert.equal(api().state().detailOpen, false)
    await vscode.commands.executeCommand('heroSynergy.openDetail')
    await until('the Detail to open', () => api().state().detailOpen)
    await until('the tab to carry the map', () => detailTabs()[0]?.label === '#3 Cockpit colors')

    const view = api().state().detailView
    assert.equal(view?.detail?.kind, 'map')
    assert.equal(view?.detail?.key, 'map:3:map')
    // Webview panels open as editors of their own, never as a preview that the next file replaces.
    assert.equal(detailTabs().length, 1)
    assert.equal(detailTabs()[0]?.isPreview, false)

    // Selecting another row retitles the same panel: it is reused, not opened again.
    assert.equal(await api().receive({ type: 'select', key: 'map:3:ticket:1' }), true)
    await until('the tab to follow the selection', () => detailTabs()[0]?.label === '#1 Palette')
    assert.equal(detailTabs().length, 1)

    // Asking to open it again reveals the open one.
    assert.equal(
      await api().receive({ type: 'open-detail', key: 'map:3:map', section: 'fog' }),
      true,
    )
    await until('the tab to show the map', () => detailTabs()[0]?.label === '#3 Cockpit colors')
    assert.equal(detailTabs().length, 1)
    assert.equal(api().state().detailView?.section, 'fog')
  })

  it('restores the Detail on the same selection through the serializer', async () => {
    assert.equal(await api().receive({ type: 'select', key: 'map:3:ticket:2' }), true)
    await until('the tab to follow the selection', () => detailTabs()[0]?.label === '#2 Dark mode')

    // A reload closes the panel and VS Code hands a blank one of the same view type to the
    // serializer; closing the tab and creating one here is the same hand-over.
    await vscode.window.tabGroups.close(detailTabs())
    await until('the Detail to close', () => !api().state().detailOpen)
    const blank = vscode.window.createWebviewPanel(
      'heroSynergy.detail',
      'Hero Synergy',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    )
    await api().restoreDetail(blank)
    await until('the restored tab to carry the selection', () => blank.title === '#2 Dark mode')
    assert.equal(api().state().detailOpen, true)
    assert.equal(api().state().detailView?.detail?.key, 'map:3:ticket:2')
    blank.dispose()
  })
})

/** What the stub `claude` recorded, one value per line; the stub writes these when it starts. */
const records = (): string => {
  const dir = process.env.HERO_SYNERGY_STUB_RECORDS
  assert.ok(dir, 'the host was started with HERO_SYNERGY_STUB_RECORDS')
  return dir
}

const recorded = (name: string): string[] =>
  readFileSync(path.join(records(), name), 'utf8').trimEnd().split('\n')

const rowOf = (key: string) => {
  const { viewModel } = api().state()
  if (viewModel?.kind !== 'maps') return undefined
  return viewModel.maps.flatMap((map) => map.tickets).find((ticket) => ticket.key === key)
}

describe('hero-synergy launching a ticket', () => {
  const PALETTE = 'map:3:ticket:1'

  it('creates a terminal that is claude itself, named like the session', async () => {
    const before = vscode.window.terminals.length
    assert.equal(await api().receive({ type: 'launch', key: PALETTE }), true)
    await until('the terminal', () => vscode.window.terminals.length === before + 1)

    const terminal = vscode.window.terminals.at(-1)
    assert.ok(terminal)
    assert.equal(terminal.name, '#1 Palette')
    const options = terminal.creationOptions as vscode.TerminalOptions
    assert.equal(options.name, '#1 Palette')
    assert.equal(options.shellPath, path.join(records(), 'claude'))
    const plugin = path.join(extension().extensionPath, 'claude-plugin')
    assert.deepEqual(options.shellArgs?.slice(0, 4), ['-n', '#1 Palette', '--plugin-dir', plugin])
    assert.equal(
      options.shellArgs?.at(-1),
      '/wayfinder .scratch/cockpit-colors/map.md .scratch/cockpit-colors/issues/01-palette.md',
    )
    assert.ok(!options.shellArgs?.includes('-w'), 'no worktree on a local tracker')
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    assert.ok(folder)
    // macOS temp folders sit behind the /var symlink; VS Code 1.141 hands back the resolved path.
    assert.equal(realpathSync(String(options.cwd)), realpathSync(folder))
    assert.equal(options.env?.HERO_SYNERGY_TICKET, '1')
    assert.match(String(options.env?.HERO_SYNERGY_EVENTS), /events[\\/][0-9a-f]{16}\.jsonl$/)
    assert.equal((options.iconPath as vscode.ThemeIcon).id, 'beaker')
    assert.equal(options.location, vscode.TerminalLocation.Panel)
    assert.equal(options.isTransient ?? false, false)
    assert.equal(options.hideFromUser ?? false, false)
  })

  it('runs the stub with the argv and env it was given, in the repo root', async () => {
    await until('the stub to record', () => existsSync(path.join(records(), 'cwd.txt')))
    const options = vscode.window.terminals.at(-1)?.creationOptions as vscode.TerminalOptions
    assert.deepEqual(recorded('argv.txt'), options.shellArgs)
    const [ticket, events] = recorded('env.txt')
    assert.equal(ticket, '1')
    assert.equal(events, options.env?.HERO_SYNERGY_EVENTS)
    assert.equal(
      realpathSync(recorded('cwd.txt')[0] ?? ''),
      realpathSync(String(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath)),
    )
    // The events file exists before the plugin first appends to it.
    assert.ok(existsSync(String(events)))
  })

  it('shows the ticket as starting, with no second launch', async () => {
    await until('the row to be starting', () => rowOf(PALETTE)?.session.kind === 'starting')
    assert.equal(rowOf(PALETTE)?.action, null)
    const before = vscode.window.terminals.length
    assert.equal(await api().receive({ type: 'launch', key: PALETTE }), true)
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.equal(vscode.window.terminals.length, before)
  })

  it('moves the ticket to ended when its terminal closes', async () => {
    vscode.window.terminals.at(-1)?.show()
    await vscode.commands.executeCommand('workbench.action.terminal.kill')
    await until('the row to be ended', () => rowOf(PALETTE)?.session.kind === 'ended')
    const session = rowOf(PALETTE)?.session
    assert.equal(session?.kind, 'ended')
    assert.equal(session?.kind === 'ended' ? session.detail : null, 'terminal closed')
    // Taking it again is possible.
    assert.equal(rowOf(PALETTE)?.action?.disabled, null)
  })

  it('opens the terminal in the editor area when the setting says so', async () => {
    const settings = vscode.workspace.getConfiguration('heroSynergy')
    await settings.update('sessions.terminalLocation', 'editor', vscode.ConfigurationTarget.Global)
    try {
      const before = vscode.window.terminals.length
      assert.equal(await api().receive({ type: 'launch', key: 'map:3:ticket:3' }), true)
      await until('the terminal', () => vscode.window.terminals.length === before + 1)
      const options = vscode.window.terminals.at(-1)?.creationOptions as vscode.TerminalOptions
      assert.equal(options.name, '#3 Contrast audit')
      assert.equal((options.iconPath as vscode.ThemeIcon).id, 'checklist')
      assert.deepEqual(options.location, { viewColumn: vscode.ViewColumn.Active })
    } finally {
      await settings.update(
        'sessions.terminalLocation',
        undefined,
        vscode.ConfigurationTarget.Global,
      )
      vscode.window.terminals.forEach((terminal) => terminal.dispose())
    }
  })
})
