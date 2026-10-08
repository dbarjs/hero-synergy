/**
 * The warning catalogue: every code the Cockpit can show, as closed unions.
 *
 * A warning is one coded point. Drift (`WarningCode`) is about the tracker: a
 * map or ticket off the current wayfinder conventions, raised by the scout.
 * Health (`HealthCode`) is about the machine: Claude Code, the skills, the
 * registry, raised by the extension host. The level (loud or quiet) and the copy
 * of each code are tables beside them, `drift-table.ts` and `claude/health.ts`,
 * so the Cockpit and `next` word every warning alike; the code says which kind.
 */

/** Drift codes, by the level they attach to: snapshot, map or ticket. */
export const warningCodes = [
  // snapshot
  'unknown-wayfinder-labels',
  // map
  'map-body-legacy',
  'map-body-partial',
  'map-body-free-form',
  'map-no-destination',
  'decision-line-unparsed',
  'decision-links-open-ticket',
  'children-as-task-list',
  'map-title-from-directory',
  // ticket
  'parent-as-part-of-line',
  'blockers-as-text-line',
  'blockers-as-slugs',
  'type-as-line',
  'type-missing',
  'type-several',
  'claim-legacy-label',
  'no-question-heading',
  'closed-no-resolution',
  'closed-unrecorded',
  'no-map',
  'blocker-outside-map',
  'ticket-title-from-slug',
  'unknown-status',
] as const

export type WarningCode = (typeof warningCodes)[number]

/** Health codes, produced by the extension host, never by the scout. */
export const healthCodes = [
  'claude-not-found',
  'claude-below-floor',
  'claude-version-unreadable',
  'registry-unreadable',
  'registry-entry-unreadable',
  'registry-status-unknown',
  'hook-payload-unreadable',
  'hook-reason-missing',
  'plugin-manifest-unreadable',
  'skill-unreadable',
  'skill-missing',
  'skill-installed-twice',
  'plugin-disabled',
] as const

export type HealthCode = (typeof healthCodes)[number]

/** A drift warning: what the scout found off the current conventions, with the specifics in `detail`. */
export interface DriftWarning {
  readonly code: WarningCode
  readonly detail?: string
}

/** A health warning: what the extension host found wrong on the machine. */
export interface HealthWarning {
  readonly code: HealthCode
  readonly detail?: string
}

/** One coded point about the tracker or the machine; the code says which. */
export type Warning = DriftWarning | HealthWarning

/**
 * Loud when what the Cockpit shows may be wrong or missing; quiet when something old or odd was
 * still read correctly.
 */
export type WarningLevel = 'loud' | 'quiet'

/** A warning with its level and words: a drift or health code once the tables have spoken. */
export interface WarningEntry {
  readonly code: string
  readonly level: WarningLevel
  /** What was found. */
  readonly message: string
  /** The specifics recorded with the code; null when there are none. */
  readonly detail: string | null
  /** One line on the current convention, or the one thing to do. */
  readonly hint: string
}

export const isLoud = (entry: { readonly level: WarningLevel }): boolean => entry.level === 'loud'

const driftCodes: ReadonlySet<string> = new Set(warningCodes)
const machineCodes: ReadonlySet<string> = new Set(healthCodes)

export const isWarningCode = (code: string): code is WarningCode => driftCodes.has(code)
export const isHealthCode = (code: string): code is HealthCode => machineCodes.has(code)
