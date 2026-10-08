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
  type Ref,
  type SessionFacts,
  sessionView,
  type Snapshot,
  type Ticket,
  type WayfinderMap,
} from '@hero-synergy/core'

import { overlaySessions, type SessionOverlay, shownClaim } from './disagreements.ts'
import { driftingTickets, isLoud, mapDrift, ticketDrift } from './drift.ts'
import {
  type Launching,
  mapActions,
  NOT_LAUNCHING,
  type Planned,
  startOf,
  ticketActions,
} from './launch.ts'
import type {
  ActionView,
  BudgetNote,
  Detail,
  DecisionFold,
  DecisionRow,
  DriftEntry,
  DriftGroup,
  DriftSummary,
  Focus,
  Fold,
  MapNode,
  NeighbourView,
  Notice,
  TicketRow,
  UnlistedRow,
  UnmappedRow,
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
/** The synthetic node that holds the tickets of no map. */
export const UNMAPPED_KEY = 'unmapped'
export const unmappedKey = (number: number): string => `${UNMAPPED_KEY}:ticket:${number}`

/** The snapshot with the sessions laid over it: a held ticket is off the frontier, and the disagreements are named. */
const overlaid = (snapshot: Snapshot, launching: Launching): SessionOverlay =>
  overlaySessions(snapshot, launching.sessions, launching.me, (map, ticket) =>
    ticketKey(map, ticket.number),
  )

/** The drift entries the person dismissed, by dismissal key; a dismissal hides exactly one entry. */
export type Dismissed = ReadonlySet<string>
const NO_DISMISSED: Dismissed = new Set()

const loudOf = (entries: ReadonlyArray<DriftEntry>): string[] =>
  entries.filter(isLoud).map(({ message }) => message)

/** What a pane says about drift; null when there is none, so nothing appears. */
const summaryOf = (entries: ReadonlyArray<DriftEntry>, tickets: number): DriftSummary | null =>
  entries.length === 0 && tickets === 0
    ? null
    : { loud: loudOf(entries), quiet: entries.filter((entry) => !isLoud(entry)).length, tickets }

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`

const ticketSubject =
  (map: WayfinderMap) =>
  (ticket: Ticket): string =>
    ticketKey(map, ticket.number)

/** The ⚠ tooltip of a map row: loud warnings on the map and on its tickets, open or closed. */
const mapLoudTitle = (map: WayfinderMap, dismissed: Dismissed): string | null => {
  const own = mapDrift(map, dismissed).filter(isLoud).length
  const loudTickets = driftingTickets(map, ticketSubject(map), dismissed).filter(({ entries }) =>
    entries.some(isLoud),
  )
  const onTickets = loudTickets.reduce((sum, { entries }) => sum + entries.filter(isLoud).length, 0)
  if (own === 0 && onTickets === 0) return null
  const loud = (count: number): string => plural(count, 'loud warning', 'loud warnings')
  return [
    own > 0 ? `${loud(own)} on the map` : null,
    onTickets > 0
      ? `${loud(onTickets)} on ${plural(loudTickets.length, 'ticket', 'tickets')}`
      : null,
  ]
    .filter((part) => part !== null)
    .join(', ')
}

const mapSummary = (map: WayfinderMap, dismissed: Dismissed): DriftSummary | null =>
  summaryOf(mapDrift(map, dismissed), driftingTickets(map, ticketSubject(map), dismissed).length)

/** A Detail's Drift section for one subject; empty when it has no drift. */
const ownGroup = (entries: ReadonlyArray<DriftEntry>): DriftGroup[] =>
  entries.length === 0 ? [] : [{ key: null, number: null, title: null, entries }]

/** The map's own drift first, then each drifting ticket's under its `#n title`, closed ones included. */
const mapGroups = (map: WayfinderMap, dismissed: Dismissed): DriftGroup[] => [
  ...ownGroup(mapDrift(map, dismissed)),
  ...driftingTickets(map, ticketSubject(map), dismissed).map(({ ticket, entries }) => ({
    key: ticketKey(map, ticket.number),
    number: ticket.number,
    title: ticket.title,
    entries,
  })),
]

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

/** The ticket a row key names with its map; null when the key names no ticket in the snapshot. */
export const ticketOf = (
  snapshot: Snapshot,
  key: string,
): { readonly map: WayfinderMap; readonly ticket: Ticket } | null => {
  for (const map of snapshot.maps) {
    const ticket = map.tickets.find((candidate) => ticketKey(map, candidate.number) === key)
    if (ticket !== undefined) return { map, ticket }
  }
  return null
}

/** The row a key selects, with what its pane shows; null when the key names nothing in the snapshot. */
export const selectionOf = (
  collected: Snapshot,
  key: string | null,
  launching: Launching = NOT_LAUNCHING,
  dismissed: Dismissed = NO_DISMISSED,
): Selected | null => {
  if (key === null) return null
  const { snapshot, disagreements } = overlaid(collected, launching)
  const stray = snapshot.unmapped.find((candidate) => unmappedKey(candidate.number) === key)
  if (stray !== undefined) {
    return {
      target: targetOf(snapshot.repoRoot, stray.ref),
      focus: {
        kind: 'ticket',
        key,
        number: stray.number,
        title: stray.title,
        state: stray.state,
        claim: stray.claim === null ? null : stray.claim.by,
        url: stray.ref.tracker === 'github' ? stray.ref.url : null,
        session: sessionView(undefined),
        disagreement: null,
        actions: [],
        drift: summaryOf(ticketDrift(key, stray, dismissed), 0),
      },
    }
  }
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
          drift: mapSummary(map, dismissed),
          actions: views(mapActions(snapshot, launching, map)),
        },
      }
    }
    const ticket = map.tickets.find((candidate) => ticketKey(map, candidate.number) === key)
    if (ticket !== undefined) {
      const disagreement = disagreements.get(key) ?? null
      return {
        target: target(ticket.ref),
        focus: {
          kind: 'ticket',
          key,
          number: ticket.number,
          title: ticket.title,
          state: ticket.state,
          claim: shownClaim(ticket, disagreement),
          url: ticket.ref.tracker === 'github' ? ticket.ref.url : null,
          session: sessionView(launching.sessions.get(key)),
          disagreement,
          actions: actionsOf(snapshot, launching, map, ticket, key),
          drift: summaryOf(ticketDrift(key, ticket, dismissed), 0),
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
export const detailOf = (
  collected: Snapshot,
  key: string | null,
  launching: Launching = NOT_LAUNCHING,
  dismissed: Dismissed = NO_DISMISSED,
): Detail | null => {
  if (key === null) return null
  const { snapshot, disagreements } = overlaid(collected, launching)
  const openUrl = (ref: Ref): string | null => (ref.tracker === 'github' ? ref.url : null)
  const stray = snapshot.unmapped.find((candidate) => unmappedKey(candidate.number) === key)
  if (stray !== undefined) {
    return {
      kind: 'ticket',
      key,
      number: stray.number,
      title: stray.title,
      state: stray.state,
      place: placeOf(stray),
      type: stray.type,
      mode: modeOf(stray.type),
      claim: stray.claim === null ? null : stray.claim.by,
      url: openUrl(stray.ref),
      body: stray.body,
      resolution: stray.resolution,
      // A ticket of no map has no map to select a neighbour in.
      waitsOn: stray.blockedBy.map(({ number, title, state }) => ({
        number,
        title,
        state,
        key: null,
      })),
      clearsWayFor: [],
      session: sessionView(undefined),
      disagreement: null,
      actions: [],
      drift: ownGroup(ticketDrift(key, stray, dismissed)),
    }
  }
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
        freeForm: map.warnings.some(({ code }) => code === 'map-body-free-form') ? map.body : null,
        drift: mapGroups(map, dismissed),
        actions: views(mapActions(snapshot, launching, map)),
      }
    }
    const ticket = map.tickets.find((candidate) => ticketKey(map, candidate.number) === key)
    if (ticket !== undefined) {
      const { waitsOn, clearsWayFor } = neighbourhoodOf(ticket, map)
      const disagreement = disagreements.get(key) ?? null
      return {
        kind: 'ticket',
        key,
        number: ticket.number,
        title: ticket.title,
        state: ticket.state,
        place: placeOf(ticket),
        type: ticket.type,
        mode: modeOf(ticket.type),
        claim: shownClaim(ticket, disagreement),
        url: openUrl(ticket.ref),
        body: ticket.body,
        resolution: ticket.resolution,
        waitsOn: waitsOn.map((blocker) => neighbour(map, blocker)),
        clearsWayFor: clearsWayFor.map((other) => neighbour(map, other)),
        session: sessionView(launching.sessions.get(key)),
        disagreement,
        actions: actionsOf(snapshot, launching, map, ticket, key),
        drift: ownGroup(ticketDrift(key, ticket, dismissed)),
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
  if (snapshot.unmapped.some((ticket) => unmappedKey(ticket.number) === key)) return [UNMAPPED_KEY]
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

const views = (planned: ReadonlyArray<Planned>): ReadonlyArray<ActionView> =>
  planned.map(({ view }) => view)

/** The Actions of the ticket's context (see `ticketActions`), first the one ▶ runs. */
const actionsOf = (
  snapshot: Snapshot,
  launching: Launching,
  map: WayfinderMap,
  ticket: Ticket,
  key: string,
): ReadonlyArray<ActionView> => views(ticketActions(snapshot, launching, { map, ticket }, key))

const ticketRow = (
  snapshot: Snapshot,
  launching: Launching,
  map: WayfinderMap,
  ticket: Ticket,
  next: Ticket | null,
  dismissed: Dismissed,
  disagreements: SessionOverlay['disagreements'],
): TicketRow => {
  const place = placeOf(ticket)
  if (place === 'closed') throw new Error(`#${ticket.number} is closed and has no row`)
  const key = ticketKey(map, ticket.number)
  return {
    key,
    session: sessionView(launching.sessions.get(key)),
    disagreement: disagreements.get(key) ?? null,
    action: actionsOf(snapshot, launching, map, ticket, key)[0] ?? null,
    number: ticket.number,
    title: ticket.title,
    place,
    type: ticket.type,
    mode: modeOf(ticket.type),
    next: ticket === next,
    loud: loudOf(ticketDrift(key, ticket, dismissed)),
    waitsOn:
      place === 'blocked'
        ? openBlockers(ticket).map(({ number, title }) => ({ number, title }))
        : [],
  }
}

/**
 * The Decisions fold: the decisions the map recorded, and any closed ticket still wrapping up that
 * the map has not recorded yet. A ticket wrapping up keeps its status and focus terminal on its row.
 */
const decisionFold = (
  launching: Launching,
  map: WayfinderMap,
  key: string,
  expanded: ReadonlySet<string>,
  disagreements: SessionOverlay['disagreements'],
): DecisionFold => {
  const row = (
    number: number | null,
    title: string,
    gist: string,
    ticket: Ticket | undefined,
  ): DecisionRow => {
    // Only a decision whose ticket is in the map can be selected.
    const rowKey = ticket === undefined || number === null ? null : ticketKey(map, number)
    const disagreement = rowKey === null ? null : (disagreements.get(rowKey) ?? null)
    return {
      key: rowKey,
      number,
      title,
      gist,
      session:
        rowKey !== null && disagreement?.kind === 'wrapping-up'
          ? sessionView(launching.sessions.get(rowKey))
          : { kind: 'none' },
      disagreement,
    }
  }
  const entries = map.decisions.map(({ number, title, gist }) =>
    row(
      number,
      title,
      gist,
      map.tickets.find((ticket) => ticket.number === number),
    ),
  )
  const recorded = new Set(entries.map((entry) => entry.number))
  const unrecorded = map.tickets
    .filter(
      (ticket) =>
        !recorded.has(ticket.number) &&
        disagreements.get(ticketKey(map, ticket.number))?.kind === 'wrapping-up',
    )
    .map((ticket) => row(ticket.number, ticket.title, '', ticket))
  const all = [...entries, ...unrecorded]
  return {
    key,
    expanded: expanded.has(key),
    entries: all,
    wrappingUp: all.filter((entry) => entry.disagreement?.kind === 'wrapping-up').length,
  }
}

const mapNode = (
  snapshot: Snapshot,
  launching: Launching,
  map: WayfinderMap,
  expanded: ReadonlySet<string>,
  dismissed: Dismissed,
  disagreements: SessionOverlay['disagreements'],
): MapNode => {
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
    action: views(mapActions(snapshot, launching, map))[0] ?? null,
    tickets: orderTickets(map).map((ticket) =>
      ticketRow(snapshot, launching, map, ticket, next, dismissed, disagreements),
    ),
    loud: mapLoudTitle(map, dismissed),
    fog: {
      key: `${key}:fog`,
      expanded: expanded.has(`${key}:fog`),
      entries: map.notYetSpecified.map(({ text }) => ({ text })),
    },
    decisions: decisionFold(launching, map, `${key}:decisions`, expanded, disagreements),
  }
}

/** The Unmapped node: the tickets of no map, shown only when there are some. */
const unmappedFold = (
  snapshot: Snapshot,
  expanded: ReadonlySet<string>,
  dismissed: Dismissed,
): Fold<UnmappedRow> | null =>
  snapshot.unmapped.length === 0
    ? null
    : {
        key: UNMAPPED_KEY,
        expanded: expanded.has(UNMAPPED_KEY),
        entries: snapshot.unmapped.map((ticket) => ({
          key: unmappedKey(ticket.number),
          number: ticket.number,
          title: ticket.title,
          loud: loudOf(ticketDrift(unmappedKey(ticket.number), ticket, dismissed)),
        })),
      }

/** `#999 Title` is held under `title`; a name with no title, or none at all, leaves it null. */
const titleOfName = (name: string | null): string | null => {
  const title = name?.replace(/^#\d+\s*/, '').trim()
  return title === undefined || title === '' ? null : title
}

/**
 * The sessions whose `#number` matches no ticket in view, live or ended, by number. Null when
 * there are none, so no row shows.
 */
const unlistedRows = (
  snapshot: Snapshot,
  launching: Launching,
): ReadonlyArray<UnlistedRow> | null => {
  const rows = [...launching.sessions]
    .filter(([key]) => ticketOf(snapshot, key) === null)
    .map(([key, state]): UnlistedRow => ({
      key,
      number: Number(key.slice(key.lastIndexOf(':') + 1)),
      title: titleOfName(state.kind === 'live' ? state.name : null),
      session: sessionView(state),
    }))
    .sort((a, b) => a.number - b.number)
  return rows.length === 0 ? null : rows
}

/**
 * The Tree's view model from a snapshot: the open maps by urgency, the finished
 * ones folded into one node at the bottom. Everything the Tree draws is derived
 * here with core's functions; the webview only lays it out.
 */
export const buildViewModel = (
  collected: Snapshot,
  expanded: ReadonlySet<string>,
  selected: string | null = null,
  facts: SessionFacts = NO_SESSIONS,
  notice: Notice | null = null,
  budget: BudgetNote | null = null,
  launching: Launching = NOT_LAUNCHING,
  dismissed: Dismissed = NO_DISMISSED,
): ViewModel => {
  const { snapshot, disagreements } = overlaid(collected, launching)
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
    selection: selectionOf(collected, selected, launching, dismissed)?.focus ?? null,
    // A repo with maps to show leads with them; an empty one leads with what it lacks.
    start: startOf(
      snapshot.repoRoot,
      launching,
      active.length === 0 && finished.length === 0 && snapshot.unmapped.length === 0
        ? 'map'
        : 'nothing',
    ),
    maps: active.map((map) =>
      mapNode(snapshot, launching, map, expanded, dismissed, disagreements),
    ),
    unlisted: unlistedRows(snapshot, launching),
    unmapped: unmappedFold(snapshot, expanded, dismissed),
    finished:
      finished.length === 0
        ? null
        : {
            key: FINISHED_KEY,
            expanded: expanded.has(FINISHED_KEY),
            maps: finished.map((map) =>
              mapNode(snapshot, launching, map, expanded, dismissed, disagreements),
            ),
          },
  }
}
