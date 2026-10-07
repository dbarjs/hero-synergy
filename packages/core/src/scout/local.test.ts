import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { fixtureRepo as seed } from '../../fixtures/local-tracker/seed.ts'
import { FileSystem } from '../file-system.ts'
import { decodeSnapshot, encodeSnapshot, type Snapshot } from '../snapshot/model.ts'
import { collectLocal, readLocalTracker } from './local.ts'

const ROOT = '/home/ana/billing'
const fixtureRepo = (root: string = ROOT) => seed(root)

const codesOf = (item: { warnings: ReadonlyArray<{ code: string }> }): string[] =>
  item.warnings.map((warning) => warning.code)

const read = (files: Record<string, string>, root = ROOT): Effect.Effect<Snapshot> =>
  readLocalTracker(root).pipe(Effect.provide(FileSystem.inMemory(files)), Effect.orDie)

describe('readLocalTracker on the fixture repo', () => {
  it.effect('numbers every effort directory by position and shows the two with a map', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(fixtureRepo())
      expect(snapshot.tracker).toEqual({ kind: 'local' })
      expect(snapshot.repoRoot).toBe(ROOT)
      expect(snapshot.collectedAt).toBe('1970-01-01T00:00:00.000Z')
      expect(snapshot.warnings).toEqual([])
      expect(snapshot.maps.map((map) => [map.number, map.title])).toEqual([
        [1, 'Billing rewrite'],
        [2, 'Cockpit colors'],
      ])
      expect(snapshot.maps.map((map) => map.ref)).toEqual([
        { tracker: 'local', path: '.scratch/billing-rewrite/map.md' },
        { tracker: 'local', path: '.scratch/cockpit-colors/map.md' },
      ])
    }),
  )

  it.effect(
    'reads the first map: its sections, its tickets in number order, their states, claim, blockers and answer',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(fixtureRepo())
        const map = snapshot.maps[0]!
        expect(map.destination).toBe(
          'Billing v2 decided: every question it depends on is answered, ready for `/to-spec`.',
        )
        expect(map.decisions).toEqual([
          {
            number: 1,
            title: 'Which database?',
            link: 'issues/01-which-database.md',
            gist: 'Postgres: the team runs it already, and the refund ledger needs transactions',
          },
        ])
        expect(map.notYetSpecified.map((entry) => entry.text)).toEqual([
          'How refunds reach the ledger once the policy is decided.',
        ])
        expect(map.warnings).toEqual([])

        expect(map.tickets.map((ticket) => ticket.number)).toEqual([1, 2, 3])
        const [database, refund, numbering] = map.tickets
        expect(database).toMatchObject({
          title: 'Which database?',
          ref: { tracker: 'local', path: '.scratch/billing-rewrite/issues/01-which-database.md' },
          state: 'closed',
          type: 'research',
          claim: null,
          blockedBy: [],
          resolution: {
            body: 'Postgres. The team runs it already, and the refund ledger needs transactions.',
            author: null,
            at: null,
          },
          outcome: 'decided',
          gist: 'Postgres: the team runs it already, and the refund ledger needs transactions',
          warnings: [],
        })
        expect(refund).toMatchObject({
          title: 'Refund policy',
          state: 'open',
          type: 'grilling',
          claim: { by: [] },
          resolution: null,
          outcome: null,
          warnings: [],
        })
        expect(refund!.blockedBy).toEqual([
          {
            number: 1,
            title: 'Which database?',
            state: 'closed',
            ref: { tracker: 'local', path: '.scratch/billing-rewrite/issues/01-which-database.md' },
          },
        ])
        expect(numbering).toMatchObject({ title: 'Invoice numbering', state: 'open', claim: null })
        expect(numbering!.blockedBy.map((blocker) => [blocker.number, blocker.state])).toEqual([
          [1, 'closed'],
          [2, 'open'],
        ])
        expect(numbering!.body.startsWith('# Invoice numbering')).toBe(true)
      }),
  )

  it.effect(
    'reads the second map: a title from the slug with its warning, and a ticket ruled out of scope',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(fixtureRepo())
        const map = snapshot.maps[1]!
        expect(map.decisions).toEqual([])
        expect(map.outOfScope).toEqual([
          {
            text: "[Dark mode](issues/02-dark-mode.md): VS Code's theme already decides it.",
            tickets: [2],
          },
        ])
        const [palette, darkMode] = map.tickets
        expect(palette).toMatchObject({
          number: 1,
          title: 'Palette',
          ref: { tracker: 'local', path: '.scratch/cockpit-colors/issues/01-palette.md' },
          type: 'prototype',
          state: 'open',
        })
        expect(codesOf(palette!)).toEqual(['ticket-title-from-slug'])
        expect(darkMode).toMatchObject({
          number: 2,
          title: 'Dark mode',
          state: 'closed',
          outcome: 'out-of-scope',
          gist: null,
          resolution: { body: 'No: the tokens follow the VS Code theme.' },
          warnings: [],
        })
      }),
  )

  it.effect(
    'puts the issue files of an effort without a map in unmapped with no-map, and ignores a stray file under .scratch',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(fixtureRepo())
        expect(
          snapshot.unmapped.map((ticket) => [ticket.number, ticket.title, ticket.ref]),
        ).toEqual([
          [
            1,
            'Welcome screen',
            { tracker: 'local', path: '.scratch/onboarding-spec/issues/01-welcome-screen.md' },
          ],
          [
            2,
            'Invite flow',
            { tracker: 'local', path: '.scratch/onboarding-spec/issues/02-invite-flow.md' },
          ],
        ])
        for (const ticket of snapshot.unmapped) {
          expect(ticket.state).toBe('open')
          expect(codesOf(ticket)).toEqual([
            'type-missing',
            'unknown-status',
            'no-question-heading',
            'no-map',
          ])
        }
      }),
  )

  it.effect('yields a snapshot that round-trips through its JSON form', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(fixtureRepo())
      expect(decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot(snapshot))))).toEqual(snapshot)
    }),
  )

  it.effect('collects one effort per directory, with the slug a launch needs', () =>
    Effect.gen(function* () {
      const efforts = yield* collectLocal(ROOT).pipe(
        Effect.provide(FileSystem.inMemory(fixtureRepo())),
      )
      expect(efforts.map((effort) => effort.slug)).toEqual([
        'billing-rewrite',
        'cockpit-colors',
        'onboarding-spec',
      ])
      expect(efforts.map((effort) => effort.collected.maps.map((map) => map.number))).toEqual([
        [1],
        [2],
        [],
      ])
      expect(efforts[0]!.collected.maps[0]!.children).toEqual([1, 2, 3])
      expect(efforts[2]!.collected.tickets.map((ticket) => ticket.parent)).toEqual([null, null])
      for (const effort of efforts) {
        for (const ticket of effort.collected.tickets) {
          expect(ticket).toMatchObject({
            title: null,
            state: null,
            lastComment: null,
            labels: [],
            assignees: [],
            blockedBy: [],
          })
        }
      }
    }),
  )
})

describe('readLocalTracker on the edges', () => {
  it.effect('a repo with no .scratch has no maps and no error', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        { '/repo/docs/agents/issue-tracker.md': '# Issue tracker: Local Markdown\n' },
        '/repo',
      )
      expect(snapshot.maps).toEqual([])
      expect(snapshot.unmapped).toEqual([])
    }),
  )

  it.effect('an effort with a map and no issues directory is a map with no tickets', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        { '/repo/.scratch/empty/map.md': '# Empty\n\n## Destination\n\nSomewhere.\n' },
        '/repo',
      )
      expect(snapshot.maps).toHaveLength(1)
      expect(snapshot.maps[0]!.tickets).toEqual([])
      expect(snapshot.maps[0]!.title).toBe('Empty')
    }),
  )

  it.effect(
    'orders tickets by their number, not by file name, and skips files that are not tickets',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(
          {
            '/repo/.scratch/one/map.md': '# One\n',
            '/repo/.scratch/one/issues/10-late.md': '# Late\n\nType: task\n\n## Question\n\nq\n',
            '/repo/.scratch/one/issues/2-early.md': '# Early\n\nType: task\n\n## Question\n\nq\n',
            '/repo/.scratch/one/issues/README.md': 'not a ticket',
          },
          '/repo',
        )
        expect(snapshot.maps[0]!.tickets.map((ticket) => [ticket.number, ticket.title])).toEqual([
          [2, 'Early'],
          [10, 'Late'],
        ])
      }),
  )

  it.effect('a trailing slash on the root changes nothing in the refs', () =>
    Effect.gen(function* () {
      const snapshot = yield* read({ '/repo/.scratch/one/map.md': '# One\n' }, '/repo/')
      expect(snapshot.maps[0]!.ref).toEqual({ tracker: 'local', path: '.scratch/one/map.md' })
    }),
  )
})
