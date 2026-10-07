/**
 * The little Markdown the readers need: H2 sections, list entries, links and
 * the issue numbers behind them. No renderer; the Detail renders bodies itself.
 */

export interface Section {
  /** The heading as written, without the `## `; empty for the text before the first H2. */
  readonly heading: string
  /** The heading normalized for matching: lower case, hyphens and underscores as spaces. */
  readonly key: string
  /** The section's text, trimmed. */
  readonly text: string
}

/** HTML comments, which templates leave in bodies, say nothing. */
export const stripComments = (markdown: string): string => markdown.replace(/<!--[\s\S]*?-->/g, '')

export const normalizeHeading = (heading: string): string =>
  heading.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()

const H1 = /^#\s+(.+?)\s*#*\s*$/
const H2 = /^##\s+(.+?)\s*#*\s*$/

/** The first H1 heading's text, or null. */
export function firstH1(markdown: string): string | null {
  for (const line of lines(stripComments(markdown))) {
    const match = H1.exec(line)
    if (match?.[1] !== undefined) return match[1]
  }
  return null
}

/** Splits a body at its H2 headings. The first section holds whatever precedes them. */
export function sections(markdown: string): ReadonlyArray<Section> {
  const out: Array<{ heading: string; lines: string[] }> = [{ heading: '', lines: [] }]
  let fenced = false
  for (const line of lines(stripComments(markdown))) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const match = fenced ? null : H2.exec(line)
    if (match?.[1] !== undefined) out.push({ heading: match[1], lines: [] })
    else out.at(-1)?.lines.push(line)
  }
  return out.map(({ heading, lines }) => ({
    heading,
    key: normalizeHeading(heading),
    text: lines.join('\n').trim(),
  }))
}

const TASK_ITEM = /^\s*[-*+]\s+\[[ xX]\]\s/
const LIST_ITEM = /^[-*+]\s+(.*)$/

/**
 * The top-level list entries of a section, each with its continuation lines
 * joined by a space. Task-list items are not entries: they list children, not
 * decisions or fog. Paragraphs outside a list are skipped.
 */
export function entries(text: string): ReadonlyArray<string> {
  const out: string[] = []
  let open = false
  for (const line of lines(text)) {
    if (line.trim() === '') {
      open = false
      continue
    }
    if (TASK_ITEM.test(line)) {
      open = false
      continue
    }
    const item = LIST_ITEM.exec(line)
    if (item?.[1] !== undefined) {
      out.push(item[1].trim())
      open = true
      continue
    }
    if (open && out.length > 0) out[out.length - 1] += ` ${line.trim()}`
  }
  return out
}

/** The numbers of a task list in the text, in order: `- [ ] #2`, `- [x] https://…/issues/3`. */
export function taskListNumbers(text: string): ReadonlyArray<number> {
  const out: number[] = []
  for (const match of text.matchAll(/^\s*[-*+]\s+\[[ xX]\]\s+(\S+)/gm)) {
    const number = issueNumber(match[1] ?? '')
    if (number !== null) out.push(number)
  }
  return out
}

const LINK = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

/** The targets of every Markdown link in the text, in order. */
export function linkTargets(text: string): ReadonlyArray<string> {
  return [...text.matchAll(LINK)].map((match) => match[2] ?? '')
}

/** The ticket numbers the text links: issue URLs, local ticket paths and `#n` targets. */
export function linkedNumbers(text: string): ReadonlyArray<number> {
  const out: number[] = []
  for (const target of linkTargets(text)) {
    const number = issueNumber(target)
    if (number !== null && !out.includes(number)) out.push(number)
  }
  return out
}

/**
 * The issue number a reference points at: `#12`, `…/issues/12`, `…/issues/12#…`,
 * a local `issues/12-slug.md` path. Null for anything else.
 */
export function issueNumber(reference: string): number | null {
  const match =
    /^#(\d+)$/.exec(reference) ??
    /\/issues\/(\d+)(?:[/#?]|$)/.exec(reference) ??
    /(?:^|\/)issues\/(\d+)-[^/]*$/.exec(reference)
  return match?.[1] === undefined ? null : Number(match[1])
}

export const lines = (text: string): ReadonlyArray<string> => text.split(/\r?\n/)
