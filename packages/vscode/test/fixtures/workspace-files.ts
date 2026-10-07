import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = join(dirname(fileURLToPath(import.meta.url)), 'workspace')

/** The fixture workspace as `FileSystem.inMemory` takes it, placed under a made-up repo root. */
export function workspaceFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const entry of readdirSync(WORKSPACE, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const absolute = join(entry.parentPath, entry.name)
    const path = relative(WORKSPACE, absolute).split('\\').join('/')
    files[`${root}/${path}`] = readFileSync(absolute, 'utf8')
  }
  return files
}
