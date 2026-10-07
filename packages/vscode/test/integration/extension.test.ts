import assert from 'node:assert/strict'
import * as vscode from 'vscode'

/**
 * The extension-host tier: Mocha inside a real VS Code, started by
 * `vp run --filter hero-synergy test:integration` on the floor and on stable (ADR 0004).
 * Only what needs the live `vscode` API belongs here; everything else is Vitest.
 */
describe('hero-synergy in the extension host', () => {
  it('activates', async () => {
    const extension = vscode.extensions.getExtension('dbarjs.hero-synergy')
    assert.ok(extension, 'the development extension is installed in the host')
    await extension.activate()
    assert.equal(extension.isActive, true)
  })

  it('runs on a VS Code at or above the floor', () => {
    const [major, minor] = vscode.version.split('.').map(Number)
    assert.ok(major !== undefined && minor !== undefined, `parses ${vscode.version}`)
    assert.ok(major > 1 || (major === 1 && minor >= 105), `${vscode.version} is below 1.105`)
    // Which Node each build runs the tests on; the register records 22.19 (1.105) and 24.21 (1.140).
    console.log(
      `[host] vscode ${vscode.version} electron ${process.versions.electron} node ${process.version} ${process.platform}-${process.arch}`,
    )
  })
})
