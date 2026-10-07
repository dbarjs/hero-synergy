import assert from 'node:assert/strict'
import * as vscode from 'vscode'

import type { ExtensionApi } from '../../src/extension.ts'

/**
 * The extension-host tier on a GitHub repo whose `gh` is a stub replaying the recording of a
 * logged-out run (`.vscode-test.mjs`, label `ghlogin`): the real process runner spawns it, and
 * the Tree has to show the one message with the fix.
 */
describe('hero-synergy on a GitHub repo where gh is not logged in', () => {
  it('shows the one message with `gh auth login` and no maps', async () => {
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
    assert.equal(viewModel.message, 'gh is not logged in to GitHub.')
    assert.match(viewModel.detail ?? '', /gh auth login/)
  })
})
