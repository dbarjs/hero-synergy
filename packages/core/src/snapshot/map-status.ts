import { headerValue, readHeaderLines } from './header-lines.ts'

/**
 * A local map's own state, decided by its Status header line alone (#136): a
 * value led by `DONE` or `destination reached` closes the map, anything else
 * leaves it open. The rest of the line is annotation and never parsed, so a
 * `DONE` later in the line, a `## Destination reached` heading or a gist that
 * starts with a state word never closes a map.
 */
export interface MapStatus {
  readonly state: 'open' | 'closed'
  /** The value's first word as written, when this version does not read it; null otherwise. */
  readonly unknown: string | null
}

/** The leads a map's Status line uses while the map is open. */
const OPEN_LEADS: ReadonlyArray<ReadonlyArray<string>> = [
  ['in', 'progress'],
  ['charted'],
  ['reopened'],
  ['route', 'walked'],
]
const CLOSED_LEADS: ReadonlyArray<ReadonlyArray<string>> = [['done'], ['destination', 'reached']]

const WORD = /^[\p{L}\p{N}-]+/u

/** The value's words as the leads are compared: `**` stripped, any case. */
const wordsOf = (value: string): ReadonlyArray<string> =>
  value
    .split(/\s+/)
    .filter((token) => token !== '')
    .map((token) => WORD.exec(token)?.[0]?.toLowerCase() ?? '')

const ledBy = (words: ReadonlyArray<string>, leads: ReadonlyArray<ReadonlyArray<string>>) =>
  leads.some((lead) => lead.every((word, index) => words[index] === word))

export function readMapStatus(body: string): MapStatus {
  const value = (headerValue(readHeaderLines(body), 'status') ?? '').replaceAll('**', '').trim()
  if (value === '') return { state: 'open', unknown: null }
  const words = wordsOf(value)
  if (ledBy(words, CLOSED_LEADS)) return { state: 'closed', unknown: null }
  if (ledBy(words, OPEN_LEADS)) return { state: 'open', unknown: null }
  const first = value.split(/\s+/)[0] ?? value
  return { state: 'open', unknown: WORD.exec(first)?.[0] ?? first }
}
