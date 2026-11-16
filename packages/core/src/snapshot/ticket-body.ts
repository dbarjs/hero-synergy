import { type HeaderLine, headerValue, readHeaderLines } from './header-lines.ts'
import { firstH1, lines, sections } from './markdown.ts'
import type { TicketType } from './model.ts'

/** A `Blocked by:` value: the numbers it holds and the tokens that are not numbers. */
export interface BlockersLine {
  readonly numbers: ReadonlyArray<number>
  readonly slugs: ReadonlyArray<string>
}

/** A `Type:` value: the type it names, null when the name is not one of the four. */
export interface TypeLine {
  readonly value: TicketType | null
  readonly raw: string
}

/** The lines a ticket's facts are read from, before the tracker decides which count. */
export interface TicketLines {
  readonly blockedBy: BlockersLine | null
  readonly type: TypeLine | null
  /** The value of a `Status:` line. */
  readonly status: string | null
  /** The labels a `Labels:` line names, comma- or space-separated, backticks dropped; null with no line. */
  readonly labels: ReadonlyArray<string> | null
}

/**
 * What a ticket body may carry besides its question: the lines the local
 * tracker and the text fallbacks use, and the headings the conventions name.
 * Reading says what is there; whether a line is the convention or drift
 * depends on the tracker, which `readSnapshot` knows.
 */
export interface TicketBody extends TicketLines {
  /** The first H1, which titles a local ticket. */
  readonly title: string | null
  /** The map named by a `Part of #n` line. */
  readonly partOf: number | null
  /**
   * The header lines a local ticket's facts come from. `blockedBy`, `type` and
   * `status` are the text fallbacks GitHub reads: any such line before the first H2.
   */
  readonly header: ReadonlyArray<HeaderLine>
  /** Whether a `## Question` heading is there. */
  readonly hasQuestion: boolean
  /** The text under `## Answer`, which holds a local ticket's resolution. */
  readonly answer: string | null
}

const TYPES: ReadonlyArray<TicketType> = ['research', 'prototype', 'grilling', 'task']
const EMPTY_BLOCKERS = new Set(['', '[]', 'none', '-', '—'])

export function readTicketBody(body: string): TicketBody {
  const found = sections(body)
  const question = found.find((section) => section.key === 'question')
  const answer = found.find((section) => section.key === 'answer')

  let partOf: number | null = null
  let blockedBy: TicketBody['blockedBy'] = null
  let type: TicketBody['type'] = null
  let status: string | null = null
  let labels: ReadonlyArray<string> | null = null

  // The lines live at the top of the body, before any section.
  for (const raw of lines(found[0]?.text ?? '')) {
    const line = raw.trim()
    const part = /^Part of #(\d+)\b/i.exec(line)
    if (part?.[1] !== undefined && partOf === null) partOf = Number(part[1])
    const blockers = /^(?:Blocked by|blocked_by):\s*(.*)$/i.exec(line)
    if (blockers?.[1] !== undefined && blockedBy === null) blockedBy = readBlockers(blockers[1])
    const typeLine = /^Type:\s*(.+?)\s*$/i.exec(line)
    if (typeLine?.[1] !== undefined && type === null) type = readType(typeLine[1], line)
    const statusLine = /^Status:\s*(.+?)\s*$/i.exec(line)
    if (statusLine?.[1] !== undefined && status === null) status = statusLine[1]
    const labelsLine = /^Labels:\s*(.*)$/i.exec(line)
    if (labelsLine?.[1] !== undefined && labels === null) labels = readLabels(labelsLine[1])
  }

  return {
    title: firstH1(body),
    partOf,
    blockedBy,
    type,
    status,
    labels,
    header: readHeaderLines(body),
    hasQuestion: question !== undefined,
    answer: answer === undefined || answer.text === '' ? null : answer.text,
  }
}

/** The same lines read from a local ticket's header lines, where a bold key counts too. */
export function headerTicketLines(header: ReadonlyArray<HeaderLine>): TicketLines {
  const blockedBy = headerValue(header, 'blocked by')
  const type = headerValue(header, 'type')
  const status = headerValue(header, 'status')
  const labels = headerValue(header, 'labels')
  return {
    blockedBy: blockedBy === null ? null : readBlockers(blockedBy),
    type: type === null || type === '' ? null : readType(type, `Type: ${type}`),
    status: status === null || status === '' ? null : status,
    labels: labels === null ? null : readLabels(labels),
  }
}

function readType(value: string, raw: string): TypeLine {
  const name = value.toLowerCase()
  return { value: TYPES.find((known) => known === name) ?? null, raw }
}

function readBlockers(value: string): BlockersLine {
  const tokens = value
    .replace(/[[\]]/g, '')
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => !EMPTY_BLOCKERS.has(token.toLowerCase()))
  const numbers: number[] = []
  const slugs: string[] = []
  for (const token of tokens) {
    const number = /^#?(\d+)$/.exec(token)
    if (number?.[1] !== undefined) numbers.push(Number(number[1]))
    else slugs.push(token)
  }
  return { numbers, slugs }
}

/** A `Labels:` value, split on commas only: a label may hold a space (`good first issue`). */
function readLabels(value: string): ReadonlyArray<string> {
  return value
    .split(',')
    .map((token) => token.replace(/`/g, '').trim())
    .filter((token) => token !== '')
}
