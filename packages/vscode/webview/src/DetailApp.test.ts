import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'

import type { Detail, HostMessage } from '../../src/protocol.ts'
import DetailApp from './DetailApp.vue'

const NO_START = { key: 'repo', actions: [], note: null }
const postMessage = vi.fn()
// The webview host hands out its API once per page; the stub stands in for it.
vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage }))

const detail: Detail = {
  kind: 'ticket',
  key: 'map:1:ticket:1',
  number: 1,
  title: 'Which database?',
  state: 'open',
  place: 'frontier',
  type: 'grilling',
  mode: 'HITL',
  claim: null,
  url: null,
  body: '## Question\n\nPostgres or SQLite?',
  resolution: null,
  waitsOn: [],
  clearsWayFor: [{ number: 2, title: 'Refund policy', state: 'open', key: 'map:1:ticket:2' }],
  session: { kind: 'none' },
  disagreement: null,
  actions: [],
  drift: [],
}

const fromHost = (message: HostMessage): void => {
  window.dispatchEvent(new MessageEvent('message', { data: message }))
}

describe('the Detail app', () => {
  it('asks the host for the Detail once mounted, and follows what it is sent', async () => {
    const wrapper = mount(DetailApp)
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready' })
    expect(wrapper.text()).toBe('Select a ticket or a map in the Tree.')

    fromHost({ type: 'detail', view: { detail, section: null, scroll: 1 } })
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('#1 Which database?')

    // The Tree's view models are not its business.
    fromHost({
      type: 'view-model',
      viewModel: { kind: 'message', message: 'No maps', detail: null, start: NO_START },
    })
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('#1 Which database?')
    wrapper.unmount()
  })

  it('posts a neighbour click as a reveal, the issue as open and a link as open-link', async () => {
    const wrapper = mount(DetailApp)
    fromHost({ type: 'detail', view: { detail, section: null, scroll: 1 } })
    await flushPromises()
    postMessage.mockClear()

    await wrapper.find('.neighbour').trigger('click')
    await wrapper.find('.head .open').trigger('click')
    expect(postMessage.mock.calls).toEqual([
      [{ type: 'reveal', key: 'map:1:ticket:2' }],
      [{ type: 'open', key: 'map:1:ticket:1' }],
    ])
    wrapper.unmount()
  })
})
