import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { FileTruth } from './tools/truth.ts'

export type { FileTruth, MapTruth, NoteTruth, TicketTruth, TicketType } from './tools/truth.ts'

const FIXTURE = dirname(fileURLToPath(import.meta.url))

/** The mirror repo, its tracker doc and `.scratch`, as `FileSystem.inMemory` takes it, under a made-up root. */
export function mirrorRepo(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const top of ['docs', '.scratch']) {
    for (const entry of readdirSync(join(FIXTURE, top), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const absolute = join(entry.parentPath, entry.name)
      const path = relative(FIXTURE, absolute).split('\\').join('/')
      files[`${root}/${path}`] = readFileSync(absolute, 'utf8')
    }
  }
  return files
}

/** The careful reading of every Markdown file under the mirror's `.scratch`, by repo-relative path. */
export function mirrorTruth(): ReadonlyArray<FileTruth> {
  const truth = JSON.parse(readFileSync(join(FIXTURE, 'truth.json'), 'utf8')) as {
    files: FileTruth[]
  }
  return truth.files
}
