import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig } from '@vscode/test-cli'

import { createWorkspace } from './test/fixtures/workspace.mjs'

// Electron's IPC socket lives under the user data dir and Unix caps socket paths at 107
// characters, so keep it out of deep worktree paths (`.claude/worktrees/<slug>` lands near 100).
const scratch = path.join(tmpdir(), 'hero-synergy-vscode-test')
// Every run starts clean: what a window remembers (the open view, the expanded nodes) must not
// leak from one run into the next, or from the floor build into the stable one.
rmSync(scratch, { recursive: true, force: true })

const build = (label, version) => ({
  label,
  version,
  files: 'out-test/**/*.test.cjs',
  // A copy that is a git repo of its own, since the fixture sits inside this repo.
  workspaceFolder: createWorkspace(path.join(scratch, label)),
  launchArgs: ['--disable-extensions', `--user-data-dir=${path.join(scratch, label, 'user-data')}`],
  mocha: { ui: 'bdd', timeout: 20_000 },
})

// Both builds run by default; `vscode-test --label floor` picks one. The floor is
// `engines.vscode` in package.json; CI keys its download cache on this file.
export default defineConfig([build('floor', '1.105.0'), build('stable', 'stable')])
