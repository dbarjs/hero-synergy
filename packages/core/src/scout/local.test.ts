import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { fixtureRepo as seed } from '../../fixtures/local-tracker/seed.ts'
import { FileSystem } from '../file-system.ts'
import { isFinished } from '../snapshot/derive.ts'
import { driftEntryOf } from '../snapshot/drift-table.ts'
import { decodeSnapshot, encodeSnapshot, type Snapshot } from '../snapshot/model.ts'
import { collectLocal, readLocalEfforts, readLocalTracker } from './local.ts'

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

const SECTIONS =
  '## Destination\n\nA seed library.\n\n## Notes\n\n- Dry shelves.\n\n## Decisions so far\n\n## Not yet specified\n\n## Out of scope\n'
const mapBody = (header = '') => `# Seed library\n\n${header}\n\n${SECTIONS}`
const ticketBody = (title: string, status = 'Status: claimed') =>
  `# ${title}\n\nType: task\n${status}\n\n## Question\n\nq\n`

const efforts = (files: Record<string, string>, root = '/repo') =>
  readLocalEfforts(root).pipe(Effect.provide(FileSystem.inMemory(files)), Effect.orDie)

describe('a local map file', () => {
  it.effect.each(['MAP.md', 'Map.md', 'map.md'])(
    'is found as %s on a case-sensitive disk, with no drift',
    (name) =>
      Effect.gen(function* () {
        const snapshot = yield* read(
          {
            [`/repo/.scratch/seeds/${name}`]: mapBody('Status: in progress'),
            '/repo/.scratch/seeds/issues/01-shelf.md': ticketBody('Shelf'),
          },
          '/repo',
        )
        expect(snapshot.maps).toHaveLength(1)
        const [map] = snapshot.maps
        expect(map!.ref).toEqual({ tracker: 'local', path: `.scratch/seeds/${name}` })
        expect(map!.title).toBe('Seed library')
        expect(map!.warnings).toEqual([])
        expect(map!.tickets.map((ticket) => ticket.title)).toEqual(['Shelf'])
        expect(snapshot.unmapped).toEqual([])
      }),
  )

  it.effect('beside another casing, reads map.md and names both in a loud map-file-ambiguous', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        {
          '/repo/.scratch/seeds/MAP.md': '# Upper\n\n' + SECTIONS,
          '/repo/.scratch/seeds/map.md': '# Lower\n\n' + SECTIONS,
          '/repo/.scratch/seeds/issues/01-shelf.md': ticketBody('Shelf'),
        },
        '/repo',
      )
      const [map] = snapshot.maps
      expect(map!.ref).toEqual({ tracker: 'local', path: '.scratch/seeds/map.md' })
      expect(map!.title).toBe('Lower')
      expect(map!.warnings).toEqual([
        { code: 'map-file-ambiguous', detail: 'MAP.md, map.md; read map.md' },
      ])
      expect(driftEntryOf(map!.warnings[0]!).level).toBe('loud')
      expect(map!.tickets).toHaveLength(1)
    }),
  )

  it.effect('without map.md among the casings, reads the first name in byte order', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        {
          '/repo/.scratch/seeds/Map.md': '# Title case\n\n' + SECTIONS,
          '/repo/.scratch/seeds/MAP.md': '# Upper\n\n' + SECTIONS,
        },
        '/repo',
      )
      expect(snapshot.maps.map((map) => [map.ref, map.title, map.warnings])).toEqual([
        [
          { tracker: 'local', path: '.scratch/seeds/MAP.md' },
          'Upper',
          [{ code: 'map-file-ambiguous', detail: 'MAP.md, Map.md; read MAP.md' }],
        ],
      ])
    }),
  )

  it.effect('is never a directory named map.md, nor a map file below the effort directory', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        {
          '/repo/.scratch/seeds/map.md/notes.md': '# Not a map\n',
          '/repo/.scratch/seeds/research/MAP.md': '# Not a map either\n\n' + SECTIONS,
          '/repo/.scratch/seeds/issues/01-shelf.md': ticketBody('Shelf'),
        },
        '/repo',
      )
      expect(snapshot.maps).toEqual([])
      expect(snapshot.unmapped.map((ticket) => ticket.title)).toEqual(['Shelf'])
    }),
  )

  it.effect('with a bold key raises one header-key-bold naming the bold keys in order', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        {
          '/repo/.scratch/seeds/MAP.md': mapBody(
            '**Label:** wayfinder:map\nCharted: 2025-07-07\n**Status**: charted 2025-07-07',
          ),
        },
        '/repo',
      )
      expect(snapshot.maps[0]!.warnings).toEqual([
        { code: 'header-key-bold', detail: 'Label, Status' },
      ])
    }),
  )
})

describe("a local map's own state", () => {
  it.effect('hides a closed map with its tickets, and the other maps keep their numbers', () =>
    Effect.gen(function* () {
      const files = {
        '/repo/.scratch/a-done/MAP.md': mapBody('Status: **DONE 2025-07-01** — 01 closed.'),
        '/repo/.scratch/a-done/issues/01-shelf.md': ticketBody('Shelf', 'Status: resolved'),
        '/repo/.scratch/b-open/MAP.md': mapBody('Status: in progress 2025-07-05'),
        '/repo/.scratch/b-open/issues/01-fill.md': ticketBody('Fill'),
        '/repo/.scratch/c-reached/map.md': mapBody('Status: destination reached 2025-07-04'),
        '/repo/.scratch/d-no-status/map.md': mapBody(),
      }
      const snapshot = yield* read(files, '/repo')
      expect(snapshot.maps.map((map) => [map.number, map.ref])).toEqual([
        [2, { tracker: 'local', path: '.scratch/b-open/MAP.md' }],
        [4, { tracker: 'local', path: '.scratch/d-no-status/map.md' }],
      ])
      expect(snapshot.maps[0]!.tickets.map((ticket) => ticket.title)).toEqual(['Fill'])
      expect(snapshot.unmapped).toEqual([])

      const read_ = yield* efforts(files)
      expect(read_.map((effort) => [effort.directory, effort.mapState])).toEqual([
        ['a-done', 'closed'],
        ['b-open', 'open'],
        ['c-reached', 'closed'],
        ['d-no-status', 'open'],
      ])
      expect(read_[0]!.map!.number).toBe(1)
      expect(read_[0]!.map!.tickets.map((ticket) => [ticket.title, ticket.state])).toEqual([
        ['Shelf', 'closed'],
      ])
    }),
  )

  it.effect('still finishes an open map whose tickets are all closed', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        {
          '/repo/.scratch/seeds/MAP.md': mapBody(
            'Status: **route walked 2025-07-12** — 01 closed.',
          ),
          '/repo/.scratch/seeds/issues/01-shelf.md': ticketBody('Shelf', 'Status: resolved'),
        },
        '/repo',
      )
      const [map] = snapshot.maps
      expect(map!.warnings).toEqual([])
      expect(isFinished(map!)).toBe(true)
    }),
  )

  it.effect(
    'reads a DONE later in the line, a heading and a Frontier line as nothing; an unknown lead is quiet',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(
          {
            '/repo/.scratch/a/MAP.md': mapBody('Status: **07 DONE 2025-04-19** (uncommitted)'),
            '/repo/.scratch/b/MAP.md': mapBody('Status: The shelf work **DONE 2025-07-10**'),
            '/repo/.scratch/c/MAP.md':
              '# Seed library\n\nFrontier: empty\n\n## Destination reached\n\nAll done.\n\n' +
              SECTIONS,
          },
          '/repo',
        )
        expect(snapshot.maps.map((map) => [map.number, map.warnings])).toEqual([
          [1, [{ code: 'map-status-unknown', detail: '07' }]],
          [2, [{ code: 'map-status-unknown', detail: 'The' }]],
          [3, []],
        ])
        expect(driftEntryOf(snapshot.maps[0]!.warnings[0]!).level).toBe('quiet')
      }),
  )

  it.effect('never reads a Status line after the first H2, in a fence or in inline code', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        {
          '/repo/.scratch/a/MAP.md': `# Seed library\n\n${SECTIONS}\nStatus: DONE 2025-07-01\n`,
          '/repo/.scratch/b/MAP.md': `# Seed library\n\n\`\`\`\nStatus: DONE 2025-07-01\n\`\`\`\n\n${SECTIONS}`,
          '/repo/.scratch/c/MAP.md': `# Seed library\n\n\`Status: DONE 2025-07-01\`\n\n${SECTIONS}`,
        },
        '/repo',
      )
      expect(snapshot.maps.map((map) => [map.number, map.warnings])).toEqual([
        [1, []],
        [2, []],
        [3, []],
      ])
    }),
  )
})

describe('other Markdown under .scratch', () => {
  it.effect('an effort holding only a PRD raises nothing and adds no map', () =>
    Effect.gen(function* () {
      const files = {
        '/repo/.scratch/only-prd/PRD.md': '# A PRD\n\nStatus: DONE\nMap: ../other/MAP.md\n',
      }
      const snapshot = yield* read(files, '/repo')
      expect(snapshot.maps).toEqual([])
      expect(snapshot.unmapped).toEqual([])
      expect(snapshot.warnings).toEqual([])
      expect(yield* efforts(files)).toEqual([
        { directory: 'only-prd', map: null, mapState: null, unmapped: [] },
      ])
    }),
  )

  it.effect(
    'never reads PRDs, specs, research write-ups, asset notes, handoffs or checklists as tickets',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(
          {
            '/repo/.scratch/seeds/MAP.md': mapBody(),
            '/repo/.scratch/seeds/PRD.md': '# PRD\n\nStatus: open\n',
            '/repo/.scratch/seeds/spec.md': '# Spec\n\nType: task\n',
            '/repo/.scratch/seeds/handoff-shelf.md': '# Handoff\n',
            '/repo/.scratch/seeds/qa-checklist.md': '# QA\n\n- [ ] dry\n',
            '/repo/.scratch/seeds/research/01-catalogues.md': '# Research\n\nTicket: 01\n',
            '/repo/.scratch/seeds/assets/01-research/shapes.md': '# Shapes\n',
            '/repo/.scratch/seeds/assets/photo.md': '# Photo\n',
            '/repo/.scratch/seeds/issues/01-shelf.md': ticketBody('Shelf'),
          },
          '/repo',
        )
        expect(snapshot.maps.map((map) => map.tickets.map((ticket) => ticket.ref))).toEqual([
          [{ tracker: 'local', path: '.scratch/seeds/issues/01-shelf.md' }],
        ])
        expect(snapshot.unmapped).toEqual([])
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
