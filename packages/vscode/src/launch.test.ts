import { describe, expect, it } from 'vite-plus/test'

import {
  canLaunchFrom,
  describeExit,
  NO_WAYFINDER_REASON,
  sessionView,
  terminalIcon,
} from './launch.ts'

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

describe('session state', () => {
  it('allows a launch with no session or an ended one, never while starting', () => {
    expect(canLaunchFrom(undefined)).toBe(true)
    expect(canLaunchFrom({ kind: 'ended', detail: 'terminal closed' })).toBe(true)
    expect(canLaunchFrom({ kind: 'starting', terminal: null })).toBe(false)
    expect(canLaunchFrom({ kind: 'starting', terminal: 4 })).toBe(false)
  })

  it('shows the state without the terminal id', () => {
    expect(sessionView(undefined)).toEqual({ kind: 'none' })
    expect(sessionView({ kind: 'starting', terminal: 4 })).toEqual({ kind: 'starting' })
    expect(sessionView({ kind: 'ended', detail: 'window closed' })).toEqual({
      kind: 'ended',
      detail: 'window closed',
    })
  })

  it('tells the person how to install the wayfinder skill', () => {
    expect(NO_WAYFINDER_REASON).toContain('claude plugins install mattpocock-skills')
  })
})
