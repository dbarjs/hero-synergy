/**
 * Turns a private local tracker into the scratch mirror: every effort and Markdown file kept
 * in its structure, its text replaced under an allowlist.
 *
 *   node sanitize.ts --corpus <dir> --out <dir> --shift-days <n> --path-map <file>
 *
 * Kept: the words of `vocabulary.ts`, Markdown structure and punctuation, ticket numbers (one
 * or two digits), dates moved by `--shift-days`, and the links between files with their
 * targets renamed, bare `NN-<slug>.md` names included. Replaced: every other word, collapsed to one placeholder per run; a line
 * left with nothing kept collapses to `Lorem ipsum.`; larger numbers become `100`; URLs off
 * GitHub's hero-synergy and skills repos become `https://example.com/`. Effort directories
 * become `effort-NN` in their sorted order, `NN-<slug>` names become `NN-ticket`, `NN-folder`
 * or `NN-note`, other names `note-<k>`. Non-Markdown files are dropped.
 *
 * `--path-map` writes the real-to-mirror path map as JSON: it holds the real names, so it
 * stays beside the corpus and is never committed.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { KEPT_NAMES, SIGNAL_WORDS, SOFT_WORDS } from './vocabulary.ts'

export const PLACEHOLDER = 'lorem'
export const PROSE_LINE = 'Lorem ipsum.'
export const PLACEHOLDER_URL = 'https://example.com/'

const ALLOWED_URL = /^https:\/\/github\.com\/(dbarjs\/hero-synergy|mattpocock\/skills)\b/
const BIG_NUMBER = '100'
const DAY = 86_400_000

/** How a line's links and dates are rewritten: the parts that depend on where it lives. */
export interface LineContext {
  readonly shiftDays: number
  /** The mirror's link target for a relative target written in this file. */
  readonly relink: (target: string) => string
}

const PATTERN = new RegExp(
  [
    String.raw`(?<target>\]\()(?<path>[^()\s]*)\)`,
    String.raw`(?<url>https?:\/\/[^\s)>\]` + '`\'"]+)',
    String.raw`(?<iso>\d{4}-\d{2}-\d{2})(?<time>[T ]\d{2}:\d{2}(?::\d{2})?)?(?:(?<until>\s*(?:→|->|–|to)\s*)(?<monthDay>\d{2}-\d{2})(?![\d-]))?`,
    String.raw`(?<dmy>\d{2}\/\d{2}\/\d{4})`,
    String.raw`(?<token>[\p{L}\p{N}]+(?:['’._:/-][\p{L}\p{N}]+)*)`,
  ].join('|'),
  'gu',
)

/** A bare file name or path of a numbered file (`05-ledger.md`), renamed like a link target. */
const TICKET_FILE = /^(?:[\p{L}\p{N}._-]+\/)*\d+-[\p{L}\p{N}._-]+\.md$/u

/** A kept piece is hard when it carries state (a signal word, a date, a link), soft otherwise. */
type Piece =
  | { readonly kind: 'kept'; readonly text: string; readonly hard: boolean }
  | { readonly kind: 'placeholder'; readonly capital: boolean }
  | { readonly kind: 'separator'; readonly text: string }

/** Text between two placeholders that may fold into them: spaces and light punctuation. */
const FOLDABLE = /^[\s,;:.!?'"’&+/\-–—]*$/u

/** How far, in words, a soft word may stand from a signal word and still be kept. */
const SOFT_REACH = 3

export function shiftDate(iso: string, days: number): string {
  const time = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(time)) return iso
  return new Date(time + days * DAY).toISOString().slice(0, 10)
}

const shiftDmy = (dmy: string, days: number): string => {
  const [day, month, year] = dmy.split('/')
  const iso = `${year}-${month}-${day}`
  const shifted = shiftDate(iso, days)
  if (shifted === iso) return dmy
  const [y, m, d] = shifted.split('-')
  return `${d}/${m}/${y}`
}

type Weight = 'hard' | 'soft' | null

const partWeight = (part: string, index: number): Weight => {
  if (/^\p{N}+$/u.test(part)) return 'soft'
  if (/^[xX]$/.test(part) || (index > 0 && /^\p{L}$/u.test(part))) return 'soft'
  if (/^\p{L}\d{1,2}$/u.test(part)) return 'soft'
  if (!/^\p{L}+$/u.test(part)) return null
  const word = part.toLowerCase()
  if (SIGNAL_WORDS.has(word)) return 'hard'
  return SOFT_WORDS.has(word) ? 'soft' : null
}

const sanitizeNumber = (part: string): string => (part.length <= 2 ? part : BIG_NUMBER)

/**
 * A word-like token as the mirror writes it, with its large numbers replaced, and whether it
 * carries state; `null` when it is replaced.
 */
export function classifyToken(token: string): { text: string; hard: boolean } | null {
  if (/\d{4}-\d{2}-\d{2}/.test(token)) return null
  const parts = token.split(/(['’._:/-])/u)
  const weights = parts.filter((_, index) => index % 2 === 0).map(partWeight)
  if (weights.includes(null)) return null
  const text = parts
    .map((part, index) => (index % 2 === 0 && /^\p{N}+$/u.test(part) ? sanitizeNumber(part) : part))
    .join('')
  return { text, hard: weights.includes('hard') }
}

export function sanitizeUrl(url: string): string {
  return ALLOWED_URL.test(url) ? url : PLACEHOLDER_URL
}

const relinkTarget = (target: string, context: LineContext): string => {
  if (/^https?:\/\//.test(target)) return sanitizeUrl(target)
  if (/^[a-z]+:/i.test(target)) return PLACEHOLDER_URL
  return context.relink(target)
}

const shiftRange = (groups: Record<string, string | undefined>, days: number): string => {
  const start = shiftDate(groups.iso!, days)
  let text = start + (groups.time ?? '')
  if (groups.monthDay !== undefined) {
    const end = shiftDate(`${groups.iso!.slice(0, 4)}-${groups.monthDay}`, days)
    text += groups.until! + (end.length === 10 ? end.slice(5) : groups.monthDay)
  }
  return text
}

const pieces = (text: string, context: LineContext): Piece[] => {
  const out: Piece[] = []
  let last = 0
  const separator = (until: number) => {
    if (until > last) out.push({ kind: 'separator', text: text.slice(last, until) })
  }
  for (const match of text.matchAll(PATTERN)) {
    const groups = match.groups!
    separator(match.index)
    last = match.index + match[0].length
    if (groups.target !== undefined) {
      out.push({ kind: 'kept', text: `](${relinkTarget(groups.path!, context)})`, hard: true })
    } else if (groups.url !== undefined) {
      out.push({ kind: 'kept', text: sanitizeUrl(groups.url), hard: false })
    } else if (groups.iso !== undefined) {
      out.push({ kind: 'kept', text: shiftRange(groups, context.shiftDays), hard: true })
    } else if (groups.dmy !== undefined) {
      out.push({ kind: 'kept', text: shiftDmy(groups.dmy, context.shiftDays), hard: true })
    } else {
      const token = groups.token!
      if (TICKET_FILE.test(token)) {
        out.push({ kind: 'kept', text: context.relink(token), hard: true })
        continue
      }
      const kept = classifyToken(token)
      out.push(
        kept === null
          ? { kind: 'placeholder', capital: /^\p{Lu}/u.test(token) }
          : { kind: 'kept', ...kept },
      )
    }
  }
  separator(text.length)
  return out
}

/** Replaces each soft piece farther than `SOFT_REACH` words from a hard one, never crossing a placeholder. */
const dropStraySoft = (all: Piece[]): Piece[] => {
  const words = all
    .map((piece, index) => ({ piece, index }))
    .filter(({ piece }) => piece.kind !== 'separator')
  const distance = words.map(() => Infinity)
  const sweep = (order: number[]) => {
    let reach = Infinity
    for (const at of order) {
      const piece = words[at]!.piece
      if (piece.kind === 'placeholder') reach = Infinity
      else if (piece.kind === 'kept' && piece.hard) reach = 0
      else reach += 1
      distance[at] = Math.min(distance[at]!, reach)
    }
  }
  const order = words.map((_, at) => at)
  sweep(order)
  sweep(order.toReversed())
  const out = [...all]
  words.forEach(({ piece, index }, at) => {
    if (piece.kind === 'kept' && !piece.hard && distance[at]! > SOFT_REACH) {
      out[index] = { kind: 'placeholder', capital: /^\p{Lu}/u.test(piece.text) }
    }
  })
  return out
}

const render = (all: ReadonlyArray<Piece>): string => {
  const folded: Piece[] = []
  for (let index = 0; index < all.length; index++) {
    const piece = all[index]!
    const next = all[index + 1]
    if (
      piece.kind === 'separator' &&
      folded.at(-1)?.kind === 'placeholder' &&
      next?.kind === 'placeholder' &&
      FOLDABLE.test(piece.text)
    ) {
      index++
      continue
    }
    if (piece.kind === 'placeholder' && folded.at(-1)?.kind === 'placeholder') continue
    folded.push(piece)
  }
  return folded
    .map((piece) => {
      if (piece.kind !== 'placeholder') return piece.text
      return piece.capital ? 'Lorem' : PLACEHOLDER
    })
    .join('')
}

/**
 * One line with its words replaced under the allowlist and its links and dates rewritten.
 * With `soft`, soft words far from any signal word are replaced too, and `hard` reports
 * whether anything carrying state is left.
 */
export function sanitizeText(
  text: string,
  context: LineContext,
  options: { soft?: boolean } = {},
): { text: string; hard: boolean } {
  let all = pieces(text, context)
  const placeholders = all.some((piece) => piece.kind === 'placeholder')
  if (options.soft === true && placeholders) all = dropStraySoft(all)
  const hard = all.some((piece) => piece.kind === 'kept' && piece.hard)
  return { text: render(all), hard: hard || !placeholders }
}

/** The Markdown prefix of a line: indentation, quote marks, a list marker and a checkbox. */
const PREFIX = /^(\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?(?:\[[ xX]\]\s+)?)/

/** Code fence languages kept; any other info string is dropped. */
const FENCE_LANGUAGES = new Set([
  '',
  'ts',
  'tsx',
  'js',
  'json',
  'sh',
  'bash',
  'text',
  'md',
  'markdown',
  'diff',
  'yaml',
  'html',
  'css',
])

/** A header line the scout reads, in any of its styles: never thinned. */
const HEADER_KEY =
  /^\s*(?:[-*]\s+)?\**(?:Status|Assignee|Label|Labels|Type|Blocked by|Blocks|Map|Parent)\**\s*:/i

/**
 * One line of a file outside a code fence (or inside one, with `inFence`). Headings keep their
 * level and every kept word; an H1 keeps only a leading `Type:` word; header lines keep every
 * kept word; any other line keeps its soft words only near a signal word, and collapses to its
 * prefix and `Lorem ipsum.` (`lorem` in a fence) when nothing carrying state is left.
 */
export function sanitizeLine(line: string, context: LineContext, inFence = false): string {
  const h1 = inFence ? null : /^# (?:(\p{L}+):\s*)?/u.exec(line)
  if (h1 !== null) {
    const type = h1[1]
    const prefix = type !== undefined && SIGNAL_WORDS.has(type.toLowerCase()) ? `${type}: ` : ''
    return `# ${prefix}Lorem ipsum`
  }
  const structural = line.trim() === '' || /^\s*(#{2,6}\s|\|)/.test(line) || HEADER_KEY.test(line)
  const prefix = PREFIX.exec(line)![1]!
  const sanitized = sanitizeText(line.slice(prefix.length), context, { soft: !structural })
  if (structural || sanitized.hard) return prefix + sanitized.text
  return prefix + (inFence ? PLACEHOLDER : PROSE_LINE)
}

/** A whole Markdown file, line by line; a run of collapsed paragraph lines becomes one. */
export function sanitizeFile(body: string, context: LineContext): string {
  const out: string[] = []
  let inFence = false
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      out.push(
        line.replace(/^(\s*(?:```|~~~))(.*)$/, (_, marks: string, info: string) =>
          FENCE_LANGUAGES.has(info.trim()) ? marks + info : marks,
        ),
      )
      inFence = !inFence
      continue
    }
    const sanitized = sanitizeLine(line, context, inFence)
    const collapsed = sanitized === PROSE_LINE || (inFence && sanitized === PLACEHOLDER)
    if (collapsed && out.at(-1) === sanitized) continue
    out.push(sanitized)
  }
  return out.join('\n')
}

/** The mirror path of every path of the corpus, files and directories alike. */
export class PathPlan {
  private readonly names = new Map<string, string>()

  /** Plans the names of a directory's children, given in any order. */
  plan(directory: string, children: ReadonlyArray<{ name: string; directory: boolean }>): void {
    const sorted = [...children].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    const top = directory === ''
    const numbered = new Map<string, string[]>()
    let others = 0
    const proposed: Array<[string, string]> = []
    sorted.forEach((child, index) => {
      const extension = child.directory ? '' : posix.extname(child.name)
      if (top && child.directory) {
        proposed.push([child.name, `effort-${String(index + 1).padStart(2, '0')}`])
      } else if (KEPT_NAMES.has(child.name)) {
        proposed.push([child.name, child.name])
      } else {
        const number = /^(\d+)[-_]/.exec(child.name)?.[1]
        if (number !== undefined) {
          const kind = child.directory
            ? 'folder'
            : posix.basename(directory) === 'issues'
              ? 'ticket'
              : 'note'
          const base = `${number}-${kind}${extension}`
          numbered.set(base, [...(numbered.get(base) ?? []), child.name])
          proposed.push([child.name, base])
        } else {
          others++
          const stem = child.directory ? 'folder' : extension === '.md' ? 'note' : 'file'
          proposed.push([child.name, `${stem}-${others}${extension}`])
        }
      }
    })
    for (const [name, base] of proposed) {
      const group = numbered.get(base)
      let renamed = base
      if (group !== undefined && group.length > 1) {
        const letter = String.fromCharCode(97 + group.indexOf(name))
        const extension = posix.extname(base)
        renamed = `${base.slice(0, base.length - extension.length)}-${letter}${extension}`
      }
      this.names.set(posix.join(directory, name), renamed)
    }
  }

  /** The mirror path of a corpus path; a part never planned keeps a placeholder name. */
  rename(path: string): string {
    const parts = path.split('/').filter((part) => part !== '' && part !== '.')
    const renamed: string[] = []
    for (let index = 0; index < parts.length; index++) {
      const original = parts.slice(0, index + 1).join('/')
      const planned = this.names.get(original)
      if (planned !== undefined) {
        renamed.push(planned)
        continue
      }
      const extension = posix.extname(parts[index]!)
      const number = /^(\d+)[-_]/.exec(parts[index]!)?.[1]
      renamed.push(`${number !== undefined ? `${number}-` : ''}${PLACEHOLDER}${extension}`)
    }
    return renamed.join('/')
  }

  entries(): ReadonlyArray<[string, string]> {
    return [...this.names.keys()].sort().map((path) => [path, this.rename(path)])
  }
}

/** Rewrites a relative link target written in `from` (a corpus path) to its mirror target. */
export function relinker(plan: PathPlan, from: string): (target: string) => string {
  return (target) => {
    const hash = target.indexOf('#')
    const path = hash === -1 ? target : target.slice(0, hash)
    const anchor = hash === -1 ? '' : sanitizeAnchor(target.slice(hash + 1))
    if (path === '') return anchor
    if (path.startsWith('/')) return `/path/to/${PLACEHOLDER}${posix.extname(path)}${anchor}`
    const resolved = posix.normalize(posix.join(posix.dirname(from), path))
    const trailing = path.endsWith('/') ? '/' : ''
    if (resolved.startsWith('../') || resolved === '..') {
      const up = /^(?:\.\.\/)+/.exec(resolved)![0]
      const depth = from.split('/').length - 1
      return `${'../'.repeat(depth)}${up}path/to/${PLACEHOLDER}${posix.extname(path)}${trailing}${anchor}`
    }
    const mirrored = plan.rename(resolved.replace(/\/$/, ''))
    let relative = posix.relative(posix.dirname(plan.rename(from)), mirrored) || '.'
    if (path.startsWith('./') && !relative.startsWith('.')) relative = `./${relative}`
    return `${relative}${trailing}${anchor}`
  }
}

const sanitizeAnchor = (anchor: string): string => {
  const kept = classifyToken(anchor)
  return kept === null ? '#section' : `#${kept.text}`
}

const walk = (root: string, directory: string, plan: PathPlan, files: string[]): void => {
  const entries = readdirSync(posix.join(root, directory), { withFileTypes: true })
  plan.plan(
    directory,
    entries.map((entry) => ({ name: entry.name, directory: entry.isDirectory() })),
  )
  for (const entry of entries) {
    const path = posix.join(directory, entry.name)
    if (entry.isDirectory()) walk(root, path, plan, files)
    else if (entry.isFile()) files.push(path)
  }
}

/** Plans every path of the corpus and returns its Markdown files, sorted. */
export function planCorpus(corpus: string): { plan: PathPlan; markdown: string[] } {
  const plan = new PathPlan()
  const files: string[] = []
  walk(corpus, '', plan, files)
  return { plan, markdown: files.filter((file) => file.endsWith('.md')).sort() }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      corpus: { type: 'string' },
      out: { type: 'string' },
      'shift-days': { type: 'string' },
      'path-map': { type: 'string' },
    },
  })
  const corpus = values.corpus
  const out = values.out
  const shiftDays = Number(values['shift-days'])
  if (corpus === undefined || out === undefined || !Number.isInteger(shiftDays)) {
    throw new Error(
      'usage: sanitize.ts --corpus <dir> --out <dir> --shift-days <n> [--path-map <file>]',
    )
  }
  const { plan, markdown } = planCorpus(corpus)
  for (const file of markdown) {
    const body = readFileSync(posix.join(corpus, file), 'utf8')
    const target = posix.join(out, plan.rename(file))
    mkdirSync(posix.dirname(target), { recursive: true })
    writeFileSync(target, sanitizeFile(body, { shiftDays, relink: relinker(plan, file) }))
  }
  if (values['path-map'] !== undefined) {
    const map = Object.fromEntries(markdown.map((file) => [file, plan.rename(file)]))
    writeFileSync(values['path-map'], `${JSON.stringify(map, null, 2)}\n`)
  }
  console.log(`${markdown.length} Markdown files written under ${out}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
