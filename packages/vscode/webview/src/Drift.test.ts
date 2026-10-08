import type { Snapshot } from '@hero-synergy/core'
import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vite-plus/test'

import { driftingSnapshot, freeFormSnapshot } from '../../test/fixtures/drifting-snapshot.ts'
import { buildViewModel, detailOf } from '../../src/view-model.ts'
import Detail from './Detail.vue'
import Tree from './Tree.vue'

const OPEN = new Set(['map:2', 'map:3', 'map:1', 'finished', 'unmapped'])

let drifting: Snapshot
let freeForm: Snapshot

beforeAll(async () => {
  drifting = await driftingSnapshot()
  freeForm = await freeFormSnapshot()
})

const tree = (snapshot: Snapshot, selected: string | null = null): VueWrapper =>
  mount(Tree, { props: { viewModel: buildViewModel(snapshot, OPEN, selected) } })

const detail = (snapshot: Snapshot, key: string): VueWrapper =>
  mount(Detail, { props: { view: { detail: detailOf(snapshot, key), section: null, scroll: 0 } } })

/** The row whose label starts with the text. */
const row = (wrapper: VueWrapper, label: string) => {
  const found = wrapper
    .findAll('[role="treeitem"]')
    .find((r) => r.find('.label').text().startsWith(label))
  if (found === undefined) throw new Error(`no row ${label}`)
  return found
}

describe('⚠ in the Tree', () => {
  it('follows the title of a loud ticket, with the loud messages on hover', () => {
    const palette = row(tree(drifting), '#1 Palette')
    const warn = palette.find('.warn')
    expect(warn.exists()).toBe(true)
    expect(warn.classes()).toContain('codicon-warning')
    expect(warn.attributes('title')).toBe('The ticket has no type.')
  })

  it('leaves a quiet ticket and a clean one unmarked', () => {
    const wrapper = tree(drifting)
    expect(row(wrapper, '#2 Dark mode').find('.warn').exists()).toBe(false)
    expect(row(wrapper, '#3 Contrast audit').find('.warn').exists()).toBe(false)
  })

  it('marks the map of a loud ticket with counts in the tooltip, and a clean map not at all', () => {
    const wrapper = tree(drifting)
    expect(row(wrapper, '#3 Cockpit colors').find('.warn').attributes('title')).toBe(
      '1 loud warning on 1 ticket',
    )
    expect(row(wrapper, '#2 Billing rewrite').find('.warn').exists()).toBe(false)
  })

  it('marks a finished map for its closed ticket, while the Finished fold adds nothing up', () => {
    const wrapper = tree(drifting)
    expect(row(wrapper, '#1 Archive search').find('.warn').exists()).toBe(true)
    expect(row(wrapper, 'Finished').find('.warn').exists()).toBe(false)
  })

  it('shows an Unmapped node above the Finished fold, with its ticket marked', () => {
    const wrapper = tree(drifting)
    const labels = wrapper.findAll('[role="treeitem"]').map((r) => r.find('.label').text())
    expect(labels.indexOf('Unmapped')).toBeGreaterThan(-1)
    expect(labels.indexOf('Unmapped')).toBeLessThan(labels.indexOf('Finished'))
    expect(row(wrapper, '#3 Contrast audit').exists()).toBe(true)
    const stray = wrapper.findAll('.unmapped')[0]
    expect(stray?.find('.warn').attributes('title')).toBe('The ticket belongs to no map.')
  })

  it('has no Unmapped node when every ticket has a map', () => {
    const clean = { ...drifting, unmapped: [] }
    const labels = tree(clean)
      .findAll('[role="treeitem"]')
      .map((r) => r.find('.label').text())
    expect(labels).not.toContain('Unmapped')
  })
})

describe('drift in the Focus pane', () => {
  it('has one line per loud warning and one muted line for the quiet ones', () => {
    const lines = tree(drifting, 'map:3:ticket:1').findAll('.pane .drift-line')
    expect(lines.map((line) => line.text())).toEqual(['The ticket has no type.', '1 old form'])
    expect(lines[0]?.classes()).toContain('loud')
    expect(lines[1]?.classes()).toContain('quiet')
  })

  it('adds how many tickets drift to the ⚑ Map row’s pane', () => {
    const lines = tree(drifting, 'map:3:map').findAll('.pane .drift-line')
    expect(lines.map((line) => line.text())).toEqual(['1 old form', '2 tickets with drift'])
  })

  it('opens the Detail at the Drift section when a line is clicked', async () => {
    const wrapper = tree(drifting, 'map:3:ticket:1')
    await wrapper.find('.pane .drift-line').trigger('click')
    expect(wrapper.emitted('openDetail')).toEqual([['map:3:ticket:1', 'drift']])
  })

  it('shows nothing when there is no drift', () => {
    expect(tree(drifting, 'map:3:ticket:4').find('.pane .drift').exists()).toBe(false)
  })
})

describe('the Drift section of the Detail', () => {
  it('ends a ticket Detail, with the message, the detail and the hint of each entry', () => {
    const wrapper = detail(drifting, 'map:3:ticket:1')
    const sections = wrapper.findAll('article > section')
    expect(sections.at(-1)?.attributes('id')).toBe('section-drift')
    const entries = wrapper.findAll('.drift-entry')
    expect(entries).toHaveLength(2)
    expect(entries[0]?.text()).toContain('The ticket has no type.')
    expect(entries[1]?.find('.detail').text()).toBe('Type: prototype')
    expect(entries[1]?.find('.hint').text()).toContain('label')
  })

  it('puts a ⚠ chip in the header when anything is loud, and not when it is all quiet', () => {
    expect(detail(drifting, 'map:3:ticket:1').find('.chip').exists()).toBe(true)
    expect(detail(drifting, 'map:3:ticket:2').find('.chip').exists()).toBe(false)
  })

  it('is hidden when there is no drift', () => {
    const wrapper = detail(drifting, 'map:3:ticket:4')
    expect(wrapper.find('#section-drift').exists()).toBe(false)
    expect(wrapper.find('.chip').exists()).toBe(false)
  })

  it('groups a map’s section by ticket under #n title, closed tickets included', () => {
    const wrapper = detail(drifting, 'map:3:map')
    expect(wrapper.findAll('#section-drift h3').map((h) => h.text())).toEqual([
      '#1 Palette',
      '#2 Dark mode',
    ])
    expect(detail(drifting, 'map:1:map').findAll('#section-drift h3')).toHaveLength(1)
  })

  it('asks to dismiss an entry by its key', async () => {
    const wrapper = detail(drifting, 'map:3:ticket:1')
    await wrapper.find('.drift-entry .dismiss').trigger('click')
    const [[key]] = wrapper.emitted('dismiss') as [[string]]
    expect(key).toContain('map:3:ticket:1')
  })

  it('shows a free-form map as written, after the sections that were read', () => {
    const wrapper = detail(freeForm, 'map:2:map')
    // Nothing was read, so only the Drift section follows the body.
    expect(wrapper.findAll('.section h2').map((h) => h.text())).toEqual(['Drift'])
    expect(wrapper.find('.free-form').text()).toContain(
      "This map's body isn't in the current form; shown as written.",
    )
    expect(wrapper.find('.free-form .raw').text()).toBe('Just some prose about billing.')
  })
})
