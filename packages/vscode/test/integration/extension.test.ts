import assert from 'node:assert/strict'
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
    assert.deepEqual(api().state(), { viewResolved: false, spawnedProcesses: 0, viewModel: null })
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
    // `git rev-parse` for the repo root and `git remote` are not needed on a local tracker: one process.
    assert.equal(spawnedProcesses, 1)
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
})
