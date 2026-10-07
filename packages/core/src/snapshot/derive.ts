import type { Blocker, Ticket, TicketType, WayfinderMap } from './model.ts'

/**
 * What the Cockpit derives from a snapshot: the frontier and `next`, the order
 * of a map's tickets and of the maps, decided-of-total and finished, the
 * neighbourhood of a ticket, and HITL or AFK from the type.
 *
 * Pure functions over the snapshot, applied by the extension host on every
 * render; nothing here is ever stored. The snapshot knows nothing about
 * sessions, so the one derivation that needs them, the urgency of a map, takes
 * the session facts from the host as an argument.
 */

/** Who drives a ticket's session: a human in the loop, the agent alone, or either for a task ticket. */
export type Mode = 'HITL' | 'AFK' | 'task'

/** HITL or AFK from the type: research is AFK, prototype and grilling are HITL, a task ticket shows as task. */
export const modeOf = (type: TicketType | null): Mode | null => {
  switch (type) {
    case 'research':
      return 'AFK'
    case 'prototype':
    case 'grilling':
      return 'HITL'
    case 'task':
      return 'task'
    case null:
      return null
  }
}

/**
 * The blockers still gating a ticket, for `waits on #n #m`. Each blocker gates on
 * its own reported state, so one outside the map gates like any other, and a
 * closed one never does.
 */
export const openBlockers = (ticket: Ticket): Blocker[] =>
  ticket.blockedBy.filter((blocker) => blocker.state === 'open')

/** A claim with nobody named (a local tracker's `Status: claimed`) is still a claim. */
export const isClaimed = (ticket: Ticket): boolean => ticket.claim !== null

/** Where a ticket sits on its map: closed in the decisions fold, or claimed, on the frontier, or blocked. */
export type TicketPlace = 'closed' | 'claimed' | 'frontier' | 'blocked'

/** Closed first; a claimed ticket is claimed whatever blocks it; the frontier is what is left unblocked. */
export const placeOf = (ticket: Ticket): TicketPlace => {
  if (ticket.state === 'closed') return 'closed'
  if (isClaimed(ticket)) return 'claimed'
  if (openBlockers(ticket).length > 0) return 'blocked'
  return 'frontier'
}

const placed = (map: WayfinderMap, place: TicketPlace): Ticket[] =>
  map.tickets.filter((ticket) => placeOf(ticket) === place)

/** The frontier: the open, unblocked, unclaimed tickets of a map, in map order. */
export const frontierOf = (map: WayfinderMap): Ticket[] => placed(map, 'frontier')

/** The first ticket of the frontier, the one to take next; null when nothing is takeable. */
export const nextOf = (map: WayfinderMap): Ticket | null => frontierOf(map)[0] ?? null

/** A map's open tickets as the Tree lists them: claimed, then the frontier, then blocked, each in map order. */
export const orderTickets = (map: WayfinderMap): Ticket[] => [
  ...placed(map, 'claimed'),
  ...placed(map, 'frontier'),
  ...placed(map, 'blocked'),
]

/** Decided-of-total: closed tickets over all tickets, whatever the map recorded about each. */
export const decidedOfTotal = (map: WayfinderMap): { decided: number; total: number } => ({
  decided: placed(map, 'closed').length,
  total: map.tickets.length,
})

/**
 * A finished map: still open, with every ticket closed. A map with no tickets
 * has decided nothing, so it is not finished.
 */
export const isFinished = (map: WayfinderMap): boolean =>
  map.tickets.length > 0 && map.tickets.every((ticket) => ticket.state === 'closed')

/** What the host knows about sessions and the snapshot does not. */
export interface SessionFacts {
  /** The tickets whose session needs me: waiting for you, needs approval, failed. */
  readonly needsYou: ReadonlySet<number>
}

/** The tickets of a map whose session needs me, in map order. A closed ticket wrapping up still counts. */
export const needsYouIn = (map: WayfinderMap, facts: SessionFacts): Ticket[] =>
  map.tickets.filter((ticket) => facts.needsYou.has(ticket.number))

/**
 * How urgently a map wants attention, most urgent first: a session needs me,
 * something is takeable, stuck (open work but nothing takeable), finished.
 */
export type Urgency = 'needs-you' | 'takeable' | 'stuck' | 'finished'

const urgencyRank: Record<Urgency, number> = { 'needs-you': 0, takeable: 1, stuck: 2, finished: 3 }

/** A session needing me outranks everything, so a finished map wrapping up a ticket still surfaces. */
export const urgencyOf = (map: WayfinderMap, facts: SessionFacts): Urgency => {
  if (needsYouIn(map, facts).length > 0) return 'needs-you'
  if (isFinished(map)) return 'finished'
  if (frontierOf(map).length > 0) return 'takeable'
  return 'stuck'
}

/** The maps by urgency, keeping tracker order within one urgency. */
export const orderMaps = (maps: ReadonlyArray<WayfinderMap>, facts: SessionFacts): WayfinderMap[] =>
  maps
    .map((map, index) => ({ map, index, rank: urgencyRank[urgencyOf(map, facts)] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ map }) => map)

/** A ticket's immediate neighbours: what it waits on and what it clears the way for. */
export interface Neighbourhood {
  /** Every blocker as the tracker reports it, closed ones included, wherever it lives. */
  readonly waitsOn: Blocker[]
  /** The tickets of the map that wait on this one, in map order. */
  readonly clearsWayFor: Ticket[]
}

/** `clearsWayFor` is `blockedBy` inverted across the map; nothing stores it. */
export const neighbourhoodOf = (ticket: Ticket, map: WayfinderMap): Neighbourhood => ({
  waitsOn: [...ticket.blockedBy],
  clearsWayFor: map.tickets.filter((other) =>
    other.blockedBy.some((blocker) => blocker.number === ticket.number),
  ),
})
