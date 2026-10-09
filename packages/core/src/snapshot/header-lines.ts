import { lines, stripComments } from './markdown.ts'

/**
 * A file's header lines: the `Key: value` lines a local map or ticket carries
 * before its first H2, where a local tracker keeps its state, type, claim and
 * blockers. Maps and tickets read them the same way. Nothing after the first
 * H2, inside a code fence or quoted in inline code is ever a header line, so a
 * closing protocol written in a body never changes a state.
 */
export interface HeaderLine {
  /** The key as written, without its bold markers. */
  readonly key: string
  /** The value, trimmed; empty when the line has none. */
  readonly value: string
  /** Whether the key is bold: `**Key:** value` or `**Key**: value`. */
  readonly bold: boolean
}

const FENCE = /^\s*(```|~~~)/
const H2 = /^##\s/
const KEY = String.raw`(\p{L}[\p{L}\p{N} _-]*?)`
const PLAIN = new RegExp(String.raw`^${KEY}:\s*(.*)$`, 'u')
const BOLD_INSIDE = new RegExp(String.raw`^\*\*${KEY}:\*\*\s*(.*)$`, 'u')
const BOLD_OUTSIDE = new RegExp(String.raw`^\*\*${KEY}\*\*:\s*(.*)$`, 'u')

/**
 * Every header line, in order, repeated keys included. A header line starts
 * the line with its key: a list item, a quote or a heading is never one.
 */
export function readHeaderLines(body: string): ReadonlyArray<HeaderLine> {
  const out: HeaderLine[] = []
  let fenced = false
  for (const raw of lines(stripComments(body))) {
    if (FENCE.test(raw)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    if (H2.test(raw)) break
    const line = raw.trim()
    const bold = BOLD_INSIDE.exec(line) ?? BOLD_OUTSIDE.exec(line)
    const match = bold ?? PLAIN.exec(line)
    if (match?.[1] === undefined) continue
    out.push({ key: match[1].trim(), value: (match[2] ?? '').trim(), bold: bold !== null })
  }
  return out
}

/** A key as it is matched: any case, an underscore read as a space. */
const keyOf = (key: string): string =>
  key
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .trim()

/** The value of the first header line with this key, matched in any case; null when none has it. */
export function headerValue(header: ReadonlyArray<HeaderLine>, key: string): string | null {
  const wanted = keyOf(key)
  return header.find((line) => keyOf(line.key) === wanted)?.value ?? null
}

/** The bold keys, in order, each once: the detail of `header-key-bold`. */
export function boldKeysOf(header: ReadonlyArray<HeaderLine>): ReadonlyArray<string> {
  const out: string[] = []
  for (const line of header) {
    if (line.bold && !out.some((key) => keyOf(key) === keyOf(line.key))) out.push(line.key)
  }
  return out
}
