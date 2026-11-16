import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKSPACE = join(HERE, 'workspace')
/** Core's local-tracker fixture: two maps, a mapless effort and a stray note under `.scratch`. */
const LOCAL_TRACKER = join(HERE, '../../../core/fixtures/local-tracker')

/** Every file under `directory` as `FileSystem.inMemory` takes it, placed under a made-up repo root. */
function treeFiles(directory: string, root: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const absolute = join(entry.parentPath, entry.name)
    const path = relative(directory, absolute).split('\\').join('/')
    files[`${root}/${path}`] = readFileSync(absolute, 'utf8')
  }
  return files
}

/** The fixture workspace as `FileSystem.inMemory` takes it, placed under a made-up repo root. */
export function workspaceFiles(root: string): Record<string, string> {
  return treeFiles(WORKSPACE, root)
}

/** Core's local-tracker fixture, placed the same way. */
export function localTrackerFiles(root: string): Record<string, string> {
  return treeFiles(LOCAL_TRACKER, root)
}
