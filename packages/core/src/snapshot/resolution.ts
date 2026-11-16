import { lines, stripComments } from './markdown.ts'
import type { Resolution } from './model.ts'
import type { DriftWarning } from './warnings.ts'

/**
 * A closed local ticket's one resolution (#138), with the drift its placement raises: none for
 * `## Answer`, a quiet `resolution-outside-answer` naming a Resolution label's form, or a quiet
 * `resolution-from-last-comment` naming the comment's.
 */
export interface LocalResolution {
  readonly resolution: Resolution
  readonly warning: DriftWarning | null
}

/**
 * The words a Resolution label's first word may be, compared with case and diacritics folded:
 * the English word, and the second-language word, written accented (`Resolução`) or not.
 */
const RESOLUTION_WORDS: ReadonlySet<string> = new Set(['resolution', 'resolucao'])

const FENCE = /^\s*(```|~~~)/
const ATX_HEADING = /^(#{1,6})(?:\s+(.*))?$/
const BOLD_LABEL = /^\*\*([^*]+)\*\*(.*)$/
const LIST_ITEM = /^(?:[-*+]|\d+[.)])\s/
const DATED_ITEM = /^[-*]\s+(?:\*\*)?(\d{4}-\d{2}-\d{2})(?:\*\*)?(?:\s+\(([^)]+)\))?/
const ISO_DATE = /\d{4}-\d{2}-\d{2}/

interface Line {
  readonly text: string
  /** The line's ATX heading, outside code fences; null for any other line. */
  readonly heading: { readonly level: number; readonly text: string } | null
  /** Whether the line is a fence or inside one, where nothing is a label or an entry. */
  readonly fenced: boolean
}

/**
 * Reads a closed local ticket's resolution from its body, by #138's order. Call it on a closed
 * ticket only: an open ticket has no resolution, whatever its comments or headings hold.
 *
 * 1. `## Answer`, the first one.
 * 2. Otherwise, the last Resolution label outside code fences: a heading at any level, or a bold
 *    label leading a paragraph, whose first word is `Resolution` or the second-language word.
 *    A bold `**Resolved**` or `**Done**`, and `## Decision`, are not labels.
 * 3. Otherwise, the last entry under the last `## Comments`: its last dated item, its last `###`
 *    subsection, or its trailing text.
 *
 * A candidate with nothing in its body holds no resolution, and the next one in that order is
 * read: an empty `## Answer` reads as no answer, as it always has.
 *
 * The label line is never part of the body. A heading's body runs to the next heading of the
 * same or a higher level; a bold label's from the text after it to the next heading; a dated
 * item is its own line plus its continuation lines. `at` is the first ISO date on the label line
 * or the dated item, `author` the `(<person>)` right after a dated item's date; nothing is taken
 * from prose. Null when nothing holds a resolution.
 */
export function readLocalResolution(body: string): LocalResolution | null {
  const all = readLines(body)
  return answerOf(all) ?? labelOf(all) ?? lastCommentOf(all)
}

function readLines(body: string): ReadonlyArray<Line> {
  let fenced = false
  return lines(stripComments(body)).map((text): Line => {
    if (FENCE.test(text)) {
      fenced = !fenced
      return { text, heading: null, fenced: true }
    }
    if (fenced) return { text, heading: null, fenced: true }
    const match = ATX_HEADING.exec(text)
    if (match?.[1] === undefined) return { text, heading: null, fenced: false }
    const title = (match[2] ?? '').replace(/\s+#+\s*$/, '').trim()
    return { text, heading: { level: match[1].length, text: title }, fenced: false }
  })
}

/** The first `## Answer` with something in it. It raises nothing: it is the convention. */
function answerOf(all: ReadonlyArray<Line>): LocalResolution | null {
  for (const [index, line] of all.entries()) {
    if (line.heading?.level !== 2 || foldedFirstWord(line.heading.text) !== 'answer') continue
    const text = bodyText(all, index + 1, sectionEnd(all, index + 1, 2))
    if (text === '') continue
    return { resolution: { body: text, author: null, at: null }, warning: null }
  }
  return null
}

/**
 * The last Resolution heading or bold label with something in it, read when the ticket has no
 * `## Answer`. A heading under `## Comments` is told apart by the H2 it sits under.
 */
function labelOf(all: ReadonlyArray<Line>): LocalResolution | null {
  let found: LocalResolution | null = null
  let underComments = false
  for (const [index, line] of all.entries()) {
    const label = labelAt(all, index, underComments)
    if (line.heading !== null && line.heading.level <= 2)
      underComments = isCommentsHeading(line.heading)
    if (label === null || label.body === '') continue
    found = {
      resolution: { body: label.body, author: null, at: ISO_DATE.exec(line.text)?.[0] ?? null },
      warning: { code: 'resolution-outside-answer', detail: label.form },
    }
  }
  return found
}

/** The Resolution label on the line at `index`, with its form and body; null when there is none. */
function labelAt(
  all: ReadonlyArray<Line>,
  index: number,
  underComments: boolean,
): { readonly form: string; readonly body: string } | null {
  const line = all[index]!
  const { heading } = line
  if (heading !== null) {
    if (!RESOLUTION_WORDS.has(foldedFirstWord(heading.text))) return null
    return {
      form:
        heading.level >= 3 && underComments
          ? 'Resolution heading under ## Comments'
          : 'Resolution heading',
      body: bodyText(all, index + 1, sectionEnd(all, index + 1, heading.level)),
    }
  }
  const bold = line.fenced ? null : BOLD_LABEL.exec(line.text)
  if (bold?.[1] === undefined || !RESOLUTION_WORDS.has(foldedFirstWord(bold[1]))) return null
  if (!leadsParagraph(all, index)) return null
  // Any text after the label, on its own line, opens the body; `:` or a dash before it is the label's.
  const rest = (bold[2] ?? '').replace(/^[\s:—–-]+/, '').trim()
  const after = bodyText(all, index + 1, nextHeading(all, index + 1))
  return {
    form: 'bold Resolution label',
    body: [rest, after].filter((part) => part !== '').join('\n'),
  }
}

/**
 * The last entry under the last `## Comments`, read when the ticket has no `## Answer` and no
 * Resolution label: the last dated item, else the text of the last `###` subsection, else the
 * section's text. Mirrors GitHub, where the resolution is the last comment.
 */
function lastCommentOf(all: ReadonlyArray<Line>): LocalResolution | null {
  let start = -1
  for (const [index, line] of all.entries()) {
    if (line.heading?.level === 2 && isCommentsHeading(line.heading)) start = index
  }
  if (start === -1) return null
  const end = sectionEnd(all, start + 1, 2)

  let entry = -1
  for (let index = start + 1; index < end; index++) {
    const line = all[index]!
    if ((line.heading !== null && line.heading.level >= 3) || isDatedItem(line)) entry = index
  }

  const dated = entry === -1 ? null : DATED_ITEM.exec(all[entry]!.text)
  if (dated !== null) {
    return {
      resolution: {
        body: bodyText(all, entry, itemEnd(all, entry, end)),
        author: dated[2]?.trim() || null,
        at: dated[1] ?? null,
      },
      warning: { code: 'resolution-from-last-comment', detail: 'dated comment' },
    }
  }
  const text = bodyText(all, entry === -1 ? start + 1 : entry + 1, end)
  if (text === '') return null
  return {
    resolution: { body: text, author: null, at: null },
    warning: { code: 'resolution-from-last-comment', detail: 'comment text' },
  }
}

/** The index of the first heading at or after `from` of `level` or higher; the end when none. */
function sectionEnd(all: ReadonlyArray<Line>, from: number, level: number): number {
  for (let index = from; index < all.length; index++) {
    const { heading } = all[index]!
    if (heading !== null && heading.level <= level) return index
  }
  return all.length
}

/** The index of the next heading of any level at or after `from`; the end when none. */
const nextHeading = (all: ReadonlyArray<Line>, from: number): number => sectionEnd(all, from, 6)

/**
 * Where a dated item at `index` ends, before `end`: its continuation lines run until a heading,
 * the next list item, or a blank line that no indented line follows.
 */
function itemEnd(all: ReadonlyArray<Line>, index: number, end: number): number {
  for (let next = index + 1; next < end; next++) {
    const line = all[next]!
    if (line.heading !== null || (!line.fenced && LIST_ITEM.test(line.text))) return next
    if (line.text.trim() !== '') continue
    const following = all.slice(next + 1, end).find((candidate) => candidate.text.trim() !== '')
    if (following === undefined || !/^\s/.test(following.text) || following.heading !== null)
      return next
  }
  return end
}

/** A bold label leads a paragraph: nothing but a blank line or a heading comes right before it. */
function leadsParagraph(all: ReadonlyArray<Line>, index: number): boolean {
  const before = all[index - 1]
  return before === undefined || before.text.trim() === '' || before.heading !== null
}

const isDatedItem = (line: Line): boolean => !line.fenced && DATED_ITEM.test(line.text)

const isCommentsHeading = (heading: { readonly text: string }): boolean =>
  ['comments', 'comment'].includes(foldedFirstWord(heading.text))

/** The lines from `from` up to `end`, joined, with the blank lines around them dropped. */
const bodyText = (all: ReadonlyArray<Line>, from: number, end: number): string =>
  all
    .slice(from, end)
    .map((line) => line.text)
    .join('\n')
    .trim()

/** The text's first word, its letters only, lower case and without diacritics. */
function foldedFirstWord(text: string): string {
  const word = /^[\p{L}\p{M}]+/u.exec(text.normalize('NFD'))?.[0] ?? ''
  return word.replace(/\p{M}/gu, '').toLowerCase()
}
