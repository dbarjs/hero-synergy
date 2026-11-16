import type { Ticket } from '../snapshot/model.ts'
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
type TicketType = 'research' | 'prototype' | 'grilling' | 'task'
type ModeNote = 'AFK' | 'HITL'
type Placement =
  | 'answer'
  | 'resolution'
  | 'comments-resolution'
  | 'bold-paragraph'
  | 'comments-item'
  | 'comments-text'

/** A closed ticket's one resolution: where it sits, its first non-empty line, and its byline. */
interface ResolutionTruth {
  readonly placement: Placement
  readonly firstLine: string
  readonly at: string | null
  readonly author: string | null
}

interface TicketTruth {
  /** Closed; or open, and claimed when it has a claim. */
  readonly state: TicketState
  readonly role: Role | null
  /** Who the `Assignee:` line names; a closed ticket keeps it as history. */
  readonly assignee: string | null
  readonly type: TicketType | null
  /** The leading `AFK` or `HITL` the type line's parenthesis carries: the scout's `modeNote`. */
  readonly mode: ModeNote | null
  /** The tickets the file's own `Blocked by:` line names, in order. */
  readonly blockedBy: ReadonlyArray<number>
  /** The tickets the file's own `Blocks:` line names. */
  readonly blocks: ReadonlyArray<number>
  /** The effort's map file, when the effort has one. */
  readonly map: string | null
  /** The file other than the map that a `Parent:` line names, such as a PRD. */
  readonly parent: string | null
  readonly resolution: ResolutionTruth | null
}

/**
 * One file in the columns compared: what it is; for a map its state and decisions; for a ticket
 * whether it is a ticket of its effort's map or an unmapped issue, its state (closed; or open, and
 * claimed when it has a claim), its triage role, who holds its claim (the first name, and only on
 * a ticket that isn't closed), its type and HITL note, its merged blockers (its own
 * `Blocked by:` items in order, then the tickets whose `Blocks:` line names it, in number order),
 * and its resolution: where it sits, its first non-empty line, and its byline.
 */
export type Columns =
  | { readonly kind: 'map'; readonly state: 'open' | 'closed'; readonly decisions: number[] }
  | {
      readonly kind: 'ticket'
      /** A ticket of its effort's map; false for an unmapped issue (#139). */
      readonly member: boolean
      readonly state: TicketState
      readonly role: Role | null
      readonly assignee: string | null
      readonly type: TicketType | null
      readonly modeNote: ModeNote | null
      readonly blockedBy: number[]
      readonly resolution: ResolutionTruth | null
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
  const { state, role, assignee, type, mode, map, parent, resolution } = entry.reading
  return {
    kind: 'ticket',
    // A ticket exactly when the effort has a map and no `Parent:` line names another file.
    member: map !== null && parent === null,
    state,
    role,
    // A closed ticket keeps its Assignee as history, and is never claimed.
    assignee: state === 'closed' ? null : assignee,
    type,
    modeNote: mode,
    blockedBy,
    resolution,
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
  const isFile = (candidate: Ticket): boolean =>
    candidate.ref.tracker === 'local' && candidate.ref.path === path
  const member = map?.tickets.find(isFile)
  const ticket = member ?? effort.unmapped.find(isFile)
  if (ticket === undefined) return { kind: 'note' }
  return {
    kind: 'ticket',
    member: member !== undefined,
    state: ticket.state === 'closed' ? 'closed' : ticket.claim === null ? 'open' : 'claimed',
    role: ticket.role,
    assignee: ticket.claim?.by[0] ?? null,
    type: ticket.type,
    modeNote: ticket.modeNote,
    blockedBy: ticket.blockedBy.map((blocker) => blocker.number),
    resolution: resolutionColumns(ticket),
  }
}

/** The placement each form a resolution drift detail names stands for. */
const PLACEMENTS: Readonly<Record<string, Placement>> = {
  'Resolution heading': 'resolution',
  'Resolution heading under ## Comments': 'comments-resolution',
  'bold Resolution label': 'bold-paragraph',
  'dated comment': 'comments-item',
  'comment text': 'comments-text',
}

/**
 * The scout's resolution in the truth's terms: its placement, from the drift detail that names its
 * form (none means `## Answer`), its first non-empty body line, trimmed, and its byline.
 */
function resolutionColumns(ticket: Ticket): ResolutionTruth | null {
  if (ticket.resolution === null) return null
  const named = ticket.warnings.find(
    (warning) =>
      warning.code === 'resolution-outside-answer' ||
      warning.code === 'resolution-from-last-comment',
  )
  const placement = named === undefined ? 'answer' : PLACEMENTS[named.detail ?? '']
  if (placement === undefined) throw new Error(`unknown resolution form: ${named?.detail}`)
  return {
    placement,
    firstLine:
      ticket.resolution.body
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line !== '') ?? '',
    at: ticket.resolution.at,
    author: ticket.resolution.author,
  }
}
