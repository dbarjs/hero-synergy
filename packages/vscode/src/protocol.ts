import type { Mode, TicketType } from '@hero-synergy/core'

/**
 * The messages between the extension host and the Tree's webview. The webview
 * imports this module for its types only and validates nothing (ADR 0002); the
 * host validates what arrives from the webview in `messages.ts`.
 */

/**
 * A ticket's session: none, starting while its terminal has reported nothing, live once it has,
 * ended once it is over. `since` is the epoch milliseconds of the last status event: the webview
 * shows the time since, so the age is never a timer of the host's.
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
    }
  | { readonly kind: 'ended'; readonly detail: string; readonly since: number }

/**
 * What ▶ launches for a ticket, with the exact command it shows. A greyed Action
 * keeps the command it would run when it has one, and says why in `disabled`.
 */
export interface ActionView {
  readonly label: 'Work ticket'
  /** The shell-quoted command, built once from the argv; null when no command could be built. */
  readonly command: string | null
  /** The muted `env:` line, or null when there is no env. */
  readonly envLine: string | null
  /** Why the Action is greyed; null when it can run. */
  readonly disabled: string | null
  /** A line the pane adds under the command, such as the shared checkout on a local tracker. */
  readonly note: string | null
}

/** A ticket another ticket waits on, as `waits on #n #m` shows it. */
export interface BlockerView {
  readonly number: number
  readonly title: string
}

/** One drift warning, with the copy the drift table gives its code. */
export interface DriftEntry {
  readonly code: string
  readonly level: 'loud' | 'quiet'
  /** What was found. */
  readonly message: string
  /** The specifics the scout recorded; null when there are none. */
  readonly detail: string | null
  /** One line on the current convention. */
  readonly hint: string
  /** What dismissing the entry sends: the subject, the code and the exact detail. */
  readonly dismissKey: string
}

/**
 * The drift a Focus pane summarises: one line per loud warning, one count for all the quiet
 * ones, and for a map how many of its tickets drift. Null when there is none to show.
 */
export interface DriftSummary {
  readonly loud: ReadonlyArray<string>
  readonly quiet: number
  /** Tickets of the map with any drift; zero on a ticket. */
  readonly tickets: number
}

/** An open ticket of a map, in the place the Tree lists it. */
export interface TicketRow {
  /** What the webview sends to select the row. */
  readonly key: string
  readonly number: number
  readonly title: string
  readonly place: 'claimed' | 'frontier' | 'blocked'
  readonly type: TicketType | null
  /** HITL or AFK from the type; `task` for a task ticket, which either can drive. */
  readonly mode: Mode | null
  /** The one frontier ticket marked `next`. */
  readonly next: boolean
  /** The blockers still open; empty unless the ticket is blocked. */
  readonly waitsOn: ReadonlyArray<BlockerView>
  readonly session: SessionView
  /** The Action ▶ runs; null for every row but a frontier row. */
  readonly action: ActionView | null
  /** The loud messages the ⚠ shows on hover; empty when the row is unmarked. */
  readonly loud: ReadonlyArray<string>
}

/** A ticket that belongs to no map, in the Unmapped node. */
export interface UnmappedRow {
  readonly key: string
  readonly number: number
  readonly title: string
  readonly loud: ReadonlyArray<string>
}

/** A closed ticket in the Decisions fold, with the gist the map recorded. */
export interface DecisionRow {
  /** The key that selects the closed ticket; null when the decision names no ticket. */
  readonly key: string | null
  readonly number: number | null
  readonly title: string
  readonly gist: string
}

/** One patch of the map's Not yet specified. */
export interface FogRow {
  readonly text: string
}

/** A folded node under a map; its count is the number of entries. */
export interface Fold<Entry> {
  /** What the webview sends back to expand or collapse it. */
  readonly key: string
  readonly expanded: boolean
  readonly entries: ReadonlyArray<Entry>
}

/** Why the last collect failed, and the fix when there is one. */
export interface Notice {
  readonly message: string
  readonly fix: string | null
}

/** What holds the automatic refreshes back, until when (ISO); the webview words it with the time of day. */
export interface BudgetNote {
  readonly kind: 'paused' | 'rate-limited' | 'backoff'
  readonly until: string
}

/** One open map and everything under it. */
export interface MapNode {
  readonly key: string
  readonly number: number
  readonly title: string
  readonly expanded: boolean
  /** What the webview sends to select the ⚑ Map row under this map. */
  readonly focusKey: string
  /** How many tickets are on the frontier; zero shows as "nothing takeable". */
  readonly takeable: number
  readonly decided: number
  readonly total: number
  readonly destination: string | null
  /** The open tickets: claimed, then the frontier, then blocked. */
  readonly tickets: ReadonlyArray<TicketRow>
  readonly fog: Fold<FogRow>
  readonly decisions: Fold<DecisionRow>
  /** The ⚠ tooltip when the map or any of its tickets has a loud warning, with counts; else null. */
  readonly loud: string | null
}

/** The finished maps, folded into one node at the bottom. */
export interface FinishedFold {
  readonly key: string
  readonly expanded: boolean
  readonly maps: ReadonlyArray<MapNode>
}

/**
 * What the Focus pane shows for the selected row. `key` is the selected row's
 * key, so the webview opens the pane under that row.
 */
export type Focus =
  | {
      readonly kind: 'ticket'
      readonly key: string
      readonly number: number
      readonly title: string
      readonly state: 'open' | 'closed'
      /** Who claimed it; null when unclaimed. */
      readonly claim: ReadonlyArray<string> | null
      /** The issue's URL on GitHub; null on a local tracker, which opens a file. */
      readonly url: string | null
      readonly session: SessionView
      /** The Work ticket Action; null unless the ticket is on the frontier. */
      readonly action: ActionView | null
      readonly drift: DriftSummary | null
    }
  | {
      readonly kind: 'map'
      readonly key: string
      readonly number: number
      readonly title: string
      readonly takeable: number
      readonly decided: number
      readonly total: number
      readonly destination: string | null
      readonly drift: DriftSummary | null
    }

/** What the Tree draws: a wait, one plain message, or the maps. */
export type ViewModel =
  | { readonly kind: 'loading' }
  | { readonly kind: 'message'; readonly message: string; readonly detail: string | null }
  | {
      readonly kind: 'maps'
      readonly collectedAt: string
      /** `owner/name` on a GitHub tracker, which shows the repo row; null on a local one. */
      readonly repo: string | null
      /** Set when the last collect failed and the maps shown are from an earlier one. */
      readonly notice: Notice | null
      /** Set while the gh budget or a secondary limit holds automatic refreshes back. */
      readonly budget: BudgetNote | null
      /** The unfinished maps in display order. */
      readonly maps: ReadonlyArray<MapNode>
      /** The tickets that belong to no map, folded above Finished; null when there are none. */
      readonly unmapped: Fold<UnmappedRow> | null
      readonly finished: FinishedFold | null
      /** The one selected row's pane; null when nothing is selected. */
      readonly selection: Focus | null
    }

/** A ticket the Detail shows as a neighbour; `key` is null when it is not a ticket of the map. */
export interface NeighbourView {
  readonly number: number
  readonly title: string
  readonly state: 'open' | 'closed'
  readonly key: string | null
}

/** A section of a Detail, which the Fog and Decisions rows and the drift lines open it scrolled to. */
export type MapSection = 'destination' | 'decisions' | 'fog' | 'out-of-scope' | 'drift'

/** A closed ticket's answer. */
export interface ResolutionView {
  readonly body: string
  readonly author: string | null
  readonly at: string | null
}

/** One line of a map's Decisions so far. */
export interface DecisionLine {
  readonly key: string | null
  readonly number: number | null
  readonly title: string
  readonly gist: string
}

/** The drift of one subject in a Detail's Drift section: a map's own, or one of its tickets. */
export interface DriftGroup {
  /** The ticket's key, so the heading can reveal it; null for the map itself. */
  readonly key: string | null
  readonly number: number | null
  readonly title: string | null
  readonly entries: ReadonlyArray<DriftEntry>
}

/** What the Detail shows for the selection: the full issue, not the Focus pane's summary. */
export type Detail =
  | {
      readonly kind: 'ticket'
      readonly key: string
      readonly number: number
      readonly title: string
      readonly state: 'open' | 'closed'
      readonly place: 'claimed' | 'frontier' | 'blocked' | 'closed'
      readonly type: TicketType | null
      readonly mode: Mode | null
      /** Who claimed it; null when unclaimed. */
      readonly claim: ReadonlyArray<string> | null
      readonly url: string | null
      /** The ticket's Markdown body, rendered in the webview. */
      readonly body: string
      readonly resolution: ResolutionView | null
      /** The tickets it waits on, closed ones included. */
      readonly waitsOn: ReadonlyArray<NeighbourView>
      /** The tickets of the map that wait on it. */
      readonly clearsWayFor: ReadonlyArray<NeighbourView>
      readonly session: SessionView
      /** The Work ticket Action; null unless the ticket is on the frontier with no terminal on it. */
      readonly action: ActionView | null
      /** The Drift section; empty hides it. */
      readonly drift: ReadonlyArray<DriftGroup>
    }
  | {
      readonly kind: 'map'
      readonly key: string
      readonly number: number
      readonly title: string
      readonly url: string | null
      readonly takeable: number
      readonly decided: number
      readonly total: number
      readonly destination: string | null
      readonly decisions: ReadonlyArray<DecisionLine>
      readonly fog: ReadonlyArray<FogRow>
      readonly outOfScope: ReadonlyArray<FogRow>
      /** The body as written, shown after the sections that were read when the map is free-form. */
      readonly freeForm: string | null
      /** The map's own drift first, then its tickets' under their `#n title`, closed ones included. */
      readonly drift: ReadonlyArray<DriftGroup>
    }

/**
 * What the Detail panel draws: the selection's detail (null when nothing is selected), and
 * the section to scroll to. `scroll` counts each request, so asking again for the same
 * section scrolls again.
 */
export interface DetailView {
  readonly detail: Detail | null
  readonly section: MapSection | null
  readonly scroll: number
}

export type HostMessage =
  | { readonly type: 'view-model'; readonly viewModel: ViewModel }
  | { readonly type: 'detail'; readonly view: DetailView }

export type WebviewMessage =
  /** The webview has mounted and wants the current view model. */
  | { readonly type: 'ready' }
  | { readonly type: 'expand'; readonly key: string }
  | { readonly type: 'collapse'; readonly key: string }
  /** Select a row, or null to close the pane; the host confirms with a new view model. */
  | { readonly type: 'select'; readonly key: string | null }
  /** The pane's ↗ Open and its title link: open the selected ticket or map. */
  | { readonly type: 'open'; readonly key: string }
  | { readonly type: 'refresh' }
  /** Select the row, open the Detail on it, and scroll a map's Detail to a section. */
  | { readonly type: 'open-detail'; readonly key: string; readonly section: MapSection | null }
  /** A neighbour clicked in the Detail: select it in the Tree and unfold its map. */
  | { readonly type: 'reveal'; readonly key: string }
  /** A link in a rendered body; the host opens only web links. */
  | { readonly type: 'open-link'; readonly url: string }
  /** ▶: run the ticket's Action; the host ignores it unless the ticket is launchable. */
  | { readonly type: 'launch'; readonly key: string }
  /** Focus the ticket's terminal. */
  | { readonly type: 'focus-terminal'; readonly key: string }
  /** The copy button: put the ticket's command on the clipboard. */
  | { readonly type: 'copy'; readonly key: string }
  /** Hide a drift entry until its detail changes. */
  | { readonly type: 'dismiss-drift'; readonly dismissKey: string }
