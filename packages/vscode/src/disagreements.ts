import {
  type DisagreementView,
  disagreementOf,
  type SessionState,
  type Snapshot,
  type Ticket,
  type WayfinderMap,
} from '@hero-synergy/core'

/**
 * Where the tracker and the session side disagree is named by core (`disagreementOf`), the same
 * words `next` prints. This lays those sessions over a snapshot, which only the Tree does.
 */

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

/** The Claim fact of a ticket no one has claimed. */
const UNCLAIMED_TEXT = 'unclaimed'
/** The Claim fact of a claim that names nobody, such as a local `Status: claimed` line alone. */
const CLAIMED_TEXT = 'claimed'

/**
 * The Claim fact the Focus pane and the Detail show: who holds the claim, "claimed" when it names
 * nobody, "unclaimed" when there is none. A held ticket is unclaimed on the tracker, so it says so.
 */
export const shownClaim = (
  ticket: Pick<Ticket, 'claim'>,
  disagreement: DisagreementView | null,
): string => {
  if (disagreement?.kind === 'claim-pending' || disagreement?.kind === 'unclaimed')
    return UNCLAIMED_TEXT
  if (ticket.claim === null) return UNCLAIMED_TEXT
  return ticket.claim.by.length === 0 ? CLAIMED_TEXT : ticket.claim.by.join(', ')
}

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
