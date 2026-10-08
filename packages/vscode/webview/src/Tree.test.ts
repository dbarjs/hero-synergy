import { FileSystem, readLocalTracker } from '@hero-synergy/core'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Effect } from 'effect'
import { beforeAll, describe, expect, it } from 'vite-plus/test'

import { workspaceFiles } from '../../test/fixtures/workspace-files.ts'
import type { ActionView, MapNode, ViewModel } from '../../src/protocol.ts'
import { buildViewModel } from '../../src/view-model.ts'
import Tree from './Tree.vue'

const ROOT = '/home/ana/billing'
const NO_START = { key: 'repo', actions: [], note: null }

/** Every node of the fixture workspace open, so all of its rows render. */
const ALL_OPEN = new Set([
  'map:1',
  'map:2',
  'map:3',
  'map:2:fog',
  'map:3:fog',
  'map:2:decisions',
  'map:3:decisions',
  'map:1:decisions',
  'finished',
])

let fixture: ViewModel
let closedFixture: ViewModel

beforeAll(async () => {
  const snapshot = await Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )
  fixture = buildViewModel(snapshot, ALL_OPEN)
  closedFixture = buildViewModel(snapshot, new Set())
})

const render = (viewModel: ViewModel): VueWrapper => mount(Tree, { props: { viewModel } })

/** A row as it reads left to right: its label (with the `#number`), then each trailing mark. */
const rows = (wrapper: VueWrapper, selector = '[role="treeitem"]'): string[] =>
  wrapper
    .findAll(selector)
    .map((row) =>
      [row.find('.label').text(), ...row.findAll('.trail > *').map((mark) => mark.text())]
        .filter((part) => part !== '')
        .join(' | '),
    )

describe('the Tree rows of the fixture workspace, everything open', () => {
  it('lists every map as #number title in urgency order, the finished one folded last', () => {
    const wrapper = render(fixture)
    const lines = rows(wrapper)
    // Depth 0 is aria-level 1: the maps and the Finished fold.
    const maps = rows(wrapper, '[role="treeitem"][aria-level="1"]')
    expect(maps).toEqual([
      '#3 Cockpit colors | 2 takeable | 1/5',
      '#2 Billing rewrite | nothing takeable | 1/3',
      'Finished | 1 maps',
    ])
    expect(lines.indexOf('Finished | 1 maps')).toBeGreaterThan(
      lines.indexOf('#2 Billing rewrite | nothing takeable | 1/3'),
    )
  })

  it('unfolds a map into its Map row, then claimed, the frontier with next, then blocked', () => {
    const lines = rows(render(fixture))
    const start = lines.indexOf('#3 Cockpit colors | 2 takeable | 1/5')
    expect(lines.slice(start, start + 5)).toEqual([
      '#3 Cockpit colors | 2 takeable | 1/5',
      "Map A palette for the Cockpit's tree and detail, decided and recorded as tokens.",
      '#4 Row density | claimed | HITL',
      '#1 Palette | next | HITL',
      '#3 Contrast audit | task',
    ])
    expect(lines[start + 5]).toBe('#2 Dark mode | waits on #1 | AFK')
  })

  it('shows what a blocked ticket waits on, and nothing for a ticket on the frontier', () => {
    const wrapper = render(fixture)
    const waits = wrapper.findAll('.waits').map((mark) => mark.text())
    // Dark mode waits on the palette; the invoice numbering waits on the refund policy only,
    // since the database decision is closed.
    expect(waits).toEqual(['waits on #1', 'waits on #2'])
  })

  it('marks each ticket with its type icon', () => {
    const icons = render(fixture)
      .findAll('.ticket')
      .map((row) => [row.find('.label').text(), row.find('.mark').classes()])
    expect(icons).toEqual([
      ['#4 Row density', expect.arrayContaining(['codicon-comment-discussion'])],
      ['#1 Palette', expect.arrayContaining(['codicon-beaker'])],
      ['#3 Contrast audit', expect.arrayContaining(['codicon-checklist'])],
      ['#2 Dark mode', expect.arrayContaining(['codicon-search'])],
      ['#2 Refund policy', expect.arrayContaining(['codicon-comment-discussion'])],
      ['#3 Invoice numbering', expect.arrayContaining(['codicon-comment-discussion'])],
    ])
  })

  it('folds Fog and Decisions under the map, and a decision shows its gist', () => {
    const lines = rows(render(fixture))
    expect(lines).toContain('Fog | 1')
    expect(lines).toContain('Spacing, once the palette is fixed.')
    expect(lines).toContain('Decisions | 1')
    expect(lines).toContain('#5 Icon set Codicons: they ship with VS Code')
  })

  it('unfolds the Finished fold into its maps, muted, with their decisions', () => {
    const wrapper = render(fixture)
    const lines = rows(wrapper)
    const at = lines.indexOf('Finished | 1 maps')
    expect(lines.slice(at + 1, at + 4)).toEqual([
      '#1 Archive search | 2/2',
      'Map Search over archived invoices decided, ready for `/to-spec`.',
      'Decisions | 2',
    ])
    expect(wrapper.findAll('[role="treeitem"]')[at + 1]?.classes()).toContain('muted')
  })

  it('gives only the rows that fold a twisty and an aria-expanded state', () => {
    const wrapper = render(fixture)
    const folds = wrapper
      .findAll('[role="treeitem"]')
      .filter((row) => row.attributes('aria-expanded') !== undefined)
      .map((row) => row.find('.label').text())
    expect(folds).toEqual([
      '#3 Cockpit colors',
      'Fog',
      'Decisions',
      '#2 Billing rewrite',
      'Fog',
      'Decisions',
      'Finished',
      '#1 Archive search',
      'Decisions',
    ])
    // Every other row (the Map row, the tickets, the fog and decision entries) shows no chevron.
    expect(wrapper.findAll('.codicon-chevron-down, .codicon-chevron-right')).toHaveLength(
      folds.length,
    )
  })

  it('draws a folded node closed, with the right aria state', () => {
    const states = render(closedFixture)
      .findAll('[role="treeitem"]')
      .map((row) => row.attributes('aria-expanded'))
    expect(states).toEqual(['false', 'false', 'false'])
  })
})

describe('the Tree states with no maps', () => {
  it('waits while the tracker is read', () => {
    expect(render({ kind: 'loading' }).text()).toBe('Reading the tracker…')
  })

  it('shows one plain message and its detail', () => {
    const text = render({
      kind: 'message',
      message: 'This repo has no issue tracker set up.',
      detail: 'Run /setup-matt-pocock-skills in Claude Code.',
      start: NO_START,
    }).text()
    expect(text).toContain('This repo has no issue tracker set up.')
    expect(text).toContain('Run /setup-matt-pocock-skills in Claude Code.')
  })

  it('says there are no maps for a tracker that holds none', () => {
    const wrapper = render({
      kind: 'maps',
      collectedAt: '2026-10-07T00:00:00.000Z',
      repo: null,
      notice: null,
      budget: null,
      maps: [],
      finished: null,
      unmapped: null,
      start: NO_START,
      selection: null,
    })
    expect(wrapper.text()).toBe('No maps yet.')
  })

  const action = (id: ActionView['id'], label: ActionView['label'], command: string | null) =>
    ({ id, label, command, envLine: null, disabled: null, note: null }) satisfies ActionView

  it('leads with both install commands and the pick-one line, each command with ▶ and copy', async () => {
    const wrapper = render({
      kind: 'message',
      message: 'This repo has no issue tracker set up.',
      detail: null,
      start: {
        key: 'repo',
        note: 'Pick one, never both.',
        actions: [
          action(
            'install-plugin',
            'Install the plugin',
            'claude plugins install mattpocock-skills',
          ),
          action('install-npx', 'Install with npx', 'npx skills@latest add mattpocock/skills'),
        ],
      },
    })
    expect(wrapper.findAll('.command').map((command) => command.text())).toEqual([
      'claude plugins install mattpocock-skills',
      'npx skills@latest add mattpocock/skills',
    ])
    expect(wrapper.find('.pick').text()).toBe('Pick one, never both.')
    await wrapper.findAll('.run')[1]?.trigger('click')
    await wrapper.findAll('.copy')[0]?.trigger('click')
    expect(wrapper.emitted('launch')).toEqual([['repo', 'install-npx']])
    expect(wrapper.emitted('copy')).toEqual([['repo', 'install-plugin']])
  })

  it('leads with Setup under the message when the repo has no tracker doc', () => {
    const wrapper = render({
      kind: 'message',
      message: 'This repo has no issue tracker set up.',
      detail: null,
      start: {
        key: 'repo',
        note: null,
        actions: [action('setup', 'Setup', 'claude /setup-matt-pocock-skills')],
      },
    })
    expect(wrapper.find('.run').text()).toBe('Setup')
    expect(wrapper.find('.command').text()).toBe('claude /setup-matt-pocock-skills')
    expect(wrapper.find('.pick').exists()).toBe(false)
  })

  it('leads with Chart a map when the tracker holds no map', async () => {
    const wrapper = render({
      kind: 'maps',
      collectedAt: '2026-10-07T00:00:00.000Z',
      repo: null,
      notice: null,
      budget: null,
      start: {
        key: 'repo',
        note: null,
        actions: [action('chart-map', 'Chart a map', "claude -n 'Chart a map' /wayfinder")],
      },
      maps: [],
      finished: null,
      unmapped: null,
      selection: null,
    })
    expect(wrapper.text()).toContain('No maps yet.')
    expect(wrapper.find('.command').text()).toBe("claude -n 'Chart a map' /wayfinder")
    await wrapper.find('.run').trigger('click')
    expect(wrapper.emitted('launch')).toEqual([['repo', 'chart-map']])
  })

  it('greys an Action whose skill is missing, with the reason, and posts nothing', async () => {
    const wrapper = render({
      kind: 'message',
      message: 'This repo has no issue tracker set up.',
      detail: null,
      start: {
        key: 'repo',
        note: null,
        actions: [
          {
            ...action('setup', 'Setup', null),
            disabled: 'The setup-matt-pocock-skills skill was not found.',
          },
        ],
      },
    })
    expect(wrapper.find('.run').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('.reason').text()).toContain('setup-matt-pocock-skills skill was not found')
    expect(wrapper.find('.command').exists()).toBe(false)
    await wrapper.find('.run').trigger('click')
    expect(wrapper.emitted('launch')).toBeUndefined()
  })
})

const node = (number: number, overrides: Partial<MapNode> = {}): MapNode => ({
  key: `map:${number}`,
  number,
  title: `Map number ${number}`,
  expanded: false,
  focusKey: `map:${number}:map`,
  takeable: 0,
  decided: 0,
  total: 0,
  destination: null,
  action: null,
  tickets: [],
  fog: { key: `map:${number}:fog`, expanded: false, entries: [] },
  decisions: { key: `map:${number}:decisions`, expanded: false, entries: [] },
  loud: null,
  ...overrides,
})

describe('a repo with 45 maps, 38 of them finished', () => {
  const active = Array.from({ length: 7 }, (_, i) =>
    node(i + 1, { takeable: i % 2, decided: i, total: 9 }),
  )
  const finishedMaps = Array.from({ length: 38 }, (_, i) =>
    node(i + 8, {
      decided: 5,
      total: 5,
      decisions: { key: `map:${i + 8}:decisions`, expanded: false, entries: [] },
      loud: null,
    }),
  )
  const model = (finishedOpen: boolean): ViewModel => ({
    kind: 'maps',
    collectedAt: '2026-10-07T00:00:00.000Z',
    repo: null,
    notice: null,
    budget: null,
    maps: active,
    finished: { key: 'finished', expanded: finishedOpen, maps: finishedMaps },
    unmapped: null,
    start: NO_START,
    selection: null,
  })

  it('renders the seven open maps and one Finished node, not the 38', () => {
    const lines = rows(render(model(false)))
    expect(lines).toHaveLength(8)
    expect(lines.slice(0, 7).map((line) => line.split(' | ')[0])).toEqual(
      active.map((map) => `#${map.number} Map number ${map.number}`),
    )
    expect(lines[7]).toBe('Finished | 38 maps')
  })

  it('renders the 38 finished maps once the fold is open', () => {
    const lines = rows(render(model(true)))
    expect(lines).toHaveLength(7 + 1 + 38)
    expect(lines.at(-1)).toBe('#45 Map number 45 | 5/5')
  })
})

describe('what the Tree asks for', () => {
  it('asks to expand a closed map and to collapse an open one', async () => {
    const wrapper = render({
      kind: 'maps',
      collectedAt: '2026-10-07T00:00:00.000Z',
      repo: null,
      notice: null,
      budget: null,
      maps: [node(1), node(2, { expanded: true })],
      finished: null,
      unmapped: null,
      start: NO_START,
      selection: null,
    })
    const [first, second] = wrapper.findAll('[role="treeitem"]')
    await first?.trigger('click')
    await second?.trigger('click')
    expect(wrapper.emitted('expand')).toEqual([['map:1']])
    expect(wrapper.emitted('collapse')).toEqual([['map:2']])
  })

  it('asks to expand the Finished fold from the keyboard', async () => {
    const wrapper = render({
      kind: 'maps',
      collectedAt: '2026-10-07T00:00:00.000Z',
      repo: null,
      notice: null,
      budget: null,
      maps: [],
      finished: { key: 'finished', expanded: false, maps: [node(1, { decided: 1, total: 1 })] },
      unmapped: null,
      start: NO_START,
      selection: null,
    })
    await wrapper.find('[role="treeitem"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('expand')).toEqual([['finished']])
  })
})

describe('what opens the Detail', () => {
  const wrapper = (): VueWrapper => render(fixture)
  const rowOf = (w: VueWrapper, label: string) =>
    w.findAll('[role="treeitem"]').find((row) => row.find('.label').text().startsWith(label))

  it('opens the Detail on a ticket row with Enter or a double-click, and selects with a click', async () => {
    const w = wrapper()
    const palette = rowOf(w, '#1 Palette')
    await palette?.trigger('click')
    expect(w.emitted('select')).toEqual([['map:3:ticket:1']])
    expect(w.emitted('openDetail')).toBeUndefined()

    await palette?.trigger('keydown', { key: 'Enter' })
    await palette?.trigger('dblclick')
    expect(w.emitted('openDetail')).toEqual([
      ['map:3:ticket:1', null],
      ['map:3:ticket:1', null],
    ])
  })

  it('opens the map on its Map row', async () => {
    const w = wrapper()
    await rowOf(w, 'Map')?.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('openDetail')).toEqual([['map:3:map', null]])
  })

  it('opens the map scrolled to the Fog from the Fog row, and to Decisions from the Decisions row', async () => {
    const w = wrapper()
    await rowOf(w, 'Fog')?.trigger('keydown', { key: 'Enter' })
    await rowOf(w, 'Decisions')?.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('openDetail')).toEqual([
      ['map:3:map', 'fog'],
      ['map:3:map', 'decisions'],
    ])
    // A click still folds them.
    await rowOf(w, 'Fog')?.trigger('click')
    expect(w.emitted('collapse')?.at(-1)).toEqual(['map:3:fog'])
  })

  it('keeps Enter on a map row as expand and collapse', async () => {
    const w = wrapper()
    await rowOf(w, '#3 Cockpit colors')?.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('collapse')).toEqual([['map:3']])
    expect(w.emitted('openDetail')).toBeUndefined()
  })

  it('opens the Detail on a decision with Enter', async () => {
    const w = wrapper()
    await rowOf(w, '#5 Icon set')?.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('openDetail')).toEqual([['map:3:ticket:5', null]])
  })
})
