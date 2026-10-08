import { describe, expect, it } from 'vite-plus/test'

import { dismissalKey, entryOf } from './drift.ts'

// The level and the copy of every drift code are core's table, tested there.
describe('drift in the Tree', () => {
  it('keys a dismissal on the exact detail', () => {
    const a = dismissalKey('map:3:ticket:1', { code: 'blockers-as-slugs', detail: 'x' })
    expect(a).toBe(dismissalKey('map:3:ticket:1', { code: 'blockers-as-slugs', detail: 'x' }))
    expect(a).not.toBe(dismissalKey('map:3:ticket:1', { code: 'blockers-as-slugs', detail: 'y' }))
    expect(a).not.toBe(dismissalKey('map:3:ticket:2', { code: 'blockers-as-slugs', detail: 'x' }))
  })

  it('shows a warning in core’s words with the key dismissing it', () => {
    expect(entryOf({ code: 'type-missing' }, 'k')).toEqual({
      code: 'type-missing',
      level: 'loud',
      message: 'The ticket has no type.',
      detail: null,
      hint: 'A ticket carries one wayfinder:<type> label: research, prototype, grilling or task.',
      dismissKey: 'k',
    })
  })
})
