import assert from 'node:assert/strict'
import * as vscode from 'vscode'

describe('hero-synergy in the extension host', () => {
  it('activates', async () => {
    const extension = vscode.extensions.getExtension('dbarjs.hero-synergy')
    assert.ok(extension, 'extension is installed in the development host')
    await extension.activate()
    assert.equal(extension.isActive, true)
  })

  it('reports the host it runs on', () => {
    // Recorded by the spike: which Node the tests run on, per VS Code build.
    console.log(
      `[host] vscode ${vscode.version} electron ${process.versions.electron} node ${process.version} arch ${process.arch}`,
    )
    assert.equal(typeof process.versions.electron, 'string')
  })
})
