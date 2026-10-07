import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig } from '@vscode/test-cli'

// Electron's IPC socket lives under the user data dir and Unix caps socket paths at 107
// characters, so keep it out of deep worktree paths (`.claude/worktrees/<slug>` lands near 100).
const userDataDir = path.join(tmpdir(), 'hero-synergy-vscode-test')

const base = {
  files: 'out-test/**/*.test.cjs',
  workspaceFolder: 'test/fixtures/workspace',
  launchArgs: ['--disable-extensions', `--user-data-dir=${userDataDir}`],
  mocha: { ui: 'bdd', timeout: 20_000 },
}

// Both builds run by default; `vscode-test --label floor` picks one. The floor is
// `engines.vscode` in package.json; CI keys its download cache on this file.
export default defineConfig([
  { label: 'floor', version: '1.105.0', ...base },
  { label: 'stable', version: 'stable', ...base },
])
