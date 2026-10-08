import { describe, expect, it } from 'vite-plus/test'

import type { StatusEvent } from '../claude/status-event.ts'
import {
  CLAIM_PENDING_TEXT,
  claimedByOtherText,
  disagreementOf,
  NOT_CLAIMED_TEXT,
  WRAPPING_UP_TEXT,
} from './disagreements.ts'
import { reduceSession, type SessionState, sessionTitleOf } from './session.ts'

const startEvent = (ticket: number): StatusEvent => ({
  ticket: String(ticket),
  hook: 'SessionStart',
  session: 'A',
  detail: 'startup',
  at: null,
  payload: {},
})

const starting = (): SessionState =>
  reduceSession(undefined, { type: 'launched', at: 1_000 }) as SessionState

const live = (ticket: number, at = 1_000): SessionState =>
  reduceSession(starting(), { type: 'event', event: startEvent(ticket), at }) as SessionState

const ended = (ticket: number): SessionState =>
  reduceSession(live(ticket), {
    type: 'event',
    event: { ...startEvent(ticket), hook: 'SessionEnd', detail: 'other' },
    at: 2_000,
  }) as SessionState

const open = (by: string[] | null) => ({ state: 'open' as const, claim: by && { by } })
const closed = { state: 'closed' as const, claim: null }

describe('what the tracker and the session side disagree about', () => {
  describe('a session on an unclaimed ticket', () => {
    it('says the claim is not on the tracker yet while the session is starting', () => {
      expect(disagreementOf(open(null), starting(), 5_000, null)).toEqual({
        kind: 'claim-pending',
        text: CLAIM_PENDING_TEXT,
        level: 'note',
      })
      expect(CLAIM_PENDING_TEXT).toBe('live · claim not on tracker yet')
    })

    it('says it while no snapshot was collected after SessionStart', () => {
      expect(disagreementOf(open(null), live(1, 5_000), 4_999, null)).toMatchObject({
        kind: 'claim-pending',
      })
    })

    it('warns once a snapshot collected after SessionStart still shows no claim', () => {
      expect(disagreementOf(open(null), live(1, 5_000), 5_000, null)).toEqual({
        kind: 'unclaimed',
        text: NOT_CLAIMED_TEXT,
        level: 'warning',
      })
      expect(NOT_CLAIMED_TEXT).toBe('not claimed on the tracker')
    })

    it('is nothing once the snapshot shows the claim, when the session has ended or there is none', () => {
      expect(disagreementOf(open(['ana']), live(1, 5_000), 9_000, null)).toBeNull()
      expect(disagreementOf(open(null), ended(1), 9_000, null)).toBeNull()
      expect(disagreementOf(open(null), undefined, 9_000, null)).toBeNull()
    })
  })

  describe('a closed ticket with a live session', () => {
    it('is wrapping up, and only while the session is live', () => {
      expect(disagreementOf(closed, live(5), 0, null)).toEqual({
        kind: 'wrapping-up',
        text: WRAPPING_UP_TEXT,
        level: 'note',
      })
      expect(disagreementOf(closed, starting(), 0, null)).toBeNull()
      expect(disagreementOf(closed, undefined, 0, null)).toBeNull()
    })
  })

  describe('a ticket claimed by someone else with a session live here', () => {
    it('names the login and both facts', () => {
      expect(disagreementOf(open(['sam']), live(4), 0, 'ana')).toEqual({
        kind: 'claimed-by-other',
        text: 'claimed by sam on the tracker, session live here',
        level: 'warning',
      })
      expect(claimedByOtherText(['sam', 'lee'])).toBe(
        'claimed by sam, lee on the tracker, session live here',
      )
    })

    it('is nothing when the claim is mine, in any case, or shared with me', () => {
      expect(disagreementOf(open(['Ana']), live(4), 0, 'ana')).toBeNull()
      expect(disagreementOf(open(['sam', 'ana']), live(4), 0, 'ana')).toBeNull()
    })

    it('is nothing when it is not known who is here, or when no one is named', () => {
      expect(disagreementOf(open(['sam']), live(4), 0, null)).toBeNull()
      expect(disagreementOf(open([]), live(4), 0, 'ana')).toBeNull()
    })
  })
})

describe('the title of a session without a ticket', () => {
  it('is the registry’s name less the number', () => {
    const named = reduceSession(starting(), {
      type: 'registry',
      listed: [{ sessionId: 'id-9', status: 'waiting', name: '#999 Hand started' }],
      at: 10,
    }) as SessionState
    expect(sessionTitleOf(named)).toBe('Hand started')
  })

  it('is null for a name that is only a number, a session not named yet and an ended one', () => {
    const bare = reduceSession(starting(), {
      type: 'registry',
      listed: [{ sessionId: 'id-9', status: 'waiting', name: '#999' }],
      at: 10,
    }) as SessionState
    expect(sessionTitleOf(bare)).toBeNull()
    expect(sessionTitleOf(live(1))).toBeNull()
    expect(sessionTitleOf(ended(1))).toBeNull()
  })
})
