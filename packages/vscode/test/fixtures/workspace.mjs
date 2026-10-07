import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(HERE, 'workspace')
const CORE_FIXTURES = path.join(HERE, '../../../core/fixtures')

/**
 * Copies the fixture workspace into `parent/workspace` and makes the copy a git repo of its own,
 * returning its path. The scout resolves a folder to its repo root, and the fixture sits inside
 * this repo, whose tracker is GitHub: opened in place, the window would show this repo's maps.
 * Plain `.mjs` so `.vscode-test.mjs` and the TypeScript end-to-end tier both import it.
 *
 * @param {string} parent an existing or creatable directory the copy goes into
 * @returns {string} the workspace folder to open
 */
export function createWorkspace(parent) {
  const workspace = path.join(parent, 'workspace')
  mkdirSync(workspace, { recursive: true })
  cpSync(SOURCE, workspace, { recursive: true })
  execFileSync('git', ['init', '--quiet', workspace])
  return workspace
}

/**
 * A git repo whose tracker doc says GitHub and whose `origin` is this repo, for the windows that
 * exercise the GitHub collect. `gh` is a stub on the front of `PATH` that answers like the
 * recording in `packages/core/fixtures/github/<recording>.json`: its stdout, stderr and exit code.
 *
 * @param {string} parent an existing or creatable directory the repo and the stub go into
 * @param {string} recording the name of a core GitHub recording, without `.json`
 * @returns {{ workspace: string, bin: string }} the folder to open and the directory holding the stub `gh`
 */
export function createGitHubWorkspace(parent, recording) {
  const workspace = path.join(parent, 'workspace')
  mkdirSync(path.join(workspace, 'docs', 'agents'), { recursive: true })
  writeFileSync(
    path.join(workspace, 'docs', 'agents', 'issue-tracker.md'),
    '# Issue tracker: GitHub\n',
  )
  execFileSync('git', ['init', '--quiet', workspace])
  execFileSync('git', [
    '-C',
    workspace,
    'remote',
    'add',
    'origin',
    'https://github.com/dbarjs/hero-synergy.git',
  ])

  const recorded = JSON.parse(
    readFileSync(path.join(CORE_FIXTURES, 'github', `${recording}.json`), 'utf8'),
  )
  const bin = path.join(parent, 'bin')
  mkdirSync(bin, { recursive: true })
  const stdout = path.join(bin, 'gh.stdout')
  const stderr = path.join(bin, 'gh.stderr')
  writeFileSync(stdout, recorded.stdout)
  writeFileSync(stderr, recorded.stderr)
  writeFileSync(
    path.join(bin, 'gh'),
    `#!/bin/sh\ncat '${stdout}'\ncat '${stderr}' >&2\nexit ${recorded.exitCode}\n`,
    { mode: 0o755 },
  )
  return { workspace, bin }
}

/**
 * A git repo with no tracker doc, so the Tree shows the setup message.
 *
 * @param {string} parent an existing or creatable directory the repo goes into
 * @returns {string} the workspace folder to open
 */
export function createBareWorkspace(parent) {
  const workspace = path.join(parent, 'workspace')
  mkdirSync(workspace, { recursive: true })
  writeFileSync(path.join(workspace, 'README.md'), '# A repo with no tracker doc\n')
  execFileSync('git', ['init', '--quiet', workspace])
  return workspace
}
