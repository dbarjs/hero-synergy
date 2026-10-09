/**
 * Writes the mirror's truth file: the careful reading of every Markdown file of the corpus,
 * under its mirror path.
 *
 *   node truth.ts --corpus <dir> --records <dir> --shift-days <n> --out <truth.json>
 *
 * `--records` holds the survey's `batch-<k>.jsonl` files, one record per file with its real
 * `path`, its `kind` and, for a ticket or a map, the careful reader's `human_state`. The rest
 * of a ticket's reading comes from its own header lines, read as a careful reader does:
 *
 * - `type`: the `wayfinder:<type>` of a `Label:` or `Labels:` line, else a `Type:` line, else
 *   the H1's `Research:`, `Grilling:`, `Prototype:` or `Task:` prefix.
 * - `blockedBy`: every number of the `Blocked by:` line, dates aside, that names a ticket of
 *   the same effort (a link, a file name or a bare number).
 * - `map`: the effort's map file, when it has one.
 * - `resolution`: the line that opens the resolution, as the mirror writes it, and the H2 it
 *   sits under (`null` when the line is an H2 itself). The last `Answer` or `Resolution`
 *   heading or bold `Resolution` lead; without one, a `## Decision` section; without that,
 *   the last dated comment under `## Comments`.
 *
 * The files ticket 134 settles are marked `settled: false`: tickets whose Status line leads
 * with `ready-for-human` or holds both a DONE and an OPEN half, maps whose Status line leads
 * with `route walked` or that have none, and the map whose tickets carry a PRD `Parent:` line,
 * with those tickets.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { type LineContext, planCorpus, relinker, sanitizeLine } from './sanitize.ts'

export type TicketType = 'research' | 'prototype' | 'grilling' | 'task'

export interface TicketTruth {
  readonly path: string
  readonly kind: 'ticket'
  readonly state: string
  readonly settled: boolean
  readonly type: TicketType | null
  readonly blockedBy: ReadonlyArray<number>
  readonly map: string | null
  readonly resolution: { readonly section: string | null; readonly lead: string } | null
}

export interface MapTruth {
  readonly path: string
  readonly kind: 'map'
  readonly state: string
  readonly settled: boolean
}

export interface NoteTruth {
  readonly path: string
  readonly kind: 'note'
  readonly note: string
}

export type FileTruth = TicketTruth | MapTruth | NoteTruth

interface SurveyRecord {
  readonly path: string
  readonly kind: string
  readonly human_state: string
}

const TYPES: ReadonlyArray<TicketType> = ['research', 'prototype', 'grilling', 'task']

/** The `Key: value` lines before the first H2, in any style, by lower-case key. */
export function headerLines(body: string): Map<string, string> {
  const header = new Map<string, string>()
  for (const line of body.split('\n')) {
    if (/^##\s/.test(line)) break
    const match = /^\s*(?:[-*]\s+)?\**([A-Za-z][A-Za-z ]*?)\**\s*:\**\s*(.*)$/.exec(line)
    if (match === null) continue
    const key = match[1]!.toLowerCase()
    if (!header.has(key)) header.set(key, match[2]!.replace(/^\*\*\s*/, ''))
  }
  return header
}

export function ticketType(body: string, header: Map<string, string>): TicketType | null {
  for (const key of ['label', 'labels']) {
    const found = /wayfinder:(research|prototype|grilling|task)\b/.exec(header.get(key) ?? '')
    if (found !== null) return found[1] as TicketType
  }
  const typed = /^\s*(\w+)/.exec(header.get('type') ?? '')?.[1]?.toLowerCase()
  if (typed !== undefined && (TYPES as ReadonlyArray<string>).includes(typed))
    return typed as TicketType
  const prefix = /^# (\w+):/m.exec(body)?.[1]?.toLowerCase()
  if (prefix !== undefined && (TYPES as ReadonlyArray<string>).includes(prefix))
    return prefix as TicketType
  return null
}

/**
 * The tickets a `Blocked by:` value names: every linked or written ticket file, and every bare
 * number standing as a list item (`03, 07`, `— (01 closed …; 03 closed …)`, `ticket 05`).
 * A number inside link text or prose (`steps 1–3`, `lorem 8`) names no ticket, and nor does
 * a pointer after an empty value (`— (but read 12 below …)`).
 */
export function blockers(
  value: string | undefined,
  tickets: ReadonlySet<number>,
  self: number,
): number[] {
  if (value === undefined || /^(?:—|none)\s*\(but\b/i.test(value.trim())) return []
  const found = new Set<number>()
  const add = (number: number) => {
    if (number !== self && tickets.has(number)) found.add(number)
  }
  for (const match of value.matchAll(/(?:^|[(/\s[])(\d{1,3})-[^\s()/]*\.md\b/g))
    add(Number(match[1]))
  const text = value
    .replaceAll(/\[[^\]]*\]\([^)]*\)/g, ' <link> ')
    .replaceAll(/\b\d{1,3}-[^\s()]*\.md\b/g, ' <file> ')
    .replaceAll(/\d{4}-\d{2}-\d{2}/g, '<date>')
  const item =
    /(?:^|[,;(]\s*|\band\s+|\bticket\s+|^—\s*\(?)(\d{1,3})(?=$|[,;)]|\s+(?:\(|—|–|-|and\b|closed\b|resolved\b|done\b|\())/gi
  for (const match of text.matchAll(item)) add(Number(match[1]))
  return [...found].sort((a, b) => a - b)
}

const RESOLUTION = /^(?:#{2,3}\s+(?:Answer|Resolution|Resolução)\b|\*\*(?:Resolution|Resolução)\b)/
const DATED_COMMENT = /^(?:[-*]\s+)?(?:\*\*)?\d{4}-\d{2}-\d{2}/

export function resolutionLine(
  body: string,
  context: LineContext,
  closed = true,
): { section: string | null; lead: string } | null {
  let section: string | null = null
  let lead: { section: string | null; lead: string } | null = null
  let decision: { section: null; lead: string } | null = null
  let comment: { section: string | null; lead: string } | null = null
  let inFence = false
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) continue
    if (/^##\s/.test(line)) section = sanitizeLine(line, context)
    if (RESOLUTION.test(line)) {
      lead = { section: /^##\s/.test(line) ? null : section, lead: sanitizeLine(line, context) }
    } else if (/^##\s+Decision\b/.test(line)) {
      decision = { section: null, lead: sanitizeLine(line, context) }
    } else if (/^##\s+Comment\s*\(\d{4}/.test(line)) {
      comment = { section: null, lead: sanitizeLine(line, context) }
    } else if (
      section !== null &&
      /^## (?:Comment|Comentário)/.test(section) &&
      DATED_COMMENT.test(line)
    ) {
      comment = { section, lead: sanitizeLine(line, context) }
    }
  }
  return lead ?? (closed ? (decision ?? comment) : null)
}

const statusValue = (header: Map<string, string>): string | undefined =>
  header.get('status')?.replaceAll('*', '').trim()

export function buildTruth(
  corpus: string,
  records: ReadonlyArray<SurveyRecord>,
  shiftDays: number,
): FileTruth[] {
  const { plan, markdown } = planCorpus(corpus)
  const byPath = new Map(records.map((record) => [record.path, record]))
  const missing = markdown.filter((path) => !byPath.has(path))
  if (missing.length > 0 || records.length !== markdown.length) {
    throw new Error(`records and corpus differ: ${missing.length} files have no record`)
  }
  const mirror = (path: string) => posix.join('.scratch', plan.rename(path))
  const effortOf = (path: string) => path.split('/')[0]!
  const read = (path: string) => readFileSync(posix.join(corpus, path), 'utf8')

  const prdEfforts = new Set<string>()
  for (const record of records) {
    if (record.kind !== 'ticket') continue
    if (/\(\.\.\/PRD\.md\)/.test(headerLines(read(record.path)).get('parent') ?? '')) {
      prdEfforts.add(effortOf(record.path))
    }
  }

  const files = markdown.map((path): FileTruth => {
    const record = byPath.get(path)!
    const body = read(path)
    const header = headerLines(body)
    const status = statusValue(header)
    const effort = effortOf(path)
    if (record.kind === 'map') {
      const settled =
        status !== undefined && !/^route walked/i.test(status) && !prdEfforts.has(effort)
      return { path: mirror(path), kind: 'map', state: record.human_state, settled }
    }
    if (record.kind !== 'ticket') return { path: mirror(path), kind: 'note', note: record.kind }

    const self = Number(/^(\d+)/.exec(posix.basename(path))?.[1])
    const issues = posix.join(effort, 'issues')
    const tickets = new Set(
      markdown
        .filter((file) => posix.dirname(file) === issues)
        .map((file) => Number(/^(\d+)/.exec(posix.basename(file))?.[1]))
        .filter((number) => Number.isInteger(number)),
    )
    const map = markdown.find((file) => file === `${effort}/MAP.md` || file === `${effort}/map.md`)
    const parentPrd = /\(\.\.\/PRD\.md\)/.test(header.get('parent') ?? '')
    const settled =
      status !== undefined &&
      !/^ready-for-human/i.test(status) &&
      !(/\bDONE\b/.test(status) && /\bOPEN\b/.test(status)) &&
      !parentPrd
    const context: LineContext = { shiftDays, relink: relinker(plan, path) }
    return {
      path: mirror(path),
      kind: 'ticket',
      state: record.human_state,
      settled,
      type: ticketType(body, header),
      blockedBy: blockers(header.get('blocked by'), tickets, self),
      map: map === undefined ? null : mirror(map),
      resolution: resolutionLine(body, context, record.human_state === 'closed'),
    }
  })
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

const readRecords = (directory: string): SurveyRecord[] =>
  readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
    .flatMap((name) =>
      readFileSync(posix.join(directory, name), 'utf8')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as SurveyRecord),
    )

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
  if (
    values.corpus === undefined ||
    values.records === undefined ||
    values.out === undefined ||
    !Number.isInteger(shiftDays)
  ) {
    throw new Error('usage: truth.ts --corpus <dir> --records <dir> --shift-days <n> --out <file>')
  }
  const files = buildTruth(values.corpus, readRecords(values.records), shiftDays)
  writeFileSync(values.out, `${JSON.stringify({ files }, null, 2)}\n`)
  const count = (kind: string) => files.filter((file) => file.kind === kind).length
  const unsettled = files.filter((file) => file.kind !== 'note' && !file.settled).length
  console.log(
    `${files.length} files: ${count('ticket')} tickets, ${count('map')} maps, ${count('note')} notes; ${unsettled} unsettled`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
