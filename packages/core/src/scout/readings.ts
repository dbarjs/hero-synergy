import type { EffortReading } from './local.ts'

/**
 * Test helpers: one file of a local tracker as the scout read it and as its
 * truth file reads it, in the same terms, so the pattern fixture
 * (`fixtures/local-forms`) and the scratch mirror (`fixtures/scratch-mirror`)
 * compare file by file. Each reader ticket of map #130's spec turns on the
 * columns it reads; a column the scout does not read yet is left out of both.
 */

/** A file's truth entry, in the shape both truth files share. */
export type TruthEntry =
  | { readonly path: string; readonly kind: 'map'; readonly reading: MapTruth }
  | { readonly path: string; readonly kind: 'ticket'; readonly reading: TicketTruth }
  | { readonly path: string; readonly kind: 'note' }

interface MapTruth {
  readonly state: 'open' | 'closed'
  readonly decisions: ReadonlyArray<number>
}

type TicketState = 'open' | 'claimed' | 'closed'
type Role = 'needs-triage' | 'needs-info' | 'ready-for-agent' | 'ready-for-human' | 'wontfix'

interface TicketTruth {
  /** Closed; or open, and claimed when it has a claim. */
  readonly state: TicketState
  readonly role: Role | null
  /** Who the `Assignee:` line names; a closed ticket keeps it as history. */
  readonly assignee: string | null
  /** The tickets the file's own `Blocked by:` line names, in order. */
  readonly blockedBy: ReadonlyArray<number>
  /** The tickets the file's own `Blocks:` line names. */
  readonly blocks: ReadonlyArray<number>
}

/**
 * One file in the columns compared: what it is; for a map its state and decisions; for a ticket
 * its state (closed; or open, and claimed when it has a claim), its triage role, who holds its
 * claim (the first name, and only on a ticket that isn't closed), and its merged blockers: its
 * own `Blocked by:` items in order, then the tickets whose `Blocks:` line names it, in number order.
 */
export type Columns =
  | { readonly kind: 'map'; readonly state: 'open' | 'closed'; readonly decisions: number[] }
  | {
      readonly kind: 'ticket'
      readonly state: TicketState
      readonly role: Role | null
      readonly assignee: string | null
      readonly blockedBy: number[]
    }
  | { readonly kind: 'note' }

const effortOf = (path: string): string => path.split('/')[1] ?? ''
const numberOf = (path: string): number => Number(/\/issues\/(\d+)-[^/]*$/.exec(path)?.[1])

/**
 * The truth of one file, cut to the columns compared. `all` is every entry of the same truth
 * file: a ticket's blockers include the tickets of its effort whose `Blocks:` line names it.
 */
export function truthColumns(entry: TruthEntry, all: ReadonlyArray<TruthEntry>): Columns {
  if (entry.kind === 'note') return { kind: 'note' }
  if (entry.kind === 'map')
    return { kind: 'map', state: entry.reading.state, decisions: [...entry.reading.decisions] }
  const number = numberOf(entry.path)
  const blockedBy = [...entry.reading.blockedBy]
  const inverted = all
    .filter(
      (other) =>
        other.kind === 'ticket' &&
        effortOf(other.path) === effortOf(entry.path) &&
        other.reading.blocks.includes(number),
    )
    .map((other) => numberOf(other.path))
    .sort((a, b) => a - b)
  for (const blocker of inverted) if (!blockedBy.includes(blocker)) blockedBy.push(blocker)
  const { state, role, assignee } = entry.reading
  return {
    kind: 'ticket',
    state,
    role,
    // A closed ticket keeps its Assignee as history, and is never claimed.
    assignee: state === 'closed' ? null : assignee,
    blockedBy,
  }
}

/**
 * What the scout read for the file at `path` (from the repo root): its
 * effort's map, a ticket of that map or one of its unmapped issues, or neither,
 * which is a note.
 */
export function scoutColumns(efforts: ReadonlyArray<EffortReading>, path: string): Columns {
  const effort = efforts.find((candidate) => path.startsWith(`.scratch/${candidate.directory}/`))
  if (effort === undefined) return { kind: 'note' }
  const { map } = effort
  if (map !== null && map.ref.tracker === 'local' && map.ref.path === path) {
    return {
      kind: 'map',
      state: effort.mapState ?? 'open',
      decisions: [...new Set(map.decisions.flatMap((decision) => decision.number ?? []))],
    }
  }
  const tickets = [...(map?.tickets ?? []), ...effort.unmapped]
  const ticket = tickets.find(
    (candidate) => candidate.ref.tracker === 'local' && candidate.ref.path === path,
  )
  if (ticket === undefined) return { kind: 'note' }
  return {
    kind: 'ticket',
    state: ticket.state === 'closed' ? 'closed' : ticket.claim === null ? 'open' : 'claimed',
    role: ticket.role,
    assignee: ticket.claim?.by[0] ?? null,
    blockedBy: ticket.blockedBy.map((blocker) => blocker.number),
  }
}
