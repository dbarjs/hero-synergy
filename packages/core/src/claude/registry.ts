import { Schema } from 'effect'

import type { HealthWarning } from '../snapshot/warnings.ts'
import { attempt, type Decoded, decoder, parseJson, warn } from './decode.ts'

/**
 * Claude Code's registry as `claude agents --json` prints it: an array of
 * entries, one per live session. Only what the Cockpit reads is decoded; new
 * fields are ignored, so a newer Claude Code does not break the reader.
 */

const Entry = Schema.Struct({
  sessionId: Schema.String,
  name: Schema.String,
  // Absent on some background sessions, which carry `state` instead (seen on 2.1.292).
  status: Schema.optionalKey(Schema.String),
  waitingFor: Schema.optionalKey(Schema.String),
  cwd: Schema.optionalKey(Schema.String),
  kind: Schema.optionalKey(Schema.String),
  pid: Schema.optionalKey(Schema.Number),
  startedAt: Schema.optionalKey(Schema.Number),
})

const decodeEntry = decoder(Entry)

/** `unknown` is a status word Claude Code added after this reader, flagged, or no status word at all. The entry is kept either way. */
export type RegistryStatus = 'busy' | 'idle' | 'waiting' | 'unknown'

export interface RegistryEntry {
  readonly sessionId: string
  readonly name: string
  readonly status: RegistryStatus
  /** What a waiting session is blocked on, as Claude Code words it; null when it says nothing. */
  readonly waitingFor: string | null
  readonly cwd: string | null
  readonly kind: string | null
  readonly pid: number | null
  readonly startedAt: number | null
}

/** The status word the Cockpit shows for a registry entry. */
export type RegistryStatusWord = 'working' | 'waiting-for-you' | 'needs-approval' | 'unknown'

const STATUSES: ReadonlyArray<RegistryStatus> = ['busy', 'idle', 'waiting']

/** `claude agents --json` stdout to its entries, one coded warning for each thing it could not read. */
export function readRegistry(stdout: string): Decoded<ReadonlyArray<RegistryEntry>> {
  const parsed = parseJson(stdout)
  if (!parsed.ok) {
    return { value: [], warnings: [warn('registry-unreadable', parsed.message)] }
  }
  if (!Array.isArray(parsed.value)) {
    return { value: [], warnings: [warn('registry-unreadable', 'not an array of entries')] }
  }

  const entries: RegistryEntry[] = []
  const warnings: HealthWarning[] = []
  for (const [index, raw] of parsed.value.entries()) {
    const decoded = attempt(decodeEntry, raw)
    if (!decoded.ok) {
      warnings.push(warn('registry-entry-unreadable', `entry ${index}: ${decoded.message}`))
      continue
    }
    const { status, waitingFor, cwd, kind, pid, startedAt, sessionId, name } = decoded.value
    const known = STATUSES.find((word) => word === status)
    // No status at all is not a new word: the entry is kept as unknown, with nothing to flag.
    if (known === undefined && status !== undefined) {
      warnings.push(warn('registry-status-unknown', status))
    }
    entries.push({
      sessionId,
      name,
      status: known ?? 'unknown',
      waitingFor: waitingFor ?? null,
      cwd: cwd ?? null,
      kind: kind ?? null,
      pid: pid ?? null,
      startedAt: startedAt ?? null,
    })
  }
  return { value: entries, warnings }
}

/**
 * Registry first: the word the registry gives is the status. `busy` is working,
 * `idle` is waiting for you, and `waiting` depends on what it waits for:
 * `input needed` and `dialog open` are waiting for you; `permission prompt`,
 * `sandbox request`, `worker request` and any value not known yet, or none at
 * all, are needing approval, the safe side for a session that is blocked.
 */
export function registryStatusWord(entry: RegistryEntry): RegistryStatusWord {
  switch (entry.status) {
    case 'busy':
      return 'working'
    case 'idle':
      return 'waiting-for-you'
    case 'waiting':
      return entry.waitingFor === 'input needed' || entry.waitingFor === 'dialog open'
        ? 'waiting-for-you'
        : 'needs-approval'
    case 'unknown':
      return 'unknown'
  }
}
