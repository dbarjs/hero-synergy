import { entries, issueNumber, linkedNumbers, sections, taskListNumbers } from './markdown.ts'
import type { Decision, SectionEntry } from './model.ts'
import type { DriftWarning } from './warnings.ts'

/**
 * What code reads from a map body: the five sections of the current form, the
 * legacy forms by their headings, and a task list of children where one exists.
 * The map's identity and its tickets are facts the tracker reports; they are
 * joined in by `readSnapshot`.
 */
export interface MapBody {
  readonly destination: string | null
  readonly notes: string | null
  readonly decisions: ReadonlyArray<Decision>
  readonly notYetSpecified: ReadonlyArray<SectionEntry>
  readonly outOfScope: ReadonlyArray<SectionEntry>
  /** Children listed as a task list in the body, in order; empty when there is none. */
  readonly taskList: ReadonlyArray<number>
  readonly warnings: ReadonlyArray<DriftWarning>
}

type SectionKey = 'destination' | 'notes' | 'decisions' | 'notYetSpecified' | 'outOfScope'

/** Every heading the readers know, mapped to the section it holds. */
const HEADINGS: Readonly<Record<string, SectionKey>> = {
  destination: 'destination',
  notes: 'notes',
  'decisions so far': 'decisions',
  'not yet specified': 'notYetSpecified',
  fog: 'notYetSpecified',
  'out of scope': 'outOfScope',
  deferred: 'outOfScope',
}

/**
 * The map body forms upstream has shipped, by the headings that identify them.
 * The current form is the last; the others are read with a quiet warning.
 */
const FORMS = {
  current: ['Destination', 'Notes', 'Decisions so far', 'Not yet specified', 'Out of scope'],
  deferred: ['Destination', 'Notes', 'Decisions so far', 'Fog', 'Deferred'],
  fogWithDestination: ['Destination', 'Notes', 'Decisions so far', 'Fog'],
  fog: ['Notes', 'Decisions so far', 'Fog'],
} as const

const DECISION_LINE = /^\[(.+?)\]\((\S+?)\)\s*(?:—|:)\s*(.*)$/

export function readMapBody(body: string): MapBody {
  const warnings: DriftWarning[] = []
  const found = sections(body)
  const present = new Set(found.map((section) => section.key))
  const text = (key: SectionKey): string | null => {
    const texts = found
      .filter((section) => HEADINGS[section.key] === key)
      .map((section) => section.text)
      .filter((value) => value !== '')
    return texts.length === 0 ? null : texts.join('\n\n')
  }

  const form = formOf(present)
  if (form === null) {
    warnings.push({ code: 'map-body-free-form' })
  } else {
    const missing = FORMS[form].filter((heading) => !present.has(heading.toLowerCase()))
    if (missing.length > 0) {
      warnings.push({ code: 'map-body-partial', detail: `missing ${missing.join(', ')}` })
    } else if (form !== 'current') {
      warnings.push({ code: 'map-body-legacy', detail: FORMS[form].join(', ') })
    }
  }

  const destination = text('destination')
  if (destination === null) warnings.push({ code: 'map-no-destination' })

  const decisions: Decision[] = []
  for (const line of entries(text('decisions') ?? '')) {
    const match = DECISION_LINE.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      decisions.push({
        number: issueNumber(match[2]),
        title: match[1],
        link: match[2],
        gist: match[3].trim(),
      })
    } else {
      warnings.push({ code: 'decision-line-unparsed', detail: line })
    }
  }

  const taskList = taskListNumbers(body)
  if (taskList.length > 0) warnings.push({ code: 'children-as-task-list' })

  return {
    destination,
    notes: text('notes'),
    decisions,
    notYetSpecified: sectionEntries(text('notYetSpecified')),
    outOfScope: sectionEntries(text('outOfScope')),
    taskList,
    warnings,
  }
}

/** Which form the headings point at; null when none of the known headings is there. */
function formOf(present: ReadonlySet<string>): keyof typeof FORMS | null {
  if (present.has('deferred')) return 'deferred'
  if (present.has('fog')) return present.has('destination') ? 'fogWithDestination' : 'fog'
  for (const heading of Object.keys(HEADINGS)) if (present.has(heading)) return 'current'
  return null
}

const sectionEntries = (text: string | null): ReadonlyArray<SectionEntry> =>
  entries(text ?? '').map((entry) => ({ text: entry, tickets: linkedNumbers(entry) }))
