import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vite-plus/test'

import type { Snapshot, Ticket, WayfinderMap } from './model.ts'
import { type Collected, readSnapshot } from './read.ts'
import { type WarningCode, warningCodes } from './warnings.ts'

/**
 * One fixture per drift code: the smallest tracker state that raises it. Each
 * test asserts the warning, its detail where one is promised, and the nulls or
 * the fallback value read beside it.
 */

const DIR = resolve(import.meta.dirname, '../../fixtures/snapshot/drift')

const read = (code: WarningCode): Snapshot =>
  readSnapshot(JSON.parse(readFileSync(resolve(DIR, `${code}.json`), 'utf8')) as Collected)

const codesOf = (item: { warnings: ReadonlyArray<{ code: string }> }): string[] =>
  item.warnings.map((warning) => warning.code)

const map = (snapshot: Snapshot, number: number): WayfinderMap => {
  const found = snapshot.maps.find((candidate) => candidate.number === number)
  if (found === undefined) throw new Error(`no map #${number}`)
  return found
}

const ticket = (snapshot: Snapshot, number: number): Ticket => {
  const found = [
    ...snapshot.maps.flatMap((candidate) => candidate.tickets),
    ...snapshot.unmapped,
  ].find((candidate) => candidate.number === number)
  if (found === undefined) throw new Error(`no ticket #${number}`)
  return found
}

describe('the drift catalogue', () => {
  test('has one fixture per code, and no fixture without a code', () => {
    const files = readdirSync(DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort()
    expect(files).toEqual([...warningCodes].sort())
  })

  test('unknown-wayfinder-labels: on the snapshot for the repo, on the ticket that carries one', () => {
    const snapshot = read('unknown-wayfinder-labels')
    expect(snapshot.warnings).toEqual([
      { code: 'unknown-wayfinder-labels', detail: 'wayfinder:blocked' },
    ])
    const carrier = ticket(snapshot, 2)
    expect(carrier.warnings).toEqual([
      { code: 'unknown-wayfinder-labels', detail: 'wayfinder:blocked' },
    ])
    expect(carrier.type).toBe('grilling')
  })

  test('map-body-legacy: each old heading set is read under its own sections, quietly', () => {
    const snapshot = read('map-body-legacy')
    const fog = map(snapshot, 1)
    expect(fog.warnings).toEqual([
      { code: 'map-body-legacy', detail: 'Notes, Decisions so far, Fog' },
      { code: 'map-no-destination' },
    ])
    expect(fog.destination).toBeNull()
    expect(fog.notes).toBe('- Domain: invoicing.')
    expect(fog.decisions.map((decision) => decision.number)).toEqual([2])
    expect(fog.notYetSpecified.map((entry) => entry.text)).toEqual([
      'Retry policy for failed charges.',
    ])
    expect(fog.outOfScope).toEqual([])
    expect(ticket(snapshot, 2).outcome).toBe('decided')

    const fogWithDestination = map(snapshot, 3)
    expect(fogWithDestination.warnings).toEqual([
      { code: 'map-body-legacy', detail: 'Destination, Notes, Decisions so far, Fog' },
    ])
    expect(fogWithDestination.destination).toBe('Billing v2 decided.')

    const deferred = map(snapshot, 4)
    expect(deferred.warnings).toEqual([
      { code: 'map-body-legacy', detail: 'Destination, Notes, Decisions so far, Fog, Deferred' },
    ])
    expect(deferred.outOfScope.map((entry) => entry.tickets)).toEqual([[5]])
    expect(ticket(snapshot, 5).outcome).toBe('out-of-scope')
  })

  test('map-body-partial: names the missing sections and reads the present ones', () => {
    const snapshot = read('map-body-partial')
    const partial = map(snapshot, 1)
    expect(partial.warnings).toEqual([
      { code: 'map-body-partial', detail: 'missing Not yet specified, Out of scope' },
    ])
    expect(partial.destination).toBe('Billing v2 decided.')
    expect(partial.decisions).toHaveLength(1)
    expect(partial.notYetSpecified).toEqual([])
    expect(partial.outOfScope).toEqual([])
  })

  test('map-body-free-form: everything read is null or empty, the tickets stay attached', () => {
    const snapshot = read('map-body-free-form')
    const free = map(snapshot, 1)
    expect(free.warnings).toEqual([{ code: 'map-body-free-form' }, { code: 'map-no-destination' }])
    expect(free.destination).toBeNull()
    expect(free.notes).toBeNull()
    expect(free.decisions).toEqual([])
    expect(free.notYetSpecified).toEqual([])
    expect(free.outOfScope).toEqual([])
    expect(free.tickets.map((candidate) => candidate.number)).toEqual([2, 3])
    expect(ticket(snapshot, 2).outcome).toBe('unrecorded')
  })

  test('map-no-destination: an empty Destination section is no destination', () => {
    const snapshot = read('map-no-destination')
    const bare = map(snapshot, 1)
    expect(bare.warnings).toEqual([{ code: 'map-no-destination' }])
    expect(bare.destination).toBeNull()
    expect(bare.notes).not.toBeNull()
  })

  test('decision-line-unparsed: carries the line, which counts for no ticket', () => {
    const snapshot = read('decision-line-unparsed')
    expect(map(snapshot, 1).warnings).toEqual([
      { code: 'decision-line-unparsed', detail: '#3 was dropped, see the comment there' },
    ])
    expect(map(snapshot, 1).decisions.map((decision) => decision.number)).toEqual([2])
    expect(ticket(snapshot, 3).outcome).toBe('unrecorded')
    expect(ticket(snapshot, 3).gist).toBeNull()
  })

  test('decision-links-open-ticket: names the ticket; its gist is read, its outcome stays null', () => {
    const snapshot = read('decision-links-open-ticket')
    expect(map(snapshot, 1).warnings).toEqual([
      { code: 'decision-links-open-ticket', detail: '#2 Ticket 2' },
    ])
    expect(ticket(snapshot, 2).outcome).toBeNull()
    expect(ticket(snapshot, 2).gist).toBe('Postgres, one schema per tenant')
  })

  test('children-as-task-list: the list places and orders the tickets', () => {
    const snapshot = read('children-as-task-list')
    const listed = map(snapshot, 1)
    expect(listed.warnings).toEqual([{ code: 'children-as-task-list' }])
    expect(listed.tickets.map((candidate) => candidate.number)).toEqual([3, 2, 4])
    expect(snapshot.unmapped).toEqual([])
    expect(codesOf(ticket(snapshot, 3))).toEqual([])
  })

  test('map-title-from-directory: a local map without an H1 is named after its effort directory', () => {
    const snapshot = read('map-title-from-directory')
    const named = map(snapshot, 1)
    expect(named.title).toBe('Billing rewrite')
    expect(named.warnings).toEqual([{ code: 'map-title-from-directory' }])
    expect(ticket(snapshot, 1).title).toBe('Which database?')
    expect(ticket(snapshot, 1).outcome).toBe('decided')
  })

  test('parent-as-part-of-line: the line places the ticket, with the line in the detail', () => {
    const snapshot = read('parent-as-part-of-line')
    expect(map(snapshot, 1).tickets.map((candidate) => candidate.number)).toEqual([2])
    expect(ticket(snapshot, 2).warnings).toEqual([
      { code: 'parent-as-part-of-line', detail: 'Part of #1' },
    ])
  })

  test('blockers-as-text-line: the numbers resolve to blockers with title, state and ref', () => {
    const snapshot = read('blockers-as-text-line')
    const blocked = ticket(snapshot, 2)
    expect(blocked.warnings).toEqual([{ code: 'blockers-as-text-line' }])
    expect(blocked.blockedBy).toEqual([
      {
        number: 3,
        title: 'Ticket 3',
        state: 'open',
        ref: { tracker: 'github', url: 'https://github.com/acme/billing/issues/3' },
      },
    ])
  })

  test('blockers-as-slugs: the slugs ride in the detail and no blocker is read', () => {
    const snapshot = read('blockers-as-slugs')
    const blocked = ticket(snapshot, 2)
    expect(blocked.warnings).toEqual([
      { code: 'blockers-as-slugs', detail: 'relational-db, auth-model' },
    ])
    expect(blocked.blockedBy).toEqual([])
  })

  test('type-as-line: the line gives the type on GitHub, quietly', () => {
    const snapshot = read('type-as-line')
    const typed = ticket(snapshot, 2)
    expect(typed.type).toBe('prototype')
    expect(typed.warnings).toEqual([{ code: 'type-as-line', detail: 'Type: prototype' }])
  })

  test('type-missing: no label and no line is null; a line naming no known type is null with the line', () => {
    const snapshot = read('type-missing')
    expect(ticket(snapshot, 2).type).toBeNull()
    expect(ticket(snapshot, 2).warnings).toEqual([{ code: 'type-missing' }])
    expect(ticket(snapshot, 3).type).toBeNull()
    expect(ticket(snapshot, 3).warnings).toEqual([
      { code: 'type-missing', detail: 'Type: discuss' },
    ])
  })

  test('type-several: two type labels are no type, both named', () => {
    const snapshot = read('type-several')
    expect(ticket(snapshot, 2).type).toBeNull()
    expect(ticket(snapshot, 2).warnings).toEqual([
      { code: 'type-several', detail: 'grilling, research' },
    ])
  })

  test('claim-legacy-label: the label is a claim by nobody', () => {
    const snapshot = read('claim-legacy-label')
    expect(ticket(snapshot, 2).claim).toEqual({ by: [] })
    expect(ticket(snapshot, 2).warnings).toEqual([{ code: 'claim-legacy-label' }])
  })

  test('no-question-heading: the body is kept as written', () => {
    const snapshot = read('no-question-heading')
    const plain = ticket(snapshot, 2)
    expect(plain.warnings).toEqual([{ code: 'no-question-heading' }])
    expect(plain.body).toBe('Should a refund reopen the invoice, or create a credit note?\n')
    expect(plain.type).toBe('grilling')
  })

  test('closed-no-resolution: closed and recorded, with nothing to show as the answer', () => {
    const snapshot = read('closed-no-resolution')
    const silent = ticket(snapshot, 2)
    expect(silent.resolution).toBeNull()
    expect(silent.outcome).toBe('decided')
    expect(silent.warnings).toEqual([{ code: 'closed-no-resolution' }])
  })

  test('closed-unrecorded: closed, in neither Decisions so far nor Out of scope', () => {
    const snapshot = read('closed-unrecorded')
    const forgotten = ticket(snapshot, 2)
    expect(forgotten.outcome).toBe('unrecorded')
    expect(forgotten.gist).toBeNull()
    expect(forgotten.resolution).not.toBeNull()
    expect(forgotten.warnings).toEqual([{ code: 'closed-unrecorded' }])
  })

  test('no-map: the ticket goes to unmapped and has no outcome to read', () => {
    const snapshot = read('no-map')
    expect(map(snapshot, 1).tickets).toEqual([])
    expect(snapshot.unmapped.map((candidate) => candidate.number)).toEqual([2])
    const stray = ticket(snapshot, 2)
    expect(stray.warnings).toEqual([{ code: 'no-map' }])
    expect(stray.outcome).toBeNull()
    expect(stray.gist).toBeNull()
  })

  test('blocker-outside-map: the blocker stays and gates, named in the detail', () => {
    const snapshot = read('blocker-outside-map')
    const blocked = ticket(snapshot, 2)
    expect(blocked.blockedBy.map((blocker) => blocker.number)).toEqual([4, 9])
    expect(blocked.warnings).toEqual([
      { code: 'blocker-outside-map', detail: '#4 Ticket 4' },
      { code: 'blocker-outside-map', detail: '#9 Rotate the API keys' },
    ])
    expect(codesOf(ticket(snapshot, 4))).toEqual([])
  })

  test('ticket-title-from-slug: a local ticket without an H1 is named after its file', () => {
    const snapshot = read('ticket-title-from-slug')
    const named = ticket(snapshot, 2)
    expect(named.title).toBe('Refund policy')
    expect(named.warnings).toEqual([{ code: 'ticket-title-from-slug' }])
    expect(map(snapshot, 1).title).toBe('Billing rewrite')
    expect(map(snapshot, 1).warnings).toEqual([])
  })

  test('unknown-status: the value rides in the detail; the ticket is open and unclaimed', () => {
    const snapshot = read('unknown-status')
    const odd = ticket(snapshot, 2)
    expect(odd.warnings).toEqual([{ code: 'unknown-status', detail: 'in-progress' }])
    expect(odd.state).toBe('open')
    expect(odd.claim).toBeNull()
    expect(odd.title).toBe('Refund policy')
  })
})
