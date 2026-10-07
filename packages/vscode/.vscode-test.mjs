import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig } from '@vscode/test-cli'

import {
  createBareWorkspace,
  createGitHubWorkspace,
  createLaunchableWorkspace,
  writeUserSettings,
} from './test/fixtures/workspace.mjs'

// Electron's IPC socket lives under the user data dir and Unix caps socket paths at 107
// characters (104 on macOS, whose temp dir is already 49), so keep it out of deep worktree paths
// (`.claude/worktrees/<slug>` lands near 100) and the names here short: the socket is
// `<scratch>/<label>/ud/1.14-main.sock`.
const scratch = path.join(tmpdir(), 'hs-vscode-test')
// Every run starts clean: what a window remembers (the open view, the expanded nodes) must not
// leak from one run into the next, or from the floor build into the stable one.
rmSync(scratch, { recursive: true, force: true })

const build = (label, version, { files, workspaceFolder, env }) => ({
  label,
  version,
  files,
  // A copy that is a git repo of its own, since the fixture sits inside this repo.
  workspaceFolder,
  ...(env === undefined ? {} : { env }),
  launchArgs: ['--disable-extensions', `--user-data-dir=${path.join(scratch, label, 'ud')}`],
  mocha: { ui: 'bdd', timeout: 20_000 },
})

// The window launches sessions against a stub `claude` named in the user settings (the setting is
// machine-scoped, so a workspace file could not carry it). The test reads what the stub recorded
// from `HERO_SYNERGY_STUB_RECORDS`.
const local = (label, version) => {
  const launchable = createLaunchableWorkspace(path.join(scratch, label))
  writeUserSettings(path.join(scratch, label, 'ud'), {
    'heroSynergy.claude.path': launchable.claude,
  })
  return build(label, version, {
    files: 'out-test/extension.test.cjs',
    workspaceFolder: launchable.workspace,
    env: { HERO_SYNERGY_STUB_RECORDS: path.dirname(launchable.claude) },
  })
}

// The windows that look at the Tree's one-message cases, each on the floor only: a repo with no
// tracker doc, and a GitHub repo whose `gh` (a stub replaying a recording) is not logged in.
const noDoc = build('nodoc', '1.105.0', {
  files: 'out-test/no-tracker-doc.test.cjs',
  workspaceFolder: createBareWorkspace(path.join(scratch, 'nodoc')),
})
const github = createGitHubWorkspace(path.join(scratch, 'ghlogin'), 'list-not-logged-in')
const notLoggedIn = build('ghlogin', '1.105.0', {
  files: 'out-test/not-logged-in.test.cjs',
  workspaceFolder: github.workspace,
  env: { PATH: `${github.bin}${path.delimiter}${process.env.PATH}` },
})

// Every build runs by default; `vscode-test --label floor` picks one. The floor is
// `engines.vscode` in package.json; CI keys its download cache on this file.
export default defineConfig([
  local('floor', '1.105.0'),
  local('stable', 'stable'),
  noDoc,
  notLoggedIn,
])
