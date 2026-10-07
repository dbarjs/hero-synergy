import type { Mode, TicketType } from '@hero-synergy/core'

/**
 * The messages between the extension host and the Tree's webview. The webview
 * imports this module for its types only and validates nothing (ADR 0002); the
 * host validates what arrives from the webview in `messages.ts`.
 */

/** A ticket's session: none, starting while its terminal exists, ended once the terminal closed. */
export type SessionView =
  | { readonly kind: 'none' }
  | { readonly kind: 'starting' }
  | { readonly kind: 'ended'; readonly detail: string }

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

/** A section of a map's Detail, which the Fog and Decisions rows open it scrolled to. */
export type MapSection = 'destination' | 'decisions' | 'fog' | 'out-of-scope'

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
