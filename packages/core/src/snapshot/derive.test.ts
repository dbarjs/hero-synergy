import { describe, expect, test } from 'vite-plus/test'

import heroSynergy from '../../fixtures/snapshot/maps/hero-synergy-1.json' with { type: 'json' }
import legacyForms from '../../fixtures/snapshot/maps/legacy-forms.json' with { type: 'json' }
import {
  decidedOfTotal,
  frontierOf,
  isFinished,
  modeOf,
  neighbourhoodOf,
  nextOf,
  openBlockers,
  orderMaps,
  orderTickets,
  placeOf,
  urgencyOf,
} from './derive.ts'
import type { Blocker, Ticket, WayfinderMap } from './model.ts'
import { type Collected, readSnapshot } from './read.ts'

const numbers = (tickets: ReadonlyArray<{ number: number }>): number[] =>
  tickets.map((ticket) => ticket.number)

const ref = (number: number) => ({
  tracker: 'github' as const,
  url: `https://github.com/acme/billing/issues/${number}`,
})

const blocker = (number: number, state: Blocker['state'] = 'open'): Blocker => ({
  number,
  title: `Ticket ${number}`,
  state,
  ref: ref(number),
})

const ticket = (number: number, overrides: Partial<Ticket> = {}): Ticket => ({
  number,
  title: `Ticket ${number}`,
  ref: ref(number),
  state: 'open',
  type: 'grilling',
  claim: null,
  blockedBy: [],
  body: '## Question\n\nWhat?',
  resolution: null,
  outcome: null,
  gist: null,
  warnings: [],
  ...overrides,
})

const closed = (number: number, overrides: Partial<Ticket> = {}): Ticket =>
  ticket(number, {
    state: 'closed',
    resolution: { body: 'Done.', author: 'ana', at: '2026-10-07T12:00:00.000Z' },
    outcome: 'decided',
    gist: `the answer to ${number}`,
    ...overrides,
  })

const map = (number: number, tickets: Ticket[], title = `Map ${number}`): WayfinderMap => ({
  number,
  title,
  ref: ref(number),
  body: '',
  tickets,
  destination: null,
  notes: null,
  decisions: [],
  notYetSpecified: [],
  outOfScope: [],
  warnings: [],
})

const noSessions = { needsYou: new Set<number>() }

describe("this repo's own map, fully decided", () => {
  const decided = readSnapshot(heroSynergy as Collected).maps[0]!

  test('has an empty frontier, no next and nothing open to order', () => {
    expect(frontierOf(decided)).toEqual([])
    expect(nextOf(decided)).toBeNull()
    expect(orderTickets(decided)).toEqual([])
  })

  test('counts 33 of 33 decided and is finished', () => {
    expect(decidedOfTotal(decided)).toEqual({ decided: 33, total: 33 })
    expect(isFinished(decided)).toBe(true)
    expect(urgencyOf(decided, noSessions)).toBe('finished')
  })

  test('places every ticket as closed, with the blockers it waited on in its neighbourhood', () => {
    for (const each of decided.tickets) expect(placeOf(each)).toBe('closed')
    const testing = decided.tickets.find((each) => each.number === 32)!
    const neighbourhood = neighbourhoodOf(testing, decided)
    expect(numbers(neighbourhood.waitsOn)).toEqual([31])
    expect(numbers(neighbourhood.clearsWayFor)).toEqual([33, 34])
    expect(openBlockers(testing)).toEqual([])
    const interpret = decided.tickets.find((each) => each.number === 16)!
    expect(neighbourhoodOf(interpret, decided)).toEqual({
      waitsOn: interpret.blockedBy,
      clearsWayFor: [],
    })
  })
})

describe("the scout prototype's legacy forms, mid-flight", () => {
  const snapshot = readSnapshot(legacyForms as Collected)
  const billing = snapshot.maps[0]!
  const checkout = snapshot.maps[1]!

  test('the frontier is the open, unblocked, unclaimed tickets in map order, the first one next', () => {
    // #2 waits only on closed #3, #9 waits on nothing; #4 is claimed; #3 and #5 are closed.
    expect(numbers(frontierOf(billing))).toEqual([2, 9])
    expect(nextOf(billing)?.number).toBe(2)
    expect(numbers(frontierOf(checkout))).toEqual([7])
  })

  test('orders a map as claimed, then the frontier, then blocked, leaving closed tickets out', () => {
    expect(numbers(orderTickets(billing))).toEqual([4, 2, 9])
    expect(numbers(orderTickets(checkout))).toEqual([7])
  })

  test('counts closed over all and is not finished while a ticket is open', () => {
    expect(decidedOfTotal(billing)).toEqual({ decided: 2, total: 5 })
    expect(isFinished(billing)).toBe(false)
    expect(urgencyOf(billing, noSessions)).toBe('takeable')
  })
})

describe('the frontier gate', () => {
  test('a blocker that is open and outside the map keeps the ticket off the frontier and is listed', () => {
    const gated = ticket(2, { blockedBy: [blocker(99)] })
    const effort = map(1, [gated, ticket(3)])
    expect(numbers(frontierOf(effort))).toEqual([3])
    expect(placeOf(gated)).toBe('blocked')
    expect(numbers(openBlockers(gated))).toEqual([99])
    expect(numbers(neighbourhoodOf(gated, effort).waitsOn)).toEqual([99])
  })

  test('a closed blocker never gates, wherever it lives', () => {
    const freed = ticket(2, { blockedBy: [blocker(99, 'closed'), blocker(3, 'closed')] })
    expect(numbers(frontierOf(map(1, [freed, closed(3)])))).toEqual([2])
    expect(openBlockers(freed)).toEqual([])
  })

  test('a claimed ticket leaves the frontier, even with no blockers, and an empty claim still claims', () => {
    const mine = ticket(2, { claim: { by: ['ana'] } })
    const local = ticket(3, { claim: { by: [] } })
    const effort = map(1, [mine, local, ticket(4)])
    expect(numbers(frontierOf(effort))).toEqual([4])
    expect(placeOf(mine)).toBe('claimed')
    expect(placeOf(local)).toBe('claimed')
  })

  test('a ticket both claimed and blocked is claimed', () => {
    expect(placeOf(ticket(2, { claim: { by: ['ana'] }, blockedBy: [blocker(9)] }))).toBe('claimed')
  })

  test('gates on each blocker as reported, not on the map, so the blocked ticket itself is unblocked by its blocker closing', () => {
    // The map still lists #3 as open in the blocker entry: the entry's own state is what gates.
    const stale = ticket(2, { blockedBy: [blocker(3, 'open')] })
    expect(numbers(frontierOf(map(1, [stale, closed(3)])))).toEqual([])
  })
})

describe('the order of maps', () => {
  const stuck = map(1, [
    ticket(2, { claim: { by: ['ana'] } }),
    ticket(3, { blockedBy: [blocker(2)] }),
  ])
  const takeable = map(4, [ticket(5), ticket(6, { blockedBy: [blocker(5)] })])
  const needsMe = map(7, [ticket(8, { claim: { by: ['ana'] } }), ticket(9)])
  const finished = map(10, [closed(11), closed(12, { outcome: 'out-of-scope', gist: null })])
  const facts = { needsYou: new Set([8]) }

  test('puts a session needing me first, then something takeable, then stuck, then finished', () => {
    expect(numbers(orderMaps([finished, stuck, takeable, needsMe], facts))).toEqual([7, 4, 1, 10])
    expect(urgencyOf(needsMe, facts)).toBe('needs-you')
    expect(urgencyOf(takeable, facts)).toBe('takeable')
    expect(urgencyOf(stuck, facts)).toBe('stuck')
    expect(urgencyOf(finished, facts)).toBe('finished')
  })

  test('keeps tracker order within one urgency', () => {
    const later = map(13, [ticket(14)])
    expect(numbers(orderMaps([takeable, later, stuck], facts))).toEqual([4, 13, 1])
  })

  test('a finished map whose ticket is wrapping up with a session that needs me still ranks first', () => {
    expect(urgencyOf(finished, { needsYou: new Set([11]) })).toBe('needs-you')
    expect(isFinished(finished)).toBe(true)
  })

  test('a session needing me is read per ticket of the map, never from another map', () => {
    expect(urgencyOf(takeable, facts)).toBe('takeable')
    expect(urgencyOf(takeable, { needsYou: new Set([6]) })).toBe('needs-you')
  })

  test('a map with no tickets is neither finished nor takeable', () => {
    const empty = map(20, [])
    expect(isFinished(empty)).toBe(false)
    expect(urgencyOf(empty, facts)).toBe('stuck')
    expect(decidedOfTotal(empty)).toEqual({ decided: 0, total: 0 })
  })

  test('decided-of-total counts every closed ticket, whatever the map recorded about it', () => {
    expect(decidedOfTotal(finished)).toEqual({ decided: 2, total: 2 })
    expect(decidedOfTotal(map(1, [closed(2, { outcome: 'unrecorded' }), ticket(3)]))).toEqual({
      decided: 1,
      total: 2,
    })
  })
})

describe('the neighbourhood of a ticket', () => {
  const first = closed(2)
  const middle = ticket(3, { blockedBy: [blocker(2, 'closed')] })
  const last = ticket(4, { blockedBy: [blocker(3)] })
  const chain = map(1, [first, middle, last])

  test('the middle of a three-ticket chain waits on one and clears the way for one', () => {
    const neighbourhood = neighbourhoodOf(middle, chain)
    expect(numbers(neighbourhood.waitsOn)).toEqual([2])
    expect(neighbourhood.waitsOn[0]?.state).toBe('closed')
    expect(numbers(neighbourhood.clearsWayFor)).toEqual([4])
  })

  test('the ends of the chain have one empty side each', () => {
    expect(neighbourhoodOf(first, chain)).toEqual({ waitsOn: [], clearsWayFor: [middle] })
    expect(neighbourhoodOf(last, chain)).toEqual({ waitsOn: last.blockedBy, clearsWayFor: [] })
  })

  test('clears the way for is derived by inverting blockedBy across the map, in map order', () => {
    const hub = ticket(5)
    const effort = map(1, [
      ticket(7, { blockedBy: [blocker(5)] }),
      hub,
      ticket(6, { blockedBy: [blocker(5), blocker(7)] }),
    ])
    expect(numbers(neighbourhoodOf(hub, effort).clearsWayFor)).toEqual([7, 6])
  })
})

describe('HITL or AFK from the type', () => {
  test.each([
    ['research', 'AFK'],
    ['prototype', 'HITL'],
    ['grilling', 'HITL'],
    ['task', 'task'],
    [null, null],
  ] as const)('%s is %s', (type, mode) => {
    expect(modeOf(type)).toBe(mode)
  })
})
