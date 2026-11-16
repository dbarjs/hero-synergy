import { type HeaderLine, headerValue, headerValues } from './header-lines.ts'
import type { Claim, TicketState, TriageRole } from './model.ts'
import { readLabels } from './ticket-body.ts'
import type { DriftWarning } from './warnings.ts'

/**
 * A local ticket's state, claim, triage role and Status line, read from its header lines by the
 * rules #135 settled. The first word of the Status value decides the state; after `open`, and only
 * there, one more word can set a role or a claim. Nothing else on the line is read, so no word in
 * an annotation can reopen a closed ticket. A closed ticket is never claimed.
 */
export interface TicketStatus {
  readonly state: TicketState
  /** An open ticket's claim: a `claimed` Status line, or an `Assignee:` name; `by` holds that name or nobody. */
  readonly claim: Claim | null
  /** From the Status line first, else from a `Labels:` item that is exactly a role. */
  readonly role: TriageRole | null
  /** The first Status line's value as written, trimmed; null with none. For display only. */
  readonly statusLine: string | null
  /** `unknown-status`, for a first word this version does not read and for each later Status line. */
  readonly warnings: ReadonlyArray<DriftWarning>
}

const CLOSING: ReadonlySet<string> = new Set(['closed', 'done', 'resolved', 'wontfix'])
const ROLES: ReadonlyArray<TriageRole> = [
  'needs-triage',
  'needs-info',
  'ready-for-agent',
  'ready-for-human',
  'wontfix',
]
const OPENING: ReadonlySet<string> = new Set(['open', 'claimed', ...ROLES.slice(0, 4)])

const roleOf = (word: string | undefined): TriageRole | null =>
  ROLES.find((role) => role === word) ?? null

/** A word: its letters and hyphens, compared in any case. */
const FIRST_WORD = /^[\p{L}-]+/u

/** After `open`: the first word after a dash (`—`, `–`, ` - `) or an opening parenthesis. */
const AFTER_OPEN = /^open\s*(?:—|–| - |\()\s*([\p{L}-]+)/iu

/** An Assignee name ends at its first parenthesis or dash; a hyphen inside a word is no dash. */
const NAME_END = /\(|—|–|(?:^|\s)-(?=\s|$)/u

/** Who an `Assignee:` value names: the text before any parenthesis or dash; null for nobody. */
function assigneeName(value: string | null): string | null {
  const text = (value ?? '').replaceAll('**', '')
  const end = NAME_END.exec(text)
  const name = (end === null ? text : text.slice(0, end.index)).trim()
  return name === '' ? null : name
}

export function readTicketStatus(header: ReadonlyArray<HeaderLine>): TicketStatus {
  const [first = '', ...later] = headerValues(header, 'status')
  // An empty value is read as no Status line, as on a map.
  const statusLine = first === '' ? null : first
  const plain = first.replaceAll('**', '').trim()
  const word = FIRST_WORD.exec(plain)?.[0]?.toLowerCase() ?? ''
  const after = word === 'open' ? AFTER_OPEN.exec(plain)?.[1]?.toLowerCase() : undefined
  const state: TicketState = CLOSING.has(word) ? 'closed' : 'open'

  const warnings: DriftWarning[] = []
  if (statusLine !== null && !CLOSING.has(word) && !OPENING.has(word))
    warnings.push({ code: 'unknown-status', detail: statusLine })
  for (const value of later)
    warnings.push({
      code: 'unknown-status',
      detail: `${value} (a second Status line, ignored)`.trim(),
    })

  const labelled = readLabels(headerValue(header, 'labels') ?? '')
    .map((label) => roleOf(label.toLowerCase()))
    .find((role) => role !== null)
  const role = roleOf(word) ?? roleOf(after) ?? labelled ?? null

  const name = assigneeName(headerValue(header, 'assignee'))
  const claimed = word === 'claimed' || after === 'claimed' || name !== null
  const claim = state === 'open' && claimed ? { by: name === null ? [] : [name] } : null

  return { state, claim, role, statusLine, warnings }
}
