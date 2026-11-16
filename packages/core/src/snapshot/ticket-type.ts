import { type HeaderLine, headerValue } from './header-lines.ts'
import type { ModeNote, TicketType } from './model.ts'
import type { DriftWarning } from './warnings.ts'

/**
 * A local ticket's type and HITL note, read from its header lines by the rules #137 settled.
 *
 * The sources are the `Type:` line, the `Label:` line and every `wayfinder:` item of the
 * `Labels:` line, which splits on commas outside parentheses. Each value is an optional
 * `wayfinder:` prefix, then its first word, which must be one of the four types. The parenthesis
 * right after that word is read only for a leading `AFK` or `HITL`, the HITL note; nothing else in
 * it is ever read, so no type or number in a note becomes data. The H1 is never a type.
 */
export interface TicketTypeReading {
  /** The one type the sources name; null when they name none, or more than one. */
  readonly type: TicketType | null
  /**
   * The leading `AFK` or `HITL` inside the parenthesis after a type word: the first source's that
   * carries one, in the order Type, Label, Labels. Kept when the sources disagree on the type, so a
   * ticket marked for a person is never read as AFK.
   */
  readonly modeNote: ModeNote | null
  /**
   * `type-several` or `type-missing`, then `type-as-label`, `mode-conflicts-type` and
   * `unknown-wayfinder-labels`, each at most once.
   */
  readonly warnings: ReadonlyArray<DriftWarning>
}

export const TICKET_TYPES: ReadonlyArray<TicketType> = ['research', 'prototype', 'grilling', 'task']

export const isTicketType = (value: string): value is TicketType =>
  (TICKET_TYPES as ReadonlyArray<string>).includes(value)

/** The `wayfinder:` labels this version knows: the map, the four types and the legacy claim. */
export const KNOWN_LABELS: ReadonlySet<string> = new Set([
  'wayfinder:map',
  ...TICKET_TYPES.map((type) => `wayfinder:${type}`),
  'wayfinder:claimed',
])

/** One line or `Labels:` item that names a type. */
interface Source {
  readonly key: 'Type' | 'Label' | 'Labels'
  /** The value or item as written, trimmed: the detail of `type-as-label` and `mode-conflicts-type`. */
  readonly value: string
  readonly prefixed: boolean
  readonly type: TicketType
  readonly note: ModeNote | null
}

/** An optional `wayfinder:` prefix, the first word, and a leading AFK or HITL in the parenthesis right after it. */
const VALUE = /^(wayfinder:)?([\p{L}-]+)(?:\s*\(\s*(AFK|HITL)(?![\p{L}\p{N}]))?/iu
const PREFIX = /^wayfinder:/i

/** Bold markers and backticks are not part of a value. */
const plain = (value: string): string => value.replace(/\*\*|`/g, '').trim()

export function readTicketType(header: ReadonlyArray<HeaderLine>): TicketTypeReading {
  const sources: Source[] = []
  const unknown: string[] = []
  let unreadType: string | null = null

  const read = (key: Source['key'], value: string): boolean => {
    const match = VALUE.exec(plain(value))
    const word = match?.[2]
    if (match === null || word === undefined) return false
    const prefixed = match[1] !== undefined
    const type = word.toLowerCase()
    if (isTicketType(type)) {
      const note = match[3]?.toUpperCase() as ModeNote | undefined
      sources.push({ key, value: value.trim(), prefixed, type, note: note ?? null })
      return true
    }
    if (prefixed && !KNOWN_LABELS.has(`wayfinder:${type}`)) unknown.push(`wayfinder:${word}`)
    return false
  }

  const typeLine = headerValue(header, 'type')
  if (typeLine !== null && typeLine !== '' && !read('Type', typeLine)) unreadType = typeLine
  const labelLine = headerValue(header, 'label')
  if (labelLine !== null) read('Label', labelLine)
  for (const item of splitOutsideParentheses(headerValue(header, 'labels') ?? '')) {
    if (PREFIX.test(plain(item))) read('Labels', item)
  }

  const warnings: DriftWarning[] = []
  const types = [...new Set(sources.map((source) => source.type))]
  if (types.length > 1) warnings.push({ code: 'type-several', detail: types.join(', ') })
  else if (types.length === 0)
    warnings.push({
      code: 'type-missing',
      ...(unreadType === null ? {} : { detail: `Type: ${unreadType}` }),
    })
  const labelled = sources.filter((source) => source.key !== 'Type' || source.prefixed)
  if (labelled.length > 0)
    warnings.push({
      code: 'type-as-label',
      detail: labelled.map((source) => source.value).join(', '),
    })

  const type = types.length === 1 ? (types[0] ?? null) : null
  const noted = sources.find((source) => source.note !== null)
  const modeNote = noted?.note ?? null
  // A note can take a ticket out of AFK, never put one in.
  if (noted !== undefined && modeNote === 'AFK' && (type === 'prototype' || type === 'grilling'))
    warnings.push({ code: 'mode-conflicts-type', detail: noted.value })
  if (unknown.length > 0)
    warnings.push({ code: 'unknown-wayfinder-labels', detail: unknown.join(', ') })

  return { type, modeNote, warnings }
}

/** A `Labels:` value's items: split on commas outside parentheses and brackets, trimmed, empty ones dropped. */
function splitOutsideParentheses(value: string): string[] {
  const items: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    if (character === '(' || character === '[') depth++
    else if ((character === ')' || character === ']') && depth > 0) depth--
    else if (depth === 0 && character === ',') {
      items.push(value.slice(start, index))
      start = index + 1
    }
  }
  items.push(value.slice(start))
  return items.map((item) => item.trim()).filter((item) => item !== '')
}
