import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { fixtureRepo as seed } from '../../fixtures/local-tracker/seed.ts'
import { FileSystem } from '../file-system.ts'
import {
  frontierOf,
  isFinished,
  modeOf,
  neighbourhoodOf,
  nextOf,
  placeOf,
} from '../snapshot/derive.ts'
import { driftEntryOf } from '../snapshot/drift-table.ts'
import { decodeSnapshot, encodeSnapshot, type Snapshot, type Ticket } from '../snapshot/model.ts'
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
    'puts the issue files of an effort without a map in one unmapped group named after its directory, with no-map, and ignores a stray file under .scratch',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(fixtureRepo())
        expect(
          snapshot.unmapped.map(({ effort, title, tickets }) => ({
            effort,
            title,
            tickets: tickets.map((ticket) => [ticket.number, ticket.title, ticket.ref]),
          })),
        ).toEqual([
          {
            effort: 'onboarding-spec',
            title: 'onboarding-spec',
            tickets: [
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
            ],
          },
        ])
        for (const ticket of snapshot.unmapped.flatMap((group) => group.tickets)) {
          expect(ticket.state).toBe('open')
          expect(codesOf(ticket)).toEqual(['type-missing', 'no-question-heading', 'no-map'])
        }
      }),
  )

  it.effect(
    "reads each ticket's triage role and Status line, on a map ticket or an unmapped one, and no HITL note from a plain Type line",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(fixtureRepo())
        const tickets = [
          ...snapshot.maps.flatMap((map) => map.tickets),
          ...snapshot.unmapped.flatMap((group) => group.tickets),
        ]
        expect(
          tickets.map((ticket) => [ticket.title, ticket.state, ticket.role, ticket.statusLine]),
        ).toEqual([
          ['Which database?', 'closed', null, 'resolved'],
          ['Refund policy', 'open', null, 'claimed'],
          ['Invoice numbering', 'open', null, null],
          ['Palette', 'open', null, null],
          ['Dark mode', 'closed', null, 'resolved'],
          ['Welcome screen', 'open', 'ready-for-agent', 'ready-for-agent'],
          ['Invite flow', 'open', 'needs-triage', 'needs-triage'],
        ])
        for (const ticket of tickets) expect(ticket.modeNote, ticket.title).toBeNull()
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
      expect(
        snapshot.unmapped.flatMap((group) => group.tickets.map((ticket) => ticket.title)),
      ).toEqual(['Shelf'])
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

describe('unmapped groups', () => {
  it.effect(
    'give each effort without a map its own group, in directory order, and an effort with a map none',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(
          {
            '/repo/.scratch/c-triage/issues/02-dark-shelf.md': ticketBody('Dark shelf'),
            '/repo/.scratch/c-triage/issues/01-damp-shelf.md': ticketBody('Damp shelf'),
            '/repo/.scratch/b-seeds/MAP.md': mapBody(),
            '/repo/.scratch/b-seeds/issues/01-shelf.md': ticketBody('Shelf'),
            '/repo/.scratch/a-onboarding/issues/01-welcome.md': ticketBody('Welcome'),
            '/repo/.scratch/d-notes/PRD.md': '# A PRD\n',
          },
          '/repo',
        )
        expect(
          snapshot.unmapped.map(({ effort, title, tickets }) => ({
            effort,
            title,
            tickets: tickets.map((ticket) => `#${ticket.number} ${ticket.title}`),
          })),
        ).toEqual([
          { effort: 'a-onboarding', title: 'a-onboarding', tickets: ['#1 Welcome'] },
          { effort: 'c-triage', title: 'c-triage', tickets: ['#1 Damp shelf', '#2 Dark shelf'] },
        ])
        expect(snapshot.maps.map((map) => map.tickets.map((ticket) => ticket.title))).toEqual([
          ['Shelf'],
        ])
      }),
  )

  it.effect('keep two efforts’ #1 apart, each in its own group', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        {
          '/repo/.scratch/left/issues/01-shelf.md': ticketBody('Left shelf'),
          '/repo/.scratch/right/issues/01-shelf.md': ticketBody('Right shelf'),
        },
        '/repo',
      )
      expect(
        snapshot.unmapped.map((group) => [
          group.effort,
          group.tickets.map((ticket) => [ticket.number, ticket.ref]),
        ]),
      ).toEqual([
        ['left', [[1, { tracker: 'local', path: '.scratch/left/issues/01-shelf.md' }]]],
        ['right', [[1, { tracker: 'local', path: '.scratch/right/issues/01-shelf.md' }]]],
      ])
    }),
  )
})

describe("a local ticket's state, claim and triage role", () => {
  const issue = (title: string, lines: string) =>
    `# ${title}\n\nType: task\n${lines}\n\n## Question\n\nq\n\n## Answer\n\nDone.\n`
  /** One map, `seeds`, holding the given issue files, numbered in order from 01. */
  const seeds = (...lines: string[]) =>
    Object.fromEntries([
      ['/repo/.scratch/seeds/map.md', mapBody()],
      ...lines.map((line, index) => [
        `/repo/.scratch/seeds/issues/0${index + 1}-step.md`,
        issue(`Step ${index + 1}`, line),
      ]),
    ])
  const ticketsOf = (...lines: string[]) =>
    read(seeds(...lines), '/repo').pipe(Effect.map((snapshot) => snapshot.maps[0]!.tickets))
  const statusDrift = (ticket: Ticket) =>
    ticket.warnings.filter((warning) => warning.code === 'unknown-status')
  const facts = (ticket: Ticket) => ({
    state: ticket.state,
    claim: ticket.claim,
    role: ticket.role,
    statusLine: ticket.statusLine,
  })

  it.effect('closes a ticket on its first word, and no annotation after it reverses that', () =>
    Effect.gen(function* () {
      const lines = [
        'Status: closed 2026-10-01 (reopened and re-closed after a recount)',
        'Status: **closed 2026-10-02** (resolved — turned twice)',
        'Status: DONE 2026-10-03 (closed — labels in place)',
        'Status: resolved',
        'Status: closed — claimed 2026-10-04 (open again?)',
        '**Status:** done (2026-10-05)',
      ]
      const tickets = yield* ticketsOf(...lines)
      tickets.forEach((ticket, index) => {
        const value = lines[index]!.replace(/^\**Status:\**\s*/, '')
        expect(facts(ticket), lines[index]).toEqual({
          state: 'closed',
          claim: null,
          role: null,
          statusLine: value,
        })
        expect(placeOf(ticket)).toBe('closed')
        expect(statusDrift(ticket), lines[index]).toEqual([])
      })
    }),
  )

  it.effect('closes a ticket on wontfix and makes wontfix its role', () =>
    Effect.gen(function* () {
      const [ticket] = yield* ticketsOf('Status: wontfix (2026-10-06 — the hall is gone)')
      expect(facts(ticket!)).toEqual({
        state: 'closed',
        claim: null,
        role: 'wontfix',
        statusLine: 'wontfix (2026-10-06 — the hall is gone)',
      })
    }),
  )

  it.effect('leaves a ticket open on open, a triage role or no Status line, with no drift', () =>
    Effect.gen(function* () {
      const tickets = yield* ticketsOf(
        'Status: open',
        'Status: needs-triage',
        'Status: needs-info (asked 2026-10-07)',
        'Status: ready-for-agent',
        '**Status:** ready-for-human',
        'Assignee: —',
      )
      expect(tickets.map((ticket) => [ticket.state, ticket.claim, ticket.role])).toEqual([
        ['open', null, null],
        ['open', null, 'needs-triage'],
        ['open', null, 'needs-info'],
        ['open', null, 'ready-for-agent'],
        ['open', null, 'ready-for-human'],
        ['open', null, null],
      ])
      for (const ticket of tickets) expect(statusDrift(ticket), ticket.title).toEqual([])
      expect(tickets[5]!.statusLine).toBeNull()
    }),
  )

  it.effect('reads one more word after open: a role sets the role, claimed claims', () =>
    Effect.gen(function* () {
      const tickets = yield* ticketsOf(
        'Status: open — needs-triage (blocked)',
        'Status: open (ready-for-human — unblocked 2026-10-08: 01/02 all closed)',
        'Status: open — claimed 2026-10-09 (HITL: waiting on the roster)',
        'Status: open (claimed 2026-10-10, a member on it)',
        'Status: open — ready-for-human (claimed 2026-10-11, being worked)',
      )
      expect(tickets.map((ticket) => [ticket.claim, ticket.role])).toEqual([
        [null, 'needs-triage'],
        [null, 'ready-for-human'],
        [{ by: [] }, null],
        [{ by: [] }, null],
        // Only one word is read after open: the claim after the role is annotation.
        [null, 'ready-for-human'],
      ])
      for (const ticket of tickets) expect(statusDrift(ticket), ticket.title).toEqual([])
    }),
  )

  it.effect('takes the role from a Labels item when the Status line gives none', () =>
    Effect.gen(function* () {
      const tickets = yield* ticketsOf(
        'Status: open\nLabels: wayfinder:task, ready-for-agent',
        'Status: open — needs-info\nLabels: ready-for-agent',
        'Labels: ready-for-agent (afk)',
      )
      expect(tickets.map((ticket) => ticket.role)).toEqual(['ready-for-agent', 'needs-info', null])
    }),
  )

  it.effect(
    'claims an open ticket by its Assignee name, which takes it off the frontier, and names nobody for a placeholder',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(
          seeds(
            'Status: open\nAssignee: wren (claimed 2026-10-12, wayfinder session)',
            'Status: open\nAssignee: agent (wren) — claimed 2026-10-13',
            'Status: claimed\nAssignee: wren',
            'Status: open\nAssignee: — (unclaimed)',
            'Status: open\nAssignee: (unclaimed)',
            'Status: open\nAssignee:',
            'Status: claimed',
          ),
          '/repo',
        )
        const map = snapshot.maps[0]!
        expect(map.tickets.map((ticket) => ticket.claim)).toEqual([
          { by: ['wren'] },
          { by: ['agent'] },
          { by: ['wren'] },
          null,
          null,
          null,
          { by: [] },
        ])
        expect(frontierOf(map).map((ticket) => ticket.number)).toEqual([4, 5, 6])
        expect(map.tickets.filter((ticket) => placeOf(ticket) === 'claimed')).toHaveLength(4)
        for (const ticket of map.tickets) expect(statusDrift(ticket), ticket.title).toEqual([])
      }),
  )

  it.effect('never claims a closed ticket, whatever its Assignee line or a leftover claim', () =>
    Effect.gen(function* () {
      const tickets = yield* ticketsOf(
        'Status: closed 2026-10-14\nAssignee: wren (claimed 2026-10-01)',
        'Status: done\nAssignee: agent (agent session 2026-10-02)',
        'Status: resolved — claimed 2026-10-03',
      )
      for (const ticket of tickets) {
        expect([ticket.state, ticket.claim, placeOf(ticket)], ticket.title).toEqual([
          'closed',
          null,
          'closed',
        ])
      }
    }),
  )

  it.effect(
    'reads a Status line it does not know as open, claimable through Assignee, with a loud unknown-status naming the value',
    () =>
      Effect.gen(function* () {
        const line =
          'build half DONE 2026-10-15 (uncommitted); check half OPEN (HITL — a member walks it)'
        const [twoStates, other] = yield* ticketsOf(
          `Status: ${line}\nAssignee: wren (claimed 2026-10-15)`,
          'Status: in-progress',
        )
        expect(facts(twoStates!)).toEqual({
          state: 'open',
          claim: { by: ['wren'] },
          role: null,
          statusLine: line,
        })
        expect(statusDrift(twoStates!)).toEqual([{ code: 'unknown-status', detail: line }])
        expect(driftEntryOf(statusDrift(twoStates!)[0]!)).toMatchObject({
          level: 'loud',
          message: `The ticket's Status line starts with a word this version does not read; the ticket reads as open: ${line}.`,
        })
        expect([other!.state, other!.claim]).toEqual(['open', null])
        expect(statusDrift(other!)).toEqual([{ code: 'unknown-status', detail: 'in-progress' }])
      }),
  )

  it.effect(
    'reads the first of two Status header lines, and raises unknown-status for the second',
    () =>
      Effect.gen(function* () {
        const [ticket] = yield* ticketsOf('Status: closed 2026-10-16\nStatus: open — claimed')
        expect(facts(ticket!)).toEqual({
          state: 'closed',
          claim: null,
          role: null,
          statusLine: 'closed 2026-10-16',
        })
        expect(statusDrift(ticket!)).toEqual([
          { code: 'unknown-status', detail: 'open — claimed (a second Status line, ignored)' },
        ])
      }),
  )

  it.effect(
    'never reads a Status or Assignee line after the first H2, in a fence or in inline code',
    () =>
      Effect.gen(function* () {
        const body =
          '# Step 1\n\nType: task\n```\nStatus: closed\n```\n`Status: closed`\n\n## Question\n\nClose with `Status: closed`.\n\nStatus: done\nAssignee: wren\n'
        const snapshot = yield* read(
          {
            '/repo/.scratch/seeds/map.md': mapBody(),
            '/repo/.scratch/seeds/issues/01-step.md': body,
          },
          '/repo',
        )
        expect(facts(snapshot.maps[0]!.tickets[0]!)).toEqual({
          state: 'open',
          claim: null,
          role: null,
          statusLine: null,
        })
      }),
  )

  it.effect('never lets the role gate the frontier: a ready-for-human ticket can be next', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        seeds('Status: ready-for-human', 'Status: open — needs-triage (blocked)\nBlocked by: 01'),
        '/repo',
      )
      const map = snapshot.maps[0]!
      expect(nextOf(map)?.number).toBe(1)
      expect(map.tickets.map(placeOf)).toEqual(['frontier', 'blocked'])
    }),
  )
})

describe("a local ticket's type and HITL note", () => {
  /** One map, `seeds`, holding issue files numbered in order from 01, each with the given header lines. */
  const seeds = (...headers: string[]) =>
    Object.fromEntries([
      ['/repo/.scratch/seeds/map.md', mapBody()],
      ...headers.map((header, index) => [
        `/repo/.scratch/seeds/issues/0${index + 1}-step.md`,
        `# Task: Step ${index + 1}\n\nStatus: open\n${header}\n\n## Question\n\nq\n`,
      ]),
    ])
  const ticketsOf = (...headers: string[]) =>
    read(seeds(...headers), '/repo').pipe(Effect.map((snapshot) => snapshot.maps[0]!.tickets))
  const typeDrift = (ticket: Ticket) =>
    ticket.warnings.filter((warning) =>
      [
        'type-missing',
        'type-several',
        'type-as-label',
        'mode-conflicts-type',
        'unknown-wayfinder-labels',
      ].includes(warning.code),
    )

  it.effect(
    'reads the type from Type, Label and Labels lines, noting every form but the template’s',
    () =>
      Effect.gen(function* () {
        const tickets = yield* ticketsOf(
          'Type: research',
          'Label: wayfinder:grilling',
          'Labels: wayfinder:prototype',
          'Type: wayfinder:task (AFK)',
          '**Type:** grilling',
        )
        expect(tickets.map((ticket) => [ticket.type, ticket.modeNote, typeDrift(ticket)])).toEqual([
          ['research', null, []],
          ['grilling', null, [{ code: 'type-as-label', detail: 'wayfinder:grilling' }]],
          ['prototype', null, [{ code: 'type-as-label', detail: 'wayfinder:prototype' }]],
          ['task', 'AFK', [{ code: 'type-as-label', detail: 'wayfinder:task (AFK)' }]],
          ['grilling', null, []],
        ])
      }),
  )

  it.effect('gives one Labels line both the type and the triage role', () =>
    Effect.gen(function* () {
      const [ticket] = yield* ticketsOf('Labels: wayfinder:task, ready-for-agent')
      expect(ticket).toMatchObject({
        type: 'task',
        role: 'ready-for-agent',
        modeNote: null,
        labels: ['wayfinder:task', 'ready-for-agent'],
      })
      expect(typeDrift(ticket!)).toEqual([{ code: 'type-as-label', detail: 'wayfinder:task' }])
    }),
  )

  it.effect('never reads the H1 as a type, and keeps the title verbatim', () =>
    Effect.gen(function* () {
      const [untyped, typed] = yield* ticketsOf('Assignee: —', 'Type: research')
      expect([untyped!.title, untyped!.type]).toEqual(['Task: Step 1', null])
      expect(typeDrift(untyped!)).toEqual([{ code: 'type-missing' }])
      expect([typed!.title, typed!.type]).toEqual(['Task: Step 2', 'research'])
    }),
  )

  it.effect('never makes data of a type word or a number in the parenthesis’s prose', () =>
    Effect.gen(function* () {
      const tickets = yield* ticketsOf(
        'Type: task',
        'Label: wayfinder:task (AFK — ready once 01 closes; the grilling in 03 can wait)',
        'Labels: wayfinder:research (HITL, wayfinder:grilling after 01), ready-for-agent',
      )
      const [, noted, labelled] = tickets
      expect([noted!.type, noted!.modeNote, noted!.blockedBy]).toEqual(['task', 'AFK', []])
      expect([labelled!.type, labelled!.modeNote, labelled!.blockedBy]).toEqual([
        'research',
        'HITL',
        [],
      ])
      for (const ticket of tickets) {
        expect(codesOf(ticket), ticket.title).not.toContain('type-several')
        expect(placeOf(ticket), ticket.title).toBe('frontier')
      }
    }),
  )

  it.effect('reads no type from lines that name two, and says which', () =>
    Effect.gen(function* () {
      const [ticket] = yield* ticketsOf('Type: task\nLabels: wayfinder:research, ready-for-agent')
      expect(ticket!.type).toBeNull()
      expect(typeDrift(ticket!)).toEqual([
        { code: 'type-several', detail: 'task, research' },
        { code: 'type-as-label', detail: 'wayfinder:research' },
      ])
      expect(driftEntryOf(typeDrift(ticket!)[0]!).level).toBe('loud')
    }),
  )

  it.effect(
    'reads the leading word of the type’s parenthesis as the HITL note, the first source’s winning',
    () =>
      Effect.gen(function* () {
        const tickets = yield* ticketsOf(
          'Type: task (HITL — a member signs it off)',
          'Type: research (AFK)',
          'Label: wayfinder:task (AFK for the weight; HITL at the counter)',
          'Type: task (a member does the HITL part)',
          'Labels: wayfinder:task (HITL)\nLabel: wayfinder:task (AFK)',
        )
        expect(tickets.map((ticket) => ticket.modeNote)).toEqual([
          'HITL',
          'AFK',
          'AFK',
          null,
          'AFK',
        ])
      }),
  )

  it.effect('keeps a prototype or grilling ticket HITL under an AFK note, loudly', () =>
    Effect.gen(function* () {
      const [grilling, prototype] = yield* ticketsOf(
        'Type: grilling (AFK)',
        'Label: wayfinder:prototype (AFK — a quick sketch)',
      )
      expect([grilling!.type, grilling!.modeNote, modeOf(grilling!)]).toEqual([
        'grilling',
        'AFK',
        'HITL',
      ])
      expect(typeDrift(grilling!)).toEqual([
        { code: 'mode-conflicts-type', detail: 'grilling (AFK)' },
      ])
      expect(modeOf(prototype!)).toBe('HITL')
      expect(typeDrift(prototype!)).toEqual([
        { code: 'type-as-label', detail: 'wayfinder:prototype (AFK — a quick sketch)' },
        { code: 'mode-conflicts-type', detail: 'wayfinder:prototype (AFK — a quick sketch)' },
      ])
    }),
  )

  it.effect('raises unknown-wayfinder-labels on the ticket, and none on the snapshot', () =>
    Effect.gen(function* () {
      const snapshot = yield* read(
        seeds('Labels: wayfinder:task, wayfinder:blocked', 'Label: wayfinder:map'),
        '/repo',
      )
      const [labelled, mapLabelled] = snapshot.maps[0]!.tickets
      expect(snapshot.warnings).toEqual([])
      expect(typeDrift(labelled!)).toEqual([
        { code: 'type-as-label', detail: 'wayfinder:task' },
        { code: 'unknown-wayfinder-labels', detail: 'wayfinder:blocked' },
      ])
      expect(typeDrift(mapLabelled!)).toEqual([{ code: 'type-missing' }])
    }),
  )
})

describe("a local ticket's blockers", () => {
  const BLOCKER_CODES = [
    'blockers-as-slugs',
    'blockers-not-template',
    'blocker-unread',
    'blocks-line',
    'blocker-outside-map',
  ]
  const blockerDrift = (ticket: Ticket) =>
    ticket.warnings.filter((warning) => BLOCKER_CODES.includes(warning.code))
  const issue = (title: string, lines: string) =>
    `# ${title}\n\nType: task\n${lines}\n\n## Question\n\nq\n`
  const closedIssue = (title: string, lines = '') =>
    `# ${title}\n\nType: task\nStatus: resolved\n${lines}\n\n## Question\n\nq\n\n## Answer\n\nDone.\n`
  /** One map, `seeds`, with closed 01 and open 02 and 03, plus the given issue files. */
  const seeds = (files: Record<string, string>) => ({
    '/repo/.scratch/seeds/map.md': mapBody(),
    '/repo/.scratch/seeds/issues/01-pick-a-date.md': closedIssue('Pick a date'),
    '/repo/.scratch/seeds/issues/02-book-the-hall.md': issue('Book the hall', ''),
    '/repo/.scratch/seeds/issues/03-tell-the-members.md': issue('Tell the members', ''),
    ...Object.fromEntries(
      Object.entries(files).map(([file, body]) => [`/repo/.scratch/seeds/issues/${file}`, body]),
    ),
  })
  const ticketsOf = (snapshot: Snapshot): Map<number, Ticket> =>
    new Map(snapshot.maps[0]!.tickets.map((ticket) => [ticket.number, ticket]))
  const numbers = (ticket: Ticket | undefined) => ticket?.blockedBy.map((blocker) => blocker.number)

  it.effect('names one blocker per item, from its start, and never reads a title or a note', () =>
    Effect.gen(function* () {
      const lines = {
        4: 'Blocked by: [Pick a date](01-pick-a-date.md) (closed 2026-10-01 — see 03); [Book the hall](02-book-the-hall.md)',
        5: 'Blocked by: 01 resolved 2026-10-01; frontier — 03 is next',
        6: 'Blocked by: [Step 3 of 4](02-book-the-hall.md) — after 03',
        7: 'Blocked by: 02-book-the-hall.md (closed 2026-10-02), #3 — the members hear first.',
        8: '**Blocked by:** [03 — Tell the members](03-tell-the-members.md)',
      }
      const tickets = ticketsOf(
        yield* read(
          seeds(
            Object.fromEntries(
              Object.entries(lines).map(([n, line]) => [`0${n}-step.md`, issue(`Step ${n}`, line)]),
            ),
          ),
          '/repo',
        ),
      )
      expect(numbers(tickets.get(4))).toEqual([1, 2])
      expect(numbers(tickets.get(5))).toEqual([1])
      expect(numbers(tickets.get(6))).toEqual([2])
      expect(numbers(tickets.get(7))).toEqual([2, 3])
      expect(numbers(tickets.get(8))).toEqual([3])
      // A blocker carries its own file's title and state, never the link's.
      expect(tickets.get(4)!.blockedBy[0]).toEqual({
        number: 1,
        title: 'Pick a date',
        state: 'closed',
        ref: { tracker: 'local', path: '.scratch/seeds/issues/01-pick-a-date.md' },
      })
      for (const [n, line] of Object.entries(lines)) {
        expect(blockerDrift(tickets.get(Number(n))!), line).toEqual([
          { code: 'blockers-not-template', detail: line.replace(/^\**Blocked by:\**\s*/, '') },
        ])
      }
      expect(driftEntryOf({ code: 'blockers-not-template' }).level).toBe('quiet')
    }),
  )

  it.effect("reads the template's NN, NN without a word", () =>
    Effect.gen(function* () {
      const tickets = ticketsOf(
        yield* read(seeds({ '04-step.md': issue('Step 4', 'Blocked by: 01, 03') }), '/repo'),
      )
      expect(numbers(tickets.get(4))).toEqual([1, 3])
      expect(blockerDrift(tickets.get(4)!)).toEqual([])
    }),
  )

  it.effect.each([
    '',
    '—',
    '–',
    '-',
    'none',
    'None — later',
    'NOTHING',
    '— (first ticket of the map)',
    '(none — frontier)',
    '(nothing — frontier)',
    '— ([02](02-book-the-hall.md) closed 2026-10-02)',
    '— (ticket 03 closed 2026-10-02)',
    '[]',
  ])('reads the none marker "Blocked by: %s" as no blockers, with no drift', (value) =>
    Effect.gen(function* () {
      const tickets = ticketsOf(
        yield* read(
          seeds({ '04-step.md': issue('Step 4', `Blocked by: ${value}\nBlocks: ${value}`) }),
          '/repo',
        ),
      )
      expect(numbers(tickets.get(4))).toEqual([])
      expect(blockerDrift(tickets.get(4)!)).toEqual([])
      expect(numbers(tickets.get(2))).toEqual([])
      expect(numbers(tickets.get(3))).toEqual([])
    }),
  )

  it.effect(
    'raises a loud blocker-unread for an item with no reference, and keeps blockers-as-slugs for a lone slug',
    () =>
      Effect.gen(function* () {
        const tickets = ticketsOf(
          yield* read(
            seeds({
              '04-step.md': issue('Step 4', 'Blocked by: 01, the design review (pending 2)'),
              '05-step.md': issue('Step 5', 'Blocked by: palette, contrast'),
              '06-step.md': issue(
                'Step 6',
                'Blocked by: every ticket on the map (02, 03), and the review',
              ),
              '07-step.md': issue('Step 7', 'Blocked by: (waiting — frontier)'),
            }),
            '/repo',
          ),
        )
        expect(numbers(tickets.get(4))).toEqual([1])
        expect(blockerDrift(tickets.get(4)!)).toEqual([
          { code: 'blocker-unread', detail: 'the design review (pending 2)' },
          { code: 'blockers-not-template', detail: '01, the design review (pending 2)' },
        ])
        // A value with no reference read is no off-template form: the slugs say it all.
        expect(numbers(tickets.get(5))).toEqual([])
        expect(blockerDrift(tickets.get(5)!)).toEqual([
          { code: 'blockers-as-slugs', detail: 'palette, contrast' },
        ])
        expect(numbers(tickets.get(6))).toEqual([])
        expect(blockerDrift(tickets.get(6)!)).toEqual([
          { code: 'blocker-unread', detail: 'every ticket on the map (02, 03)' },
          { code: 'blocker-unread', detail: 'and the review' },
        ])
        expect(blockerDrift(tickets.get(7)!)).toEqual([
          { code: 'blocker-unread', detail: '(waiting — frontier)' },
        ])
        expect(driftEntryOf({ code: 'blocker-unread' }).level).toBe('loud')
      }),
  )

  it.effect(
    'raises blocker-outside-map for a number with no file or a target off the effort, and never gates on it',
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(
          {
            ...seeds({
              '04-step.md': issue(
                'Step 4',
                'Blocked by: 07, [Other](../../other/issues/01-elsewhere.md), [Web](https://example.com/issues/02-book-the-hall.md), [Up](../02-book-the-hall.md), ../../other/issues/01-elsewhere.md, [Root](/02-book-the-hall.md), [Climb](../../../../../02-book-the-hall.md)',
              ),
              '05-step.md': issue('Step 5', 'Blocked by: [Same](./02-book-the-hall.md), 01'),
            }),
            '/repo/.scratch/other/issues/01-elsewhere.md': issue('Elsewhere', ''),
          },
          '/repo',
        )
        const tickets = ticketsOf(snapshot)
        expect(numbers(tickets.get(4))).toEqual([])
        expect(placeOf(tickets.get(4)!)).toBe('frontier')
        expect(
          blockerDrift(tickets.get(4)!).filter(({ code }) => code === 'blocker-outside-map'),
        ).toEqual(
          [
            '#7',
            '../../other/issues/01-elsewhere.md',
            'https://example.com/issues/02-book-the-hall.md',
            '../02-book-the-hall.md',
            '../../other/issues/01-elsewhere.md',
            '/02-book-the-hall.md',
            '../../../../../02-book-the-hall.md',
          ].map((target) => ({
            code: 'blocker-outside-map',
            detail: `${target} is not an issue file of this effort`,
          })),
        )
        // `./` stays in the ticket's directory: the link resolves to its own effort's file.
        expect(numbers(tickets.get(5))).toEqual([2, 1])
        expect(placeOf(tickets.get(5)!)).toBe('blocked')
      }),
  )

  it.effect(
    "adds a Blocks line's ticket to the blocked ticket's blockers, after its own items, and a one-sided edge gates",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* read(
          {
            '/repo/.scratch/seeds/map.md': mapBody(),
            '/repo/.scratch/seeds/issues/01-pick-a-date.md': issue(
              'Pick a date',
              'Blocks: 03 (the members need the date)',
            ),
            '/repo/.scratch/seeds/issues/02-book-the-hall.md': issue(
              'Book the hall',
              'Blocks: [Tell the members](03-tell-the-members.md), 09, the caterer',
            ),
            '/repo/.scratch/seeds/issues/03-tell-the-members.md': issue(
              'Tell the members',
              'Blocked by: 04',
            ),
            '/repo/.scratch/seeds/issues/04-print-flyers.md': issue('Print flyers', 'Blocks: 03'),
            '/repo/.scratch/seeds/issues/05-thank-the-hosts.md': issue(
              'Thank the hosts',
              'Blocks: [Out](../../other/issues/05-x.md)',
            ),
            '/repo/.scratch/seeds/issues/06-sweep-up.md': closedIssue('Sweep up', 'Blocks: 05'),
          },
          '/repo',
        )
        const map = snapshot.maps[0]!
        const tickets = ticketsOf(snapshot)
        // Its own `Blocked by:` first, then the Blocks lines that name it, in number order, once each.
        expect(numbers(tickets.get(3))).toEqual([4, 1, 2])
        expect(placeOf(tickets.get(3)!)).toBe('blocked')
        // The edge is never written on 01's side of the pair, nor on 05's: they gate all the same.
        expect(numbers(tickets.get(1))).toEqual([])
        expect(numbers(tickets.get(5))).toEqual([6])
        expect(tickets.get(5)!.blockedBy[0]!.state).toBe('closed')
        expect(frontierOf(map).map((ticket) => ticket.number)).toEqual([1, 2, 4, 5])
        // Each Blocks line is noted once, raw; an item naming no issue file is dropped silently.
        expect(blockerDrift(tickets.get(1)!)).toEqual([
          { code: 'blocks-line', detail: '03 (the members need the date)' },
        ])
        expect(blockerDrift(tickets.get(2)!)).toEqual([
          {
            code: 'blocks-line',
            detail: '[Tell the members](03-tell-the-members.md), 09, the caterer',
          },
        ])
        expect(blockerDrift(tickets.get(5)!)).toEqual([
          { code: 'blocks-line', detail: '[Out](../../other/issues/05-x.md)' },
        ])
        expect(blockerDrift(tickets.get(3)!)).toEqual([])
        expect(driftEntryOf({ code: 'blocks-line' }).level).toBe('quiet')
        // What a Blocks line names is what its ticket clears the way for.
        expect(neighbourhoodOf(tickets.get(2)!, map).clearsWayFor.map((t) => t.number)).toEqual([3])
        expect(neighbourhoodOf(tickets.get(6)!, map).clearsWayFor.map((t) => t.number)).toEqual([5])
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
