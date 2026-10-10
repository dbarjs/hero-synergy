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
  | { readonly path: string; readonly kind: 'ticket' }
  | { readonly path: string; readonly kind: 'note' }

interface MapTruth {
  readonly state: 'open' | 'closed'
  readonly decisions: ReadonlyArray<number>
}

/** One file in the columns compared: what it is, and for a map its state and decisions. */
export type Columns =
  | { readonly kind: 'map'; readonly state: 'open' | 'closed'; readonly decisions: number[] }
  | { readonly kind: 'ticket' }
  | { readonly kind: 'note' }

/** The truth of one file, cut to the columns compared. */
export function truthColumns(entry: TruthEntry): Columns {
  if (entry.kind !== 'map') return { kind: entry.kind }
  return { kind: 'map', state: entry.reading.state, decisions: [...entry.reading.decisions] }
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
  const found = tickets.some((ticket) => ticket.ref.tracker === 'local' && ticket.ref.path === path)
  return { kind: found ? 'ticket' : 'note' }
}
