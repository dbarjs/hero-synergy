import { raise } from '@hero-synergy/core'
import { describe, expect, it } from '@effect/vitest'

import {
  HEALTH_KEY,
  healthDismissalKey,
  healthEntries,
  healthEntry,
  healthRowOf,
} from './health.ts'

const NONE: ReadonlySet<string> = new Set()
const CONTEXT = { claude: '2.1.213' }

// The level and the copy of every health code are core's table, tested there.
describe('health in the Tree', () => {
  it('keys a dismissal on the code and the exact detail', () => {
    expect(healthDismissalKey('claude-below-floor', '2.1.211')).not.toBe(
      healthDismissalKey('claude-below-floor', '2.1.210'),
    )
    expect(healthEntry(raise('claude-below-floor', '2.1.211'), CONTEXT).dismissKey).toBe(
      healthDismissalKey('claude-below-floor', '2.1.211'),
    )
  })
})

describe('the entries of the Health row', () => {
  it('lists loud entries first, each code once, the dismissed ones gone', () => {
    const dismissed = new Set([healthDismissalKey('plugin-disabled', 'mp is disabled')])
    const entries = healthEntries(
      [
        raise('hook-reason-missing', 'SessionEnd for ticket 4 has no reason'),
        raise('claude-below-floor', '2.1.211'),
        raise('claude-below-floor', '2.1.211'),
        raise('plugin-disabled', 'mp is disabled'),
      ],
      [{ code: 'unknown-wayfinder-labels', detail: 'wayfinder:epic' }],
      CONTEXT,
      dismissed,
    )
    expect(entries.map((entry) => [entry.code, entry.level])).toEqual([
      ['claude-below-floor', 'loud'],
      ['hook-reason-missing', 'quiet'],
      ['unknown-wayfinder-labels', 'quiet'],
    ])
  })

  it('keys the snapshot’s own warning like a health entry, so it is dismissed in every workspace', () => {
    const [entry] = healthEntries(
      [],
      [{ code: 'unknown-wayfinder-labels', detail: 'wayfinder:epic' }],
      CONTEXT,
      NONE,
    )
    expect(entry?.dismissKey).toBe(healthDismissalKey('unknown-wayfinder-labels', 'wayfinder:epic'))
  })
})

describe('the pinned Health row', () => {
  it('is absent when there is nothing to report', () => {
    expect(healthRowOf([])).toBeNull()
  })

  it('is a ⚠ row of warnings when any entry is loud, hovering the loud messages', () => {
    const entries = healthEntries(
      [
        raise('claude-below-floor', '2.1.211'),
        raise('registry-unreadable', 'not an array of entries'),
        raise('hook-reason-missing', 'x'),
      ],
      [],
      CONTEXT,
      NONE,
    )
    const row = healthRowOf(entries)
    expect(row).toMatchObject({ key: HEALTH_KEY, loud: true, label: 'Health · 2 warnings' })
    expect(row?.hover).toEqual(entries.filter((e) => e.level === 'loud').map((e) => e.message))
    expect(row?.entries).toHaveLength(3)
  })

  it('says one warning in the singular', () => {
    const row = healthRowOf(
      healthEntries([raise('claude-below-floor', '2.1.211')], [], CONTEXT, NONE),
    )
    expect(row?.label).toBe('Health · 1 warning')
  })

  it('is a quiet row of notes when no entry is loud, with nothing on hover', () => {
    const row = healthRowOf(healthEntries([raise('hook-reason-missing', 'x')], [], CONTEXT, NONE))
    expect(row).toMatchObject({ loud: false, label: 'Health · 1 note', hover: [] })
    const several = healthRowOf(
      healthEntries(
        [raise('hook-reason-missing', 'x'), raise('plugin-disabled', 'y')],
        [],
        CONTEXT,
        NONE,
      ),
    )
    expect(several?.label).toBe('Health · 2 notes')
  })
})
