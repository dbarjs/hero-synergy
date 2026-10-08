import { FileSystem, readLocalTracker, type Snapshot } from '@hero-synergy/core'
import { Effect } from 'effect'
import { describe, expect, it } from 'vite-plus/test'

import { workspaceFiles } from '../test/fixtures/workspace-files.ts'
import type { MapNode, ViewModel } from './protocol.ts'
import {
  buildViewModel,
  defaultExpanded,
  detailOf,
  firstFocusKey,
  revealKeys,
} from './view-model.ts'

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
      {
        key: 'map:3:ticket:5',
        number: 5,
        title: 'Icon set',
        gist: 'Codicons: they ship with VS Code',
      },
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

describe('the Detail of the fixture workspace', () => {
  it('shows a ticket in full: header facts, body and the neighbours both ways', async () => {
    const snapshot = await fixtureSnapshot()
    const detail = detailOf(snapshot, 'map:3:ticket:1')
    expect(detail).toMatchObject({
      kind: 'ticket',
      number: 1,
      title: 'Palette',
      state: 'open',
      place: 'frontier',
      type: 'prototype',
      mode: 'HITL',
      claim: null,
      url: null,
      resolution: null,
      waitsOn: [],
    })
    expect(detail?.kind === 'ticket' && detail.body).toContain('Which five colors')
    // Dark mode waits on the palette, so the palette clears the way for it.
    expect(detail?.kind === 'ticket' && detail.clearsWayFor).toEqual([
      { number: 2, title: 'Dark mode', state: 'open', key: 'map:3:ticket:2' },
    ])
    const blocked = detailOf(snapshot, 'map:3:ticket:2')
    expect(blocked?.kind === 'ticket' && blocked.waitsOn).toEqual([
      { number: 1, title: 'Palette', state: 'open', key: 'map:3:ticket:1' },
    ])
  })

  it('shows a closed ticket with its resolution', async () => {
    const snapshot = await fixtureSnapshot()
    const detail = detailOf(snapshot, 'map:3:ticket:5')
    expect(detail).toMatchObject({ kind: 'ticket', number: 5, state: 'closed', place: 'closed' })
    expect(detail?.kind === 'ticket' && detail.resolution?.body).toContain('Codicons')
  })

  it('keeps a closed blocker as a neighbour, since the Detail shows every blocker', async () => {
    const snapshot = await fixtureSnapshot()
    const detail = detailOf(snapshot, 'map:2:ticket:3')
    expect(detail?.kind === 'ticket' && detail.waitsOn.map((n) => [n.number, n.state])).toEqual([
      [1, 'closed'],
      [2, 'open'],
    ])
  })

  it('shows a map with its destination, decisions, fog and what is out of scope', async () => {
    const snapshot = await fixtureSnapshot()
    expect(detailOf(snapshot, 'map:3:map')).toEqual({
      kind: 'map',
      key: 'map:3:map',
      number: 3,
      title: 'Cockpit colors',
      url: null,
      takeable: 2,
      decided: 1,
      total: 5,
      destination: "A palette for the Cockpit's tree and detail, decided and recorded as tokens.",
      decisions: [
        {
          key: 'map:3:ticket:5',
          number: 5,
          title: 'Icon set',
          gist: 'Codicons: they ship with VS Code',
        },
      ],
      fog: [{ text: 'Spacing, once the palette is fixed.' }],
      outOfScope: [{ text: 'Custom user themes, which belong to a later release.' }],
      freeForm: null,
      drift: [],
      actions: [],
    })
  })

  it('shows nothing for no selection or a key that names nothing', async () => {
    const snapshot = await fixtureSnapshot()
    expect(detailOf(snapshot, null)).toBeNull()
    expect(detailOf(snapshot, 'map:3:ticket:99')).toBeNull()
  })

  it('names the nodes a row needs open: its map, the Finished fold, the Decisions fold', async () => {
    const snapshot = await fixtureSnapshot()
    expect(revealKeys(snapshot, 'map:3:ticket:2')).toEqual(['map:3'])
    expect(revealKeys(snapshot, 'map:3:map')).toEqual(['map:3'])
    expect(revealKeys(snapshot, 'map:3:ticket:5')).toEqual(['map:3', 'map:3:decisions'])
    expect(revealKeys(snapshot, 'map:1:ticket:1')).toEqual(['map:1', 'finished', 'map:1:decisions'])
    expect(revealKeys(snapshot, 'map:3:ticket:99')).toEqual([])
  })

  it('opens on the first map in display order when nothing is selected', async () => {
    const snapshot = await fixtureSnapshot()
    expect(firstFocusKey(snapshot)).toBe('map:3:map')
    expect(firstFocusKey({ ...snapshot, maps: [] })).toBeNull()
  })
})
