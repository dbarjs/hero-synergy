import {
  isRunning,
  type SessionState,
  type Snapshot,
  type Ticket,
  type WayfinderMap,
} from '@hero-synergy/core'

import type { DisagreementView } from './protocol.ts'

/**
 * The situations where the tracker and the session side disagree. Each is named, never
 * overridden, and lasts until the next refresh: the tracker alone says claimed, open, closed and
 * blocked; the session side alone says alive and what status; neither wins.
 */

export const CLAIM_PENDING_TEXT = 'live · claim not on tracker yet'
export const NOT_CLAIMED_TEXT = 'not claimed on the tracker'
export const WRAPPING_UP_TEXT = 'wrapping up'

export const claimedByOtherText = (by: ReadonlyArray<string>): string =>
  `claimed by ${by.join(', ')} on the tracker, session live here`

/** The snapshot with the claims the sessions imply laid over it, and the disagreements found. */
export interface SessionOverlay {
  /**
   * An open, unclaimed ticket with a session starting or live here is held as claimed, so it
   * leaves the frontier at once; everything else is the snapshot as collected.
   */
  readonly snapshot: Snapshot
  /** By ticket row key. */
  readonly disagreements: ReadonlyMap<string, DisagreementView>
}

const note = (kind: DisagreementView['kind'], text: string): DisagreementView => ({
  kind,
  text,
  level: 'note',
})
const warning = (kind: DisagreementView['kind'], text: string): DisagreementView => ({
  kind,
  text,
  level: 'warning',
})

const sameLogin = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/**
 * What a ticket and its session disagree about, if anything. `collectedAt` is when the snapshot
 * was collected (epoch milliseconds) and `me` the GitHub login of the person at this machine,
 * null when it is not known (a local tracker names nobody).
 */
export function disagreementOf(
  ticket: Ticket,
  session: SessionState | undefined,
  collectedAt: number,
  me: string | null,
): DisagreementView | null {
  if (ticket.state === 'closed') {
    return session?.kind === 'live' ? note('wrapping-up', WRAPPING_UP_TEXT) : null
  }
  if (!isRunning(session)) return null
  if (ticket.claim === null) {
    // The first snapshot collected after the session went live decides: it shows the claim or it does not.
    return session?.kind === 'live' && collectedAt >= session.startedAt
      ? warning('unclaimed', NOT_CLAIMED_TEXT)
      : note('claim-pending', CLAIM_PENDING_TEXT)
  }
  const others = me === null ? [] : ticket.claim.by.filter((login) => !sameLogin(login, me))
  // Someone else is on it only when nobody named is me; a shared claim that includes me is mine.
  return me !== null && others.length > 0 && others.length === ticket.claim.by.length
    ? warning('claimed-by-other', claimedByOtherText(others))
    : null
}

/** The claim a row shows: a held ticket is unclaimed on the tracker, so it says so. */
export const shownClaim = (
  ticket: Ticket,
  disagreement: DisagreementView | null,
): ReadonlyArray<string> | null =>
  disagreement?.kind === 'claim-pending' || disagreement?.kind === 'unclaimed'
    ? null
    : ticket.claim === null
      ? null
      : ticket.claim.by

/** Lays the sessions over a snapshot; `keyOf` names a ticket's row, so the sessions can be found. */
export function overlaySessions(
  snapshot: Snapshot,
  sessions: ReadonlyMap<string, SessionState>,
  me: string | null,
  keyOf: (map: WayfinderMap, ticket: Ticket) => string,
): SessionOverlay {
  const disagreements = new Map<string, DisagreementView>()
  if (sessions.size === 0) return { snapshot, disagreements }
  const collectedAt = Date.parse(snapshot.collectedAt)
  const maps = snapshot.maps.map((map) => {
    let changed = false
    const tickets = map.tickets.map((ticket) => {
      const key = keyOf(map, ticket)
      const found = disagreementOf(ticket, sessions.get(key), collectedAt, me)
      if (found === null) return ticket
      disagreements.set(key, found)
      if (ticket.claim !== null || (found.kind !== 'claim-pending' && found.kind !== 'unclaimed')) {
        return ticket
      }
      changed = true
      return { ...ticket, claim: { by: [] } }
    })
    return changed ? { ...map, tickets } : map
  })
  return {
    snapshot: maps.some((map, index) => map !== snapshot.maps[index])
      ? { ...snapshot, maps }
      : snapshot,
    disagreements,
  }
}
