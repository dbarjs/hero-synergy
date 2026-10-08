import {
  CLAIM_PENDING_TEXT,
  claimedByOtherText,
  disagreementOf,
  FileSystem,
  NOT_CLAIMED_TEXT,
  readLocalTracker,
  reduceSession,
  type SessionState,
  type Snapshot,
  type StatusEvent,
  type Ticket,
  WRAPPING_UP_TEXT,
} from '@hero-synergy/core'
import { Effect } from 'effect'
import { describe, expect, it } from 'vite-plus/test'

import { workspaceFiles } from '../test/fixtures/workspace-files.ts'
import { shownClaim } from './disagreements.ts'
import { NOT_LAUNCHING } from './launch.ts'
import { buildViewModel, detailOf, selectionOf } from './view-model.ts'

const ROOT = '/home/ana/billing'

const fixtureSnapshot = (): Promise<Snapshot> =>
  Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )

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

const ticketOf = (snapshot: Snapshot, mapNumber: number, number: number): Ticket => {
  const found = snapshot.maps
    .find((map) => map.number === mapNumber)
    ?.tickets.find((ticket) => ticket.number === number)
  if (found === undefined) throw new Error(`no ticket #${number} on map #${mapNumber}`)
  return found
}

const launching = (sessions: Record<string, SessionState>, me: string | null = null) => ({
  ...NOT_LAUNCHING,
  sessions: new Map(Object.entries(sessions)),
  me,
})

const PALETTE = 'map:3:ticket:1'
const ROW_DENSITY = 'map:3:ticket:4'
const ICON_SET = 'map:3:ticket:5'

const mapNode = (
  snapshot: Snapshot,
  sessions: Record<string, SessionState>,
  me: string | null = null,
) => {
  const model = buildViewModel(
    snapshot,
    new Set(['map:3', 'map:3:decisions']),
    null,
    undefined,
    null,
    null,
    launching(sessions, me),
  )
  if (model.kind !== 'maps') throw new Error('expected maps')
  const node = model.maps.find((map) => map.number === 3)
  if (node === undefined) throw new Error('expected map #3')
  return { model, node }
}

describe('what the tracker and the session side disagree about', () => {
  describe('a session on an unclaimed ticket', () => {
    it('says the claim is not on the tracker yet while the session is starting', async () => {
      const ticket = ticketOf(await fixtureSnapshot(), 3, 1)
      expect(disagreementOf(ticket, starting(), Date.parse('2026-10-08T10:00:00Z'), null)).toEqual({
        kind: 'claim-pending',
        text: CLAIM_PENDING_TEXT,
        level: 'note',
      })
    })

    it('says it while no snapshot was collected after SessionStart', async () => {
      const ticket = ticketOf(await fixtureSnapshot(), 3, 1)
      expect(disagreementOf(ticket, live(1, 5_000), 4_999, null)).toMatchObject({
        kind: 'claim-pending',
        text: 'live · claim not on tracker yet',
      })
    })

    it('warns once a snapshot collected after SessionStart still shows no claim', async () => {
      const ticket = ticketOf(await fixtureSnapshot(), 3, 1)
      expect(disagreementOf(ticket, live(1, 5_000), 5_000, null)).toEqual({
        kind: 'unclaimed',
        text: NOT_CLAIMED_TEXT,
        level: 'warning',
      })
      expect(NOT_CLAIMED_TEXT).toBe('not claimed on the tracker')
    })

    it('is nothing once the snapshot shows the claim', async () => {
      const claimed = ticketOf(await fixtureSnapshot(), 3, 4)
      expect(disagreementOf(claimed, live(4, 5_000), 9_000, null)).toBeNull()
    })

    it('is nothing when the session has ended or there is none', async () => {
      const ticket = ticketOf(await fixtureSnapshot(), 3, 1)
      const ended = reduceSession(live(1), {
        type: 'event',
        event: { ...startEvent(1), hook: 'SessionEnd', detail: 'other' },
        at: 2_000,
      })
      expect(disagreementOf(ticket, ended, 9_000, null)).toBeNull()
      expect(disagreementOf(ticket, undefined, 9_000, null)).toBeNull()
    })

    it('shows the ticket as unclaimed, since that is what the tracker says', async () => {
      const ticket = ticketOf(await fixtureSnapshot(), 3, 1)
      const pending = disagreementOf(ticket, starting(), 0, null)
      expect(shownClaim(ticket, pending)).toBeNull()
    })
  })

  describe('a closed ticket with a live session', () => {
    it('is wrapping up', async () => {
      const closed = ticketOf(await fixtureSnapshot(), 3, 5)
      expect(disagreementOf(closed, live(5), 0, null)).toEqual({
        kind: 'wrapping-up',
        text: WRAPPING_UP_TEXT,
        level: 'note',
      })
      expect(disagreementOf(closed, starting(), 0, null)).toBeNull()
    })
  })

  describe('a ticket claimed by someone else with a session live here', () => {
    const claimedBy = (ticket: Ticket, by: string[]): Ticket => ({ ...ticket, claim: { by } })

    it('names the login and both facts', async () => {
      const ticket = claimedBy(ticketOf(await fixtureSnapshot(), 3, 4), ['sam'])
      expect(disagreementOf(ticket, live(4), 0, 'ana')).toEqual({
        kind: 'claimed-by-other',
        text: 'claimed by sam on the tracker, session live here',
        level: 'warning',
      })
      expect(claimedByOtherText(['sam', 'lee'])).toBe(
        'claimed by sam, lee on the tracker, session live here',
      )
    })

    it('is nothing when the claim is mine, in any case', async () => {
      const mine = claimedBy(ticketOf(await fixtureSnapshot(), 3, 4), ['Ana'])
      expect(disagreementOf(mine, live(4), 0, 'ana')).toBeNull()
      const shared = claimedBy(ticketOf(await fixtureSnapshot(), 3, 4), ['sam', 'ana'])
      expect(disagreementOf(shared, live(4), 0, 'ana')).toBeNull()
    })

    it('is nothing when it is not known who is here, or when no one is named', async () => {
      const ticket = claimedBy(ticketOf(await fixtureSnapshot(), 3, 4), ['sam'])
      expect(disagreementOf(ticket, live(4), 0, null)).toBeNull()
      expect(disagreementOf(claimedBy(ticket, []), live(4), 0, 'ana')).toBeNull()
    })
  })
})

describe('the Tree and the Detail with the sessions laid over the snapshot', () => {
  it('takes a ticket with a starting session off the frontier at once, and ▶ moves to the next one', async () => {
    const snapshot = await fixtureSnapshot()
    const before = mapNode(snapshot, {}).node
    expect(before.tickets.find((row) => row.next)?.number).toBe(1)
    expect(before.takeable).toBe(2)

    const { node } = mapNode(snapshot, { [PALETTE]: starting() })
    expect(node.takeable).toBe(1)
    expect(node.tickets.find((row) => row.next)?.number).toBe(3)
    const held = node.tickets.find((row) => row.number === 1)
    expect(held).toMatchObject({
      place: 'claimed',
      disagreement: { kind: 'claim-pending', text: 'live · claim not on tracker yet' },
    })
  })

  it('shows the warning in the Focus pane and the Detail, and the claim as unclaimed', async () => {
    const snapshot = await fixtureSnapshot()
    const sessions = launching({ [PALETTE]: live(1, Date.parse(snapshot.collectedAt) + 1) })
    const focus = selectionOf(snapshot, PALETTE, sessions)?.focus
    expect(focus).toMatchObject({
      kind: 'ticket',
      claim: null,
      disagreement: { kind: 'claim-pending' },
    })
    const later = launching({ [PALETTE]: live(1, Date.parse(snapshot.collectedAt)) })
    expect(detailOf(snapshot, PALETTE, later)).toMatchObject({
      kind: 'ticket',
      claim: null,
      disagreement: { kind: 'unclaimed', text: 'not claimed on the tracker' },
    })
  })

  it('leaves a ticket the tracker shows as claimed in its place, with no disagreement', async () => {
    const snapshot = await fixtureSnapshot()
    const { node } = mapNode(snapshot, { [ROW_DENSITY]: live(4) })
    expect(node.tickets.find((row) => row.number === 4)).toMatchObject({
      place: 'claimed',
      disagreement: null,
    })
  })

  it('moves a closed ticket with a live session to the Decisions fold as wrapping up, keeping its status', async () => {
    const snapshot = await fixtureSnapshot()
    const { node } = mapNode(snapshot, { [ICON_SET]: live(5) })
    expect(node.decisions.wrappingUp).toBe(1)
    expect(node.decisions.entries).toEqual([
      expect.objectContaining({
        key: ICON_SET,
        number: 5,
        session: expect.objectContaining({ kind: 'live', focusable: false }),
        disagreement: { kind: 'wrapping-up', text: 'wrapping up', level: 'note' },
      }),
    ])
  })

  it('adds a wrapping-up ticket the map has not recorded as a decision yet', async () => {
    const snapshot = await fixtureSnapshot()
    const map = snapshot.maps.find((candidate) => candidate.number === 3)!
    const unrecorded = {
      ...snapshot,
      maps: snapshot.maps.map((candidate) =>
        candidate === map ? { ...map, decisions: [] } : candidate,
      ),
    }
    const { node } = mapNode(unrecorded, { [ICON_SET]: live(5) })
    expect(node.decisions.entries).toEqual([
      expect.objectContaining({ number: 5, title: 'Icon set', gist: '' }),
    ])
  })

  it('keeps a decision with no session as it was', async () => {
    const snapshot = await fixtureSnapshot()
    const { node } = mapNode(snapshot, {})
    expect(node.decisions.wrappingUp).toBe(0)
    expect(node.decisions.entries[0]).toMatchObject({
      session: { kind: 'none' },
      disagreement: null,
    })
  })

  it('names the claimant when someone else claimed a ticket with a session live here', async () => {
    const snapshot = await fixtureSnapshot()
    const claimed = {
      ...snapshot,
      maps: snapshot.maps.map((map) => ({
        ...map,
        tickets: map.tickets.map((ticket) =>
          ticket.number === 4 && map.number === 3 ? { ...ticket, claim: { by: ['sam'] } } : ticket,
        ),
      })),
    }
    const { node } = mapNode(claimed, { [ROW_DENSITY]: live(4) }, 'ana')
    expect(node.tickets.find((row) => row.number === 4)?.disagreement?.text).toBe(
      'claimed by sam on the tracker, session live here',
    )
  })

  it('lists a session whose number matches no ticket in one row, live or ended, by number', async () => {
    const snapshot = await fixtureSnapshot()
    const stray = (number: number, at: number): SessionState =>
      reduceSession(starting(), {
        type: 'registry',
        listed: [{ sessionId: `id-${number}`, status: 'waiting', name: `#${number} Hand started` }],
        at,
      }) as SessionState
    const gone = reduceSession(stray(500, 10), { type: 'vanished', at: 20 }) as SessionState
    const { model } = mapNode(snapshot, {
      'unlisted:ticket:999': stray(999, 10),
      'unlisted:ticket:500': gone,
    })
    expect(model.kind === 'maps' && model.unlisted).toEqual([
      expect.objectContaining({
        key: 'unlisted:ticket:500',
        number: 500,
        session: { kind: 'ended', detail: 'process gone', since: 20 },
      }),
      expect.objectContaining({
        key: 'unlisted:ticket:999',
        number: 999,
        title: 'Hand started',
        session: expect.objectContaining({
          kind: 'live',
          status: 'waiting for you',
          needsYou: true,
        }),
      }),
    ])
  })

  it('has no row for sessions when every session has its ticket', async () => {
    const snapshot = await fixtureSnapshot()
    const { model } = mapNode(snapshot, { [PALETTE]: starting() })
    expect(model.kind === 'maps' && model.unlisted).toBeNull()
  })
})
