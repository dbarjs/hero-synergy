import { describe, expect, it } from '@effect/vitest'

import { localForms, scratchFiles } from '../../fixtures/local-forms/forms.ts'

// The pattern fixtures of map #130: one invented file per form a real local tracker holds, each
// with its careful reading in `truth.json`. These tests keep the fixture whole; the readers'
// table test feeds `localForms()` to the readers and compares with each `reading`.

const forms = localForms()
const effortOf = (path: string): string => path.split('/')[1]!
const ticketNumbers = (effort: string): Set<number> =>
  new Set(
    forms
      .filter((form) => form.kind === 'ticket' && effortOf(form.path) === effort)
      .map((form) => Number(/\/issues\/(\d+)-/.exec(form.path)![1])),
  )

describe('the local-forms fixture', () => {
  it('holds a truth for every file under .scratch, and a file for every truth', () => {
    expect(forms.map((form) => form.path)).toEqual(scratchFiles())
  })

  it('places each kind where a local tracker keeps it', () => {
    for (const form of forms) {
      const inEffort = form.path.split('/').slice(2).join('/')
      if (form.kind === 'ticket') expect(inEffort, form.path).toMatch(/^issues\/\d+-[^/]+\.md$/)
      else if (form.kind === 'map') expect(inEffort, form.path).toMatch(/^(MAP|map)\.md$/)
      else expect(inEffort, form.path).not.toMatch(/^(issues\/\d+-[^/]+|MAP|map)\.md$/)
    }
  })

  it('names a form for every file and gives every ticket an H1', () => {
    for (const form of forms) {
      expect(form.form, form.path).not.toBe('')
      if (form.kind === 'ticket') expect(form.body, form.path).toMatch(/^# \S/)
    }
  })

  it('links blockers, blocked tickets and decisions to tickets of the same effort', () => {
    for (const form of forms) {
      const numbers = ticketNumbers(effortOf(form.path))
      const linked =
        form.kind === 'ticket'
          ? [...form.reading.blockedBy, ...form.reading.blocks]
          : form.kind === 'map'
            ? form.reading.decisions
            : []
      for (const number of linked)
        expect(numbers.has(number), `${form.path} → ${number}`).toBe(true)
    }
  })

  it('points membership at a map or PRD of the same effort', () => {
    const paths = new Set(forms.map((form) => form.path))
    for (const form of forms) {
      if (form.kind !== 'ticket') continue
      for (const target of [form.reading.map, form.reading.parent]) {
        if (target === null) continue
        expect(paths.has(target), `${form.path} → ${target}`).toBe(true)
        expect(effortOf(target), form.path).toBe(effortOf(form.path))
      }
    }
  })

  it('leaves every unsettled field null and names the ticket that settles it', () => {
    const unsettled = forms.filter((form) => form.unsettled !== undefined)
    expect(unsettled.length).toBeGreaterThan(0)
    for (const form of unsettled) {
      expect(form.unsettled!.why, form.path).toContain('#134')
      for (const field of form.unsettled!.fields) {
        expect(form.reading, form.path).not.toBeNull()
        expect((form.reading as unknown as Record<string, unknown>)[field], form.path).toBeNull()
      }
    }
    for (const form of forms) {
      if (form.unsettled === undefined && form.kind !== 'note')
        expect(form.reading.state, form.path).not.toBeNull()
    }
  })
})
