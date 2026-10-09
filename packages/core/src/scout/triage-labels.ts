import { Effect } from 'effect'

import { FileSystem } from '../file-system.ts'
import { lines } from '../snapshot/markdown.ts'
import { joinPath } from './paths.ts'

/**
 * The repo's triage label strings. `/setup-matt-pocock-skills` writes {@link TRIAGE_LABELS_PATH}: a
 * table from each canonical role to the label the tracker uses, which a repo may rename. Only the
 * two roles the AFK ticket rule reads are kept. A wrong name only means fewer sessions bypass.
 */

export const TRIAGE_LABELS_PATH = 'docs/agents/triage-labels.md'

export interface TriageLabels {
  /** The label on a ticket ready for an AFK agent. */
  readonly readyForAgent: string
  /** The label on a ticket that requires a human. */
  readonly readyForHuman: string
}

export const DEFAULT_TRIAGE_LABELS: TriageLabels = {
  readyForAgent: 'ready-for-agent',
  readyForHuman: 'ready-for-human',
}

const cellText = (cell: string): string =>
  cell
    .trim()
    .replace(/^`(.*)`$/, '$1')
    .trim()

/**
 * The two label strings a triage-labels table names: the right-hand column of the
 * `ready-for-agent` and `ready-for-human` rows. A missing row, or an empty cell, keeps the default.
 */
export function readTriageLabels(markdown: string): TriageLabels {
  const found: Record<string, string> = {}
  for (const raw of lines(markdown)) {
    const line = raw.trim()
    if (!line.startsWith('|')) continue
    const cells = line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(cellText)
    const [role, label] = cells
    if (role === undefined || label === undefined || label === '') continue
    if (!(role in found)) found[role] = label
  }
  return {
    readyForAgent: found['ready-for-agent'] ?? DEFAULT_TRIAGE_LABELS.readyForAgent,
    readyForHuman: found['ready-for-human'] ?? DEFAULT_TRIAGE_LABELS.readyForHuman,
  }
}

/** The repo's triage labels; the defaults, silently, when the file is missing or unreadable. */
export function triageLabelsOf(repoRoot: string): Effect.Effect<TriageLabels, never, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem
    return yield* fs.readFile(joinPath(repoRoot, TRIAGE_LABELS_PATH)).pipe(
      Effect.map(readTriageLabels),
      Effect.catch(() => Effect.succeed(DEFAULT_TRIAGE_LABELS)),
    )
  })
}
