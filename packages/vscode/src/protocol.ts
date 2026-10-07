import type { Mode, TicketType } from '@hero-synergy/core'

/**
 * The messages between the extension host and the Tree's webview. The webview
 * imports this module for its types only and validates nothing (ADR 0002); the
 * host validates what arrives from the webview in `messages.ts`.
 */

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
      /** The unfinished maps in display order. */
      readonly maps: ReadonlyArray<MapNode>
      readonly finished: FinishedFold | null
      /** The one selected row's pane; null when nothing is selected. */
      readonly selection: Focus | null
    }

export type HostMessage = { readonly type: 'view-model'; readonly viewModel: ViewModel }

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
