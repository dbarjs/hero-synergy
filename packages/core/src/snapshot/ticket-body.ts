import { firstH1, lines, sections } from './markdown.ts'
import type { TicketType } from './model.ts'

/**
 * What a ticket body may carry besides its question: the lines the local
 * tracker and the text fallbacks use, and the headings the conventions name.
 * Reading says what is there; whether a line is the convention or drift
 * depends on the tracker, which `readSnapshot` knows.
 */
export interface TicketBody {
  /** The first H1, which titles a local ticket. */
  readonly title: string | null
  /** The map named by a `Part of #n` line. */
  readonly partOf: number | null
  /** A `Blocked by:` line: the numbers it holds and the tokens that are not numbers. */
  readonly blockedBy: {
    readonly numbers: ReadonlyArray<number>
    readonly slugs: ReadonlyArray<string>
  } | null
  /** A `Type:` line: the type it names, null when the name is not one of the four. */
  readonly type: { readonly value: TicketType | null; readonly raw: string } | null
  /** The value of a `Status:` line. */
  readonly status: string | null
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

  // The lines live at the top of the body, before any section.
  for (const raw of lines(found[0]?.text ?? '')) {
    const line = raw.trim()
    const part = /^Part of #(\d+)\b/i.exec(line)
    if (part?.[1] !== undefined && partOf === null) partOf = Number(part[1])
    const blockers = /^(?:Blocked by|blocked_by):\s*(.*)$/i.exec(line)
    if (blockers?.[1] !== undefined && blockedBy === null) blockedBy = readBlockers(blockers[1])
    const typeLine = /^Type:\s*(.+?)\s*$/i.exec(line)
    if (typeLine?.[1] !== undefined && type === null) {
      const value = typeLine[1].toLowerCase()
      type = { value: TYPES.find((known) => known === value) ?? null, raw: line }
    }
    const statusLine = /^Status:\s*(.+?)\s*$/i.exec(line)
    if (statusLine?.[1] !== undefined && status === null) status = statusLine[1]
  }

  return {
    title: firstH1(body),
    partOf,
    blockedBy,
    type,
    status,
    hasQuestion: question !== undefined,
    answer: answer === undefined || answer.text === '' ? null : answer.text,
  }
}

function readBlockers(value: string): TicketBody['blockedBy'] {
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
