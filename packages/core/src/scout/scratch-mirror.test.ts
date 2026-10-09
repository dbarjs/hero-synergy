import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { mirrorRepo, mirrorTruth, type TicketTruth } from '../../fixtures/scratch-mirror/seed.ts'
import { FileSystem } from '../file-system.ts'
import { collectLocal, readLocalTracker } from './local.ts'

const ROOT = '/home/ana/mirror'
const repo = mirrorRepo(ROOT)
const truth = mirrorTruth()
const markdown = Object.keys(repo)
  .filter((path) => path.startsWith(`${ROOT}/.scratch/`) && path.endsWith('.md'))
  .map((path) => path.slice(ROOT.length + 1))
  .sort()
const tickets = truth.filter((file): file is TicketTruth => file.kind === 'ticket')
const maps = truth.filter((file) => file.kind === 'map')
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

  it('names every Markdown file in the truth, once, and nothing else', () => {
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

  it('gives every ticket and map a state from the careful reading', () => {
    for (const ticket of tickets) {
      expect(['open', 'closed', 'claimed', 'in-progress']).toContain(ticket.state)
    }
    for (const map of maps) expect(['open', 'in-progress', 'closed']).toContain(map.state)
    expect(tickets.filter((ticket) => ticket.state === 'closed')).toHaveLength(227)
  })

  it('points each ticket at its own effort: its map and its blockers', () => {
    const mapPaths = new Set(maps.map((map) => map.path))
    const numbers = new Map<string, Set<number>>()
    for (const ticket of tickets) {
      const effort = effortOf(ticket.path)
      numbers.set(effort, (numbers.get(effort) ?? new Set()).add(numberOf(ticket.path)))
    }
    for (const ticket of tickets) {
      if (ticket.map !== null) {
        expect(mapPaths.has(ticket.map)).toBe(true)
        expect(effortOf(ticket.map)).toBe(effortOf(ticket.path))
      }
      for (const blocker of ticket.blockedBy) {
        expect(numbers.get(effortOf(ticket.path))!.has(blocker)).toBe(true)
        expect(blocker).not.toBe(numberOf(ticket.path))
      }
    }
  })

  it("finds each ticket's resolution lead, under its section, in the mirror file", () => {
    for (const ticket of tickets) {
      if (ticket.resolution === null) continue
      const lines = body(ticket.path).split('\n')
      const at = lines.lastIndexOf(ticket.resolution.lead)
      expect(at, ticket.path).toBeGreaterThan(-1)
      if (ticket.resolution.section !== null) {
        const sections = lines.slice(0, at).filter((line) => /^##\s/.test(line))
        expect(sections.at(-1), ticket.path).toBe(ticket.resolution.section)
      }
    }
    const closedWithout = tickets.filter(
      (ticket) => ticket.state === 'closed' && ticket.resolution === null,
    )
    expect(closedWithout.every((ticket) => !ticket.settled)).toBe(true)
  })

  it('leaves unsettled the 24 files ticket 134 decides', () => {
    expect(truth.filter((file) => file.kind !== 'note' && !file.settled)).toHaveLength(24)
  })
})
