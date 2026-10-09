import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { FileSystem, readLocalTracker } from '@hero-synergy/core'

import {
  claimTicket,
  createDemoWorkspace,
  DEMO_MAP,
  DEMO_TICKETS,
  mapFile,
  registryEntries,
  SCENE,
  sessionName,
  ticketById,
  ticketFile,
} from './demo.mts'

const scratches: string[] = []
afterEach(() => {
  for (const scratch of scratches.splice(0)) rmSync(scratch, { recursive: true, force: true })
})
const scratch = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hs-demo-'))
  scratches.push(dir)
  return dir
}

describe('the demo map', () => {
  it('writes a ticket in the local tracker form', () => {
    expect(ticketFile(ticketById(11))).toBe(
      '# No results page\n\nType: prototype\nBlocked by: 09, 10\n\n## Question\n\nWhat does the page say and offer when nothing matches?\n',
    )
    expect(ticketFile(ticketById(1))).toContain('Status: resolved\n')
    expect(ticketFile(ticketById(1))).toMatch(/## Answer\n\nPagefind: .*\.\n$/)
  })

  it('lists each resolved ticket once in Decisions so far, linked to its file', () => {
    const decisions = mapFile().split('## Decisions so far\n\n')[1]!.split('\n\n')[0]!.split('\n')
    expect(decisions).toEqual([
      '- [Index engine](issues/01-index-engine.md) — Pagefind: a static index split into chunks, no server to run',
      '- [When the index is built](issues/02-index-build.md) — On every deploy, in the same CI job as the site',
      '- [What a result shows](issues/03-result-shape.md) — Page title, section heading, then a two-line snippet with the match marked',
      '- [Search scope](issues/04-search-scope.md) — The version being read; each older version keeps its own index',
    ])
    expect(mapFile()).toContain(`## Destination\n\n${DEMO_MAP.destination}\n`)
  })

  it('has the shape the shots need: decisions, a frontier, two blocked tickets, fog', () => {
    const resolved = (number: number) => ticketById(number).status === 'resolved'
    const open = DEMO_TICKETS.filter((ticket) => ticket.status !== 'resolved')
    const unblocked = open.filter((ticket) => (ticket.blockedBy ?? []).every(resolved))
    const blocked = open.filter((ticket) => !(ticket.blockedBy ?? []).every(resolved))
    expect(DEMO_TICKETS.filter((ticket) => resolved(ticket.number))).toHaveLength(4)
    expect(blocked.map((ticket) => ticket.number)).toEqual([10, 11])
    expect(new Set(unblocked.map((ticket) => ticket.type)).size).toBeGreaterThanOrEqual(3)
    expect(DEMO_MAP.fog.length).toBeGreaterThan(0)
    // The sessions sit on unblocked tickets; ▶ and the ended session on unclaimed ones.
    for (const number of [
      SCENE.working,
      SCENE.approval,
      SCENE.waiting,
      SCENE.launched,
      SCENE.ended,
    ]) {
      expect(unblocked.map((ticket) => ticket.number)).toContain(number)
    }
    expect(ticketById(SCENE.launched).status).toBeUndefined()
    expect(ticketById(SCENE.ended).status).toBeUndefined()
    // The neighbourhood shot needs both columns.
    expect(ticketById(SCENE.neighbourhood).blockedBy?.length).toBeGreaterThan(0)
    expect(DEMO_TICKETS.some((ticket) => ticket.blockedBy?.includes(SCENE.neighbourhood))).toBe(
      true,
    )
  })

  it('names a session like the Cockpit: #<number> <title>', () => {
    expect(sessionName(8)).toBe('#8 Typo tolerance')
    expect(() => ticketById(99)).toThrow('No demo ticket #99')
  })
})

describe('the demo workspace', () => {
  it('reads back through the local tracker as one map with every ticket', async () => {
    const workspace = createDemoWorkspace(scratch())
    const snapshot = await Effect.runPromise(
      readLocalTracker(workspace).pipe(Effect.provide(FileSystem.live)),
    )
    expect(snapshot.maps.map((map) => map.title)).toEqual([DEMO_MAP.title])
    expect(snapshot.maps[0]!.tickets).toHaveLength(DEMO_TICKETS.length)
    // Read as written: no drift for the Detail to show.
    expect(snapshot.warnings).toEqual([])
  })

  it('claims a ticket by rewriting its file with Status: claimed', () => {
    const workspace = createDemoWorkspace(scratch())
    claimTicket(workspace, SCENE.launched)
    const file = path.join(workspace, '.scratch/docs-search/issues/08-typo-tolerance.md')
    expect(readFileSync(file, 'utf8')).toBe(ticketFile({ ...ticketById(8), status: 'claimed' }))
  })
})

describe('the registry', () => {
  it('lists each session named for its ticket, in the registry words for its status', () => {
    const entries = registryEntries(
      '/repo',
      [
        { ticket: 5, status: 'working' },
        { ticket: 6, status: 'needs approval' },
        { ticket: 8, status: 'waiting for you', sessionId: 'stub-session' },
      ],
      1_000_000,
    )
    expect(entries).toEqual([
      {
        pid: 4205,
        cwd: '/repo',
        kind: 'interactive',
        startedAt: 700_000,
        sessionId: 'demo-5',
        name: '#5 Ranking signals',
        status: 'busy',
      },
      {
        pid: 4206,
        cwd: '/repo',
        kind: 'interactive',
        startedAt: 640_000,
        sessionId: 'demo-6',
        name: '#6 Keyboard shortcut',
        status: 'waiting',
        waitingFor: 'permission prompt',
      },
      {
        pid: 4208,
        cwd: '/repo',
        kind: 'interactive',
        startedAt: 520_000,
        sessionId: 'stub-session',
        name: '#8 Typo tolerance',
        status: 'idle',
      },
    ])
  })
})
