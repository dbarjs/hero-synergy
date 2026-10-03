import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig } from '@vscode/test-cli'

// Electron's IPC socket lives under the user data dir and Unix caps socket
// paths at 107 chars, so keep it out of deep worktree paths.
const userDataDir = path.join(tmpdir(), 'hero-synergy-vscode-test')

const base = {
  files: 'out-test/**/*.test.cjs',
  workspaceFolder: 'test/fixtures/workspace',
  launchArgs: ['--disable-extensions', `--user-data-dir=${userDataDir}`],
  mocha: { ui: 'bdd', timeout: 20_000 },
}

// Both builds run by default; `vscode-test --label floor` picks one.
const configs = [
  { label: 'floor', version: '1.105.0', ...base },
  { label: 'stable', version: 'stable', ...base },
]

// Spike only: `HERO_SYNERGY_ESM=1 vscode-test --label esm-floor --label esm-stable`.
if (process.env.HERO_SYNERGY_ESM) {
  const esm = { ...base, files: 'out-test-esm/**/*.test.mjs' }
  configs.push(
    { label: 'esm-floor', version: '1.105.0', ...esm },
    { label: 'esm-stable', version: 'stable', ...esm },
  )
}

export default defineConfig(configs)
