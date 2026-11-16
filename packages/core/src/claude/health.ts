import { driftEntryOf } from '../snapshot/drift-table.ts'
import type { DriftWarning, HealthCode, WarningEntry, WarningLevel } from '../snapshot/warnings.ts'
import {
  type ClaudeVersion,
  claudeVersionFloor,
  isBelowClaudeFloor,
  readClaudeVersion,
} from './version.ts'

/**
 * The health table: the level and the copy of every health code. Health is about the machine
 * (Claude Code, the skills, the registry), raised by whoever reads it, the Cockpit's host or
 * `next`, never by the scout. One rule with drift: loud when what the Cockpit shows may be wrong
 * or missing, quiet when something odd was still read correctly. Every message names the upstream
 * and the version it saw, every hint names the one thing to do, and no entry carries an Action.
 */

/** What the messages name: the Claude Code that was asked, `x.y.z`, or null when it was never read. */
export interface HealthContext {
  readonly claude: string | null
}

interface Copy {
  /** Most codes have one level; `skill-unreadable` depends on which skill. */
  readonly level: WarningLevel | ((detail: string | undefined) => WarningLevel)
  readonly message: (detail: string | undefined, context: HealthContext) => string
  readonly hint: string
}

const quoted = (detail: string | undefined): string => (detail === undefined ? '' : `: ${detail}`)
const parenthesised = (detail: string | undefined): string =>
  detail === undefined ? '' : ` (${detail})`

const claudeCode = (context: HealthContext): string =>
  context.claude === null ? 'Claude Code (version unknown)' : `Claude Code ${context.claude}`

export const formatVersion = ({ major, minor, patch }: ClaudeVersion): string =>
  `${major}.${minor}.${patch}`

const UPDATE_HERO_SYNERGY = 'Check for a Hero Synergy update that reads this Claude Code.'

/** The skills the Cockpit launches: a skill file it cannot read is only loud when it is one of these. */
const NEEDED_SKILLS: ReadonlySet<string> = new Set(['wayfinder', 'to-spec'])

/**
 * The skill folder a `skill-unreadable` detail names: the last word or path segment before the
 * first `: `, as in `plugin 1.2.3 wayfinder: …` or `/repo/.claude/skills/wayfinder: …`.
 */
export const skillOfDetail = (detail: string | undefined): string | null => {
  // The first colon followed by a space: a Windows drive letter's colon is not followed by one.
  const end = detail?.indexOf(': ') ?? -1
  const subject = end < 0 ? detail?.trim() : detail?.slice(0, end).trim()
  if (subject === undefined || subject === '') return null
  return subject.split(/[\s/\\]+/).at(-1) ?? null
}

export const HEALTH_TABLE: Readonly<Record<HealthCode, Copy>> = {
  'claude-not-found': {
    level: 'loud',
    message: (detail) => `Claude Code was not found${quoted(detail)}`,
    hint: 'Install Claude Code, or set heroSynergy.claude.path to the claude binary.',
  },
  'claude-below-floor': {
    level: 'loud',
    message: (detail) =>
      `Claude Code ${detail ?? '(version unknown)'} is older than ${formatVersion(claudeVersionFloor)}; some prompts show as busy in its session list.`,
    hint: 'Run `claude update`, or upgrade through your package manager.',
  },
  'claude-version-unreadable': {
    level: 'quiet',
    message: (detail) =>
      `claude --version did not start with x.y.z${parenthesised(detail)}, so the version was not checked.`,
    hint: 'Run `claude --version` in a terminal to see what it prints.',
  },
  'registry-unreadable': {
    level: 'loud',
    message: (detail, context) =>
      `${claudeCode(context)} printed a session list this version cannot read${parenthesised(detail)}; session statuses show as unknown.`,
    hint: UPDATE_HERO_SYNERGY,
  },
  'registry-entry-unreadable': {
    level: 'loud',
    message: (detail, context) =>
      `${claudeCode(context)} listed a session this version cannot read${parenthesised(detail)}; it is left out.`,
    hint: UPDATE_HERO_SYNERGY,
  },
  'registry-status-unknown': {
    level: 'loud',
    message: (detail, context) =>
      `${claudeCode(context)} reports a session status this version does not know${quoted(detail)}.`,
    hint: UPDATE_HERO_SYNERGY,
  },
  'hook-payload-unreadable': {
    level: 'loud',
    message: (detail, context) =>
      `${claudeCode(context)} sent a status hook this version cannot read${parenthesised(detail)}.`,
    hint: UPDATE_HERO_SYNERGY,
  },
  'hook-reason-missing': {
    level: 'quiet',
    message: (detail, context) =>
      `${claudeCode(context)} ended a session without saying why${parenthesised(detail)}.`,
    hint: 'The ticket shows the terminal’s exit instead; nothing to do.',
  },
  'plugin-manifest-unreadable': {
    level: 'loud',
    message: (detail) => `mattpocock-skills: a plugin manifest could not be read${quoted(detail)}`,
    hint: 'Reinstall the plugin, or run `claude plugin list` to see what Claude Code reports.',
  },
  'skill-unreadable': {
    level: (detail) => {
      const skill = skillOfDetail(detail)
      return skill !== null && NEEDED_SKILLS.has(skill) ? 'loud' : 'quiet'
    },
    message: (detail) => `mattpocock-skills: a skill file could not be read${quoted(detail)}`,
    hint: 'Reinstall mattpocock-skills; wayfinder and to-spec are the skills the Cockpit launches.',
  },
  'skill-missing': {
    level: 'loud',
    message: () => 'mattpocock-skills: the wayfinder skill was not found, so Work ticket is off.',
    hint: 'Install it with `claude plugins install mattpocock-skills` or `npx skills@latest add mattpocock/skills`.',
  },
  'skill-installed-twice': {
    level: 'quiet',
    message: (detail) => `mattpocock-skills: a skill is installed twice${quoted(detail)}`,
    hint: 'Keep one install, the plugin or skills.sh, never both.',
  },
  'plugin-disabled': {
    level: 'quiet',
    message: (detail) =>
      `mattpocock-skills: a plugin that holds a needed skill is off${quoted(detail)}`,
    hint: 'Enable the plugin with `claude plugin enable`.',
  },
  'bypass-not-isolated': {
    level: 'quiet',
    message: (detail) =>
      `Bypass permissions is on, but this window is not an isolated environment${parenthesised(detail)}, so sessions keep their permission prompts.`,
    hint: 'Reopen the folder in a Dev Container, or turn off heroSynergy.sessions.bypassPermissionsOnlyWhenIsolated.',
  },
  'bypass-refused-as-root': {
    level: 'loud',
    message: () =>
      'Claude Code refuses bypass permissions as root, so bypassed sessions exit as soon as they start.',
    hint: "Run the window as a non-root user (a devcontainer's `remoteUser`), or set heroSynergy.sessions.bypassPermissions to off.",
  },
}

/** A health warning as it was raised, with what was seen when the detail is only a summary. */
export interface Raised {
  readonly code: HealthCode
  readonly detail: string | null
  /** The raw text behind the detail (the version line, the failing output), logged but not shown. */
  readonly seen: string | null
}

/** Where a seen text is cut: enough to tell what the upstream printed, not a transcript. */
export const SEEN_LIMIT = 2048

export const raise = (
  code: HealthCode,
  detail: string | undefined,
  seen: string | null = null,
): Raised => ({
  code,
  detail: detail ?? null,
  seen: seen === null ? null : seen.slice(0, SEEN_LIMIT),
})

/** The level of a raised code. */
export const healthLevel = (code: HealthCode, detail: string | null): WarningLevel => {
  const { level } = HEALTH_TABLE[code]
  return typeof level === 'function' ? level(detail ?? undefined) : level
}

/** A raised health warning with its level and words. */
export const healthEntryOf = (raised: Raised, context: HealthContext): WarningEntry => {
  const copy = HEALTH_TABLE[raised.code]
  return {
    code: raised.code,
    level: healthLevel(raised.code, raised.detail),
    message: copy.message(raised.detail ?? undefined, context),
    detail: raised.detail,
    hint: copy.hint,
  }
}

/**
 * Every entry of the Health row, loud first and each in the order it was raised, a code at the
 * same detail listed once. The snapshot's own warnings are repo-level drift, so they live in the
 * row too.
 */
export const healthEntryList = (
  raised: ReadonlyArray<Raised>,
  snapshotWarnings: ReadonlyArray<DriftWarning>,
  context: HealthContext,
): WarningEntry[] => {
  const seen = new Set<string>()
  const all = [
    ...raised.map((entry) => healthEntryOf(entry, context)),
    ...snapshotWarnings.map(driftEntryOf),
  ].filter((entry) => {
    const key = JSON.stringify([entry.code, entry.detail ?? ''])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return [...all.filter((e) => e.level === 'loud'), ...all.filter((e) => e.level === 'quiet')]
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`

/** The words of the Health row: `Health · 2 warnings`, or `Health · 1 note` when none is loud; null when empty. */
export const healthLabel = (
  entries: ReadonlyArray<{ readonly level: WarningLevel }>,
): string | null => {
  if (entries.length === 0) return null
  const loud = entries.filter((entry) => entry.level === 'loud').length
  return `Health · ${loud > 0 ? plural(loud, 'warning', 'warnings') : plural(entries.length, 'note', 'notes')}`
}

/** What `claude --version` printed and how it ended. */
export interface VersionRun {
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
}

/**
 * The floor check on one run of `claude --version` (null when it could not be run): the version
 * it read, null when it read none, and what it raised about it.
 */
export const checkClaudeVersion = (
  run: VersionRun | null,
): { readonly version: string | null; readonly raised: ReadonlyArray<Raised> } => {
  if (run === null || run.exitCode !== 0) {
    const why =
      run === null ? 'it could not be run' : `it exited with ${run.exitCode ?? 'a timeout'}`
    return { version: null, raised: [raise('claude-version-unreadable', why, run?.stderr ?? null)] }
  }
  const read = readClaudeVersion(run.stdout)
  if (read.value === null) {
    return {
      version: null,
      raised: read.warnings.map((warning) => raise(warning.code, warning.detail, run.stdout)),
    }
  }
  const version = formatVersion(read.value)
  return {
    version,
    raised: isBelowClaudeFloor(read.value)
      ? [raise('claude-below-floor', version, run.stdout)]
      : [],
  }
}
