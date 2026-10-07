import { FileSystem, readLocalTracker, type Snapshot } from '@hero-synergy/core'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Effect } from 'effect'
import { beforeAll, describe, expect, it } from 'vite-plus/test'

import { workspaceFiles } from '../../test/fixtures/workspace-files.ts'
import type { ViewModel } from '../../src/protocol.ts'
import { buildViewModel } from '../../src/view-model.ts'
import Tree from './Tree.vue'

const ROOT = '/home/ana/billing'
const OPEN = new Set(['map:2', 'map:3', 'map:3:decisions'])

let snapshot: Snapshot

beforeAll(async () => {
  snapshot = await Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )
})

const render = (selected: string | null): VueWrapper => {
  const viewModel: ViewModel = buildViewModel(snapshot, OPEN, selected)
  return mount(Tree, { props: { viewModel } })
}

const facts = (wrapper: VueWrapper): Record<string, string> =>
  Object.fromEntries(
    wrapper.findAll('.pane .fact').map((fact) => [fact.find('dt').text(), fact.find('dd').text()]),
  )

describe('the Focus pane', () => {
  it('is closed until a row is selected', () => {
    expect(render(null).find('.pane').exists()).toBe(false)
  })

  it('shows an open ticket: its state, no claim, and the title', () => {
    const wrapper = render('map:3:ticket:1')
    expect(wrapper.findAll('.pane')).toHaveLength(1)
    expect(wrapper.find('.pane .title').text()).toBe('#1 Palette')
    expect(facts(wrapper)).toEqual({ State: 'open', Claim: 'unclaimed' })
  })

  it('shows a claimed ticket with who holds the claim', () => {
    const wrapper = render('map:3:ticket:4')
    expect(wrapper.find('.pane .title').text()).toBe('#4 Row density')
    expect(facts(wrapper).State).toBe('open')
    expect(facts(wrapper).Claim).not.toBe('unclaimed')
  })

  it('shows a closed ticket from the Decisions fold', () => {
    const wrapper = render('map:3:ticket:5')
    expect(wrapper.find('.pane .title').text()).toBe('#5 Icon set')
    expect(facts(wrapper)).toMatchObject({ State: 'closed' })
  })

  it('shows the ⚑ Map row with the map counts and its destination', () => {
    const wrapper = render('map:3:map')
    expect(wrapper.find('.pane .title').text()).toBe('#3 Cockpit colors')
    expect(facts(wrapper)).toEqual({
      Counts: '2 takeable · 1/5 decided',
      Destination: "A palette for the Cockpit's tree and detail, decided and recorded as tokens.",
    })
  })

  it('opens inline under the selected row and marks that row', () => {
    const wrapper = render('map:3:ticket:1')
    const selected = wrapper.find('[aria-selected="true"]')
    expect(selected.find('.label').text()).toBe('#1 Palette')
    expect(selected.element.nextElementSibling?.classList.contains('pane')).toBe(true)
  })

  it('asks to select a row, and to close the pane on a second click or ✕', async () => {
    const closed = render(null)
    await closed.findAll('.ticket')[0]?.trigger('click')
    expect(closed.emitted('select')).toEqual([['map:3:ticket:4']])

    const open = render('map:3:ticket:4')
    await open.findAll('.ticket')[0]?.trigger('click')
    await open.find('.pane .close').trigger('click')
    expect(open.emitted('select')).toEqual([[null], [null]])
  })

  it('opens the Detail from ↗ Detail and the issue from the title', async () => {
    const wrapper = render('map:3:ticket:1')
    await wrapper.find('.pane .detail').trigger('click')
    expect(wrapper.emitted('openDetail')).toEqual([['map:3:ticket:1', null]])
    expect(wrapper.emitted('open')).toBeUndefined()
    await wrapper.find('.pane .title').trigger('click')
    expect(wrapper.emitted('open')).toEqual([['map:3:ticket:1']])
  })
})
