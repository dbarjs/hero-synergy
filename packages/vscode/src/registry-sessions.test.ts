import { readRegistry } from '@hero-synergy/core'
import { describe, expect, it } from 'vite-plus/test'

import ceiling from '../../core/fixtures/process/claude-agents-json-2.1.292.json' with { type: 'json' }
import { groupByTicket, ticketOfName } from './registry-sessions.ts'
import { listedOf, reduceSession, sessionView } from './session.ts'

describe('which ticket a registry entry belongs to', () => {
  it.each([
    ['#12 Pick a name', 12],
    ['#12', 12],
    ['#12 Pick a name-calm-otter', 12],
    ['#12-calm-otter', 12],
    ['  #7 padded', 7],
    ['Pick a name #12', null],
    ['#x12', null],
    ['12 no hash', null],
    ['', null],
  ])('%j is ticket %s', (name, number) => {
    expect(ticketOfName(name)).toBe(number)
  })
})

describe('the recorded registry, session by session', () => {
  const read = readRegistry(ceiling.stdout)
  const grouped = groupByTicket(read.value)

  it('groups every recorded entry under its ticket number', () => {
    expect([...grouped.keys()]).toEqual([46, 47, 48, 49, 50, 51, 52])
  })

  it.each([
    [46, 'working', false],
    [47, 'waiting for you', true], // idle
    [48, 'needs approval', true], // permission prompt
    [49, 'waiting for you', true], // input needed
    [50, 'waiting for you', true], // dialog open
    [51, 'needs approval', true], // sandbox request
    [52, 'needs approval', true], // worker request
  ])('ticket %s shows "%s"', (number, word, needsYou) => {
    const state = reduceSession(undefined, {
      type: 'registry',
      listed: grouped.get(number)!,
      at: 1,
    })
    expect(sessionView(state)).toMatchObject({ kind: 'live', status: word, needsYou })
  })

  it('shows a waiting session with a detail nobody knows as needing approval, and a status nobody knows as no word', () => {
    const entries = readRegistry(
      JSON.stringify([
        { sessionId: 'a', name: '#1 x', status: 'waiting', waitingFor: 'telepathy' },
        { sessionId: 'b', name: '#2 y', status: 'napping' },
      ]),
    ).value
    expect(entries.map((entry) => listedOf(entry).status)).toEqual(['approval', null])
  })

  it('lists two sessions with one number oldest first, whatever order the registry gave them', () => {
    const entries = readRegistry(
      JSON.stringify([
        { sessionId: 'new', name: '#5 Same-calm-otter', status: 'busy', startedAt: 20 },
        { sessionId: 'old', name: '#5 Same', status: 'idle', startedAt: 10 },
        { sessionId: 'other', name: 'not a ticket', status: 'busy', startedAt: 1 },
      ]),
    ).value
    expect(
      groupByTicket(entries)
        .get(5)
        ?.map((entry) => entry.sessionId),
    ).toEqual(['old', 'new'])
    expect(groupByTicket(entries).size).toBe(1)
  })
})
