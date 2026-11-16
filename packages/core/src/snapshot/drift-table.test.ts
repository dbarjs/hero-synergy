import { describe, expect, it } from 'vite-plus/test'

import { DRIFT_TABLE, driftEntryOf } from './drift-table.ts'
import { isLoud, warningCodes } from './warnings.ts'

const LOUD = [
  'map-body-free-form',
  'map-body-partial',
  'map-no-destination',
  'decision-line-unparsed',
  'decision-links-open-ticket',
  'type-missing',
  'type-several',
  'blockers-as-slugs',
  'no-map',
  'closed-unrecorded',
  'closed-no-resolution',
  'unknown-status',
  'map-file-ambiguous',
]

describe('the drift table', () => {
  it('covers the whole WarningCode union and nothing else', () => {
    expect(Object.keys(DRIFT_TABLE).toSorted()).toEqual([...warningCodes].toSorted())
  })

  it('gives every code a message, a hint and a level', () => {
    for (const code of warningCodes) {
      const entry = driftEntryOf({ code, detail: 'the detail' })
      expect(entry.code).toBe(code)
      expect(entry.message, code).not.toBe('')
      expect(entry.hint, code).not.toBe('')
      expect(['loud', 'quiet']).toContain(entry.level)
    }
  })

  it('is loud for exactly the codes where the Cockpit may be wrong or missing something', () => {
    const loud = warningCodes.filter((code) => DRIFT_TABLE[code].level === 'loud')
    expect(loud.toSorted()).toEqual(LOUD.toSorted())
    for (const code of warningCodes) {
      expect(isLoud(driftEntryOf({ code })), code).toBe(LOUD.includes(code))
    }
  })

  it('adds the newer-skills hint to the three codes a newer mattpocock-skills may write, and no others', () => {
    for (const code of warningCodes) {
      const mentions = driftEntryOf({ code }).hint.includes('check for a hero-synergy update')
      expect(mentions, code).toBe(
        ['map-body-partial', 'unknown-wayfinder-labels', 'decision-line-unparsed'].includes(code),
      )
    }
  })

  it('carries the scout’s detail into the message and the entry, and null when there is none', () => {
    expect(driftEntryOf({ code: 'blockers-as-slugs', detail: 'api, schema' })).toEqual({
      code: 'blockers-as-slugs',
      level: 'loud',
      message: 'The ticket is blocked by names, not numbers: api, schema.',
      detail: 'api, schema',
      hint: 'A blocker is a ticket number, or the tracker’s own blocked-by link.',
    })
    expect(driftEntryOf({ code: 'no-map' }).detail).toBeNull()
  })

  it.each([
    {
      code: 'header-key-bold',
      level: 'quiet',
      message: 'A header line has a bold key.',
      detail: 'Status, Parent',
      withDetail: 'A header line has a bold key: Status, Parent.',
      hint: 'A header line is a plain "Key: value" line before the first ## heading.',
    },
    {
      code: 'map-file-ambiguous',
      level: 'loud',
      message: 'The effort has more than one map file.',
      detail: 'MAP.md, map.md; read map.md',
      withDetail: 'The effort has more than one map file: MAP.md, map.md; read map.md.',
      hint: 'An effort keeps one map file, map.md.',
    },
    {
      code: 'map-status-unknown',
      level: 'quiet',
      message:
        "The map's Status line starts with a word this version does not read; the map reads as open.",
      detail: '01',
      withDetail:
        "The map's Status line starts with a word this version does not read; the map reads as open: 01.",
      hint: 'Only a Status line that starts with DONE or destination reached closes a local map.',
    },
  ] as const)(
    '$code: words the local tracker reader raises',
    ({ code, level, message, detail, withDetail, hint }) => {
      expect(driftEntryOf({ code })).toEqual({ code, level, message, detail: null, hint })
      expect(driftEntryOf({ code, detail })).toEqual({
        code,
        level,
        message: withDetail,
        detail,
        hint,
      })
    },
  )
})
