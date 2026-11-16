import type { TriageLabels } from '../scout/triage-labels.ts'
import { modeOf } from '../snapshot/derive.ts'
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
 * Whether a ticket is AFK: marked ready for an agent whatever its type, or typed research or task.
 * A ticket marked for a human is never AFK, even when it is also marked ready for an agent: a
 * ticket marked for a person is never run unattended. A ticket is marked for a human by the repo's
 * triage labels (`docs/agents/triage-labels.md` may rename them), or, on a local tracker, by its
 * triage role, which reads only the five default names, or by a `HITL` note on its type line; it
 * is marked ready for an agent by the label or the role. Any other ticket, one with no type
 * included, is HITL.
 *
 * The type and note are read through `modeOf`, the Tree's mode chip. On a ticket with no triage
 * mark, the chip's HITL keeps the prompts, and its AFK and its task both bypass: #155 runs a task
 * ticket alone even when the tracker doesn't say who drives it. A mark for a human keeps the
 * prompts whatever the chip says; a mark ready for an agent bypasses whatever the chip says, unless
 * the ticket also carries a `HITL` note.
 */
export function isAfkTicket(
  ticket: Pick<Ticket, 'type' | 'modeNote' | 'labels' | 'role'>,
  triage: TriageLabels,
): boolean {
  if (
    ticket.modeNote === 'HITL' ||
    ticket.role === 'ready-for-human' ||
    ticket.labels.includes(triage.readyForHuman)
  )
    return false
  if (ticket.role === 'ready-for-agent' || ticket.labels.includes(triage.readyForAgent)) return true
  const mode = modeOf(ticket)
  return mode === 'AFK' || mode === 'task'
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
