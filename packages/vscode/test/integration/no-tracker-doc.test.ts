import assert from 'node:assert/strict'
import * as vscode from 'vscode'

import type { ExtensionApi } from '../../src/extension.ts'

/**
 * The extension-host tier on a git repo with no tracker doc (`.vscode-test.mjs`, label `nodoc`):
 * nothing activates the extension on its own, so the test shows the view and the Tree has to say
 * why it has no maps.
 */
describe('hero-synergy in a repo without a tracker doc', () => {
  it('shows the one setup message and no maps', async () => {
    const extension = vscode.extensions.getExtension<ExtensionApi>('dbarjs.hero-synergy')
    assert.ok(extension, 'the development extension is installed in the host')
    const api = await extension.activate()

    await vscode.commands.executeCommand('workbench.view.extension.heroSynergy')
    const deadline = Date.now() + 15_000
    while (api.state().viewModel?.kind !== 'message') {
      if (Date.now() > deadline) assert.fail('timed out waiting for the message')
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const { viewModel } = api.state()
    assert.equal(viewModel?.kind, 'message')
    if (viewModel?.kind !== 'message') return
    assert.equal(viewModel.message, 'This repo has no issue tracker set up.')
    assert.match(viewModel.detail ?? '', /setup-matt-pocock-skills/)
  })
})
