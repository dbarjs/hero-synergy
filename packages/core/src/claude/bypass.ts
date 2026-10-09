import type { TriageLabels } from '../scout/triage-labels.ts'
import type { Ticket } from '../snapshot/model.ts'
import { type Raised, raise } from './health.ts'
import type { Isolation } from './isolation.ts'

/**
 * Bypassed sessions: which Actions start Claude Code with `--permission-mode bypassPermissions`.
 * The ticket decides, not the Action: under `afkTickets` every ticket Action on an AFK ticket
 * carries the flag, resumes included, since `--resume` drops the mode. Plain Actions carry it only
 * under `allSessions`; installs and the scout never. The flag is decided when Actions are planned,
 * so the command the Focus pane shows is the command that is spawned.
 *
 * The Cockpit never accepts Claude Code's bypass dialog, never writes `~/.claude` and never sets
 * `IS_SANDBOX`: every consent to bypass is the person's, given in Claude Code.
 */

/** `heroSynergy.sessions.bypassPermissions`. */
export const bypassModes = ['off', 'afkTickets', 'allSessions'] as const

export type BypassMode = (typeof bypassModes)[number]

/** A setting value that is not one of the modes reads as off. */
export const bypassModeOf = (value: unknown): BypassMode =>
  (bypassModes as ReadonlyArray<unknown>).includes(value) ? (value as BypassMode) : 'off'

/** The argv a bypassed session gains: the permission mode, never `--dangerously-skip-permissions`. */
export const BYPASS_ARGS: ReadonlyArray<string> = ['--permission-mode', 'bypassPermissions']

/** The two settings and what the window is: everything the decision reads. */
export interface BypassPolicy {
  readonly mode: BypassMode
  /** `heroSynergy.sessions.bypassPermissionsOnlyWhenIsolated`. */
  readonly onlyWhenIsolated: boolean
  readonly isolation: Isolation
}

/** Nothing is bypassed: the settings' defaults, and what a reader that reads no settings uses. */
export const NO_BYPASS: BypassPolicy = {
  mode: 'off',
  onlyWhenIsolated: true,
  isolation: { isolated: false, vetoedBy: null, remoteName: null },
}

/**
 * Whether a ticket is AFK: labelled the repo's `ready-for-agent`, or typed research or task and not
 * labelled its `ready-for-human`. A ticket with no type is HITL.
 */
export function isAfkTicket(
  ticket: Pick<Ticket, 'type' | 'labels'>,
  triage: TriageLabels,
): boolean {
  if (ticket.labels.includes(triage.readyForAgent)) return true
  if (ticket.type !== 'research' && ticket.type !== 'task') return false
  return !ticket.labels.includes(triage.readyForHuman)
}

/** What an Action is, for the decision: a ticket session, a plain session, or not a session at all. */
export type BypassTarget =
  /** Work ticket, Launch fresh, Resume (by id), Resume by name. */
  | { readonly kind: 'ticket'; readonly afk: boolean }
  /** Chart a map, To spec, Run skill…, Setup. */
  | { readonly kind: 'plain' }
  /** Install plugin, Install with npx, the scout's background `claude`. */
  | { readonly kind: 'install' }

/** Whether the settings let the flag through in this window at all: a mode is on and the gate passes. */
export const bypassAllowed = (policy: BypassPolicy): boolean =>
  policy.mode !== 'off' && (!policy.onlyWhenIsolated || policy.isolation.isolated)

/** Whether an Action carries the flag. */
export function bypasses(policy: BypassPolicy, target: BypassTarget): boolean {
  if (!bypassAllowed(policy)) return false
  switch (target.kind) {
    case 'install':
      return false
    case 'plain':
      return policy.mode === 'allSessions'
    case 'ticket':
      return policy.mode === 'allSessions' || target.afk
  }
}

/** What the health check reads: the two settings, the isolation result, and who the window runs as. */
export interface BypassHealthInput {
  readonly bypassPermissions: BypassMode
  readonly onlyWhenIsolated: boolean
  readonly isolation: Isolation
  /** The extension host runs as uid 0. */
  readonly root: boolean
  /** `IS_SANDBOX=1` or `CLAUDE_CODE_BUBBLEWRAP` is set in the host's environment. */
  readonly sandboxEnv: boolean
}

const WHERE: Readonly<Record<string, string>> = {
  'ssh-remote': 'Remote-SSH',
  wsl: 'WSL',
  tunnel: 'Remote Tunnel',
}

/** Where the window is and why it did not count, as `bypass-not-isolated` names it. */
export function notIsolatedDetail(isolation: Extract<Isolation, { isolated: false }>): string {
  const where =
    isolation.remoteName === null
      ? 'local window'
      : (WHERE[isolation.remoteName] ?? isolation.remoteName)
  const why =
    isolation.vetoedBy === null ? 'no container marker' : 'a toolbx or distrobox container'
  return `${where}, ${why}`
}

/**
 * The health warnings bypass adds: `bypass-not-isolated` when a mode is on, the gate is on and the
 * window is not isolated; `bypass-refused-as-root` when the flag would be added as root with no
 * sandbox variable, where Claude Code refuses it. Neither gates the flag.
 */
export function bypassHealth(input: BypassHealthInput): ReadonlyArray<Raised> {
  if (input.bypassPermissions === 'off') return []
  if (input.onlyWhenIsolated && !input.isolation.isolated) {
    return [raise('bypass-not-isolated', notIsolatedDetail(input.isolation))]
  }
  return input.root && !input.sandboxEnv ? [raise('bypass-refused-as-root', undefined)] : []
}
