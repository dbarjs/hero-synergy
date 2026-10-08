import type { DriftWarning, WarningCode, WarningEntry, WarningLevel } from './warnings.ts'

/**
 * The drift table: the level and the copy of every drift code. Loud when what the Cockpit shows
 * may be wrong or missing; quiet when something old or odd was still read correctly. A message
 * says what was found, the hint says the current convention, and no warning carries an Action.
 * The Cockpit and `next` word drift from this one table.
 */

interface Copy {
  readonly level: WarningLevel
  /** What was found; the detail the scout recorded is passed in when there is one. */
  readonly message: (detail: string | undefined) => string
  /** One line on the current convention. */
  readonly hint: string
  /** The hint also says a newer mattpocock-skills may write this form. */
  readonly newer?: true
}

const NEWER = 'A newer mattpocock-skills may write this; check for a hero-synergy update.'

const quoted = (detail: string | undefined): string => (detail === undefined ? '' : `: ${detail}`)

export const DRIFT_TABLE: Readonly<Record<WarningCode, Copy>> = {
  // snapshot
  'unknown-wayfinder-labels': {
    level: 'quiet',
    message: (detail) => `A label this version does not know${quoted(detail)}.`,
    hint: `The wayfinder labels are wayfinder:map, wayfinder:research, wayfinder:prototype, wayfinder:grilling and wayfinder:task. ${NEWER}`,
    newer: true,
  },
  // map
  'map-body-free-form': {
    level: 'loud',
    message: () => 'The map body has none of the wayfinder sections.',
    hint: 'A map body has the sections Destination, Notes, Decisions so far, Not yet specified and Out of scope.',
  },
  'map-body-partial': {
    level: 'loud',
    message: (detail) => `The map body is missing sections${quoted(detail)}.`,
    hint: `A map body has all five sections, even when one is empty. ${NEWER}`,
    newer: true,
  },
  'map-no-destination': {
    level: 'loud',
    message: () => 'The map names no destination.',
    hint: 'The Destination section says what reaching the end of the map looks like.',
  },
  'decision-line-unparsed': {
    level: 'loud',
    message: (detail) => `A line of Decisions so far could not be read${quoted(detail)}.`,
    hint: `A decision is one line, "- [ticket title](link) — gist". ${NEWER}`,
    newer: true,
  },
  'decision-links-open-ticket': {
    level: 'loud',
    message: (detail) => `A decision links a ticket that is still open${quoted(detail)}.`,
    hint: 'Decisions so far lists closed tickets only; the ticket is closed when its answer is recorded.',
  },
  'map-body-legacy': {
    level: 'quiet',
    message: (detail) => `The map body is in an older form${quoted(detail)}.`,
    hint: 'The current form is Destination, Notes, Decisions so far, Not yet specified and Out of scope.',
  },
  'children-as-task-list': {
    level: 'quiet',
    message: () => 'The map lists its tickets as a task list in the body.',
    hint: 'Tickets are child issues of the map; the body does not list them.',
  },
  'map-title-from-directory': {
    level: 'quiet',
    message: () => 'The map has no title of its own; its directory name stands in.',
    hint: 'A local map starts with a # heading.',
  },
  // ticket
  'type-missing': {
    level: 'loud',
    message: () => 'The ticket has no type.',
    hint: 'A ticket carries one wayfinder:<type> label: research, prototype, grilling or task.',
  },
  'type-several': {
    level: 'loud',
    message: (detail) => `The ticket has several types${quoted(detail)}.`,
    hint: 'A ticket carries exactly one wayfinder:<type> label.',
  },
  'blockers-as-slugs': {
    level: 'loud',
    message: (detail) => `The ticket is blocked by names, not numbers${quoted(detail)}.`,
    hint: 'A blocker is a ticket number, or the tracker’s own blocked-by link.',
  },
  'no-map': {
    level: 'loud',
    message: () => 'The ticket belongs to no map.',
    hint: 'A ticket is a child issue of its map.',
  },
  'closed-unrecorded': {
    level: 'loud',
    message: () => 'The ticket is closed, but its map records no decision or scope line for it.',
    hint: 'Closing a ticket adds a line to Decisions so far, or to Out of scope.',
  },
  'closed-no-resolution': {
    level: 'loud',
    message: () => 'The ticket is closed with no answer.',
    hint: 'A closed ticket ends with a resolution comment (an ## Answer section locally).',
  },
  'unknown-status': {
    level: 'loud',
    message: (detail) => `The ticket has a status this version does not know${quoted(detail)}.`,
    hint: 'A local ticket has Status: claimed or resolved, or none.',
  },
  'parent-as-part-of-line': {
    level: 'quiet',
    message: (detail) => `The ticket names its map in a line${quoted(detail)}.`,
    hint: 'A ticket is a child issue of its map.',
  },
  'blockers-as-text-line': {
    level: 'quiet',
    message: () => 'The ticket lists its blockers in a Blocked by line.',
    hint: 'A blocker is the tracker’s own blocked-by link.',
  },
  'type-as-line': {
    level: 'quiet',
    message: (detail) => `The ticket gives its type in a line${quoted(detail)}.`,
    hint: 'The type is a wayfinder:<type> label.',
  },
  'claim-legacy-label': {
    level: 'quiet',
    message: () => 'The ticket is claimed by a label.',
    hint: 'A claim is the ticket’s assignee.',
  },
  'no-question-heading': {
    level: 'quiet',
    message: () => 'The ticket body has no ## Question heading.',
    hint: 'A ticket body starts with ## Question.',
  },
  'blocker-outside-map': {
    level: 'quiet',
    message: () => 'The ticket waits on a ticket outside its map.',
    hint: 'Blockers are usually tickets of the same map.',
  },
  'ticket-title-from-slug': {
    level: 'quiet',
    message: () => 'The ticket has no title of its own; its file name stands in.',
    hint: 'A local ticket starts with a # heading.',
  },
}

/** A drift warning with its level and words. */
export const driftEntryOf = (warning: DriftWarning): WarningEntry => {
  const copy = DRIFT_TABLE[warning.code]
  return {
    code: warning.code,
    level: copy.level,
    message: copy.message(warning.detail),
    detail: warning.detail ?? null,
    hint: copy.hint,
  }
}
