import { type RegistryEntry, registryStatusWord, type StatusEvent } from '@hero-synergy/core'

import type { SessionView } from './protocol.ts'
import type { TerminalExit } from './services.ts'

/**
 * A ticket's session state machine: a pure reducer from what the Cockpit sees (a launch, a
 * terminal, a status event, a terminal closing) to the state the Tree shows. The state is keyed
 * on the ticket by the caller, never on a session id; ids are only remembered so `SessionEnd`
 * can be final for its own session and a ticket can be resumed by id later.
 */

/** The status word of a live session; null is "live, no status known": the events carry no more than that. */
export type SessionStatus = 'working' | 'waiting' | 'approval' | 'failed'

/** What every state carries. */
interface Common {
  /** The last session id this ticket reported, for resuming it; null when none has. */
  readonly sessionId: string | null
  /** The ids whose `SessionEnd` was seen: final for each of them, whichever line came first. */
  readonly finished: ReadonlyArray<string>
}

/** What the registry lists for one live session: its id and the status word it gives, null when the word is not known. */
export interface Listed {
  readonly sessionId: string
  readonly status: SessionStatus | null
}

/** The registry's word for an entry, in the Cockpit's words; null for a status word Claude Code added after this reader. */
export function listedOf(entry: RegistryEntry): Listed {
  const word = registryStatusWord(entry)
  return {
    sessionId: entry.sessionId,
    status:
      word === 'working'
        ? 'working'
        : word === 'waiting-for-you'
          ? 'waiting'
          : word === 'needs-approval'
            ? 'approval'
            : null,
  }
}

export type SessionState =
  /** A terminal exists (`terminal` is null in the instant before VS Code has created it), no `SessionStart` yet. */
  | (Common & {
      readonly kind: 'starting'
      readonly terminal: number | null
      /** Whether 15 s passed with no status event. */
      readonly hint: boolean
    })
  | (Common & {
      readonly kind: 'live'
      readonly terminal: number | null
      /** The status the last status event gave. The registry's word, while it lists the session, comes first. */
      readonly status: SessionStatus | null
      /** Epoch milliseconds of the last status event. */
      readonly since: number
      /** What the registry says now; null while it lists no such session. */
      readonly registry: { readonly status: SessionStatus | null; readonly since: number } | null
      /** Whether only the registry knows this session: no terminal of ours and no event of its own. */
      readonly adopted: boolean
      /** How many other live sessions carry this ticket's number. */
      readonly duplicates: number
    })
  | (Common & {
      readonly kind: 'ended'
      /** The terminal it ran in, while its close can still add to the detail. */
      readonly terminal: number | null
      /** Why, as text: the `SessionEnd` reason, else the terminal's exit status, else "process gone". */
      readonly detail: string
      /** Whether the detail is a reason the Cockpit trusts, not the fallback. */
      readonly known: boolean
      readonly since: number
    })

export type SessionInput =
  /** ▶ ran: a new terminal is being made. The ticket's remembered id and finished ids carry over. */
  | { readonly type: 'launched'; readonly at: number }
  /** VS Code made the terminal. */
  | { readonly type: 'terminal'; readonly terminal: number }
  /** 15 s passed since the terminal was made. */
  | { readonly type: 'quiet'; readonly terminal: number }
  /** A line of the events file; `at` is when it was written, else when it was read. */
  | { readonly type: 'event'; readonly event: StatusEvent; readonly at: number }
  /** The terminal closed. */
  | {
      readonly type: 'closed'
      readonly terminal: number
      readonly exit: TerminalExit
      readonly at: number
    }
  /** The registry reports the session busy. */
  | { readonly type: 'busy' }
  /** A read of the registry: the live sessions whose name starts with this ticket's number, none when it lists none. */
  | { readonly type: 'registry'; readonly listed: ReadonlyArray<Listed>; readonly at: number }

export const NO_STATUS_HINT =
  'no status yet, the session may be waiting at the trust dialog, open the terminal'

/** How long a terminal may run without a status event before the hint shows. */
export const HINT_AFTER_MS = 15_000

/** Why a session ended, from the terminal's exit status. */
export function describeExit(exit: TerminalExit): string {
  switch (exit.reason) {
    case 'user':
      return 'terminal closed'
    case 'shutdown':
      return 'window closed'
    case 'process':
      return exit.code === null || exit.code === 0 ? 'exited' : `exited with code ${exit.code}`
    case 'extension':
    case 'unknown':
      return 'process gone'
  }
}

/** Reasons that end a session's run but not the ticket's: the same terminal goes on with a new id. */
const CONTINUING_REASONS: ReadonlySet<string> = new Set(['clear', 'resume'])

/** The `SessionEnd` reason as text; null when the payload had none. */
export function describeReason(reason: string | null): string | null {
  if (reason === null || reason === '') return null
  return reason === 'prompt_input_exit' ? 'exited' : reason
}

const NO_FINISHED: ReadonlyArray<string> = []

const withFinished = (
  state: SessionState | undefined,
  id: string | null,
): ReadonlyArray<string> => {
  const known = state?.finished ?? NO_FINISHED
  return id === null || known.includes(id) ? known : [...known, id]
}

/** Starts a session on a ticket whose state may be none, ended or already running. */
const startedBy = (
  state: SessionState | undefined,
  event: StatusEvent,
  at: number,
): SessionState => {
  const sessionId = event.session ?? state?.sessionId ?? null
  const finished = state?.finished ?? NO_FINISHED
  if (state?.kind === 'live' && (event.session === null || event.session === state.sessionId)) {
    // `compact` and `resume` starts of the same session: the status stays, the age restarts.
    return { ...state, since: at, adopted: false }
  }
  return {
    kind: 'live',
    terminal: state?.kind === 'ended' || state === undefined ? null : state.terminal,
    status: null,
    since: at,
    registry: state?.kind === 'live' ? state.registry : null,
    adopted: false,
    duplicates: state?.kind === 'live' ? state.duplicates : 0,
    sessionId,
    finished,
  }
}

const endedBy = (state: SessionState | undefined, event: StatusEvent, at: number): SessionState => {
  const detail = describeReason(event.detail)
  return {
    kind: 'ended',
    terminal: state?.kind === 'ended' || state === undefined ? null : state.terminal,
    detail: detail ?? 'process gone',
    known: detail !== null,
    since: at,
    sessionId: event.session ?? state?.sessionId ?? null,
    finished: withFinished(state, event.session),
  }
}

const onEvent = (
  state: SessionState | undefined,
  event: StatusEvent,
  at: number,
): SessionState | undefined => {
  const id = event.session
  // An id whose session ended is final: a start or failure arriving after its end changes nothing.
  const late = id !== null && state?.finished.includes(id) === true

  switch (event.hook) {
    case 'SessionStart': {
      if (late) return state
      // Ended is absorbing until the next launch: the terminal closing is the truth. A late start
      // still tells the ticket which session it ran.
      if (state?.kind === 'ended') {
        return state.sessionId === null && id !== null ? { ...state, sessionId: id } : state
      }
      return startedBy(state, event, at)
    }
    case 'StopFailure': {
      if (late || state?.kind === 'ended') return state
      // A failure of a session that is not the live one (an older id) is not this ticket's.
      if (
        state?.kind === 'live' &&
        id !== null &&
        state.sessionId !== null &&
        id !== state.sessionId
      ) {
        return state
      }
      const base = startedBy(state, event, at)
      return base.kind === 'live' ? { ...base, status: 'failed', since: at } : base
    }
    case 'SessionEnd': {
      if (late) return state
      const finished = withFinished(state, id)
      if (event.detail !== null && CONTINUING_REASONS.has(event.detail)) {
        // The session id is finished; the ticket is not.
        return state === undefined ? undefined : { ...state, finished }
      }
      if (state?.kind === 'ended') return { ...state, finished }
      // An end for an older id than the live session's arrived after the new start.
      if (
        state?.kind === 'live' &&
        id !== null &&
        state.sessionId !== null &&
        id !== state.sessionId
      ) {
        return { ...state, finished }
      }
      return endedBy(state, event, at)
    }
    default:
      return state
  }
}

/**
 * Registry first: while it lists a session its word is the status. A failure the events reported
 * stays through the registry saying idle (a failed session sits idle), and ends with any other word.
 * Ended is left alone for an id that ended: its entry lingers about a second after exit.
 */
const onRegistry = (
  state: SessionState | undefined,
  listed: ReadonlyArray<Listed>,
  at: number,
): SessionState | undefined => {
  const finished = state?.finished ?? NO_FINISHED
  const alive = listed.filter((entry) => !finished.includes(entry.sessionId))
  if (alive.length === 0) {
    if (state?.kind !== 'live') return state
    if (state.adopted) return undefined
    return state.registry === null && state.duplicates === 0
      ? state
      : { ...state, registry: null, duplicates: 0 }
  }
  const chosen = alive.find((entry) => entry.sessionId === state?.sessionId) ?? alive[0]!
  const duplicates = alive.length - 1
  if (state?.kind !== 'live') {
    return {
      kind: 'live',
      terminal: state?.kind === 'starting' ? state.terminal : null,
      status: null,
      since: at,
      registry: { status: chosen.status, since: at },
      adopted: state?.kind !== 'starting',
      duplicates,
      sessionId: chosen.sessionId,
      finished,
    }
  }
  const same = state.registry !== null && state.registry.status === chosen.status
  return {
    ...state,
    sessionId: chosen.sessionId,
    status:
      chosen.status !== null && chosen.status !== 'waiting' ? clearFailed(state) : state.status,
    registry: same ? state.registry : { status: chosen.status, since: at },
    duplicates,
  }
}

const clearFailed = (state: { readonly status: SessionStatus | null }): SessionStatus | null =>
  state.status === 'failed' ? null : state.status

/** The status a live session shows and since when: the registry's word, else the last status event's. */
export function shownStatus(state: Extract<SessionState, { kind: 'live' }>): {
  readonly status: SessionStatus | null
  readonly since: number
} {
  const listed = state.registry
  if (listed === null || listed.status === null) return { status: state.status, since: state.since }
  if (state.status === 'failed' && listed.status === 'waiting') {
    return { status: 'failed', since: state.since }
  }
  return { status: listed.status, since: listed.since }
}

/** The next state of a ticket's session; undefined stays none. */
export function reduceSession(
  state: SessionState | undefined,
  input: SessionInput,
): SessionState | undefined {
  switch (input.type) {
    case 'launched':
      return {
        kind: 'starting',
        terminal: null,
        hint: false,
        sessionId: state?.sessionId ?? null,
        finished: state?.finished ?? NO_FINISHED,
      }
    case 'terminal':
      return (state?.kind === 'starting' || state?.kind === 'live') && state.terminal === null
        ? { ...state, terminal: input.terminal }
        : state
    case 'quiet':
      return state?.kind === 'starting' && state.terminal === input.terminal
        ? { ...state, hint: true }
        : state
    case 'event':
      return onEvent(state, input.event, input.at)
    case 'busy':
      return state?.kind === 'live' ? { ...state, status: 'working' } : state
    case 'registry':
      return onRegistry(state, input.listed, input.at)
    case 'closed': {
      if (state === undefined) return state
      if (state.kind === 'ended') {
        // An end with no reason takes the exit status once the terminal has one to give.
        return state.known || state.terminal !== input.terminal
          ? state
          : { ...state, detail: describeExit(input.exit), known: input.exit.reason !== 'unknown' }
      }
      if (state.terminal !== input.terminal) return state
      return {
        kind: 'ended',
        terminal: state.terminal,
        detail: describeExit(input.exit),
        known: input.exit.reason !== 'unknown' && input.exit.reason !== 'extension',
        since: input.at,
        sessionId: state.sessionId,
        finished: withFinished(state, state.sessionId),
      }
    }
  }
}

/** The state of a ticket whose events were read at activation, with no terminal of ours to confirm them. */
export function afterReload(state: SessionState, at: number): SessionState {
  if (state.kind === 'ended') return state
  return {
    kind: 'ended',
    terminal: null,
    detail: 'window closed',
    known: true,
    since: at,
    sessionId: state.sessionId,
    finished: state.finished,
  }
}

/** Whether a terminal of the Cockpit is running on the ticket, so ▶ is not offered. */
export const isRunning = (state: SessionState | undefined): boolean =>
  state !== undefined && state.kind !== 'ended'

export const STATUS_WORDS: Readonly<Record<SessionStatus, string>> = {
  working: 'working',
  waiting: 'waiting for you',
  approval: 'needs approval',
  failed: 'failed',
}

/** Whether the session needs me: waiting for you, needs approval, failed. */
export const needsYou = (state: SessionState | undefined): boolean => {
  if (state?.kind !== 'live') return false
  const { status } = shownStatus(state)
  return status === 'waiting' || status === 'approval' || status === 'failed'
}

const duplicateWarning = (duplicates: number): string | null =>
  duplicates === 0
    ? null
    : duplicates === 1
      ? 'Another live session has this ticket’s number'
      : `${duplicates} other live sessions have this ticket’s number`

/** What the Tree is sent for a ticket's session. */
export function sessionView(state: SessionState | undefined): SessionView {
  if (state === undefined) return { kind: 'none' }
  switch (state.kind) {
    case 'starting':
      return { kind: 'starting', hint: state.hint ? NO_STATUS_HINT : null }
    case 'live': {
      const { status, since } = shownStatus(state)
      return {
        kind: 'live',
        status: status === null ? null : STATUS_WORDS[status],
        needsYou: needsYou(state),
        since,
        focusable: state.terminal !== null,
        warning: duplicateWarning(state.duplicates),
      }
    }
    case 'ended':
      return { kind: 'ended', detail: state.detail, since: state.since }
  }
}
