import {
  type DriftWarning,
  driftEntryOf,
  isLoud,
  type Ticket,
  type WayfinderMap,
} from '@hero-synergy/core'

import type { DriftEntry } from './protocol.ts'

/**
 * Drift as the Tree shows it. The level and the copy of every drift code are core's table
 * (`driftEntryOf`), the words `next` prints too; what is the Cockpit's own is the dismissal: a
 * warning on its subject, at its exact detail, is hidden by the key it is stored under.
 */

/** A warning of the snapshot, a map or a ticket, ready to show. */
export const entryOf = (warning: DriftWarning, dismissKey: string): DriftEntry => ({
  ...driftEntryOf(warning),
  dismissKey,
})

/** The key a dismissal is stored under: the warning on its subject, at its exact detail. */
export const dismissalKey = (subject: string, warning: DriftWarning): string =>
  JSON.stringify([subject, warning.code, warning.detail ?? ''])

const visible = (
  subject: string,
  warnings: ReadonlyArray<DriftWarning>,
  dismissed: ReadonlySet<string>,
): DriftEntry[] =>
  warnings
    .filter((warning) => !dismissed.has(dismissalKey(subject, warning)))
    .map((warning) => entryOf(warning, dismissalKey(subject, warning)))

/** What a ticket's warnings come to once the dismissed ones are gone. */
export const ticketDrift = (
  subject: string,
  ticket: Ticket,
  dismissed: ReadonlySet<string>,
): DriftEntry[] => visible(subject, ticket.warnings, dismissed)

/** A map's own warnings, without its tickets'. */
export const mapDrift = (map: WayfinderMap, dismissed: ReadonlySet<string>): DriftEntry[] =>
  visible(`map:${map.number}`, map.warnings, dismissed)

export { isLoud }

/** Every ticket of a map that has any drift, open or closed. */
export const driftingTickets = (
  map: WayfinderMap,
  ticketSubject: (ticket: Ticket) => string,
  dismissed: ReadonlySet<string>,
): ReadonlyArray<{ readonly ticket: Ticket; readonly entries: DriftEntry[] }> =>
  map.tickets
    .map((ticket) => ({ ticket, entries: ticketDrift(ticketSubject(ticket), ticket, dismissed) }))
    .filter(({ entries }) => entries.length > 0)
