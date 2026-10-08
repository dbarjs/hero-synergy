import { describe, expect, it } from 'vite-plus/test'

import { canLaunchFrom, NO_WAYFINDER_REASON, terminalIcon } from './launch.ts'
import type { SessionState } from '@hero-synergy/core'

describe('the terminal icon per ticket type', () => {
  it('matches the row icons and gives a typeless ticket a plain terminal', () => {
    expect([
      terminalIcon('research'),
      terminalIcon('prototype'),
      terminalIcon('grilling'),
      terminalIcon('task'),
      terminalIcon(null),
    ]).toEqual(['search', 'beaker', 'comment-discussion', 'checklist', 'terminal'])
  })
})

const ended: SessionState = {
  kind: 'ended',
  terminal: null,
  detail: 'terminal closed',
  known: true,
  since: 1,
  sessionId: null,
  finished: [],
}

describe('session state', () => {
  it('allows a launch with no session or an ended one, never while starting or live', () => {
    expect(canLaunchFrom(undefined)).toBe(true)
    expect(canLaunchFrom(ended)).toBe(true)
    expect(canLaunchFrom({ ...ended, kind: 'starting', terminal: null, hint: false })).toBe(false)
    expect(
      canLaunchFrom({
        ...ended,
        kind: 'live',
        terminal: 4,
        status: null,
        since: 1,
        registry: null,
        adopted: false,
        duplicates: 0,
        startedAt: 1,
        name: null,
      }),
    ).toBe(false)
  })

  it('tells the person how to install the wayfinder skill', () => {
    expect(NO_WAYFINDER_REASON).toContain('claude plugins install mattpocock-skills')
  })
})
