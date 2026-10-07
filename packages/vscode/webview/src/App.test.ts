import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'

import type { HostMessage, MapNode } from '../../src/protocol.ts'
import App from './App.vue'

const postMessage = vi.fn()
// The webview host hands out its API once per page; the stub stands in for it.
vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage }))

const map: MapNode = {
  key: 'map:1',
  number: 1,
  title: 'Billing rewrite',
  expanded: false,
  focusKey: 'map:1:map',
  takeable: 1,
  decided: 0,
  total: 2,
  destination: null,
  tickets: [],
  fog: { key: 'map:1:fog', expanded: false, entries: [] },
  decisions: { key: 'map:1:decisions', expanded: false, entries: [] },
}

const fromHost = (message: HostMessage): void => {
  window.dispatchEvent(new MessageEvent('message', { data: message }))
}

describe('the Cockpit app', () => {
  it('asks the host for the view model once it has mounted, and shows what it gets', async () => {
    const wrapper = mount(App)
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready' })
    expect(wrapper.text()).toBe('Reading the tracker…')

    fromHost({
      type: 'view-model',
      viewModel: {
        kind: 'maps',
        collectedAt: '2026-10-07T00:00:00.000Z',
        repo: null,
        notice: null,
        maps: [map],
        finished: null,
        selection: null,
      },
    })
    await flushPromises()
    expect(wrapper.find('[role="treeitem"] .label').text()).toBe('#1 Billing rewrite')
    wrapper.unmount()
  })

  it('tells the host which node the user opened or closed', async () => {
    postMessage.mockClear()
    const wrapper = mount(App)
    fromHost({
      type: 'view-model',
      viewModel: {
        kind: 'maps',
        collectedAt: '2026-10-07T00:00:00.000Z',
        repo: null,
        notice: null,
        maps: [map, { ...map, key: 'map:2', number: 2, expanded: true }],
        finished: null,
        selection: null,
      },
    })
    await flushPromises()
    const [closed, open] = wrapper.findAll('[role="treeitem"]')
    await closed?.trigger('click')
    await open?.trigger('click')
    expect(postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: 'ready' },
      { type: 'expand', key: 'map:1' },
      { type: 'collapse', key: 'map:2' },
    ])
    wrapper.unmount()
  })

  it('stops listening to the host once it is gone', async () => {
    const wrapper = mount(App)
    wrapper.unmount()
    fromHost({ type: 'view-model', viewModel: { kind: 'message', message: 'late', detail: null } })
    await flushPromises()
    expect(wrapper.html()).not.toContain('late')
  })
})
