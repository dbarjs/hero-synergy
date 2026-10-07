import {
  decidedOfTotal,
  frontierOf,
  isFinished,
  modeOf,
  neighbourhoodOf,
  nextOf,
  openBlockers,
  orderMaps,
  orderTickets,
  placeOf,
  type SessionFacts,
  type Ref,
  type Snapshot,
  type Ticket,
  type WayfinderMap,
} from '@hero-synergy/core'

import type {
  BudgetNote,
  Detail,
  Focus,
  MapNode,
  NeighbourView,
  Notice,
  TicketRow,
  ViewModel,
} from './protocol.ts'

/** The sessions the Tree knows about: none until the session tickets land, so no map needs me. */
const NO_SESSIONS: SessionFacts = { needsYou: new Set() }

export const mapKey = (map: WayfinderMap): string => `map:${map.number}`
export const FINISHED_KEY = 'finished'
export const ticketKey = (map: WayfinderMap, number: number): string =>
  `${mapKey(map)}:ticket:${number}`
/** The ⚑ Map row under a map. */
export const focusKeyOf = (map: WayfinderMap): string => `${mapKey(map)}:map`

/** Where ↗ Open goes: an issue URL on GitHub, an absolute file path on a local tracker. */
export type OpenTarget =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'file'; readonly path: string }

const targetOf = (repoRoot: string, ref: Ref): OpenTarget =>
  ref.tracker === 'github'
    ? { kind: 'url', url: ref.url }
    : { kind: 'file', path: `${repoRoot.replace(/\/+$/, '')}/${ref.path}` }

interface Selected {
  readonly focus: Focus
  readonly target: OpenTarget
}

/** The row a key selects, with what its pane shows; null when the key names nothing in the snapshot. */
export const selectionOf = (snapshot: Snapshot, key: string | null): Selected | null => {
  if (key === null) return null
  for (const map of snapshot.maps) {
    const target = (ref: Ref): OpenTarget => targetOf(snapshot.repoRoot, ref)
    if (key === focusKeyOf(map)) {
      const { decided, total } = decidedOfTotal(map)
      return {
        target: target(map.ref),
        focus: {
          kind: 'map',
          key,
          number: map.number,
          title: map.title,
          takeable: frontierOf(map).length,
          decided,
          total,
          destination: map.destination,
        },
      }
    }
    const ticket = map.tickets.find((candidate) => ticketKey(map, candidate.number) === key)
    if (ticket !== undefined) {
      return {
        target: target(ticket.ref),
        focus: {
          kind: 'ticket',
          key,
          number: ticket.number,
          title: ticket.title,
          state: ticket.state,
          claim: ticket.claim === null ? null : ticket.claim.by,
          url: ticket.ref.tracker === 'github' ? ticket.ref.url : null,
        },
      }
    }
  }
  return null
}

const neighbour = (
  map: WayfinderMap,
  { number, title, state }: { number: number; title: string; state: 'open' | 'closed' },
): NeighbourView => ({
  number,
  title,
  state,
  // Only a ticket of this map can be selected in the Tree.
  key: map.tickets.some((ticket) => ticket.number === number) ? ticketKey(map, number) : null,
})

/** What the Detail shows for a selected row, with the full issue; null when the key names nothing. */
export const detailOf = (snapshot: Snapshot, key: string | null): Detail | null => {
  if (key === null) return null
  const openUrl = (ref: Ref): string | null => (ref.tracker === 'github' ? ref.url : null)
  for (const map of snapshot.maps) {
    if (key === focusKeyOf(map)) {
      const { decided, total } = decidedOfTotal(map)
      return {
        kind: 'map',
        key,
        number: map.number,
        title: map.title,
        url: openUrl(map.ref),
        takeable: frontierOf(map).length,
        decided,
        total,
        destination: map.destination,
        decisions: map.decisions.map(({ number, title, gist }) => ({
          key:
            number !== null && map.tickets.some((ticket) => ticket.number === number)
              ? ticketKey(map, number)
              : null,
          number,
          title,
          gist,
        })),
        fog: map.notYetSpecified.map(({ text }) => ({ text })),
        outOfScope: map.outOfScope.map(({ text }) => ({ text })),
      }
    }
    const ticket = map.tickets.find((candidate) => ticketKey(map, candidate.number) === key)
    if (ticket !== undefined) {
      const { waitsOn, clearsWayFor } = neighbourhoodOf(ticket, map)
      return {
        kind: 'ticket',
        key,
        number: ticket.number,
        title: ticket.title,
        state: ticket.state,
        place: placeOf(ticket),
        type: ticket.type,
        mode: modeOf(ticket.type),
        claim: ticket.claim === null ? null : ticket.claim.by,
        url: openUrl(ticket.ref),
        body: ticket.body,
        resolution: ticket.resolution,
        waitsOn: waitsOn.map((blocker) => neighbour(map, blocker)),
        clearsWayFor: clearsWayFor.map((other) => neighbour(map, other)),
      }
    }
  }
  return null
}

/**
 * The nodes that must be open for a row to show: its map, the Finished fold when the map is
 * finished, and the Decisions fold when the row is a decision. Empty when the key names nothing.
 */
export const revealKeys = (snapshot: Snapshot, key: string): ReadonlyArray<string> => {
  for (const map of snapshot.maps) {
    const ticket = map.tickets.find((candidate) => ticketKey(map, candidate.number) === key)
    if (key !== focusKeyOf(map) && ticket === undefined) continue
    const keys = [mapKey(map)]
    if (isFinished(map)) keys.push(FINISHED_KEY)
    if (ticket !== undefined && ticket.state === 'closed') keys.push(`${mapKey(map)}:decisions`)
    return keys
  }
  return []
}

/** The ⚑ Map row of the first map in display order, which the Detail command opens on with no selection. */
export const firstFocusKey = (snapshot: Snapshot): string | null => {
  const [first] = orderMaps(snapshot.maps, NO_SESSIONS)
  return first === undefined ? null : focusKeyOf(first)
}

/**
 * What the Tree opens on when nothing was stored: the first map in display
 * order, so the most urgent map shows its tickets at once.
 */
export const defaultExpanded = (snapshot: Snapshot): ReadonlySet<string> => {
  const first = orderMaps(snapshot.maps, NO_SESSIONS).find((map) => !isFinished(map))
  return new Set(first === undefined ? [] : [mapKey(first)])
}

const ticketRow = (map: WayfinderMap, ticket: Ticket, next: Ticket | null): TicketRow => {
  const place = placeOf(ticket)
  if (place === 'closed') throw new Error(`#${ticket.number} is closed and has no row`)
  return {
    key: ticketKey(map, ticket.number),
    number: ticket.number,
    title: ticket.title,
    place,
    type: ticket.type,
    mode: modeOf(ticket.type),
    next: ticket === next,
    waitsOn:
      place === 'blocked'
        ? openBlockers(ticket).map(({ number, title }) => ({ number, title }))
        : [],
  }
}

const mapNode = (map: WayfinderMap, expanded: ReadonlySet<string>): MapNode => {
  const key = mapKey(map)
  const next = nextOf(map)
  const { decided, total } = decidedOfTotal(map)
  return {
    key,
    number: map.number,
    title: map.title,
    expanded: expanded.has(key),
    focusKey: focusKeyOf(map),
    takeable: frontierOf(map).length,
    decided,
    total,
    destination: map.destination,
    tickets: orderTickets(map).map((ticket) => ticketRow(map, ticket, next)),
    fog: {
      key: `${key}:fog`,
      expanded: expanded.has(`${key}:fog`),
      entries: map.notYetSpecified.map(({ text }) => ({ text })),
    },
    decisions: {
      key: `${key}:decisions`,
      expanded: expanded.has(`${key}:decisions`),
      entries: map.decisions.map(({ number, title, gist }) => ({
        // Only a decision whose ticket is in the map can be selected.
        key:
          number !== null && map.tickets.some((ticket) => ticket.number === number)
            ? ticketKey(map, number)
            : null,
        number,
        title,
        gist,
      })),
    },
  }
}

/**
 * The Tree's view model from a snapshot: the open maps by urgency, the finished
 * ones folded into one node at the bottom. Everything the Tree draws is derived
 * here with core's functions; the webview only lays it out.
 */
export const buildViewModel = (
  snapshot: Snapshot,
  expanded: ReadonlySet<string>,
  selected: string | null = null,
  facts: SessionFacts = NO_SESSIONS,
  notice: Notice | null = null,
  budget: BudgetNote | null = null,
): ViewModel => {
  const ordered = orderMaps(snapshot.maps, facts)
  const active = ordered.filter((map) => !isFinished(map))
  const finished = ordered.filter(isFinished)
  return {
    kind: 'maps',
    collectedAt: snapshot.collectedAt,
    repo:
      snapshot.tracker.kind === 'github'
        ? `${snapshot.tracker.owner}/${snapshot.tracker.repo}`
        : null,
    notice,
    budget,
    selection: selectionOf(snapshot, selected)?.focus ?? null,
    maps: active.map((map) => mapNode(map, expanded)),
    finished:
      finished.length === 0
        ? null
        : {
            key: FINISHED_KEY,
            expanded: expanded.has(FINISHED_KEY),
            maps: finished.map((map) => mapNode(map, expanded)),
          },
  }
}
