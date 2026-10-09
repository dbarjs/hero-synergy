import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { formsRepo, localForms, scratchFiles } from '../../fixtures/local-forms/forms.ts'
import { FileSystem } from '../file-system.ts'
import { readLocalEfforts } from './local.ts'
import { scoutColumns, truthColumns } from './readings.ts'

// The pattern fixtures of map #130: one invented file per form a real local tracker holds, each
// with its careful reading in `truth.json`. The first tests keep the fixture whole; the table
// test reads the fixture with the local reader and compares every file with its `reading`.

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

  it('gives every ticket and map a state', () => {
    for (const form of forms)
      if (form.kind !== 'note') expect(form.reading.state, form.path).not.toBeNull()
  })

  it('lists a disagreement only beside a declared state, never as one', () => {
    const disagreeing = forms.filter((form) => form.disagreements !== undefined)
    expect(disagreeing.length).toBeGreaterThan(0)
    for (const form of disagreeing) {
      expect(form.kind, form.path).not.toBe('note')
      expect(form.disagreements!.length, form.path).toBeGreaterThan(0)
      for (const disagreement of form.disagreements!) expect(disagreement, form.path).not.toBe('')
    }
  })
})

describe('the local reader on every form', () => {
  const ROOT = '/home/ana/forms'
  const efforts = Effect.runSync(
    readLocalEfforts(ROOT).pipe(Effect.provide(FileSystem.inMemory(formsRepo(ROOT)))),
  )

  it.each(forms)('agrees with the truth of $path', (form) => {
    expect(scoutColumns(efforts, form.path)).toEqual(truthColumns(form))
  })

  it('reads every effort directory, and finds a map in each map-* effort', () => {
    expect(efforts.map((effort) => effort.directory)).toEqual(
      [...new Set(forms.map((form) => effortOf(form.path)))].sort(),
    )
    for (const effort of efforts) {
      if (effort.directory.startsWith('map-')) expect(effort.map, effort.directory).not.toBeNull()
    }
  })
})
