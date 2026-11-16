import { type HeaderLine, headerValue, readHeaderLines } from './header-lines.ts'
import { firstH1, lines, sections } from './markdown.ts'
import type { TicketType } from './model.ts'
import { type ReferenceLine, readReferenceLine } from './reference-line.ts'
import { isTicketType } from './ticket-type.ts'

/** A GitHub `Blocked by:` text line: the numbers it holds and the tokens that are not numbers. */
export interface BlockersLine {
  readonly numbers: ReadonlyArray<number>
  readonly slugs: ReadonlyArray<string>
}

/** A `Type:` value: the type it names, null when the name is not one of the four. */
export interface TypeLine {
  readonly value: TicketType | null
  readonly raw: string
}

/**
 * The lines a ticket's facts are read from, before the tracker decides which count. A local
 * ticket's Status and Assignee lines are read from its header lines by `readTicketStatus`.
 */
export interface TicketLines {
  readonly blockedBy: BlockersLine | null
  readonly type: TypeLine | null
  /** The labels a `Labels:` line names, comma- or space-separated, backticks dropped; null with no line. */
  readonly labels: ReadonlyArray<string> | null
}

/**
 * What a ticket body may carry besides its question: the lines the local
 * tracker and the text fallbacks use, and the headings the conventions name.
 * Reading says what is there; whether a line is the convention or drift
 * depends on the tracker, which `readSnapshot` knows. A local ticket's
 * resolution is read by `readLocalResolution`, on closed tickets only.
 */
export interface TicketBody extends TicketLines {
  /** The first H1, which titles a local ticket. */
  readonly title: string | null
  /** The map named by a `Part of #n` line. */
  readonly partOf: number | null
  /**
   * The header lines a local ticket's facts come from. `blockedBy` and `type` are
   * the text fallbacks GitHub reads: any such line before the first H2.
   */
  readonly header: ReadonlyArray<HeaderLine>
  /** Whether a `## Question` heading is there. */
  readonly hasQuestion: boolean
}

const EMPTY_BLOCKERS = new Set(['', '[]', 'none', '-', '—'])

export function readTicketBody(body: string): TicketBody {
  const found = sections(body)
  const question = found.find((section) => section.key === 'question')

  let partOf: number | null = null
  let blockedBy: TicketBody['blockedBy'] = null
  let type: TicketBody['type'] = null
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
    const labelsLine = /^Labels:\s*(.*)$/i.exec(line)
    if (labelsLine?.[1] !== undefined && labels === null) labels = readLabels(labelsLine[1])
  }

  return {
    title: firstH1(body),
    partOf,
    blockedBy,
    type,
    labels,
    header: readHeaderLines(body),
    hasQuestion: question !== undefined,
  }
}

/**
 * A local ticket's lines, read from its header lines, where a bold key counts too. Its
 * `Blocked by:` and `Blocks:` values are read by the local item grammar, not GitHub's text fallback;
 * its type and HITL note by `readTicketType`, from `Type:`, `Label:` and `Labels:`.
 */
export interface LocalTicketLines extends Omit<TicketLines, 'blockedBy' | 'type'> {
  readonly blockedBy: ReferenceLine | null
  readonly blocks: ReferenceLine | null
}

/** The same lines read from a local ticket's header lines. */
export function headerTicketLines(header: ReadonlyArray<HeaderLine>): LocalTicketLines {
  const blockedBy = headerValue(header, 'blocked by')
  const blocks = headerValue(header, 'blocks')
  const labels = headerValue(header, 'labels')
  return {
    blockedBy: blockedBy === null ? null : readReferenceLine(blockedBy),
    blocks: blocks === null ? null : readReferenceLine(blocks),
    labels: labels === null ? null : readLabels(labels),
  }
}

/** GitHub's `Type:` text fallback: the whole value, in any case, must be one of the four types. */
function readType(value: string, raw: string): TypeLine {
  const name = value.toLowerCase()
  return { value: isTicketType(name) ? name : null, raw }
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
export function readLabels(value: string): ReadonlyArray<string> {
  return value
    .split(',')
    .map((token) => token.replace(/`/g, '').trim())
    .filter((token) => token !== '')
}
