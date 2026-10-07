import { FileSystem, readLocalTracker, type Snapshot } from '@hero-synergy/core'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Effect } from 'effect'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { workspaceFiles } from '../../test/fixtures/workspace-files.ts'
import type { DetailView, MapSection } from '../../src/protocol.ts'
import { detailOf } from '../../src/view-model.ts'
import Detail from './Detail.vue'

const ROOT = '/home/ana/billing'

let snapshot: Snapshot

beforeAll(async () => {
  snapshot = await Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )
})

const render = (key: string | null, section: MapSection | null = null, scroll = 0): VueWrapper =>
  mount(Detail, {
    props: { view: { detail: detailOf(snapshot, key), section, scroll } satisfies DetailView },
    // Scrolling finds the section by its id in the document.
    attachTo: document.body,
  })

afterEach(() => {
  document.body.innerHTML = ''
})

const withBody = (body: string): VueWrapper => {
  const detail = detailOf(snapshot, 'map:3:ticket:1')
  if (detail?.kind !== 'ticket') throw new Error('expected a ticket')
  return mount(Detail, {
    props: { view: { detail: { ...detail, body }, section: null, scroll: 0 } },
  })
}

describe('the Detail of a ticket', () => {
  it('shows the header, the neighbourhood columns, and the body as Markdown', () => {
    const wrapper = render('map:3:ticket:1')
    expect(wrapper.find('h1').text()).toBe('#1 Palette')
    const facts = Object.fromEntries(
      wrapper.findAll('.fact').map((fact) => [fact.find('dt').text(), fact.find('dd').text()]),
    )
    expect(facts).toEqual({
      State: 'open',
      Place: 'frontier',
      Type: 'prototype · HITL',
      Claim: 'unclaimed',
    })

    const [waitsOn, clears] = wrapper.findAll('.neighbourhood .column')
    expect(waitsOn?.find('h2').text()).toBe('Waits on')
    expect(waitsOn?.text()).toContain('Nothing.')
    expect(clears?.find('h2').text()).toBe('Clears the way for')
    expect(clears?.findAll('.neighbour').map((n) => n.text())).toEqual(['#2 Dark mode open'])

    // The body went through the renderer: the `## Question` is a heading, not text.
    expect(wrapper.find('.body h2').text()).toBe('Question')
    expect(wrapper.find('.body').text()).toContain('Which five colors')
    expect(wrapper.find('.resolution').exists()).toBe(false)
  })

  it('shows what a blocked ticket waits on', () => {
    const wrapper = render('map:3:ticket:2')
    const [waitsOn, clears] = wrapper.findAll('.neighbourhood .column')
    expect(waitsOn?.findAll('.neighbour').map((n) => n.text())).toEqual(['#1 Palette open'])
    expect(clears?.text()).toContain('Nothing.')
  })

  it('shows a closed ticket with its resolution', () => {
    const wrapper = render('map:3:ticket:5')
    expect(wrapper.find('h1').text()).toBe('#5 Icon set')
    expect(wrapper.find('.state dd, .fact.state dd').text()).toBe('closed')
    expect(wrapper.find('.resolution h2').text()).toBe('Resolution')
    expect(wrapper.find('.resolution').text()).toContain('Codicons: they ship with VS Code.')
  })

  it('selects a neighbour in the Tree when it is clicked', async () => {
    const wrapper = render('map:3:ticket:1')
    await wrapper.find('.clears-the-way .neighbour').trigger('click')
    expect(wrapper.emitted('reveal')).toEqual([['map:3:ticket:2']])
  })

  it('shows a blocker outside the map as plain text, since the Tree has no row for it', () => {
    const detail = detailOf(snapshot, 'map:3:ticket:2')
    if (detail?.kind !== 'ticket') throw new Error('expected a ticket')
    const wrapper = mount(Detail, {
      props: {
        view: {
          detail: {
            ...detail,
            waitsOn: [{ number: 77, title: 'Elsewhere', state: 'open', key: null }],
          },
          section: null,
          scroll: 0,
        },
      },
    })
    expect(wrapper.find('.waits-on button').exists()).toBe(false)
    expect(wrapper.find('.waits-on .outside').text()).toContain('#77 Elsewhere')
  })

  it('asks the host to open the issue', async () => {
    const wrapper = render('map:3:ticket:1')
    await wrapper.find('.head .open').trigger('click')
    expect(wrapper.emitted('open')).toEqual([['map:3:ticket:1']])
  })

  it('does not run HTML in a body, and hands a clicked link to the host', async () => {
    const wrapper = withBody(
      '<img src=x onerror="alert(1)"><script>alert(2)</script>\n\n[spec](https://example.com/spec) and [bad](javascript:alert(3))',
    )
    expect(wrapper.find('.body img').exists()).toBe(false)
    expect(wrapper.find('.body script').exists()).toBe(false)
    expect(wrapper.find('.body').text()).toContain('<script>alert(2)</script>')
    // A link markdown-it refuses is left as text, so there is only the one anchor.
    const anchors = wrapper.findAll('.body a')
    expect(anchors).toHaveLength(1)
    await anchors[0]?.trigger('click')
    expect(wrapper.emitted('link')).toEqual([['https://example.com/spec']])
  })

  it('tells a body with nothing in it', () => {
    expect(withBody('  \n').find('.body').text()).toBe('No body.')
  })

  it('invites a selection when there is none', () => {
    expect(render(null).text()).toBe('Select a ticket or a map in the Tree.')
  })
})

describe('the Detail of a map', () => {
  it('shows the destination, decisions so far, fog and out of scope', () => {
    const wrapper = render('map:3:map')
    expect(wrapper.find('h1').text()).toBe('#3 Cockpit colors')
    expect(wrapper.find('.counts').text()).toBe('2 takeable · 1/5 decided')
    expect(wrapper.findAll('.section h2').map((h) => h.text())).toEqual([
      'Destination',
      'Decisions so far',
      'Not yet specified',
      'Out of scope',
    ])
    expect(wrapper.find('.destination').text()).toContain('A palette for the Cockpit')
    expect(wrapper.find('.decisions').text()).toContain('#5 Icon set')
    expect(wrapper.find('.decisions').text()).toContain('Codicons: they ship with VS Code')
    expect(wrapper.find('.fog').text()).toContain('Spacing, once the palette is fixed.')
    expect(wrapper.find('.out-of-scope').text()).toContain('Custom user themes')
  })

  it('selects a decision in the Tree when it is clicked', async () => {
    const wrapper = render('map:3:map')
    await wrapper.find('.decisions .neighbour').trigger('click')
    expect(wrapper.emitted('reveal')).toEqual([['map:3:ticket:5']])
  })

  it('says what a map has not got yet', () => {
    const wrapper = render('map:2:map')
    expect(wrapper.find('.out-of-scope').text()).toContain('Nothing.')
    const empty = detailOf(snapshot, 'map:1:map')
    expect(empty?.kind).toBe('map')
  })

  it.each([
    ['fog', '.fog'],
    ['decisions', '.decisions'],
    ['out-of-scope', '.out-of-scope'],
    ['destination', '.destination'],
  ] as const)('scrolls to and marks the %s section it is asked for', async (section, selector) => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const wrapper = render('map:3:map', section)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find(selector).classes()).toContain('targeted')
    expect(wrapper.findAll('.targeted')).toHaveLength(1)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(wrapper.find(selector).element)
  })

  it('scrolls again when the same section is asked for again', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const view: DetailView = { detail: detailOf(snapshot, 'map:3:map'), section: 'fog', scroll: 1 }
    const wrapper: VueWrapper = mount(Detail, { props: { view }, attachTo: document.body })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ view: { ...view, scroll: 2 } })
    await wrapper.vm.$nextTick()
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })
})
