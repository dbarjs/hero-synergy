import { FileSystem, readLocalTracker, type Snapshot } from '@hero-synergy/core'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Effect } from 'effect'
import { beforeAll, describe, expect, it } from 'vite-plus/test'

import { healthEntries, healthRowOf, raise } from '../../src/health.ts'
import type { HealthRow } from '../../src/protocol.ts'
import { buildViewModel } from '../../src/view-model.ts'
import { NOT_LAUNCHING } from '../../src/launch.ts'
import { workspaceFiles } from '../../test/fixtures/workspace-files.ts'
import Tree from './Tree.vue'

const ROOT = '/home/ana/billing'
const OPEN = new Set(['map:3'])
const CONTEXT = { claude: '2.1.213' }

let snapshot: Snapshot

beforeAll(async () => {
  snapshot = await Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )
})

const rowOf = (...raised: ReturnType<typeof raise>[]): HealthRow | null =>
  healthRowOf(healthEntries(raised, [], CONTEXT, new Set()))

const tree = (health: HealthRow | null, selected: string | null = null): VueWrapper =>
  mount(Tree, {
    props: {
      viewModel: buildViewModel(
        snapshot,
        OPEN,
        selected,
        undefined,
        null,
        null,
        NOT_LAUNCHING,
        new Set(),
        health,
      ),
    },
  })

/** The first treeitem is the pinned row when there is one. */
const pinned = (wrapper: VueWrapper) => wrapper.findAll('[role="treeitem"]')[0]!

describe('the pinned Health row', () => {
  it('is the first row of the Tree, ⚠ and counting the loud entries', () => {
    const wrapper = tree(
      rowOf(raise('claude-below-floor', '2.1.211'), raise('skill-missing', undefined)),
    )
    const row = pinned(wrapper)
    expect(row.find('.label').text()).toBe('Health · 2 warnings')
    expect(row.find('.codicon-warning').exists()).toBe(true)
  })

  it('lists the loud messages on hover', () => {
    const health = rowOf(raise('claude-below-floor', '2.1.211'))
    const row = pinned(tree(health))
    expect(row.attributes('title')).toBe(health?.hover.join('\n'))
    expect(row.attributes('title')).toContain('Claude Code 2.1.211 is older than 2.1.212')
  })

  it('is a quiet row of notes with no ⚠ and nothing on hover when no entry is loud', () => {
    const row = pinned(tree(rowOf(raise('hook-reason-missing', 'SessionEnd for ticket 4'))))
    expect(row.find('.label').text()).toBe('Health · 1 note')
    expect(row.find('.codicon-warning').exists()).toBe(false)
    expect(row.attributes('title')).toBeUndefined()
  })

  it('is absent when there is nothing to report', () => {
    const wrapper = tree(null)
    expect(wrapper.text()).not.toContain('Health')
    expect(wrapper.find('.health').exists()).toBe(false)
  })
})

describe('the Health pane', () => {
  const selected = () =>
    tree(
      rowOf(raise('claude-below-floor', '2.1.211'), raise('hook-reason-missing', 'SessionEnd')),
      'health',
    )

  it('opens under the row on a click, and closes on a second', async () => {
    const wrapper = tree(rowOf(raise('claude-below-floor', '2.1.211')))
    await pinned(wrapper).trigger('click')
    expect(wrapper.emitted('select')?.at(-1)).toEqual(['health'])
    const open = selected()
    await pinned(open).trigger('click')
    expect(open.emitted('select')?.at(-1)).toEqual([null])
  })

  it('lists every entry with its hint, loud first, quiet muted', () => {
    const entries = selected().findAll('.pane .entry')
    expect(entries.map((entry) => entry.classes())).toEqual([
      expect.arrayContaining(['loud']),
      expect.arrayContaining(['quiet']),
    ])
    expect(entries[0]?.find('.message').text()).toContain('Claude Code 2.1.211')
    expect(entries[0]?.find('.hint').text()).toContain('claude update')
    expect(entries[0]?.find('.codicon-warning').exists()).toBe(true)
    expect(entries[1]?.find('.codicon-warning').exists()).toBe(false)
  })

  it('asks to dismiss the entry it was pressed on', async () => {
    const wrapper = selected()
    expect(wrapper.findAll('.pane .dismiss')).toHaveLength(2)
    await wrapper.findAll('.pane .dismiss')[0]?.trigger('click')
    const [sent] = wrapper.emitted('dismissHealth')?.at(-1) ?? []
    expect(JSON.parse(String(sent))).toEqual(['health', 'claude-below-floor', '2.1.211'])
  })

  it('closes from its ✕', async () => {
    const wrapper = selected()
    await wrapper.find('.pane .close').trigger('click')
    expect(wrapper.emitted('select')?.at(-1)).toEqual([null])
  })
})

describe('the Health row in an empty state', () => {
  it('shows above the message', () => {
    const health = rowOf(raise('claude-not-found', 'claude was not found on PATH.'))
    const wrapper = mount(Tree, {
      props: {
        viewModel: {
          kind: 'message',
          message: 'No git repository to show.',
          detail: null,
          start: { key: 'repo', actions: [], note: null },
          health,
          selection: null,
        },
      },
    })
    expect(wrapper.text().indexOf('Health · 1 warning')).toBeLessThan(
      wrapper.text().indexOf('No git repository to show.'),
    )
  })
})
