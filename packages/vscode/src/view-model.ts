import {
  decidedOfTotal,
  frontierOf,
  isFinished,
  modeOf,
  nextOf,
  openBlockers,
  orderMaps,
  orderTickets,
  placeOf,
  type SessionFacts,
  type Snapshot,
  type Ticket,
  type WayfinderMap,
} from '@hero-synergy/core'

import type { MapNode, TicketRow, ViewModel } from './protocol.ts'

/** The sessions the Tree knows about: none until the session tickets land, so no map needs me. */
const NO_SESSIONS: SessionFacts = { needsYou: new Set() }

export const mapKey = (map: WayfinderMap): string => `map:${map.number}`
export const FINISHED_KEY = 'finished'

/**
 * What the Tree opens on when nothing was stored: the first map in display
 * order, so the most urgent map shows its tickets at once.
 */
export const defaultExpanded = (snapshot: Snapshot): ReadonlySet<string> => {
  const first = orderMaps(snapshot.maps, NO_SESSIONS).find((map) => !isFinished(map))
  return new Set(first === undefined ? [] : [mapKey(first)])
}

const ticketRow = (ticket: Ticket, next: Ticket | null): TicketRow => {
  const place = placeOf(ticket)
  if (place === 'closed') throw new Error(`#${ticket.number} is closed and has no row`)
  return {
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
    takeable: frontierOf(map).length,
    decided,
    total,
    destination: map.destination,
    tickets: orderTickets(map).map((ticket) => ticketRow(ticket, next)),
    fog: {
      key: `${key}:fog`,
      expanded: expanded.has(`${key}:fog`),
      entries: map.notYetSpecified.map(({ text }) => ({ text })),
    },
    decisions: {
      key: `${key}:decisions`,
      expanded: expanded.has(`${key}:decisions`),
      entries: map.decisions.map(({ number, title, gist }) => ({ number, title, gist })),
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
  facts: SessionFacts = NO_SESSIONS,
): ViewModel => {
  const ordered = orderMaps(snapshot.maps, facts)
  const active = ordered.filter((map) => !isFinished(map))
  const finished = ordered.filter(isFinished)
  return {
    kind: 'maps',
    collectedAt: snapshot.collectedAt,
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
