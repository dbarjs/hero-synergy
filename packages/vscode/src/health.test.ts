import { healthCodes } from '@hero-synergy/core'
import { describe, expect, it } from '@effect/vitest'

import {
  HEALTH_KEY,
  HEALTH_TABLE,
  healthDismissalKey,
  healthEntries,
  healthEntry,
  healthLevel,
  healthRowOf,
  raise,
  skillOfDetail,
} from './health.ts'

const NONE: ReadonlySet<string> = new Set()
const CONTEXT = { claude: '2.1.213' }

describe('the health table', () => {
  it('covers the whole HealthCode union, and nothing else', () => {
    expect(Object.keys(HEALTH_TABLE).sort()).toEqual([...healthCodes].sort())
  })

  it.each(healthCodes)('%s has a level, a message and a hint', (code) => {
    const entry = healthEntry(raise(code, 'wayfinder: what was seen'), CONTEXT)
    expect(['loud', 'quiet']).toContain(entry.level)
    expect(entry.message.trim()).not.toBe('')
    expect(entry.hint.trim()).not.toBe('')
    expect(entry.code).toBe(code)
  })

  it('has the levels of the spec', () => {
    const loud = [
      'claude-not-found',
      'claude-below-floor',
      'registry-unreadable',
      'registry-entry-unreadable',
      'registry-status-unknown',
      'hook-payload-unreadable',
      'plugin-manifest-unreadable',
      'skill-missing',
    ] as const
    const quiet = [
      'claude-version-unreadable',
      'hook-reason-missing',
      'skill-installed-twice',
      'plugin-disabled',
    ] as const
    for (const code of loud) expect(healthLevel(code, null), code).toBe('loud')
    for (const code of quiet) expect(healthLevel(code, null), code).toBe('quiet')
  })

  it('makes an unreadable skill loud only for wayfinder and to-spec', () => {
    expect(healthLevel('skill-unreadable', 'plugin 1.2.3 wayfinder: no name')).toBe('loud')
    expect(healthLevel('skill-unreadable', '/repo/.claude/skills/to-spec: unreadable')).toBe('loud')
    expect(healthLevel('skill-unreadable', 'plugin 1.2.3 grilling: no name')).toBe('quiet')
    // A repo that happens to be called wayfinder-something does not make every skill loud.
    expect(healthLevel('skill-unreadable', '/work/wayfinder-app/.claude/skills/tdd: bad')).toBe(
      'quiet',
    )
    expect(healthLevel('skill-unreadable', '/home/ana/.claude/skills: cannot list')).toBe('quiet')
  })

  it('names the folder a skill detail is about', () => {
    expect(skillOfDetail('plugin 1.2.3 wayfinder: x')).toBe('wayfinder')
    expect(skillOfDetail('C:\\Users\\ana\\.claude\\skills\\to-spec: x')).toBe('to-spec')
    expect(skillOfDetail(undefined)).toBeNull()
  })

  it('names the upstream and the version it saw in every machine message', () => {
    const registry = healthEntry(raise('registry-unreadable', 'not an array of entries'), CONTEXT)
    expect(registry.message).toContain('Claude Code 2.1.213')
    expect(registry.message).toContain('not an array of entries')
    const unknown = healthEntry(raise('registry-unreadable', 'x'), { claude: null })
    expect(unknown.message).toContain('Claude Code (version unknown)')
    const floor = healthEntry(raise('claude-below-floor', '2.1.211'), CONTEXT)
    expect(floor.message).toContain('Claude Code 2.1.211')
    expect(floor.message).toContain('2.1.212')
    expect(floor.hint).toContain('claude update')
    expect(floor.hint).toContain('package manager')
  })

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
