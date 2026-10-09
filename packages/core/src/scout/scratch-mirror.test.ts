import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { mirrorRepo, mirrorTruth, type FileTruth } from '../../fixtures/scratch-mirror/seed.ts'
import { FileSystem } from '../file-system.ts'
import { collectLocal, readLocalTracker } from './local.ts'

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

  it('carries the disagreements ticket 134 listed, on 11 files', () => {
    const disagreeing = truth.filter((file) => 'disagreements' in file)
    expect(disagreeing).toHaveLength(11)
    for (const file of disagreeing) expect(file.kind).not.toBe('note')
  })
})
