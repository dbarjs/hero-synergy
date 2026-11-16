/**
 * A local ticket's `Blocked by:` and `Blocks:` values, read by one item grammar (#137, #145).
 *
 * The value splits into items outside brackets and parentheses: a `,` always splits, a `;` only
 * when the text after it starts with a reference. Each item names at most one ticket, taken from
 * its start: a Markdown link to a ticket file (its target's `NN-` gives the number, the link title
 * is never read), a bare `NN-<slug>.md`, or a leading `NN` or `#NN`. Whatever follows the
 * reference is annotation and is never read, so no digit in a note becomes a blocker.
 */

/** What one item names. */
export type ReferenceItem =
  /** A leading `NN` or `#NN`. */
  | { readonly kind: 'number'; readonly number: number }
  /** A link to a ticket file, or a bare ticket file name or path: the target as written. */
  | { readonly kind: 'file'; readonly target: string; readonly number: number }
  /** A lone slug-shaped word, which names a ticket by its slug: `blockers-as-slugs`. */
  | { readonly kind: 'slug'; readonly text: string }
  /** Any other item with no reference at its start: `blocker-unread`. */
  | { readonly kind: 'unread'; readonly text: string }

/** One `Blocked by:` or `Blocks:` value, read. */
export interface ReferenceLine {
  /** The value as written, trimmed: the detail of `blockers-not-template` and `blocks-line`. */
  readonly raw: string
  /** A none marker, which names nothing and raises nothing: empty, `—`, `none`, `(nothing …`. */
  readonly none: boolean
  /** The local template's form, `NN, NN`. */
  readonly template: boolean
  /** The items, in order; empty for a none marker. */
  readonly items: ReadonlyArray<ReferenceItem>
}

/**
 * The none markers the real tracker writes, in any case: an empty value, a dash, `none`,
 * `nothing`, either one opening a parenthesis. `[]` is the empty list today's reader already took.
 */
const NONE = /^(?:—|–|-|none\b|nothing\b|\(none\b|\(nothing\b|\[\]$)/i
const TEMPLATE = /^\d+(?:\s*,\s*\d+)*$/
/** A ticket file name or path at the start: `03-tell-the-members.md`, `../issues/03-x.md`. */
const BARE_FILE = /^(?:[^\s/()[\]]+\/)*(\d+)-[^\s/()[\]]*\.md\b/i
/** A leading `NN` or `#NN`: not part of a longer number, a date or a slug. */
const LEADING_NUMBER = /^#?(\d{1,3})(?![\d-])/
const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u
const TICKET_FILE = /^(\d+)-[^/]*\.md$/i

export function readReferenceLine(value: string): ReferenceLine {
  const raw = value.trim()
  if (raw === '' || NONE.test(raw)) return { raw, none: true, template: false, items: [] }
  return {
    raw,
    none: false,
    template: TEMPLATE.test(raw),
    items: splitItems(raw).map(
      (item): ReferenceItem =>
        leadingReference(item) ??
        (SLUG.test(item) ? { kind: 'slug', text: item } : { kind: 'unread', text: item }),
    ),
  }
}

/** The value's items, split outside brackets and parentheses, trimmed, empty ones dropped. */
function splitItems(value: string): string[] {
  const items: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    if (character === '(' || character === '[') depth++
    else if ((character === ')' || character === ']') && depth > 0) depth--
    else if (depth === 0 && (character === ',' || character === ';')) {
      const rest = value.slice(index + 1).trimStart()
      if (character === ';' && leadingReference(rest) === null) continue
      items.push(value.slice(start, index))
      start = index + 1
    }
  }
  items.push(value.slice(start))
  return items.map((item) => item.trim()).filter((item) => item !== '')
}

/** The reference `text` starts with, or null when it starts with none. */
function leadingReference(text: string): ReferenceItem | null {
  if (text.startsWith('[')) {
    const target = leadingLinkTarget(text)
    const number = target === null ? null : ticketFileNumber(target)
    return target === null || number === null ? null : { kind: 'file', target, number }
  }
  const file = BARE_FILE.exec(text)
  if (file?.[1] !== undefined) return { kind: 'file', target: file[0], number: Number(file[1]) }
  const number = LEADING_NUMBER.exec(text)
  if (number?.[1] !== undefined) return { kind: 'number', number: Number(number[1]) }
  return null
}

/** The target of the Markdown link `text` starts with: `[title](target "tooltip")` gives `target`. */
function leadingLinkTarget(text: string): string | null {
  let depth = 0
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '[') depth++
    else if (text[index] === ']' && --depth === 0) {
      if (text[index + 1] !== '(') return null
      const close = text.indexOf(')', index + 2)
      if (close === -1) return null
      const target = text
        .slice(index + 2, close)
        .trim()
        .split(/\s+/)[0]
      return target?.replace(/^<(.*)>$/, '$1') || null
    }
  }
  return null
}

/** The number of the ticket file a target names, `NN-<slug>.md` at its end; null for any other file. */
function ticketFileNumber(target: string): number | null {
  const file =
    target
      .replace(/[?#].*$/, '')
      .split('/')
      .at(-1) ?? ''
  const match = TICKET_FILE.exec(file)
  return match?.[1] === undefined ? null : Number(match[1])
}

/**
 * The repo-relative path a target names, resolved against the directory of the file at `from`;
 * null when it names no file in the repo: a URL, an absolute path, or one climbing above the root.
 */
export function resolveTarget(from: string, target: string): string | null {
  const path = target.replace(/[?#].*$/, '')
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('/')) return null
  const segments = from.split('/').slice(0, -1)
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment !== '..') segments.push(segment)
    else if (segments.pop() === undefined) return null
  }
  return segments.join('/')
}
