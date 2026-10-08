import {
  chartMap,
  installPlugin,
  installWithNpx,
  isFinished,
  isRunning,
  type Launch,
  type LaunchContext,
  launchFresh,
  placeOf,
  resumeByName,
  runSkill,
  type SessionState,
  setup,
  type Snapshot,
  type Ticket,
  type TicketType,
  toSpec,
  type WayfinderMap,
  workTicket,
} from '@hero-synergy/core'

import type { ClaudeResolution } from './claude-path.ts'
import { type ActionId, type ActionView, REPO_KEY, type Start } from './protocol.ts'

/**
 * Launching: every Action built from what the window knows. A ticket's session
 * state (`./session.ts`) is keyed on its row key. An Action is planned once, from
 * one argv: the view shows its command and the Cockpit spawns it.
 */

/** What launching needs beyond the snapshot. */
export interface Launching {
  readonly sessions: ReadonlyMap<string, SessionState>
  readonly claude: ClaudeResolution
  /** The wayfinder command discovery found (`/wayfinder`, `/mattpocock-skills:wayfinder`); null when not installed. */
  readonly wayfinder: string | null
  /** The to-spec command; null when not installed. */
  readonly toSpec: string | null
  /** The setup-matt-pocock-skills command; null when not installed. */
  readonly setup: string | null
  /** How many user-invoked skills discovery found; null until discovery has run. */
  readonly userInvoked: number | null
  readonly pluginPath: string
  readonly eventsFile: string
  /** The GitHub login of the person at this machine, to tell their claim from someone else's; null when not known. */
  readonly me: string | null
}

/** Nothing resolved and nothing running: what a Tree shows before the first collect finds out. */
export const NOT_LAUNCHING: Launching = {
  sessions: new Map(),
  claude: { kind: 'missing', reason: 'claude was not found.' },
  wayfinder: null,
  toSpec: null,
  setup: null,
  userInvoked: null,
  pluginPath: '',
  eventsFile: '',
  me: null,
}

const INSTALL_HINT =
  'Install it with `claude plugins install mattpocock-skills` or `npx skills@latest add mattpocock/skills`.'

/** Why an Action whose skill is not installed is greyed. */
export const missingSkillReason = (skill: string): string =>
  `The ${skill} skill was not found. ${INSTALL_HINT}`

export const NO_WAYFINDER_REASON = missingSkillReason('wayfinder')

export const PICK_ONE_NOTE = 'Pick one, never both.'

/** The QuickPick's title, which states what choosing does. */
export const RUN_SKILL_TITLE = 'Runs claude "<skill>" in a new terminal'

export const SHARED_CHECKOUT_NOTE =
  'No worktree on a local tracker: this session shares the checkout.'

/** The icon of a ticket session's terminal: the ticket row's type icon. */
export function terminalIcon(type: TicketType | null): string {
  switch (type) {
    case 'research':
      return 'search'
    case 'prototype':
      return 'beaker'
    case 'grilling':
      return 'comment-discussion'
    case 'task':
      return 'checklist'
    case null:
      return 'terminal'
  }
}

/** Whether ▶ may run for a ticket in this state: no terminal running on it. */
export const canLaunchFrom = (state: SessionState | undefined): boolean => !isRunning(state)

type Target = { readonly map: WayfinderMap; readonly ticket: Ticket }

/** How a planned Action starts its terminal. */
export type Spawn =
  /** `claude` is the terminal's own process, never typed into a shell. */
  | 'claude'
  /** The default shell, with the command typed in: the installs, which are not `claude` sessions. */
  | 'shell'

/**
 * One Action, planned: what the pane shows (`view`), what the Cockpit spawns (`launch`, null when
 * no command could be built) and how. A `tracked` Action is a ticket session, started with the
 * status plugin and its env; every other Action is a plain terminal: no plugin, no env, no status.
 */
export interface Planned {
  readonly view: ActionView
  readonly launch: Launch | null
  readonly tracked: boolean
  readonly spawn: Spawn
  /** The terminal's name. */
  readonly name: string
  /** A codicon id for the terminal. */
  readonly icon: string
}

const claudeReason = (launching: Pick<Launching, 'claude'>): string | null =>
  launching.claude.kind === 'missing' ? launching.claude.reason : null

interface PlanOptions {
  readonly launch: Launch | null
  /** The skill the command needs; the Action is greyed with the install hint when it is not found. */
  readonly skill?: { readonly name: string; readonly found: boolean }
  /** Whether the command needs `claude` to run. */
  readonly needsClaude?: boolean
  readonly note?: string | null
  readonly tracked?: boolean
  readonly spawn?: Spawn
  readonly name: string
  readonly icon?: string
}

const plan = (
  launching: Pick<Launching, 'claude'>,
  id: ActionId,
  label: ActionView['label'],
  options: PlanOptions,
): Planned => {
  const { launch } = options
  const needsClaude = options.needsClaude ?? true
  const disabled =
    (needsClaude ? claudeReason(launching) : null) ??
    (options.skill !== undefined && !options.skill.found
      ? missingSkillReason(options.skill.name)
      : null)
  return {
    view: {
      id,
      label,
      command: launch?.command ?? null,
      envLine: launch?.envLine ?? null,
      disabled,
      note: options.note ?? null,
    },
    launch,
    tracked: options.tracked ?? false,
    spawn: options.spawn ?? 'claude',
    name: options.name,
    icon: options.icon ?? 'terminal',
  }
}

const contextOf = (
  snapshot: Pick<Snapshot, 'repoRoot' | 'tracker'>,
  launching: Pick<Launching, 'pluginPath' | 'eventsFile'>,
): LaunchContext => ({
  repoRoot: snapshot.repoRoot,
  tracker: snapshot.tracker.kind,
  pluginPath: launching.pluginPath,
  eventsFile: launching.eventsFile,
})

/**
 * The Actions of a ticket's context, first the one ▶ runs. A frontier ticket offers Work ticket;
 * one claimed elsewhere, Launch fresh; an ended session, Launch fresh then Resume by name; a
 * blocked or closed ticket and a starting session offer none (focus terminal is a button).
 */
export function ticketActions(
  snapshot: Pick<Snapshot, 'repoRoot' | 'tracker'>,
  launching: Launching,
  { map, ticket }: Target,
  key: string,
): ReadonlyArray<Planned> {
  const place = placeOf(ticket)
  if (place === 'blocked' || place === 'closed') return []
  const session = launching.sessions.get(key)
  if (!canLaunchFrom(session)) return []

  const name = `#${ticket.number} ${ticket.title}`
  const icon = terminalIcon(ticket.type)
  const note = snapshot.tracker.kind === 'local' ? SHARED_CHECKOUT_NOTE : null
  const context = contextOf(snapshot, launching)
  const wayfinder = launching.wayfinder
  const ticketSession = (id: ActionId, label: 'Work ticket' | 'Launch fresh'): Planned => {
    const target = { map, ticket }
    const launch =
      wayfinder === null
        ? null
        : (label === 'Work ticket' ? workTicket : launchFresh)(context, { wayfinder }, target)
    return plan(launching, id, label, {
      launch,
      skill: { name: 'wayfinder', found: wayfinder !== null },
      note,
      tracked: true,
      name,
      icon,
    })
  }

  if (session?.kind === 'ended') {
    return [
      ticketSession('launch-fresh', 'Launch fresh'),
      plan(launching, 'resume-by-name', 'Resume by name', {
        launch: resumeByName(context, ticket),
        name,
        icon,
      }),
    ]
  }
  return place === 'frontier'
    ? [ticketSession('work-ticket', 'Work ticket')]
    : [ticketSession('launch-fresh', 'Launch fresh')]
}

/** To spec on a finished map (open, every ticket closed); an unfinished map offers nothing. */
export function mapActions(
  snapshot: Pick<Snapshot, 'repoRoot'>,
  launching: Launching,
  map: WayfinderMap,
): ReadonlyArray<Planned> {
  if (!isFinished(map)) return []
  const command = launching.toSpec
  return [
    plan(launching, 'to-spec', 'To spec', {
      launch: command === null ? null : toSpec(snapshot, { toSpec: command }, map),
      skill: { name: 'to-spec', found: command !== null },
      name: `To spec #${map.number} ${map.title}`,
    }),
  ]
}

/** Chart a map: the wayfinder command with no input, in a plain terminal. */
export function chartMapAction(repoRoot: string, launching: Launching): Planned {
  const command = launching.wayfinder
  return plan(launching, 'chart-map', 'Chart a map', {
    launch: command === null ? null : chartMap({ repoRoot }, { wayfinder: command }),
    skill: { name: 'wayfinder', found: command !== null },
    name: 'Chart a map',
  })
}

/** Run skill…: one discovered command by itself, in a plain terminal. */
export function runSkillAction(repoRoot: string, launching: Launching, command: string): Planned {
  return plan(launching, 'run-skill', 'Run skill…', {
    launch: runSkill({ repoRoot }, command),
    name: command,
  })
}

/** Why the Run skill… palette command cannot offer a list, or null when it can. */
export function runSkillReason(launching: Launching): string | null {
  return (
    claudeReason(launching) ??
    (launching.userInvoked === 0 ? `No user-invoked skill was found. ${INSTALL_HINT}` : null)
  )
}

/** What an empty Tree leads with, by what the repo lacks; no Actions once there is something to show. */
export type Lack = 'tracker-doc' | 'map' | 'other' | 'nothing'

export function startOf(repoRoot: string | null, launching: Launching, lack: Lack): Start {
  const none: Start = { key: REPO_KEY, actions: [], note: null }
  // Before discovery has run nothing is known, so nothing is offered.
  if (repoRoot === null || launching.userInvoked === null) return none
  const views = (planned: ReadonlyArray<Planned>): ReadonlyArray<ActionView> =>
    planned.map((entry) => entry.view)
  if (launching.userInvoked === 0 && lack !== 'nothing') {
    return {
      key: REPO_KEY,
      actions: views(installActions(repoRoot, launching)),
      note: PICK_ONE_NOTE,
    }
  }
  if (lack === 'tracker-doc') {
    return { key: REPO_KEY, actions: views([setupAction(repoRoot, launching)]), note: null }
  }
  if (lack === 'map') {
    return { key: REPO_KEY, actions: views([chartMapAction(repoRoot, launching)]), note: null }
  }
  return none
}

/** Setup: the setup skill by itself, in a plain terminal. */
export function setupAction(repoRoot: string, launching: Launching): Planned {
  const command = launching.setup
  return plan(launching, 'setup', 'Setup', {
    launch: command === null ? null : setup({ repoRoot }, { setup: command }),
    skill: { name: 'setup-matt-pocock-skills', found: command !== null },
    name: 'Setup',
  })
}

/** The two ways to install the skills, typed into the default shell. */
export function installActions(repoRoot: string, launching: Launching): ReadonlyArray<Planned> {
  return [
    plan(launching, 'install-plugin', 'Install the plugin', {
      launch: installPlugin({ repoRoot }),
      spawn: 'shell',
      name: 'Install mattpocock-skills',
    }),
    plan(launching, 'install-npx', 'Install with npx', {
      launch: installWithNpx({ repoRoot }),
      needsClaude: false,
      spawn: 'shell',
      name: 'Install mattpocock-skills',
    }),
  ]
}

/** The Actions of a ticket-less row: the repo's start Actions, by id. */
export function startActionById(
  repoRoot: string,
  launching: Launching,
  id: ActionId,
): Planned | null {
  switch (id) {
    case 'chart-map':
      return chartMapAction(repoRoot, launching)
    case 'setup':
      return setupAction(repoRoot, launching)
    case 'install-plugin':
    case 'install-npx':
      return installActions(repoRoot, launching).find((entry) => entry.view.id === id) ?? null
    default:
      return null
  }
}
