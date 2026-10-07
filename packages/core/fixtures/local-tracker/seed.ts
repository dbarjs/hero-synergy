import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURE = dirname(fileURLToPath(import.meta.url))

/** The fixture tree as `FileSystem.inMemory` takes it, placed under a made-up repo root. */
export function fixtureRepo(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const entry of readdirSync(FIXTURE, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name === 'seed.ts') continue
    const absolute = join(entry.parentPath, entry.name)
    const path = relative(FIXTURE, absolute).split('\\').join('/')
    files[`${root}/${path}`] = readFileSync(absolute, 'utf8')
  }
  return files
}
