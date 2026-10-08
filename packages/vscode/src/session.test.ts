import type { StatusEvent } from '@hero-synergy/core'
import { describe, expect, it } from 'vite-plus/test'

import {
  afterReload,
  describeExit,
  type Listed,
  NO_STATUS_HINT,
  needsYou,
  reduceSession,
  type SessionInput,
  type SessionState,
  sessionView,
} from './session.ts'

const event = (
  hook: string,
  session: string | null,
  detail: string | null = null,
): StatusEvent => ({
  ticket: '57',
  hook,
  session,
  detail,
  at: null,
  payload: {},
})

const start = (id: string, source = 'startup', at = 100): SessionInput => ({
  type: 'event',
  event: event('SessionStart', id, source),
  at,
})
const end = (id: string, reason: string | null, at = 200): SessionInput => ({
  type: 'event',
  event: event('SessionEnd', id, reason),
  at,
})
const fail = (id: string, error = 'rate_limit', at = 150): SessionInput => ({
  type: 'event',
  event: event('StopFailure', id, error),
  at,
})
const launched = (at = 0): SessionInput => ({ type: 'launched', at })
const terminal = (id: number): SessionInput => ({ type: 'terminal', terminal: id })
const quiet = (id: number): SessionInput => ({ type: 'quiet', terminal: id })
const closed = (
  id: number,
  reason: 'user' | 'shutdown' | 'process' | 'extension' | 'unknown',
  code: number | null = null,
  at = 300,
): SessionInput => ({ type: 'closed', terminal: id, exit: { reason, code }, at })

const run = (inputs: ReadonlyArray<SessionInput>): SessionState | undefined =>
  inputs.reduce<SessionState | undefined>((state, input) => reduceSession(state, input), undefined)

/** What a state shows: its kind with the fields the spec names for it. */
const shown = (state: SessionState | undefined) => {
  if (state === undefined) return { kind: 'none' }
  switch (state.kind) {
    case 'starting':
      return { kind: 'starting', hint: state.hint, id: state.sessionId }
    case 'live':
      return { kind: 'live', status: state.status, id: state.sessionId, since: state.since }
    case 'ended':
      return { kind: 'ended', detail: state.detail, id: state.sessionId }
  }
}

const launchedInTerminal: ReadonlyArray<SessionInput> = [launched(), terminal(4)]

describe('the session state machine', () => {
  const sequences: ReadonlyArray<[string, ReadonlyArray<SessionInput>, unknown]> = [
    ['nothing happened', [], { kind: 'none' }],
    [
      'a launch, before the first status event',
      launchedInTerminal,
      { kind: 'starting', hint: false, id: null },
    ],
    [
      'start turns starting into live and carries the id',
      [...launchedInTerminal, start('A')],
      { kind: 'live', status: null, id: 'A', since: 100 },
    ],
    [
      'start then end: exited',
      [...launchedInTerminal, start('A'), end('A', 'prompt_input_exit')],
      { kind: 'ended', detail: 'exited', id: 'A' },
    ],
    [
      'end before start: the late start does not bring it back',
      [...launchedInTerminal, end('A', 'prompt_input_exit'), start('A')],
      { kind: 'ended', detail: 'exited', id: 'A' },
    ],
    [
      'end before start, with no launch seen (the window reloaded)',
      [end('A', 'logout'), start('A')],
      { kind: 'ended', detail: 'logout', id: 'A' },
    ],
    [
      'the reason other is shown as it is',
      [...launchedInTerminal, start('A'), end('A', 'other')],
      { kind: 'ended', detail: 'other', id: 'A' },
    ],
    [
      'failure sticks: live and failed',
      [...launchedInTerminal, start('A'), fail('A')],
      { kind: 'live', status: 'failed', id: 'A', since: 150 },
    ],
    [
      'failure then busy: working again',
      [...launchedInTerminal, start('A'), fail('A'), { type: 'busy' }],
      { kind: 'live', status: 'working', id: 'A', since: 150 },
    ],
    [
      'a failure before the start is live and failed, the start does not clear it',
      [...launchedInTerminal, fail('A'), start('A', 'startup', 160)],
      { kind: 'live', status: 'failed', id: 'A', since: 160 },
    ],
    [
      'failure then end: ended',
      [...launchedInTerminal, start('A'), fail('A'), end('A', 'other')],
      { kind: 'ended', detail: 'other', id: 'A' },
    ],
    [
      'clear never ends the ticket, the next start carries the new id',
      [...launchedInTerminal, start('A'), end('A', 'clear'), start('B', 'clear', 250)],
      { kind: 'live', status: null, id: 'B', since: 250 },
    ],
    [
      'clear, and the new start is read before the old end',
      [...launchedInTerminal, start('A'), start('B', 'clear', 250), end('A', 'clear', 260)],
      { kind: 'live', status: null, id: 'B', since: 250 },
    ],
    [
      'an old session ending late does not end the new one',
      [...launchedInTerminal, start('A'), start('B', 'clear', 250), end('A', 'prompt_input_exit')],
      { kind: 'live', status: null, id: 'B', since: 250 },
    ],
    [
      'resume never ends the ticket',
      [...launchedInTerminal, start('A'), end('A', 'resume'), start('B', 'resume', 260)],
      { kind: 'live', status: null, id: 'B', since: 260 },
    ],
    [
      'a compact start of the live session keeps its status and restarts the age',
      [...launchedInTerminal, start('A'), fail('A'), start('A', 'compact', 400)],
      { kind: 'live', status: 'failed', id: 'A', since: 400 },
    ],
    [
      'the terminal closing ends a live session with its exit status',
      [...launchedInTerminal, start('A'), closed(4, 'user')],
      { kind: 'ended', detail: 'terminal closed', id: 'A' },
    ],
    [
      'the SessionEnd reason outranks the exit status',
      [...launchedInTerminal, start('A'), end('A', 'prompt_input_exit'), closed(4, 'process', 1)],
      { kind: 'ended', detail: 'exited', id: 'A' },
    ],
    [
      'a non-zero exit with no SessionEnd',
      [...launchedInTerminal, start('A'), closed(4, 'process', 2)],
      { kind: 'ended', detail: 'exited with code 2', id: 'A' },
    ],
    [
      'the window closing',
      [...launchedInTerminal, start('A'), closed(4, 'shutdown')],
      { kind: 'ended', detail: 'window closed', id: 'A' },
    ],
    [
      'a terminal closing before any start: the exit status, no id',
      [...launchedInTerminal, closed(4, 'user')],
      { kind: 'ended', detail: 'terminal closed', id: null },
    ],
    [
      'a terminal gone for an unknown reason',
      [...launchedInTerminal, start('A'), closed(4, 'unknown')],
      { kind: 'ended', detail: 'process gone', id: 'A' },
    ],
    [
      'the terminal closed first: a late start still names the session but does not revive it',
      [...launchedInTerminal, closed(4, 'user'), start('A')],
      { kind: 'ended', detail: 'terminal closed', id: 'A' },
    ],
    [
      'an end with no reason takes the exit status when the terminal closes',
      [...launchedInTerminal, start('A'), end('A', null), closed(4, 'user')],
      { kind: 'ended', detail: 'terminal closed', id: 'A' },
    ],
    [
      'an end with no reason and no close reads process gone',
      [...launchedInTerminal, start('A'), end('A', null)],
      { kind: 'ended', detail: 'process gone', id: 'A' },
    ],
    [
      'another terminal closing leaves a live session alone',
      [...launchedInTerminal, start('A'), closed(9, 'user')],
      { kind: 'live', status: null, id: 'A', since: 100 },
    ],
    [
      'the 15 s hint shows on a quiet terminal',
      [...launchedInTerminal, quiet(4)],
      { kind: 'starting', hint: true, id: null },
    ],
    [
      'the hint of a terminal that already reported does nothing',
      [...launchedInTerminal, start('A'), quiet(4)],
      { kind: 'live', status: null, id: 'A', since: 100 },
    ],
    [
      'the hint of another terminal does nothing',
      [...launchedInTerminal, quiet(7)],
      { kind: 'starting', hint: false, id: null },
    ],
    [
      'a relaunch after the end ignores the old session and takes the new id',
      [
        ...launchedInTerminal,
        start('A'),
        end('A', 'prompt_input_exit'),
        launched(400),
        terminal(5),
        start('A', 'resume', 410),
        start('B', 'startup', 420),
      ],
      { kind: 'live', status: null, id: 'B', since: 420 },
    ],
    [
      'a relaunch is starting with the last id known, for resuming it',
      [...launchedInTerminal, start('A'), end('A', 'other'), launched(400)],
      { kind: 'starting', hint: false, id: 'A' },
    ],
    [
      'a late end of the previous session does not end the relaunch',
      [...launchedInTerminal, start('A'), end('A', 'other'), launched(400), end('A', 'other')],
      { kind: 'starting', hint: false, id: 'A' },
    ],
  ]

  it.each(sequences)('%s', (_name, inputs, expected) => {
    expect(shown(run(inputs))).toEqual(expected)
  })

  it('keeps tickets apart: two interleaved sessions each reach their own state', () => {
    const tickets = new Map<string, SessionState | undefined>()
    const feed = (key: string, input: SessionInput) =>
      tickets.set(key, reduceSession(tickets.get(key), input))
    feed('a', launched())
    feed('b', launched())
    feed('a', terminal(1))
    feed('b', terminal(2))
    feed('b', start('B1'))
    feed('a', start('A1'))
    feed('b', fail('B1'))
    feed('a', end('A1', 'prompt_input_exit'))
    feed('a', closed(2, 'user'))
    expect(shown(tickets.get('a'))).toMatchObject({ kind: 'ended', detail: 'exited', id: 'A1' })
    expect(shown(tickets.get('b'))).toMatchObject({ kind: 'live', status: 'failed', id: 'B1' })
  })

  it('ignores hooks the plugin does not register', () => {
    const live = run([...launchedInTerminal, start('A')])
    const stop: SessionInput = { type: 'event', event: event('Stop', 'A'), at: 500 }
    expect(reduceSession(live, stop)).toBe(live)
  })

  it('treats a reloaded window as having closed what it cannot confirm', () => {
    const live = run([...launchedInTerminal, start('A')])!
    expect(shown(afterReload(live, 900))).toEqual({
      kind: 'ended',
      detail: 'window closed',
      id: 'A',
    })
    const done = run([...launchedInTerminal, start('A'), end('A', 'other')])!
    expect(afterReload(done, 900)).toBe(done)
  })
})

describe('why a session ended, from the terminal', () => {
  it.each([
    [{ reason: 'user', code: null }, 'terminal closed'],
    [{ reason: 'shutdown', code: null }, 'window closed'],
    [{ reason: 'process', code: 3 }, 'exited with code 3'],
    [{ reason: 'process', code: 0 }, 'exited'],
    [{ reason: 'extension', code: null }, 'process gone'],
    [{ reason: 'unknown', code: null }, 'process gone'],
  ] as const)('%j is "%s"', (exit, detail) => {
    expect(describeExit(exit)).toBe(detail)
  })
})

describe('what the Tree is told', () => {
  it('shows none, starting with and without the hint, live with its word, and ended with its age', () => {
    expect(sessionView(undefined)).toEqual({ kind: 'none' })
    expect(sessionView(run(launchedInTerminal))).toEqual({ kind: 'starting', hint: null })
    expect(sessionView(run([...launchedInTerminal, quiet(4)]))).toEqual({
      kind: 'starting',
      hint: NO_STATUS_HINT,
    })
    expect(sessionView(run([...launchedInTerminal, start('A')]))).toEqual({
      kind: 'live',
      status: null,
      needsYou: false,
      since: 100,
      focusable: true,
      warning: null,
    })
    expect(sessionView(run([...launchedInTerminal, start('A'), fail('A')]))).toEqual({
      kind: 'live',
      status: 'failed',
      needsYou: true,
      since: 150,
      focusable: true,
      warning: null,
    })
    expect(
      sessionView(run([...launchedInTerminal, start('A'), end('A', 'prompt_input_exit')])),
    ).toEqual({ kind: 'ended', detail: 'exited', since: 200 })
  })

  it('counts failed, waiting and approval as needing me; working, starting, live and ended not', () => {
    const live = run([...launchedInTerminal, start('A')]) as SessionState & { kind: 'live' }
    expect(needsYou(undefined)).toBe(false)
    expect(needsYou(run(launchedInTerminal))).toBe(false)
    expect(needsYou(live)).toBe(false)
    expect(needsYou({ ...live, status: 'working' })).toBe(false)
    expect(needsYou({ ...live, status: 'waiting' })).toBe(true)
    expect(needsYou({ ...live, status: 'approval' })).toBe(true)
    expect(needsYou({ ...live, status: 'failed' })).toBe(true)
    expect(needsYou(run([...launchedInTerminal, start('A'), fail('A'), end('A', 'other')]))).toBe(
      false,
    )
  })
})

const listed = (sessionId: string, status: Listed['status'], at = 400): SessionInput => ({
  type: 'registry',
  listed: [{ sessionId, status }],
  at,
})
const unlisted = (at = 500): SessionInput => ({ type: 'registry', listed: [], at })

/** The Tree's words for a state: status, whether it needs me, since when. */
const told = (state: SessionState | undefined) => {
  const view = sessionView(state)
  return view.kind === 'live'
    ? { status: view.status, needsYou: view.needsYou, since: view.since }
    : view.kind
}

describe('the registry as the first source of liveness', () => {
  it('makes a ticket with no terminal of ours live, with the status and the id the registry gave', () => {
    const state = run([listed('R', 'working')])
    expect(state).toMatchObject({ kind: 'live', terminal: null, sessionId: 'R', adopted: true })
    expect(told(state)).toEqual({ status: 'working', needsYou: false, since: 400 })
    expect(sessionView(state)).toMatchObject({ focusable: false })
  })

  it.each([
    ['working', 'working', false],
    ['waiting', 'waiting for you', true],
    ['approval', 'needs approval', true],
  ] as const)('shows the registry word %s as "%s"', (status, word, needs) => {
    expect(told(run([listed('R', status)]))).toEqual({ status: word, needsYou: needs, since: 400 })
  })

  it('shows a status word the registry added later as live, with no word', () => {
    expect(told(run([listed('R', null)]))).toEqual({ status: null, needsYou: false, since: 400 })
  })

  it('takes the word of the registry over the last status event', () => {
    const state = run([...launchedInTerminal, start('A'), listed('A', 'approval', 300)])
    expect(told(state)).toEqual({ status: 'needs approval', needsYou: true, since: 300 })
    expect(
      told(
        run([
          ...launchedInTerminal,
          start('A'),
          listed('A', 'approval'),
          listed('A', 'working', 450),
        ]),
      ),
    ).toEqual({
      status: 'working',
      needsYou: false,
      since: 450,
    })
  })

  it('keeps the age of a word the registry keeps saying', () => {
    expect(told(run([listed('R', 'waiting', 400), listed('R', 'waiting', 900)]))).toMatchObject({
      since: 400,
    })
  })

  it('turns a starting terminal live, keeping the terminal', () => {
    const state = run([...launchedInTerminal, listed('R', 'working')])
    expect(state).toMatchObject({ kind: 'live', terminal: 4, adopted: false, sessionId: 'R' })
    expect(sessionView(state)).toMatchObject({ focusable: true })
  })

  it('keeps a failure through an idle registry and drops it for any other word', () => {
    const failed = run([...launchedInTerminal, start('A'), fail('A'), listed('A', 'waiting')])
    expect(told(failed)).toEqual({ status: 'failed', needsYou: true, since: 150 })
    const busy = run([...launchedInTerminal, start('A'), fail('A'), listed('A', 'working', 450)])
    expect(told(busy)).toEqual({ status: 'working', needsYou: false, since: 450 })
    expect(told(reduceSession(busy, listed('A', 'waiting', 460)))).toEqual({
      status: 'waiting for you',
      needsYou: true,
      since: 460,
    })
  })

  it('falls back to the last status event, with its age, when the registry no longer lists it', () => {
    const state = run([
      ...launchedInTerminal,
      start('A'),
      fail('A'),
      listed('A', 'working'),
      unlisted(),
    ])
    expect(told(state)).toEqual({ status: null, needsYou: false, since: 150 })
    expect(told(run([...launchedInTerminal, start('A'), fail('A'), unlisted()]))).toEqual({
      status: 'failed',
      needsYou: true,
      since: 150,
    })
  })

  it('forgets a session only the registry knew once the registry stops listing it', () => {
    expect(run([listed('R', 'working'), unlisted()])).toBeUndefined()
  })

  it('does not bring back a session that ended while its entry lingers', () => {
    const ended = run([...launchedInTerminal, start('A'), end('A', 'prompt_input_exit')])
    expect(reduceSession(ended, listed('A', 'working'))).toBe(ended)
    const closedTerminal = run([...launchedInTerminal, start('A'), closed(4, 'process', 1)])
    expect(reduceSession(closedTerminal, listed('A', 'working'))?.kind).toBe('ended')
  })

  it('brings an ended ticket back when a new session with its number is listed', () => {
    const ended = run([...launchedInTerminal, start('A'), end('A', 'prompt_input_exit')])
    expect(reduceSession(ended, listed('B', 'waiting'))).toMatchObject({
      kind: 'live',
      sessionId: 'B',
      finished: ['A'],
    })
  })

  it('warns about a second live session and shows the one it already knew', () => {
    const state = run([
      ...launchedInTerminal,
      start('A'),
      {
        type: 'registry',
        listed: [
          { sessionId: 'B', status: 'working' },
          { sessionId: 'A', status: 'waiting' },
        ],
        at: 400,
      },
    ])
    expect(sessionView(state)).toMatchObject({
      status: 'waiting for you',
      warning: 'Another live session has this ticket’s number',
    })
    expect(state).toMatchObject({ sessionId: 'A', duplicates: 1 })
    expect(
      sessionView(
        reduceSession(state, {
          type: 'registry',
          listed: [
            { sessionId: 'A', status: 'waiting' },
            { sessionId: 'B', status: 'waiting' },
            { sessionId: 'C', status: 'waiting' },
          ],
          at: 450,
        }),
      ),
    ).toMatchObject({ warning: '2 other live sessions have this ticket’s number' })
    expect(sessionView(reduceSession(state, unlisted()))).toMatchObject({ warning: null })
  })

  it('counts a session the registry says needs me in the badge', () => {
    expect(needsYou(run([listed('R', 'waiting')]))).toBe(true)
    expect(needsYou(run([listed('R', 'approval')]))).toBe(true)
    expect(needsYou(run([listed('R', 'working')]))).toBe(false)
  })
})
