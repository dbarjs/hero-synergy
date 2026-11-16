import { FileSystem, readLocalTracker, type Snapshot } from '@hero-synergy/core'
import { Effect } from 'effect'
import { describe, expect, it } from 'vite-plus/test'

import { localTrackerFiles, workspaceFiles } from '../test/fixtures/workspace-files.ts'
import { dismissalKey } from './drift.ts'
import type { MapNode, ViewModel } from './protocol.ts'
import {
  buildViewModel,
  defaultExpanded,
  detailOf,
  firstFocusKey,
  revealKeys,
  selectionOf,
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

  it('reads the HITL note into the mode: a HITL-noted task is HITL, an AFK-noted one AFK, a grilling one HITL whatever its note', async () => {
    const noted = async (contrast: string) => {
      const issues = `${ROOT}/.scratch/cockpit-colors/issues`
      const files = {
        ...workspaceFiles(ROOT),
        [`${issues}/03-contrast-audit.md`]: `# Contrast audit\n\nType: ${contrast}\n\n## Question\n\nMeasure it.\n`,
        [`${issues}/02-dark-mode.md`]:
          '# Dark mode\n\nType: research (HITL — a person judges the themes)\nBlocked by: 01\n\n## Question\n\nFollow the theme?\n',
        [`${issues}/04-row-density.md`]:
          '# Row density\n\nType: grilling (AFK)\nStatus: claimed\n\n## Question\n\nHow dense?\n',
      }
      return Effect.runPromise(
        readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(files))),
      )
    }

    const hitl = await noted('task (HITL — a person reads the contrast)')
    const { maps } = mapsOf(buildViewModel(hitl, new Set()))
    expect(maps[0]?.tickets.map(({ number, type, mode }) => [number, type, mode])).toEqual([
      [4, 'grilling', 'HITL'],
      [1, 'prototype', 'HITL'],
      [3, 'task', 'HITL'],
      [2, 'research', 'HITL'],
    ])
    const detail = detailOf(hitl, 'map:3:ticket:3')
    expect(detail).toMatchObject({ kind: 'ticket', type: 'task', mode: 'HITL' })

    const afk = await noted('task (AFK)')
    const task = mapsOf(buildViewModel(afk, new Set())).maps[0]?.tickets.find(
      (ticket) => ticket.number === 3,
    )
    expect([task?.type, task?.mode]).toEqual(['task', 'AFK'])
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
        session: { kind: 'none' },
        disagreement: null,
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

describe('the Unmapped fold over core’s local-tracker fixture', () => {
  const localTrackerSnapshot = (extra: Record<string, string> = {}): Promise<Snapshot> =>
    Effect.runPromise(
      readLocalTracker(ROOT).pipe(
        Effect.provide(FileSystem.inMemory({ ...localTrackerFiles(ROOT), ...extra })),
      ),
    )

  it('shows the mapless effort as one group row with its count, its open issues keyed by effort, the closed one hidden', async () => {
    const snapshot = await localTrackerSnapshot()
    expect(snapshot.unmapped.map((group) => group.effort)).toEqual(['onboarding-spec'])
    const viewModel = buildViewModel(snapshot, new Set(['unmapped']))
    expect(viewModel.kind === 'maps' && viewModel.unmapped).toEqual({
      key: 'unmapped',
      expanded: true,
      count: 2,
      groups: [
        {
          effort: 'onboarding-spec',
          title: 'onboarding-spec',
          entries: [
            {
              key: 'unmapped:onboarding-spec:ticket:1',
              number: 1,
              title: 'Welcome screen',
              loud: [],
            },
            { key: 'unmapped:onboarding-spec:ticket:2', number: 2, title: 'Invite flow', loud: [] },
          ],
        },
      ],
    })
    // Collapsed until opened, still counting.
    const closed = buildViewModel(snapshot, new Set())
    expect(closed.kind === 'maps' && closed.unmapped).toMatchObject({ expanded: false, count: 2 })
  })

  it('lays several efforts’ groups end to end, in directory order, and counts them all', async () => {
    const snapshot = await localTrackerSnapshot({
      [`${ROOT}/.scratch/a-triage/issues/03-damp-shelf.md`]: '# Damp shelf\n',
      [`${ROOT}/.scratch/a-triage/issues/04-dry-shelf.md`]: '# Dry shelf\n\nStatus: wontfix\n',
    })
    const viewModel = buildViewModel(snapshot, new Set())
    expect(viewModel.kind === 'maps' && viewModel.unmapped?.count).toBe(3)
    expect(
      viewModel.kind === 'maps' &&
        viewModel.unmapped?.groups.map(({ title, entries }) => [
          title,
          entries.map(({ key, title: name }) => `${key} ${name}`),
        ]),
    ).toEqual([
      ['a-triage', ['unmapped:a-triage:ticket:3 Damp shelf']],
      [
        'onboarding-spec',
        [
          'unmapped:onboarding-spec:ticket:1 Welcome screen',
          'unmapped:onboarding-spec:ticket:2 Invite flow',
        ],
      ],
    ])
  })

  it('titles a group with its effort’s map, and keeps that map’s tickets off the fold', async () => {
    const snapshot = await localTrackerSnapshot({
      [`${ROOT}/.scratch/billing-rewrite/PRD.md`]: '# Billing PRD\n',
      [`${ROOT}/.scratch/billing-rewrite/issues/04-tax-export.md`]:
        '# Tax export\n\nParent: [Billing PRD](../PRD.md)\nStatus: ready-for-agent\n',
    })
    const viewModel = buildViewModel(snapshot, new Set(['unmapped']))
    expect(
      viewModel.kind === 'maps' &&
        viewModel.unmapped?.groups.map(({ effort, title, entries }) => [
          effort,
          title,
          entries.map(({ key }) => key),
        ]),
    ).toEqual([
      ['billing-rewrite', 'Billing rewrite', ['unmapped:billing-rewrite:ticket:4']],
      [
        'onboarding-spec',
        'onboarding-spec',
        ['unmapped:onboarding-spec:ticket:1', 'unmapped:onboarding-spec:ticket:2'],
      ],
    ])
    const billing = mapsOf(viewModel).maps.find((map) => map.title === 'Billing rewrite')
    expect(billing?.tickets.map((ticket) => ticket.number)).not.toContain(4)
    expect(billing).toMatchObject({ total: 3 })
  })

  it('selects, reveals and details an unmapped issue by its effort key', async () => {
    const snapshot = await localTrackerSnapshot()
    expect(selectionOf(snapshot, 'unmapped:onboarding-spec:ticket:2')?.focus).toMatchObject({
      kind: 'ticket',
      key: 'unmapped:onboarding-spec:ticket:2',
      number: 2,
      title: 'Invite flow',
      actions: [],
    })
    expect(revealKeys(snapshot, 'unmapped:onboarding-spec:ticket:2')).toEqual(['unmapped'])
    expect(detailOf(snapshot, 'unmapped:onboarding-spec:ticket:1')).toMatchObject({
      kind: 'ticket',
      key: 'unmapped:onboarding-spec:ticket:1',
      number: 1,
      title: 'Welcome screen',
      actions: [],
      clearsWayFor: [],
    })
    // On a local tracker the number-only key names nothing any more.
    expect(selectionOf(snapshot, 'unmapped:ticket:1')).toBeNull()
    expect(detailOf(snapshot, 'unmapped:ticket:1')).toBeNull()
    expect(revealKeys(snapshot, 'unmapped:ticket:1')).toEqual([])
  })

  it('keeps an unmapped issue’s neighbours unselectable in its Detail', async () => {
    const snapshot = await localTrackerSnapshot({
      [`${ROOT}/.scratch/onboarding-spec/issues/04-invite-email.md`]:
        '# Invite email\n\nStatus: needs-info\nBlocked by: 02\n',
    })
    const detail = detailOf(snapshot, 'unmapped:onboarding-spec:ticket:4')
    expect(detail).toMatchObject({ kind: 'ticket', actions: [], clearsWayFor: [] })
    expect(detail?.kind === 'ticket' && detail.waitsOn).toEqual([
      { number: 2, title: 'Invite flow', state: 'open', key: null },
    ])
  })
})

describe('two efforts’ #1 in the Unmapped fold', () => {
  // Both raise the same loud unknown-status: only the effort in the key tells them apart.
  const files = {
    [`${ROOT}/.scratch/left/issues/01-shelf.md`]: '# Left shelf\n\nStatus: in-review\n',
    [`${ROOT}/.scratch/right/issues/01-shelf.md`]: '# Right shelf\n\nStatus: in-review\n',
  }
  const LEFT = 'unmapped:left:ticket:1'
  const RIGHT = 'unmapped:right:ticket:1'
  const snapshot = (): Promise<Snapshot> =>
    Effect.runPromise(readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(files))))

  it('gives each its own row', async () => {
    const viewModel = buildViewModel(await snapshot(), new Set(['unmapped']))
    expect(
      viewModel.kind === 'maps' &&
        viewModel.unmapped?.groups.map(({ title, entries }) => [
          title,
          entries.map(({ key, title: name }) => [key, name]),
        ]),
    ).toEqual([
      ['left', [[LEFT, 'Left shelf']]],
      ['right', [[RIGHT, 'Right shelf']]],
    ])
  })

  it('selects, reveals and opens the Detail of only its own issue', async () => {
    const read = await snapshot()
    for (const [key, title] of [
      [LEFT, 'Left shelf'],
      [RIGHT, 'Right shelf'],
    ] as const) {
      expect(selectionOf(read, key)?.focus, key).toMatchObject({ key, number: 1, title })
      expect(selectionOf(read, key)?.target, key).toEqual({
        kind: 'file',
        path: `${ROOT}/.scratch/${key === LEFT ? 'left' : 'right'}/issues/01-shelf.md`,
      })
      expect(detailOf(read, key), key).toMatchObject({ key, number: 1, title })
      expect(revealKeys(read, key), key).toEqual(['unmapped'])
      const viewModel = buildViewModel(read, new Set(['unmapped']), key)
      expect(viewModel.kind === 'maps' && viewModel.selection?.key, key).toBe(key)
    }
  })

  it('dismisses drift on one issue only', async () => {
    const read = await snapshot()
    const warning = { code: 'unknown-status', detail: 'in-review' } as const
    const dismissed = new Set([dismissalKey(LEFT, warning)])
    const viewModel = buildViewModel(
      read,
      new Set(['unmapped']),
      null,
      undefined,
      null,
      null,
      undefined,
      dismissed,
    )
    expect(
      viewModel.kind === 'maps' &&
        viewModel.unmapped?.groups.map(({ entries }) =>
          entries.map(({ key, loud }) => [key, loud.length]),
        ),
    ).toEqual([[[LEFT, 0]], [[RIGHT, 1]]])
    expect(detailOf(read, LEFT, undefined, dismissed)).toMatchObject({ drift: [] })
    expect(detailOf(read, RIGHT, undefined, dismissed)).toMatchObject({
      drift: [{ entries: [{ code: 'unknown-status', dismissKey: dismissalKey(RIGHT, warning) }] }],
    })
    // A dismissal stored under the old number-only key hides neither: each shows once more.
    const old = new Set([dismissalKey('unmapped:ticket:1', warning)])
    for (const key of [LEFT, RIGHT])
      expect(detailOf(read, key, undefined, old), key).toMatchObject({
        drift: [{ entries: [{ code: 'unknown-status' }] }],
      })
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
      claim: 'unclaimed',
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

  it('lists what a Blocks line names under "clears the way for", and the named ticket waits on it', async () => {
    // The contrast audit writes the edge on its own side: `Blocks: 02`, and Dark mode never names it.
    const files = {
      ...workspaceFiles(ROOT),
      [`${ROOT}/.scratch/cockpit-colors/issues/03-contrast-audit.md`]:
        '# Contrast audit\n\nType: task\nBlocks: 02 (dark mode needs the measures)\n\n## Question\n\nMeasure it.\n',
    }
    const snapshot = await Effect.runPromise(
      readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(files))),
    )
    const audit = detailOf(snapshot, 'map:3:ticket:3')
    expect(audit?.kind === 'ticket' && audit.clearsWayFor).toEqual([
      { number: 2, title: 'Dark mode', state: 'open', key: 'map:3:ticket:2' },
    ])
    const darkMode = detailOf(snapshot, 'map:3:ticket:2')
    expect(darkMode).toMatchObject({ kind: 'ticket', place: 'blocked' })
    expect(darkMode?.kind === 'ticket' && darkMode.waitsOn).toEqual([
      { number: 1, title: 'Palette', state: 'open', key: 'map:3:ticket:1' },
      { number: 3, title: 'Contrast audit', state: 'open', key: 'map:3:ticket:3' },
    ])
  })

  it('shows a closed ticket with its resolution', async () => {
    const snapshot = await fixtureSnapshot()
    const detail = detailOf(snapshot, 'map:3:ticket:5')
    expect(detail).toMatchObject({ kind: 'ticket', number: 5, state: 'closed', place: 'closed' })
    expect(detail?.kind === 'ticket' && detail.resolution?.body).toContain('Codicons')
  })

  it('shows a closed local ticket’s resolution from each placement, and how sure the reading is', async () => {
    // One closed ticket per placement #138 reads, under the Question every ticket has.
    const placements = [
      ['## Answer\n\nYes.', null],
      ['## Resolution (2026-10-01)\n\nYes.', 'Resolution heading'],
      [
        '## Comments\n\n### Resolution (2026-10-02)\n\nYes.',
        'Resolution heading under ## Comments',
      ],
      ['## Comments\n\n**Resolution — 2026-10-03**\nYes.', 'bold Resolution label'],
      ['## Comments\n\n- 2026-10-04 (wren): yes.', 'dated comment'],
      ['## Comments\n\nYes.', 'comment text'],
    ] as const
    const files = {
      [`${ROOT}/.scratch/returns/map.md`]:
        '# Returns\n\n## Destination\n\nd\n\n## Notes\n\n## Decisions so far\n\n## Not yet specified\n\n## Out of scope\n',
      ...Object.fromEntries(
        placements.map(([rest], index) => [
          `${ROOT}/.scratch/returns/issues/0${index + 1}-returns.md`,
          `# Returns ${index + 1}\n\nType: grilling\nStatus: closed\n\n## Question\n\nSame day?\n\n${rest}\n`,
        ]),
      ),
    }
    const snapshot = await Effect.runPromise(
      readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(files))),
    )
    const shown = placements.map((_, index) => {
      const detail = detailOf(snapshot, `map:1:ticket:${index + 1}`)
      if (detail?.kind !== 'ticket') throw new Error(`no ticket ${index + 1}`)
      const resolutionDrift = detail.drift
        .flatMap((group) => group.entries)
        .filter((entry) => entry.code.startsWith('resolution-'))
        .map(({ level, detail: form }) => ({ level, form }))
      return { resolution: detail.resolution, drift: resolutionDrift }
    })
    expect(shown).toEqual([
      { resolution: { body: 'Yes.', author: null, at: null }, drift: [] },
      {
        resolution: { body: 'Yes.', author: null, at: '2026-10-01' },
        drift: [{ level: 'quiet', form: 'Resolution heading' }],
      },
      {
        resolution: { body: 'Yes.', author: null, at: '2026-10-02' },
        drift: [{ level: 'quiet', form: 'Resolution heading under ## Comments' }],
      },
      {
        resolution: { body: 'Yes.', author: null, at: '2026-10-03' },
        drift: [{ level: 'quiet', form: 'bold Resolution label' }],
      },
      {
        resolution: { body: '- 2026-10-04 (wren): yes.', author: 'wren', at: '2026-10-04' },
        drift: [{ level: 'quiet', form: 'dated comment' }],
      },
      {
        resolution: { body: 'Yes.', author: null, at: null },
        drift: [{ level: 'quiet', form: 'comment text' }],
      },
    ])
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
