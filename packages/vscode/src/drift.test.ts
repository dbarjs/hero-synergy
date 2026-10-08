import { warningCodes } from '@hero-synergy/core'
import { describe, expect, it } from 'vite-plus/test'

import { DRIFT_TABLE, dismissalKey, entryOf } from './drift.ts'

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
]

describe('the drift table', () => {
  it('covers the whole WarningCode union and nothing else', () => {
    expect(Object.keys(DRIFT_TABLE).toSorted()).toEqual([...warningCodes].toSorted())
  })

  it('gives every code a message, a hint and a level', () => {
    for (const code of warningCodes) {
      const entry = entryOf({ code, detail: 'the detail' }, 'k')
      expect(entry.message, code).not.toBe('')
      expect(entry.hint, code).not.toBe('')
      expect(['loud', 'quiet']).toContain(entry.level)
    }
  })

  it('is loud for exactly the codes where the Cockpit may be wrong or missing something', () => {
    const loud = warningCodes.filter((code) => DRIFT_TABLE[code].level === 'loud')
    expect(loud.toSorted()).toEqual(LOUD.toSorted())
  })

  it('adds the newer-skills hint to the three codes a newer mattpocock-skills may write, and no others', () => {
    for (const code of warningCodes) {
      const mentions = entryOf({ code }, 'k').hint.includes('check for a hero-synergy update')
      expect(mentions, code).toBe(
        ['map-body-partial', 'unknown-wayfinder-labels', 'decision-line-unparsed'].includes(code),
      )
    }
  })

  it('keys a dismissal on the exact detail', () => {
    const a = dismissalKey('map:3:ticket:1', { code: 'blockers-as-slugs', detail: 'x' })
    expect(a).toBe(dismissalKey('map:3:ticket:1', { code: 'blockers-as-slugs', detail: 'x' }))
    expect(a).not.toBe(dismissalKey('map:3:ticket:1', { code: 'blockers-as-slugs', detail: 'y' }))
    expect(a).not.toBe(dismissalKey('map:3:ticket:2', { code: 'blockers-as-slugs', detail: 'x' }))
  })
})
