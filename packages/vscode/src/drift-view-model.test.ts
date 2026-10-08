import type { Snapshot } from '@hero-synergy/core'
import { describe, expect, it } from 'vite-plus/test'

import {
  cleanSnapshot,
  driftingSnapshot,
  freeFormSnapshot,
} from '../test/fixtures/drifting-snapshot.ts'
import type { MapNode, ViewModel } from './protocol.ts'
import { buildViewModel, detailOf, revealKeys } from './view-model.ts'

const mapsOf = (
  viewModel: ViewModel,
): { maps: ReadonlyArray<MapNode>; finished: ReadonlyArray<MapNode> } => {
  if (viewModel.kind !== 'maps') throw new Error(`expected maps, got ${viewModel.kind}`)
  return { maps: viewModel.maps, finished: viewModel.finished?.maps ?? [] }
}

describe('drift in the Tree view model', () => {
  it('marks a loud ticket and not a quiet one', async () => {
    const { maps } = mapsOf(buildViewModel(await driftingSnapshot(), new Set()))
    const tickets = maps.find((map) => map.number === 3)?.tickets ?? []
    expect(tickets.find((t) => t.number === 1)?.loud).toEqual(['The ticket has no type.'])
    // #2 has only a quiet warning: its row stays unmarked.
    expect(tickets.find((t) => t.number === 2)?.loud).toEqual([])
  })

  it('marks a map whose tickets are loud, open or closed, with counts, and not one that is quiet or clean', async () => {
    const { maps, finished } = mapsOf(buildViewModel(await driftingSnapshot(), new Set()))
    expect(maps.find((map) => map.number === 3)?.loud).toBe('1 loud warning on 1 ticket')
    expect(maps.find((map) => map.number === 2)?.loud).toBeNull()
    expect(finished.map((map) => map.loud)).toEqual(['1 loud warning on 1 ticket'])
  })

  it('never changes the order of the maps or of their tickets', async () => {
    const plain = mapsOf(buildViewModel(await cleanSnapshot(), new Set()))
    const drifted = mapsOf(buildViewModel(await driftingSnapshot(), new Set()))
    expect(drifted.maps.map((map) => map.number)).toEqual(plain.maps.map((map) => map.number))
    expect(drifted.maps[0]?.tickets.map((t) => t.number)).toEqual(
      plain.maps[0]?.tickets.map((t) => t.number),
    )
  })

  it('summarises a ticket for the Focus pane: a line per loud warning, a count of the quiet ones', async () => {
    const snapshot = await driftingSnapshot()
    const view = buildViewModel(snapshot, new Set(), 'map:3:ticket:1')
    expect(view.kind === 'maps' && view.selection).toMatchObject({
      kind: 'ticket',
      drift: { loud: ['The ticket has no type.'], quiet: 1, tickets: 0 },
    })
    // A ticket without drift shows nothing.
    const clean = buildViewModel(snapshot, new Set(), 'map:3:ticket:4')
    expect(clean.kind === 'maps' && clean.selection).toMatchObject({ drift: null })
  })

  it('adds how many tickets drift to the map pane', async () => {
    const view = buildViewModel(await driftingSnapshot(), new Set(), 'map:3:map')
    expect(view.kind === 'maps' && view.selection).toMatchObject({
      kind: 'map',
      drift: { loud: [], quiet: 1, tickets: 2 },
    })
  })

  it('folds the tickets of no map into an Unmapped node, only when there are some', async () => {
    const view = buildViewModel(await driftingSnapshot(), new Set(['unmapped']))
    expect(view.kind === 'maps' && view.unmapped).toMatchObject({
      key: 'unmapped',
      expanded: true,
      entries: [{ key: 'unmapped:ticket:3', number: 3, loud: ['The ticket belongs to no map.'] }],
    })
    const none = buildViewModel(await cleanSnapshot(), new Set())
    expect(none.kind === 'maps' && none.unmapped).toBeNull()
  })

  it('selects an unmapped ticket and opens its Detail with its drift', async () => {
    const snapshot = await driftingSnapshot()
    expect(revealKeys(snapshot, 'unmapped:ticket:3')).toEqual(['unmapped'])
    expect(detailOf(snapshot, 'unmapped:ticket:3')).toMatchObject({
      kind: 'ticket',
      number: 3,
      actions: [],
      drift: [{ entries: [{ code: 'no-map', level: 'loud' }] }],
    })
  })

  it('ends a ticket Detail with its drift, each entry with message, detail and hint', async () => {
    const detail = detailOf(await driftingSnapshot(), 'map:3:ticket:1')
    expect(detail?.kind === 'ticket' && detail.drift).toEqual([
      {
        key: null,
        number: null,
        title: null,
        entries: [
          expect.objectContaining({ code: 'type-missing', level: 'loud', detail: null }),
          expect.objectContaining({
            code: 'type-as-line',
            level: 'quiet',
            detail: 'Type: prototype',
            message: expect.stringContaining('Type: prototype'),
            hint: expect.stringContaining('label'),
          }),
        ],
      },
    ])
  })

  it('groups a map Detail by ticket under #n title, closed tickets included', async () => {
    const snapshot = await driftingSnapshot()
    const detail = detailOf(snapshot, 'map:3:map')
    expect(detail?.kind === 'map' && detail.drift.map((g) => [g.key, g.number, g.title])).toEqual([
      [null, null, null],
      ['map:3:ticket:1', 1, 'Palette'],
      ['map:3:ticket:2', 2, 'Dark mode'],
    ])
    // The finished map's closed ticket is in its Drift section too.
    const finished = detailOf(snapshot, 'map:1:map')
    expect(finished?.kind === 'map' && finished.drift).toHaveLength(1)
  })

  it('leaves a dismissed entry out everywhere, and shows it again once its detail changes', async () => {
    const snapshot = await driftingSnapshot()
    const detail = detailOf(snapshot, 'map:3:ticket:1')
    const entry = detail?.kind === 'ticket' ? detail.drift[0]?.entries[0] : undefined
    if (entry === undefined) throw new Error('expected drift')
    const dismissed = new Set([entry.dismissKey])

    const after = mapsOf(
      buildViewModel(snapshot, new Set(), null, undefined, null, null, undefined, dismissed),
    )
    expect(after.maps.find((map) => map.number === 3)?.loud).toBeNull()
    const hidden = detailOf(snapshot, 'map:3:ticket:1', undefined, dismissed)
    expect(hidden?.kind === 'ticket' && hidden.drift[0]?.entries.map((e) => e.code)).toEqual([
      'type-as-line',
    ])

    // The same code at another detail is a different entry.
    const changed: Snapshot = {
      ...snapshot,
      maps: snapshot.maps.map((map) => ({
        ...map,
        tickets: map.tickets.map((ticket) =>
          ticket.number === 1 && map.number === 3
            ? { ...ticket, warnings: [{ code: 'type-several' as const, detail: 'a, b' }] }
            : ticket,
        ),
      })),
    }
    const again = detailOf(changed, 'map:3:ticket:1', undefined, dismissed)
    expect(again?.kind === 'ticket' && again.drift[0]?.entries[0]?.code).toBe('type-several')
  })

  it('shows a free-form map as written, its folds left out, its tickets still unfolding', async () => {
    const snapshot = await freeFormSnapshot()
    expect(detailOf(snapshot, 'map:2:map')).toMatchObject({
      kind: 'map',
      freeForm: 'Just some prose about billing.',
      decisions: [],
      fog: [],
    })
    const node = mapsOf(buildViewModel(snapshot, new Set(['map:2']))).maps.find(
      (map) => map.number === 2,
    )
    expect(node?.tickets).not.toHaveLength(0)
    expect(node?.fog.entries).toEqual([])
    expect(node?.decisions.entries).toEqual([])
  })
})
