import {
  type Launch,
  type LaunchContext,
  type Snapshot,
  type Ticket,
  type TicketType,
  type WayfinderMap,
  workTicket,
} from '@hero-synergy/core'

import type { ClaudeResolution } from './claude-path.ts'
import type { ActionView } from './protocol.ts'
import { isRunning, type SessionState } from './session.ts'

/**
 * Launching a ticket: the Work ticket Action built from what the window knows.
 * A ticket's session state (`./session.ts`) is keyed on its row key.
 */

/** What launching needs beyond the snapshot. */
export interface Launching {
  readonly sessions: ReadonlyMap<string, SessionState>
  readonly claude: ClaudeResolution
  /** The wayfinder command discovery found (`/wayfinder`, `/mattpocock-skills:wayfinder`); null when not installed. */
  readonly wayfinder: string | null
  readonly pluginPath: string
  readonly eventsFile: string
}

/** Nothing resolved and nothing running: what a Tree shows before the first collect finds out. */
export const NOT_LAUNCHING: Launching = {
  sessions: new Map(),
  claude: { kind: 'missing', reason: 'claude was not found.' },
  wayfinder: null,
  pluginPath: '',
  eventsFile: '',
}

export const NO_WAYFINDER_REASON =
  'The wayfinder skill was not found. Install it with `claude plugins install mattpocock-skills` or `npx skills@latest add mattpocock/skills`.'

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

/** The Work ticket launch for a ticket; null when the wayfinder command is not known. */
export function workTicketLaunch(
  snapshot: Pick<Snapshot, 'repoRoot' | 'tracker'>,
  launching: Pick<Launching, 'wayfinder' | 'pluginPath' | 'eventsFile'>,
  { map, ticket }: Target,
): Launch | null {
  if (launching.wayfinder === null) return null
  const context: LaunchContext = {
    repoRoot: snapshot.repoRoot,
    tracker: snapshot.tracker.kind,
    pluginPath: launching.pluginPath,
    eventsFile: launching.eventsFile,
  }
  return workTicket(context, { wayfinder: launching.wayfinder }, { map, ticket })
}

/** The Work ticket Action a frontier ticket shows, greyed with its reason when it cannot run. */
export function workTicketAction(
  snapshot: Pick<Snapshot, 'repoRoot' | 'tracker'>,
  launching: Launching,
  target: Target,
): ActionView {
  const launch = workTicketLaunch(snapshot, launching, target)
  return {
    label: 'Work ticket',
    command: launch?.command ?? null,
    envLine: launch?.envLine ?? null,
    disabled:
      launching.claude.kind === 'missing'
        ? launching.claude.reason
        : launch === null
          ? NO_WAYFINDER_REASON
          : null,
    note: snapshot.tracker.kind === 'local' ? SHARED_CHECKOUT_NOTE : null,
  }
}
