/**
 * Writes the mirror's truth file: the careful reading of every Markdown file of the corpus,
 * under its mirror path, in the shape of the local-forms fixture's truth.
 *
 *   node truth.ts --corpus <dir> --records <dir> --shift-days <n> --out <truth.json>
 *
 * `--records` holds the survey's `batch-<k>.jsonl` files, one record per file with its real
 * `path`, its `kind` and the careful reader's `human_state`, and `truth-134.jsonl`, the
 * readings ticket 134 settled for the files the survey could not call, with their
 * disagreements. Those override the survey.
 *
 * Every other field is read from the mirror's own text, under the rules map 130 decided:
 *
 * - State (ticket 134): a closed ticket is closed; an open one is claimed when its `Assignee:`
 *   line names someone or its Status line holds a claim. A map is closed only when its Status
 *   line leads with `DONE` or `destination reached`. There is no "in progress".
 * - Type, AFK or HITL, blockers and membership (ticket 137): header lines before the first H2;
 *   type from `Type:`, `Label:` and `Labels:`, never the H1, and none when they disagree;
 *   each comma-separated `Blocked by:` or `Blocks:` item names the ticket at its start.
 * - Resolution (ticket 138): `## Answer`, else the last Resolution heading or bold label,
 *   else, on a closed ticket only, the last entry under the last `## Comments`.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import type { MapReading, ResolutionPlacement, TicketReading } from '../../local-forms/forms.ts'
import { type LineContext, planCorpus, relinker, sanitizeFile } from './sanitize.ts'

export type TicketType = NonNullable<TicketReading['type']>
export type TriageRole = NonNullable<TicketReading['role']>

/** Evidence a file's own lines don't declare, and that contradicts them (ticket 134). */
type Disagreements = { readonly disagreements?: ReadonlyArray<string> }

export type FileTruth =
  | ({
      readonly path: string
      readonly kind: 'ticket'
      readonly reading: TicketReading
    } & Disagreements)
  | ({ readonly path: string; readonly kind: 'map'; readonly reading: MapReading } & Disagreements)
  | { readonly path: string; readonly kind: 'note'; readonly reading: null }

interface SurveyRecord {
  readonly path: string
  readonly kind: string
  readonly human_state: string
}

/** One reading ticket 134 settled, by real path. */
interface SettledReading {
  readonly path: string
  readonly kind: 'ticket' | 'map'
  readonly state: 'open' | 'closed'
  readonly claimed?: boolean
  readonly disagreements: ReadonlyArray<string>
}

const TYPES: ReadonlyArray<string> = ['research', 'prototype', 'grilling', 'task']
const ROLES: ReadonlyArray<string> = [
  'needs-triage',
  'needs-info',
  'ready-for-agent',
  'ready-for-human',
  'wontfix',
]

const FENCE = /^\s*(```|~~~)/

/** The `Key: value` lines before the first H2, in any style, by lower-case key: the first wins. */
export function headerLines(body: string): Map<string, string> {
  const header = new Map<string, string>()
  let inFence = false
  for (const line of body.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence
    if (inFence) continue
    if (/^##\s/.test(line)) break
    const match = /^\s*(?:[-*]\s+)?\**([A-Za-z][A-Za-z ]*?)\**\s*:\**\s*(.*)$/.exec(line)
    if (match === null) continue
    const key = match[1]!.toLowerCase()
    if (!header.has(key)) header.set(key, match[2]!.replace(/^\*\*\s*/, '').trim())
  }
  return header
}

const plainStatus = (header: Map<string, string>): string =>
  (header.get('status') ?? '').replaceAll('*', '').trim()

/** The triage role a Status line or a `Labels:` line names. */
export function triageRole(header: Map<string, string>): TriageRole | null {
  const status = plainStatus(header)
  const lead = /^([a-z-]+)/i.exec(status)?.[1]?.toLowerCase()
  if (lead !== undefined && ROLES.includes(lead)) return lead as TriageRole
  const after = /^open\s*(?:—|–|-|\()\s*([a-z-]+)/i.exec(status)?.[1]?.toLowerCase()
  if (after !== undefined && ROLES.includes(after)) return after as TriageRole
  for (const label of (header.get('labels') ?? '').split(',')) {
    const word = label.trim().toLowerCase()
    if (ROLES.includes(word)) return word as TriageRole
  }
  return null
}

/** Who the `Assignee:` line names, before any parenthesis or dash; null for none. */
export function assignee(value: string | undefined): string | null {
  const text = (value ?? '').replaceAll('*', '').trim()
  if (text === '' || /^(?:—|–|-|\(?unclaimed\b|\(?none\b)/i.test(text)) return null
  const name = text.split(/\s+\(|\s+[—–]\s+|\s+-\s+/)[0]!.trim()
  return name === '' ? null : name
}

/** The type and AFK or HITL that `Type:`, `Label:` and `Labels:` give: no type when they disagree. */
export function typeAndMode(header: Map<string, string>): Pick<TicketReading, 'type' | 'mode'> {
  const found: Array<{ type: string; mode: 'AFK' | 'HITL' | null }> = []
  const read = (value: string) => {
    const match = /^(?:wayfinder:)?([a-z]+)\b\s*(?:\(\s*(AFK|HITL)\b)?/i.exec(value.trim())
    if (match === null || !TYPES.includes(match[1]!.toLowerCase())) return
    found.push({
      type: match[1]!.toLowerCase(),
      mode: (match[2]?.toUpperCase() ?? null) as 'AFK' | 'HITL' | null,
    })
  }
  for (const key of ['type', 'label']) if (header.has(key)) read(header.get(key)!)
  for (const label of splitItems(header.get('labels') ?? '')) {
    if (/^wayfinder:/i.test(label.trim())) read(label)
  }
  const types = new Set(found.map((entry) => entry.type))
  if (types.size !== 1) return { type: null, mode: null }
  return {
    type: [...types][0] as TicketType,
    mode: found.find((entry) => entry.mode !== null)?.mode ?? null,
  }
}

/** Text that starts with a reference: a Markdown link, a bare `NN-<slug>.md`, or `NN` or `#NN`. */
const STARTS_WITH_REFERENCE =
  /^\s*(?:\[[^\]]*\]\(|(?:[^\s/]*\/)?\d+-[^\s/]*\.md\b|#?\d{1,3}(?![\d-]))/

/**
 * A header value's items, outside brackets and parentheses: a comma always splits; a semicolon
 * splits only before a reference, and is otherwise part of the item's annotation (ticket 145).
 */
export function splitItems(value: string): string[] {
  const items: string[] = []
  let depth = 0
  let current = ''
  for (const [index, character] of [...value].entries()) {
    if (character === '(' || character === '[') depth++
    if ((character === ')' || character === ']') && depth > 0) depth--
    const splits =
      depth === 0 &&
      (character === ',' ||
        (character === ';' && STARTS_WITH_REFERENCE.test([...value].slice(index + 1).join(''))))
    if (splits) {
      items.push(current)
      current = ''
    } else current += character
  }
  items.push(current)
  return items.map((item) => item.trim()).filter((item) => item !== '')
}

/**
 * The tickets a `Blocked by:` or `Blocks:` value names, in order: per item, a link to a ticket
 * file, a bare `NN-<slug>.md` or a leading `NN` or `#NN` at its start. A none marker names none.
 */
export function referencedTickets(value: string | undefined): number[] {
  const text = (value ?? '').trim()
  if (text === '' || /^(?:—|–|-|none\b|nothing\b|\(none\b|\(nothing\b)/i.test(text)) return []
  const numbers: number[] = []
  for (const item of splitItems(text)) {
    const reference =
      /^\[[^\]]*\]\((?:[^)]*\/)?(\d+)-[^)/]*\.md\)/.exec(item) ??
      /^(?:[^\s/]*\/)?(\d+)-[^\s/]*\.md\b/.exec(item) ??
      /^#?(\d{1,3})(?![\d-])/.exec(item)
    if (reference !== null && !numbers.includes(Number(reference[1]))) {
      numbers.push(Number(reference[1]))
    }
  }
  return numbers
}

const ISO = /\d{4}-\d{2}-\d{2}/
const DATED_ITEM = /^(?:[-*]\s+)(?:\*\*)?(\d{4}-\d{2}-\d{2})/

const placementOf = (heading: string, underComments: boolean): ResolutionPlacement => {
  if (/^##\s+Answer\b/i.test(heading)) return 'answer'
  return underComments && /^#{3,}\s/.test(heading) ? 'comments-resolution' : 'resolution'
}

const firstLineAfter = (lines: ReadonlyArray<string>, from: number): string | null => {
  for (let index = from; index < lines.length; index++) {
    const line = lines[index]!
    if (/^#{1,6}\s/.test(line)) return null
    if (line.trim() !== '') return line.trim()
  }
  return null
}

/** A closed ticket's one resolution (ticket 138), read from the mirror's text; none on any other ticket. */
export function resolution(body: string, closed: boolean): TicketReading['resolution'] {
  if (!closed) return null
  const lines = body.split('\n')
  let inFence = false
  let h2: string | null = null
  let answer: TicketReading['resolution'] = null
  let label: TicketReading['resolution'] = null
  let lastComments = -1
  lines.forEach((line, index) => {
    if (FENCE.test(line)) inFence = !inFence
    if (inFence) return
    if (/^##\s/.test(line)) {
      h2 = line
      if (/^##\s+Comments?\b/i.test(line)) lastComments = index
    }
    const heading = /^#{1,6}\s+(Answer|Resolution|Resolução|Resolucao)\b/i.exec(line)
    if (heading !== null && (heading[1]!.toLowerCase() !== 'answer' || /^##\s/.test(line))) {
      const placement = placementOf(
        line,
        h2 !== null && /^##\s+Comments?\b/i.test(h2) && line !== h2,
      )
      const found = {
        placement,
        firstLine: firstLineAfter(lines, index + 1) ?? '',
        at: ISO.exec(line)?.[0] ?? null,
        author: null,
      }
      if (placement === 'answer') answer ??= found
      else label = found
      return
    }
    const bold = /^\*\*(Resolution|Resolução|Resolucao)\b[^*]*\*\*(.*)$/i.exec(line)
    if (bold !== null) {
      const rest = bold[2]!.replace(/^[\s:—–-]+/, '').trim()
      label = {
        placement: 'bold-paragraph',
        firstLine: rest !== '' ? rest : (firstLineAfter(lines, index + 1) ?? ''),
        at: ISO.exec(line)?.[0] ?? null,
        author: null,
      }
    }
  })
  if (answer !== null) return answer
  if (label !== null) return label
  if (lastComments === -1) return null
  return lastComment(lines, lastComments)
}

const lastComment = (
  lines: ReadonlyArray<string>,
  comments: number,
): TicketReading['resolution'] => {
  let end = lines.length
  for (let index = comments + 1; index < lines.length; index++) {
    if (/^##\s/.test(lines[index]!)) {
      end = index
      break
    }
  }
  let entry = -1
  for (let index = comments + 1; index < end; index++) {
    if (DATED_ITEM.test(lines[index]!) || /^#{3,6}\s/.test(lines[index]!)) entry = index
  }
  if (entry !== -1 && DATED_ITEM.test(lines[entry]!)) {
    const line = lines[entry]!.trim()
    return {
      placement: 'comments-item',
      firstLine: line,
      at: DATED_ITEM.exec(line)![1]!,
      author:
        /^(?:[-*]\s+)(?:\*\*)?\d{4}-\d{2}-\d{2}(?:\*\*)?\s+\(([^)]+)\)/.exec(line)?.[1] ?? null,
    }
  }
  const from = entry === -1 ? comments + 1 : entry + 1
  for (let index = from; index < end; index++) {
    const line = lines[index]!.trim()
    if (line === '' || /^<!--.*-->$/.test(line)) continue
    return { placement: 'comments-text', firstLine: line, at: null, author: null }
  }
  return null
}

/** The ticket numbers a map's Decisions so far links, in order. */
export function decisions(body: string): number[] {
  const numbers: number[] = []
  let inSection = false
  for (const line of body.split('\n')) {
    if (/^##\s/.test(line)) inSection = /^##\s+Decisions so far\b/i.test(line)
    if (!inSection) continue
    for (const match of line.matchAll(/\]\((?:\.\/)?issues\/(\d+)-[^)]*\.md\)/g)) {
      const number = Number(match[1])
      if (!numbers.includes(number)) numbers.push(number)
    }
  }
  return numbers
}

/** Whether a map's Status line closes it: only `DONE` and `destination reached` do. */
export function mapClosed(header: Map<string, string>): boolean {
  return /^(?:DONE\b|destination reached\b)/i.test(plainStatus(header))
}

const byPath = (a: { path: string }, b: { path: string }) =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0

export function buildTruth(
  corpus: string,
  records: ReadonlyArray<SurveyRecord>,
  settled: ReadonlyArray<SettledReading>,
  shiftDays: number,
): FileTruth[] {
  const { plan, markdown } = planCorpus(corpus)
  const records_ = new Map(records.map((record) => [record.path, record]))
  const settled_ = new Map(settled.map((reading) => [reading.path, reading]))
  const missing = markdown.filter((path) => !records_.has(path))
  if (missing.length > 0 || records.length !== markdown.length) {
    throw new Error(`records and corpus differ: ${missing.length} files have no record`)
  }
  const mirror = (path: string) => posix.join('.scratch', plan.rename(path))
  const mirrored = (path: string) =>
    sanitizeFile(readFileSync(posix.join(corpus, path), 'utf8'), {
      shiftDays,
      relink: relinker(plan, path),
    } satisfies LineContext)
  const mapOf = (effort: string) =>
    markdown.find((file) => file === `${effort}/MAP.md` || file === `${effort}/map.md`)

  const files = markdown.map((path): FileTruth => {
    const record = records_.get(path)!
    const override = settled_.get(path)
    const extra =
      override !== undefined && override.disagreements.length > 0
        ? { disagreements: override.disagreements }
        : {}
    if (record.kind !== 'ticket' && record.kind !== 'map') {
      return { path: mirror(path), kind: 'note', reading: null }
    }
    const body = mirrored(path)
    const header = headerLines(body)
    if (record.kind === 'map') {
      const state = override?.state ?? (mapClosed(header) ? 'closed' : 'open')
      return {
        path: mirror(path),
        kind: 'map',
        reading: { state, decisions: decisions(body) },
        ...extra,
      }
    }

    const named = assignee(header.get('assignee'))
    const closed = (override?.state ?? record.human_state) === 'closed'
    const claimed =
      override?.claimed ?? (named !== null || /\bclaimed\b/i.test(plainStatus(header)))
    const effort = path.split('/')[0]!
    const map = mapOf(effort)
    const parentTarget = /\(([^)]+\.md)\)|^([^\s()]+\.md)/.exec(header.get('parent') ?? '')
    const parentPath =
      parentTarget === null
        ? null
        : posix.normalize(posix.join(posix.dirname(path), parentTarget[1] ?? parentTarget[2]!))
    return {
      path: mirror(path),
      kind: 'ticket',
      reading: {
        state: closed ? 'closed' : claimed ? 'claimed' : 'open',
        role: triageRole(header),
        assignee: named,
        ...typeAndMode(header),
        map: map === undefined ? null : mirror(map),
        parent:
          parentPath === null || parentPath === map || !markdown.includes(parentPath)
            ? null
            : mirror(parentPath),
        blockedBy: referencedTickets(header.get('blocked by')),
        blocks: referencedTickets(header.get('blocks')),
        resolution: resolution(body, closed),
      },
      ...extra,
    }
  })
  return files.sort(byPath)
}

const readJsonl = <T>(file: string): T[] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T)

function main(): void {
  const { values } = parseArgs({
    options: {
      corpus: { type: 'string' },
      records: { type: 'string' },
      'shift-days': { type: 'string' },
      out: { type: 'string' },
    },
  })
  const shiftDays = Number(values['shift-days'])
  const { corpus, records, out } = values
  if (
    corpus === undefined ||
    records === undefined ||
    out === undefined ||
    !Number.isInteger(shiftDays)
  ) {
    throw new Error('usage: truth.ts --corpus <dir> --records <dir> --shift-days <n> --out <file>')
  }
  const batches = readdirSync(records)
    .filter((name) => /^batch-\d+\.jsonl$/.test(name))
    .sort()
    .flatMap((name) => readJsonl<SurveyRecord>(posix.join(records, name)))
  const settled = readJsonl<SettledReading>(posix.join(records, 'truth-134.jsonl'))
  const files = buildTruth(corpus, batches, settled, shiftDays)
  writeFileSync(out, `${JSON.stringify(files, null, 2)}\n`)
  const count = (kind: string) => files.filter((file) => file.kind === kind).length
  const disagreeing = files.filter((file) => 'disagreements' in file).length
  console.log(
    `${files.length} files: ${count('ticket')} tickets, ${count('map')} maps, ${count('note')} notes; ${disagreeing} with disagreements`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
