import type { Ticket } from '../snapshot/model.ts'
import { isRunning, type SessionState } from './session.ts'

/**
 * The situations where the tracker and the session side disagree. Each is named, never
 * overridden, and lasts until the next refresh: the tracker alone says claimed, open, closed and
 * blocked; the session side alone says alive and what status; neither wins.
 */

/**
 * A situation where the tracker and the session side disagree, named and never overridden. A
 * `note` is what is expected to settle at the next refresh; a `warning` is a disagreement that
 * stands until someone acts.
 */
export interface DisagreementView {
  readonly kind: 'claim-pending' | 'unclaimed' | 'claimed-by-other' | 'wrapping-up'
  readonly text: string
  readonly level: 'note' | 'warning'
}

export const CLAIM_PENDING_TEXT = 'live · claim not on tracker yet'
export const NOT_CLAIMED_TEXT = 'not claimed on the tracker'
export const WRAPPING_UP_TEXT = 'wrapping up'

export const claimedByOtherText = (by: ReadonlyArray<string>): string =>
  `claimed by ${by.join(', ')} on the tracker, session live here`

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
  ticket: Pick<Ticket, 'state' | 'claim'>,
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
