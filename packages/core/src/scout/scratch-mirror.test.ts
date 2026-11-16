import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { mirrorRepo, mirrorTruth, type FileTruth } from '../../fixtures/scratch-mirror/seed.ts'
import {
  assignee,
  headerLines,
  statusClaims,
  triageRole,
} from '../../fixtures/scratch-mirror/tools/truth.ts'
import { isAfkTicket } from '../claude/bypass.ts'
import { FileSystem } from '../file-system.ts'
import { modeOf } from '../snapshot/derive.ts'
import type { Ticket } from '../snapshot/model.ts'
import { collectLocal, readLocalEfforts, readLocalTracker } from './local.ts'
import { scoutColumns, truthColumns } from './readings.ts'
import { DEFAULT_TRIAGE_LABELS } from './triage-labels.ts'

const ROOT = '/home/ana/mirror'
const repo = mirrorRepo(ROOT)
const truth = mirrorTruth()
const markdown = Object.keys(repo)
  .filter((path) => path.startsWith(`${ROOT}/.scratch/`) && path.endsWith('.md'))
  .map((path) => path.slice(ROOT.length + 1))
  .sort()
const tickets = truth.filter(
  (file): file is Extract<FileTruth, { kind: 'ticket' }> => file.kind === 'ticket',
)
const maps = truth.filter(
  (file): file is Extract<FileTruth, { kind: 'map' }> => file.kind === 'map',
)
const effortOf = (path: string) => path.split('/')[1]!
const numberOf = (path: string) => Number(/\/issues\/(\d+)-[^/]*$/.exec(path)?.[1])
const body = (path: string) => repo[`${ROOT}/${path}`]!

describe('the scratch mirror', () => {
  it.effect('loads as a local tracker of 49 efforts', () =>
    Effect.gen(function* () {
      const files = FileSystem.inMemory(repo)
      const snapshot = yield* readLocalTracker(ROOT).pipe(Effect.provide(files), Effect.orDie)
      expect(snapshot.tracker).toEqual({ kind: 'local' })
      const efforts = yield* collectLocal(ROOT).pipe(Effect.provide(files), Effect.orDie)
      expect(efforts.map((effort) => effort.slug)).toEqual(
        Array.from({ length: 49 }, (_, index) => `effort-${String(index + 1).padStart(2, '0')}`),
      )
    }),
  )

  it('holds the 342 Markdown files the survey read', () => {
    expect(markdown).toHaveLength(342)
    expect(Object.keys(repo).every((path) => path.endsWith('.md'))).toBe(true)
  })

  it('names every Markdown file in the truth, once, in path order, and nothing else', () => {
    expect(truth.map((file) => file.path)).toEqual(markdown)
    expect([tickets.length, maps.length, truth.length - tickets.length - maps.length]).toEqual([
      257, 35, 50,
    ])
  })

  it('reads every map from a MAP.md, and every ticket from a numbered file under issues/', () => {
    expect(maps.every((map) => /^\.scratch\/effort-\d{2}\/MAP\.md$/.test(map.path))).toBe(true)
    expect(markdown.filter((path) => path.endsWith('/MAP.md'))).toEqual(maps.map((map) => map.path))
    expect(tickets.every((ticket) => Number.isInteger(numberOf(ticket.path)))).toBe(true)
  })

  it('has no "in progress": tickets are open, claimed or closed, maps open or closed', () => {
    const states = (list: ReadonlyArray<{ reading: { state: string | null } }>) =>
      [...new Set(list.map((file) => file.reading.state))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      )
    expect(states(tickets)).toEqual(['claimed', 'closed', 'open'])
    expect(states(maps)).toEqual(['closed', 'open'])
    expect(tickets.filter((ticket) => ticket.reading.state === 'closed')).toHaveLength(219)
    expect(maps.filter((map) => map.reading.state === 'closed')).toHaveLength(15)
  })

  it('points each ticket at its own effort: its map, its parent and its blockers', () => {
    const paths = new Set(truth.map((file) => file.path))
    for (const ticket of tickets) {
      const { map, parent } = ticket.reading
      for (const target of [map, parent]) {
        if (target === null) continue
        expect(paths.has(target), ticket.path).toBe(true)
        expect(effortOf(target)).toBe(effortOf(ticket.path))
      }
    }
    for (const map of maps) {
      const numbers = new Set(
        tickets
          .filter((ticket) => ticket.reading.map === map.path)
          .map((ticket) => numberOf(ticket.path)),
      )
      for (const decision of map.reading.decisions)
        expect(numbers.has(decision), map.path).toBe(true)
    }
  })

  it('gives a resolution to closed tickets only, its first line taken from the mirror file', () => {
    for (const ticket of tickets) {
      const { resolution, state } = ticket.reading
      if (resolution === null) continue
      expect(state, ticket.path).toBe('closed')
      const lines = body(ticket.path).split('\n')
      expect(
        lines.some((line) => line.trim().endsWith(resolution.firstLine)),
        ticket.path,
      ).toBe(true)
    }
    const closedWithout = tickets.filter(
      (ticket) => ticket.reading.state === 'closed' && ticket.reading.resolution === null,
    )
    expect(closedWithout).toHaveLength(2)
  })

  it('reads every ticket as ticket 135 does, from its own Status, Assignee and Labels lines', () => {
    // The Status line vocabulary ticket 135 decided; any other first word reads open.
    const closing = ['closed', 'done', 'resolved', 'wontfix']
    const opening = [
      'open',
      'claimed',
      'needs-triage',
      'needs-info',
      'ready-for-agent',
      'ready-for-human',
    ]
    const known = [...closing, ...opening]
    const unknown: string[] = []
    const closedButNamed: string[] = []
    for (const ticket of tickets) {
      const header = headerLines(body(ticket.path))
      const status = (header.get('status') ?? '').replaceAll('*', '').trim()
      const first = /^([a-z-]+)/i.exec(status)?.[1]?.toLowerCase() ?? ''
      if (header.has('status') && !known.includes(first)) unknown.push(ticket.path)
      const closed = closing.includes(first)
      const named = assignee(header.get('assignee'))
      if (closed && named !== null) closedButNamed.push(ticket.path)
      const state = closed ? 'closed' : named !== null || statusClaims(header) ? 'claimed' : 'open'
      expect({ state, role: triageRole(header), assignee: named }, ticket.path).toEqual({
        state: ticket.reading.state,
        role: ticket.reading.role,
        assignee: ticket.reading.assignee,
      })
    }
    // The line with a DONE half and an OPEN half: open, and claimed through its Assignee line.
    expect(unknown).toEqual(['.scratch/effort-03/issues/06-ticket.md'])
    // A closed ticket keeps its Assignee as history and is never claimed.
    expect(closedButNamed).toHaveLength(185)
  })

  it('carries the disagreements ticket 134 listed, on 11 files', () => {
    const disagreeing = truth.filter((file) => 'disagreements' in file)
    expect(disagreeing).toHaveLength(11)
    for (const file of disagreeing) expect(file.kind).not.toBe('note')
  })
})

describe('the local reader on the scratch mirror', () => {
  const files = FileSystem.inMemory(repo)
  const efforts = Effect.runSync(readLocalEfforts(ROOT).pipe(Effect.provide(files)))

  it.each(truth)('agrees with the truth of $path', (file) => {
    expect(scoutColumns(efforts, file.path)).toEqual(truthColumns(file, truth))
  })

  it.effect('shows the 20 open maps in directory order and hides the 15 closed ones', () =>
    Effect.gen(function* () {
      const snapshot = yield* readLocalTracker(ROOT).pipe(Effect.provide(files), Effect.orDie)
      const open = maps.filter((map) => map.reading.state === 'open').map((map) => map.path)
      expect(open).toHaveLength(20)
      expect(snapshot.maps.map((map) => (map.ref.tracker === 'local' ? map.ref.path : ''))).toEqual(
        open,
      )
      expect(snapshot.maps.map((map) => map.number)).toEqual(
        open.map((path) => Number(/effort-(\d+)/.exec(path)![1])),
      )
      const hidden = new Set(
        maps.filter((map) => map.reading.state === 'closed').map((map) => effortOf(map.path)),
      )
      expect(hidden.size).toBe(15)
      for (const map of snapshot.maps) {
        for (const ticket of map.tickets) {
          expect(hidden.has(effortOf(ticket.ref.tracker === 'local' ? ticket.ref.path : ''))).toBe(
            false,
          )
        }
      }
    }),
  )

  it.effect(
    "groups the 17 open unmapped issues in 7 efforts, effort-29 under its map's title, and hides the 22 closed ones",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* readLocalTracker(ROOT).pipe(Effect.provide(files), Effect.orDie)
        // What the truth implies: a ticket exactly when it has a map and no PRD parent (#139).
        const unmapped = tickets.filter(
          (ticket) => ticket.reading.map === null || ticket.reading.parent !== null,
        )
        const open = unmapped.filter((ticket) => ticket.reading.state !== 'closed')
        expect([open.length, unmapped.length - open.length]).toEqual([17, 22])
        const pathOf = (ticket: Ticket) => (ticket.ref.tracker === 'local' ? ticket.ref.path : '')

        const groups = snapshot.unmapped.map((group) => ({
          effort: group.effort,
          title: group.title,
          tickets: group.tickets.map(pathOf),
        }))
        const expected = [...new Set(open.map((ticket) => effortOf(ticket.path)))].map(
          (effort) => ({
            effort,
            title:
              efforts.find((candidate) => candidate.directory === effort)?.map?.title ?? effort,
            tickets: open
              .filter((ticket) => effortOf(ticket.path) === effort)
              .map((ticket) => ticket.path)
              .sort((a, b) => numberOf(a) - numberOf(b)),
          }),
        )
        expect(groups).toEqual(expected)
        expect(groups).toHaveLength(7)

        // Effort-29 is the one group with a map: it holds 9, and six mapless efforts the other 8.
        const withMap = groups.filter((group) =>
          maps.some((map) => effortOf(map.path) === group.effort),
        )
        expect(withMap.map((group) => [group.effort, group.tickets.length])).toEqual([
          ['effort-29', 9],
        ])
        expect(withMap[0]!.title).toBe(
          efforts.find((effort) => effort.directory === 'effort-29')!.map!.title,
        )
        expect(withMap[0]!.title).not.toBe('effort-29')
        expect(
          groups
            .filter((group) => group.effort !== 'effort-29')
            .reduce((sum, group) => sum + group.tickets.length, 0),
        ).toBe(8)
        for (const group of groups.filter((candidate) => candidate.effort !== 'effort-29'))
          expect(group.title).toBe(group.effort)

        // The closed unmapped issues are read, and only the snapshot hides them.
        const shown = new Set(groups.flatMap((group) => group.tickets))
        for (const ticket of unmapped.filter((candidate) => candidate.reading.state === 'closed')) {
          expect(shown.has(ticket.path), ticket.path).toBe(false)
          const effort = efforts.find((candidate) => candidate.directory === effortOf(ticket.path))!
          expect(effort.unmapped.map(pathOf), ticket.path).toContain(ticket.path)
        }
        // An unmapped issue never raises no-map, type-missing or no-question-heading.
        const codes = efforts
          .flatMap((effort) => effort.unmapped)
          .flatMap((ticket) => ticket.warnings.map((warning) => warning.code))
        expect(codes.filter((code) => code === 'no-map')).toEqual([])
        expect(codes.filter((code) => code === 'type-missing')).toEqual([])
        expect(codes.filter((code) => code === 'no-question-heading')).toEqual([])
      }),
  )

  it.effect('never runs the 15 HITL-noted open tickets of the open maps AFK', () =>
    Effect.gen(function* () {
      const snapshot = yield* readLocalTracker(ROOT).pipe(Effect.provide(files), Effect.orDie)
      const noted = snapshot.maps
        .flatMap((map) => map.tickets)
        .filter((ticket) => ticket.state === 'open' && ticket.modeNote === 'HITL')
      expect(noted).toHaveLength(15)
      for (const ticket of noted) {
        expect(modeOf(ticket), ticket.title).toBe('HITL')
        expect(isAfkTicket(ticket, DEFAULT_TRIAGE_LABELS), ticket.title).toBe(false)
      }
    }),
  )

  it('raises no mode-conflicts-type and no type-several on any file', () => {
    const codes = efforts
      .flatMap((effort) => [...(effort.map?.tickets ?? []), ...effort.unmapped])
      .flatMap((ticket) => ticket.warnings.map((warning) => warning.code))
    expect(codes.filter((code) => code === 'mode-conflicts-type')).toEqual([])
    expect(codes.filter((code) => code === 'type-several')).toEqual([])
  })
})
