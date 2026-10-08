import {
  type DriftWarning,
  type HealthContext,
  healthEntryList,
  healthEntryOf,
  healthLabel,
  type Raised,
} from '@hero-synergy/core'

import { entryOf } from './drift.ts'
import type { DriftEntry, HealthRow } from './protocol.ts'

/**
 * The Health row. The level and the copy of every health code are core's table
 * (`healthEntryOf`), the words `next` prints too; what is the Cockpit's own is the dismissal and
 * the pinned row built from the entries.
 */

/** The key the pinned Health row is selected by. */
export const HEALTH_KEY = 'health'

/** The key a health dismissal is stored under: the code at its exact detail, so a changed detail shows again. */
export const healthDismissalKey = (code: string, detail: string | null): string =>
  JSON.stringify(['health', code, detail ?? ''])

export const healthEntry = (raised: Raised, context: HealthContext): DriftEntry => {
  const entry = healthEntryOf(raised, context)
  return { ...entry, dismissKey: healthDismissalKey(entry.code, entry.detail) }
}

/** The snapshot's own warnings: the repo-level drift that lives in the Health row too. */
export const snapshotEntry = (warning: DriftWarning): DriftEntry =>
  entryOf(warning, healthDismissalKey(warning.code, warning.detail ?? null))

/**
 * Every entry the row lists, loud first and each in the order it was raised, with the dismissed
 * ones gone and a code at the same detail listed once.
 */
export const healthEntries = (
  raised: ReadonlyArray<Raised>,
  snapshotWarnings: ReadonlyArray<DriftWarning>,
  context: HealthContext,
  dismissed: ReadonlySet<string>,
): DriftEntry[] =>
  healthEntryList(raised, snapshotWarnings, context)
    .map((entry) => ({ ...entry, dismissKey: healthDismissalKey(entry.code, entry.detail) }))
    .filter((entry) => !dismissed.has(entry.dismissKey))

/** The pinned row: absent when there is nothing, ⚠ when any entry is loud. */
export const healthRowOf = (entries: ReadonlyArray<DriftEntry>): HealthRow | null => {
  const label = healthLabel(entries)
  if (label === null) return null
  const loud = entries.filter((entry) => entry.level === 'loud')
  return {
    key: HEALTH_KEY,
    loud: loud.length > 0,
    label,
    hover: loud.map((entry) => entry.message),
    entries,
  }
}
