import { type RegistryEntry, registryStatusWord } from '../claude/registry.ts'
import type { StatusEvent } from '../claude/status-event.ts'

/** How a terminal ended, from VS Code's exit status. */
export interface TerminalExit {
  readonly reason: 'user' | 'shutdown' | 'process' | 'extension' | 'unknown'
  readonly code: number | null
}

/**
 * A ticket's session as the Tree and `next` show it: none, starting while its terminal has reported
 * nothing, live once it has, ended once it is over. `since` is the epoch milliseconds of the status
 * shown: the registry's last change, else the last status event. A reader shows the time since, so
 * the age is never a timer of the host's.
 */
export type SessionView =
  | { readonly kind: 'none' }
  /** `hint` is the line shown once the terminal has been quiet for 15 s; null before. */
  | { readonly kind: 'starting'; readonly hint: string | null }
  /** `status` is the word (working, waiting for you, needs approval, failed), null when none is known. */
  | {
      readonly kind: 'live'
      readonly status: string | null
      readonly needsYou: boolean
      readonly since: number
      /** Whether a terminal of the Cockpit runs it, so focus terminal has somewhere to go. */
      readonly focusable: boolean
      /** The warning for a second live session with the same ticket number; null when there is none. */
      readonly warning: string | null
    }
  | { readonly kind: 'ended'; readonly detail: string; readonly since: number }

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
  /** The session's name as the registry lists it, `#<number> <title>` for a ticket's. */
  readonly name: string | null
}

/** The registry's word for an entry, in the Cockpit's words; null for a status word Claude Code added after this reader. */
export function listedOf(entry: RegistryEntry): Listed {
  const word = registryStatusWord(entry)
  return {
    sessionId: entry.sessionId,
    name: entry.name,
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
      /** Whether the launch carried the bypass flag, so the hint names the bypass dialog too. */
      readonly bypassed: boolean
    })
  | (Common & {
      readonly kind: 'live'
      readonly terminal: number | null
      /** The status the last status event gave. The registry's word, while it lists the session, comes first. */
      readonly status: SessionStatus | null
      /** Epoch milliseconds of the last status event. */
      readonly since: number
      /** Epoch milliseconds the session went live; a `compact` or `resume` start of the same session keeps it. */
      readonly startedAt: number
      /** The name the registry gave it; null until the registry has listed it. */
      readonly name: string | null
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
  | { readonly type: 'launched'; readonly at: number; readonly bypassed?: boolean }
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
  /** After a reload: a terminal of the window is named for this ticket, so it is the ticket's terminal. */
  | { readonly type: 'adopt'; readonly terminal: number }
  /** The registry reports the session busy. */
  | { readonly type: 'busy' }
  /** A session with no ticket in view is no longer listed: it ends, and the record stays. */
  | { readonly type: 'vanished'; readonly at: number }
  /** A read of the registry: the live sessions whose name starts with this ticket's number, none when it lists none. */
  | { readonly type: 'registry'; readonly listed: ReadonlyArray<Listed>; readonly at: number }

export const NO_STATUS_HINT =
  'no status yet, the session may be waiting at the trust dialog, open the terminal'

/** The hint of a bypassed launch: Claude Code's one-time bypass dialog leaves no registry entry either. */
export const BYPASS_NO_STATUS_HINT =
  'no status yet, the session may be waiting at the trust or bypass-permissions dialog, open the terminal'

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
    startedAt: at,
    name: state?.kind === 'live' ? state.name : null,
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
      startedAt: at,
      name: chosen.name,
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
    name: chosen.name ?? state.name,
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
        bypassed: input.bypassed ?? false,
        sessionId: state?.sessionId ?? null,
        finished: state?.finished ?? NO_FINISHED,
      }
    case 'terminal':
      return (state?.kind === 'starting' || state?.kind === 'live') && state.terminal === null
        ? { ...state, terminal: input.terminal }
        : state
    case 'adopt':
      // The events already say what the session was; a ticket they never named has a terminal and
      // no word yet, which the registry then confirms.
      if (state === undefined) {
        return {
          kind: 'starting',
          terminal: input.terminal,
          hint: false,
          bypassed: false,
          sessionId: null,
          finished: NO_FINISHED,
        }
      }
      return state.terminal === null ? { ...state, terminal: input.terminal } : state
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
    case 'vanished':
      return state?.kind === 'live'
        ? {
            kind: 'ended',
            terminal: state.terminal,
            detail: 'process gone',
            known: false,
            since: input.at,
            sessionId: state.sessionId,
            finished: withFinished(state, state.sessionId),
          }
        : state
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

/**
 * Whether a session left live between two states of a ticket: it ended or was forgotten, or the
 * registry stopped listing a live one. Each is a cause for the tracker to be read again.
 */
export const sessionLeft = (
  before: SessionState | undefined,
  after: SessionState | undefined,
): boolean =>
  (isRunning(before) && !isRunning(after)) ||
  (before?.kind === 'live' &&
    before.registry !== null &&
    after?.kind === 'live' &&
    after.registry === null)
/** The ticket number a terminal's name starts with (`#12 Which database`), else null. */
export function ticketOfTerminalName(name: string): number | null {
  const match = /^#(\d+)(?!\d)/.exec(name)
  return match === null ? null : Number(match[1])
}

/** Whether a terminal of the Cockpit is running on the ticket, so ▶ is not offered. */
export const isRunning = (state: SessionState | undefined): boolean =>
  state !== undefined && state.kind !== 'ended'

/**
 * The title in a live session's name: `#999 Title` gives `Title`. A name with no title, a session
 * the registry has not named and an ended one give null.
 */
export function sessionTitleOf(state: SessionState): string | null {
  const title = (state.kind === 'live' ? state.name : null)?.replace(/^#\d+\s*/, '').trim()
  return title === undefined || title === '' ? null : title
}

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

export const STATUS_UNKNOWN = 'status unknown'

/**
 * Whether a session's status rests on a registry that cannot be read: it was last known from
 * the registry, which now says nothing true about it. Its terminal and its ended record are
 * untouched; only the status word and the need for me give way.
 */
export const statusUnknown = (
  state: SessionState | undefined,
  registryUnreadable: boolean,
): boolean => registryUnreadable && state?.kind === 'live' && state.registry !== null

/** Whether the session needs me, once an unreadable registry has taken its status away. */
export const needsYouNow = (
  state: SessionState | undefined,
  registryUnreadable: boolean,
): boolean => !statusUnknown(state, registryUnreadable) && needsYou(state)

/** What the Tree is sent for a ticket's session. */
export function sessionView(
  state: SessionState | undefined,
  registryUnreadable = false,
): SessionView {
  if (state === undefined) return { kind: 'none' }
  switch (state.kind) {
    case 'starting':
      return {
        kind: 'starting',
        hint: state.hint ? (state.bypassed ? BYPASS_NO_STATUS_HINT : NO_STATUS_HINT) : null,
      }
    case 'live': {
      const { status, since } = shownStatus(state)
      const unknown = statusUnknown(state, registryUnreadable)
      return {
        kind: 'live',
        status: unknown ? STATUS_UNKNOWN : status === null ? null : STATUS_WORDS[status],
        needsYou: needsYouNow(state, registryUnreadable),
        since,
        focusable: state.terminal !== null,
        warning: duplicateWarning(state.duplicates),
      }
    }
    case 'ended':
      return { kind: 'ended', detail: state.detail, since: state.since }
  }
}

/**
 * The sessions a reader that owns no terminal sees: the events file replayed in line order, each
 * ticket's session then shown as ended, "window closed", for what the file says is live and no
 * terminal confirms, then one read of the registry on top, which brings a listed session back to
 * live. This is the Cockpit's activation path, as one pure function. Keyed by ticket number; a
 * ticket no event or registry entry names has no entry.
 */
export function sessionsOf(
  events: ReadonlyArray<StatusEvent>,
  listed: ReadonlyMap<number, ReadonlyArray<Listed>>,
  at: number,
): ReadonlyMap<number, SessionState> {
  const replayed = new Map<number, SessionState>()
  for (const event of events) {
    const number = Number(event.ticket)
    if (!Number.isInteger(number)) continue
    const next = reduceSession(replayed.get(number), {
      type: 'event',
      event,
      at: event.at ?? at,
    })
    if (next === undefined) replayed.delete(number)
    else replayed.set(number, next)
  }
  const sessions = new Map<number, SessionState>()
  for (const [number, state] of replayed) sessions.set(number, afterReload(state, at))
  for (const number of new Set([...sessions.keys(), ...listed.keys()])) {
    const next = reduceSession(sessions.get(number), {
      type: 'registry',
      listed: listed.get(number) ?? [],
      at,
    })
    if (next === undefined) sessions.delete(number)
    else sessions.set(number, next)
  }
  return sessions
}

/**
 * How long ago an epoch-millisecond time was, as the Tree words it: `12s`, `3m`, `2h`, `4d`. The
 * webview keeps its own copy (it bundles no core code); this one serves readers outside it.
 */
export function ageSince(since: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/**
 * A session in the words of the Focus pane's session line: the state, the status word, the time
 * since, any warning; null for none. Starting carries its hint, ended its reason.
 */
export function sessionText(view: SessionView, now: number): string | null {
  switch (view.kind) {
    case 'none':
      return null
    case 'starting':
      return view.hint === null ? 'starting' : `starting, ${view.hint}`
    case 'live': {
      const base = `${view.status ?? 'live'} · ${ageSince(view.since, now)} ago`
      return view.warning === null ? base : `${base}, ${view.warning}`
    }
    case 'ended':
      return `ended: ${view.detail} · ${ageSince(view.since, now)} ago`
  }
}
