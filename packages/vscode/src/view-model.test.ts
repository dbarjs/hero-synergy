import { FileSystem, readLocalTracker, type Snapshot } from '@hero-synergy/core'
import { Effect } from 'effect'
import { describe, expect, it } from 'vite-plus/test'

import { workspaceFiles } from '../test/fixtures/workspace-files.ts'
import type { MapNode, ViewModel } from './protocol.ts'
import { buildViewModel, defaultExpanded } from './view-model.ts'

const ROOT = '/home/ana/billing'

const fixtureSnapshot = (): Promise<Snapshot> =>
  Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )

const mapsOf = (
  viewModel: ViewModel,
): { maps: ReadonlyArray<MapNode>; finished: ReadonlyArray<MapNode> } => {
  if (viewModel.kind !== 'maps') throw new Error(`expected maps, got ${viewModel.kind}`)
  return { maps: viewModel.maps, finished: viewModel.finished?.maps ?? [] }
}

describe('the Tree view model of the fixture workspace', () => {
  it('orders the maps by urgency and folds the finished one', async () => {
    const snapshot = await fixtureSnapshot()
    const { maps, finished } = mapsOf(buildViewModel(snapshot, new Set()))
    // Directory order is archive-search, billing-rewrite, cockpit-colors.
    expect(maps.map((map) => `#${map.number} ${map.title}`)).toEqual([
      '#3 Cockpit colors',
      '#2 Billing rewrite',
    ])
    expect(finished.map((map) => `#${map.number} ${map.title}`)).toEqual(['#1 Archive search'])
  })

  it('counts what is takeable and what is decided', async () => {
    const snapshot = await fixtureSnapshot()
    const { maps, finished } = mapsOf(buildViewModel(snapshot, new Set()))
    expect(maps.map(({ takeable, decided, total }) => ({ takeable, decided, total }))).toEqual([
      { takeable: 2, decided: 1, total: 5 },
      { takeable: 0, decided: 1, total: 3 },
    ])
    expect(finished[0]).toMatchObject({ takeable: 0, decided: 2, total: 2 })
  })

  it('lists the open tickets claimed, then the frontier with next, then blocked with what they wait on', async () => {
    const snapshot = await fixtureSnapshot()
    const { maps } = mapsOf(buildViewModel(snapshot, new Set()))
    expect(
      maps[0]?.tickets.map(({ number, place, next, waitsOn }) => ({
        number,
        place,
        next,
        waitsOn: waitsOn.map((blocker) => blocker.number),
      })),
    ).toEqual([
      { number: 4, place: 'claimed', next: false, waitsOn: [] },
      { number: 1, place: 'frontier', next: true, waitsOn: [] },
      { number: 3, place: 'frontier', next: false, waitsOn: [] },
      { number: 2, place: 'blocked', next: false, waitsOn: [1] },
    ])
    // A claimed ticket is claimed whatever blocks it; the closed blocker no longer gates.
    expect(
      maps[1]?.tickets.map(({ number, place, waitsOn }) => ({
        number,
        place,
        waitsOn: waitsOn.map((b) => b.number),
      })),
    ).toEqual([
      { number: 2, place: 'claimed', waitsOn: [] },
      { number: 3, place: 'blocked', waitsOn: [2] },
    ])
  })

  it('marks each ticket with its type and HITL, AFK or task', async () => {
    const snapshot = await fixtureSnapshot()
    const { maps } = mapsOf(buildViewModel(snapshot, new Set()))
    expect(maps[0]?.tickets.map(({ number, type, mode }) => [number, type, mode])).toEqual([
      [4, 'grilling', 'HITL'],
      [1, 'prototype', 'HITL'],
      [3, 'task', 'task'],
      [2, 'research', 'AFK'],
    ])
  })

  it('carries the Fog and the Decisions with their gists', async () => {
    const snapshot = await fixtureSnapshot()
    const { maps } = mapsOf(buildViewModel(snapshot, new Set()))
    expect(maps[0]?.fog.entries).toEqual([{ text: 'Spacing, once the palette is fixed.' }])
    expect(maps[0]?.decisions.entries).toEqual([
      { number: 5, title: 'Icon set', gist: 'Codicons: they ship with VS Code' },
    ])
  })

  it('opens the first map when nothing was stored, and only what is stored after', async () => {
    const snapshot = await fixtureSnapshot()
    expect([...defaultExpanded(snapshot)]).toEqual(['map:3'])

    const stored = mapsOf(buildViewModel(snapshot, new Set(['map:2', 'map:2:fog', 'finished'])))
    expect(stored.maps.map((map) => map.expanded)).toEqual([false, true])
    expect(stored.maps[1]?.fog.expanded).toBe(true)
    expect(stored.maps[1]?.decisions.expanded).toBe(false)
    const model = buildViewModel(snapshot, new Set(['finished']))
    expect(model.kind === 'maps' && model.finished?.expanded).toBe(true)
  })

  it('has no finished fold when no map is finished', async () => {
    const snapshot = await fixtureSnapshot()
    const open = { ...snapshot, maps: snapshot.maps.filter((map) => map.number !== 1) }
    const model = buildViewModel(open, new Set())
    expect(model.kind === 'maps' && model.finished).toBe(null)
  })
})
