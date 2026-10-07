import { cpSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'workspace')

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
