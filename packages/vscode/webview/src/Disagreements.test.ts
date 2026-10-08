import {
  FileSystem,
  readLocalTracker,
  reduceSession,
  type SessionState,
  type Snapshot,
} from '@hero-synergy/core'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Effect } from 'effect'
import { beforeAll, describe, expect, it } from 'vite-plus/test'

import { NOT_LAUNCHING } from '../../src/launch.ts'
import { workspaceFiles } from '../../test/fixtures/workspace-files.ts'
import { buildViewModel } from '../../src/view-model.ts'
import Tree from './Tree.vue'

const ROOT = '/home/ana/billing'
const OPEN = new Set(['map:3', 'map:3:decisions'])

let snapshot: Snapshot

beforeAll(async () => {
  snapshot = await Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )
})

const startEvent = (ticket: number) => ({
  ticket: String(ticket),
  hook: 'SessionStart',
  session: 'A',
  detail: 'startup',
  at: null,
  payload: {},
})

/** A session in a terminal of ours, started at `at`. */
const live = (ticket: number, at: number): SessionState => {
  let state = reduceSession(undefined, { type: 'launched', at: 1 })
  state = reduceSession(state, { type: 'terminal', terminal: 7 })
  return reduceSession(state, { type: 'event', event: startEvent(ticket), at }) as SessionState
}

const render = (sessions: Record<string, SessionState>): VueWrapper =>
  mount(Tree, {
    props: {
      viewModel: buildViewModel(snapshot, OPEN, null, undefined, null, null, {
        ...NOT_LAUNCHING,
        sessions: new Map(Object.entries(sessions)),
      }),
    },
  })

const rowOf = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('[role="treeitem"]').find((row) => row.text().includes(text))

const FUTURE = Date.parse(new Date().toISOString()) + 60_000

describe('the Tree rows where the tracker and the session side disagree', () => {
  it('says "live · claim not on tracker yet" on a ticket whose session started after the snapshot', () => {
    const wrapper = render({ 'map:3:ticket:1': live(1, FUTURE) })
    expect(rowOf(wrapper, 'Palette')?.find('.disagreement').text()).toBe(
      'live · claim not on tracker yet',
    )
    // The ticket is held as claimed: the "claimed" label gives way to the disagreement.
    expect(rowOf(wrapper, 'Palette')?.find('.claimed').exists()).toBe(false)
    // The ▶ is on the next frontier ticket.
    expect(rowOf(wrapper, 'Contrast audit')?.find('.next').exists()).toBe(true)
    expect(rowOf(wrapper, 'Palette')?.find('.next').exists()).toBe(false)
  })

  it('warns "not claimed on the tracker" once a snapshot after the start still shows no claim', () => {
    const wrapper = render({ 'map:3:ticket:1': live(1, 1) })
    const text = rowOf(wrapper, 'Palette')?.find('.disagreement')
    expect(text?.text()).toBe('not claimed on the tracker')
    expect(text?.classes()).toContain('warning')
  })

  it('shows no disagreement on a ticket both sides call claimed', () => {
    const wrapper = render({ 'map:3:ticket:4': live(4, 1) })
    expect(rowOf(wrapper, 'Row density')?.find('.disagreement').exists()).toBe(false)
    expect(rowOf(wrapper, 'Row density')?.find('.claimed').text()).toBe('claimed')
  })

  it('shows a closed ticket with a live session in the Decisions fold as wrapping up, with its terminal', async () => {
    const wrapper = render({ 'map:3:ticket:5': live(5, 1) })
    const row = rowOf(wrapper, 'Icon set')
    expect(row?.find('.disagreement').text()).toBe('wrapping up')
    expect(row?.find('.session').text()).toContain('live')
    await row?.find('.focus-terminal').trigger('click')
    expect(wrapper.emitted('focusTerminal')).toEqual([['map:3:ticket:5']])
    // The fold says it too, for when it is closed.
    expect(rowOf(wrapper, 'Decisions')?.text()).toContain('1 wrapping up')
  })

  it('lists a session with no ticket in view in one row at the repo level, with focus terminal', async () => {
    const wrapper = render({ 'map:9:ticket:77': live(77, 1) })
    expect(rowOf(wrapper, 'Sessions without a ticket in view')?.text()).toContain('1')
    const row = rowOf(wrapper, '#77')
    expect(row?.find('.session').text()).toContain('live')
    await row?.find('.focus-terminal').trigger('click')
    expect(wrapper.emitted('focusTerminal')).toEqual([['map:9:ticket:77']])
  })

  it('shows the ended record of a session with no ticket', () => {
    const ended = reduceSession(live(77, 1), { type: 'vanished', at: 5 }) as SessionState
    const wrapper = render({ 'unlisted:ticket:77': ended })
    expect(rowOf(wrapper, '#77')?.find('.session').text()).toBe('ended · process gone')
  })

  it('has no such row when every session has its ticket', () => {
    const wrapper = render({ 'map:3:ticket:1': live(1, 1) })
    expect(rowOf(wrapper, 'Sessions without a ticket in view')).toBeUndefined()
  })
})
