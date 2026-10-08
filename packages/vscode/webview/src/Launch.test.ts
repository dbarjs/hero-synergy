import { FileSystem, readLocalTracker, type Snapshot } from '@hero-synergy/core'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Effect } from 'effect'
import { beforeAll, describe, expect, it } from 'vite-plus/test'

import { workspaceFiles } from '../../test/fixtures/workspace-files.ts'
import { type Launching, NOT_LAUNCHING } from '../../src/launch.ts'
import type { SessionState, SessionStatus } from '../../src/session.ts'
import { buildViewModel, detailOf } from '../../src/view-model.ts'
import Detail from './Detail.vue'
import Tree from './Tree.vue'

const ROOT = '/home/ana/billing'
const OPEN = new Set(['map:2', 'map:3'])
const PALETTE = 'map:3:ticket:1'

let snapshot: Snapshot

beforeAll(async () => {
  snapshot = await Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )
})

const BASE = { sessionId: null, finished: [] }
const starting: SessionState = { ...BASE, kind: 'starting', terminal: 1, hint: false }
const live = (status: SessionStatus | null = null): SessionState => ({
  ...BASE,
  kind: 'live',
  terminal: 1,
  status,
  since: Date.now() - 12_000,
})
const ended = (detail: string): SessionState => ({
  ...BASE,
  kind: 'ended',
  terminal: 1,
  detail,
  known: true,
  since: Date.now() - 90_000,
})

const launchable = (sessions: Record<string, SessionState> = {}): Launching => ({
  sessions: new Map(Object.entries(sessions)),
  claude: { kind: 'found', claude: { path: '/opt/claude', source: 'setting', shim: false } },
  wayfinder: '/wayfinder',
  toSpec: '/to-spec',
  setup: '/setup-matt-pocock-skills',
  userInvoked: 3,
  pluginPath: '/ext/claude-plugin',
  eventsFile: '/storage/events/repo.jsonl',
})

const render = (launching: Launching, selected: string | null = null): VueWrapper =>
  mount(Tree, {
    props: {
      viewModel: buildViewModel(snapshot, OPEN, selected, undefined, null, null, launching),
    },
  })

const rowOf = (wrapper: VueWrapper, label: string) =>
  wrapper.findAll('[role="treeitem"]').find((row) => row.find('.label').text().includes(label))

describe('▶ on the Tree rows', () => {
  it('shows on frontier and claimed rows, never on blocked rows, an unfinished ⚑ Map or folds', () => {
    const wrapper = render(launchable())
    const withPlay = wrapper
      .findAll('[role="treeitem"]')
      .filter((row) => row.find('.play').exists())
      .map((row) => row.find('.label').text())
    expect(withPlay).toEqual(
      expect.arrayContaining(['#1 Palette', '#3 Contrast audit', '#4 Row density']),
    )
    expect(withPlay).not.toContain('#2 Dark mode')
    expect(withPlay.every((label) => /^#\d+ /.test(label))).toBe(true)
    expect(rowOf(wrapper, '#2 Dark mode')?.find('.play').exists()).toBe(false)
  })

  it('is Work ticket on a frontier row and Launch fresh on a claimed one', () => {
    const wrapper = render(launchable())
    expect(rowOf(wrapper, '#1 Palette')?.find('.play').attributes('aria-label')).toBe(
      'Work ticket #1',
    )
    expect(rowOf(wrapper, '#4 Row density')?.find('.play').attributes('aria-label')).toBe(
      'Launch fresh #4',
    )
  })

  it('carries the exact command in its tooltip', () => {
    const play = rowOf(render(launchable()), '#1 Palette')?.find('.play')
    expect(play?.attributes('title')).toMatch(
      /^claude -n '#1 Palette' --plugin-dir \/ext\/claude-plugin '\/wayfinder \.scratch\/cockpit-colors\/map\.md /,
    )
  })

  it('launches the ticket on click without selecting the row', async () => {
    const wrapper = render(launchable())
    await rowOf(wrapper, '#1 Palette')?.find('.play').trigger('click')
    expect(wrapper.emitted('launch')).toEqual([[PALETTE, 'work-ticket']])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('stays greyed with the reason and launches nothing when claude cannot be resolved', async () => {
    const wrapper = render(NOT_LAUNCHING)
    const play = rowOf(wrapper, '#1 Palette')?.find('.play')
    expect(play?.attributes('aria-disabled')).toBe('true')
    expect(play?.attributes('title')).toBe('claude was not found.')
    await play?.trigger('click')
    expect(wrapper.emitted('launch')).toBeUndefined()
  })
})

describe('a ticket with a session', () => {
  it('swaps ▶ for focus terminal while starting', async () => {
    const wrapper = render(launchable({ [PALETTE]: starting }))
    const row = rowOf(wrapper, '#1 Palette')
    expect(row?.find('.play').exists()).toBe(false)
    expect(row?.find('.session').text()).toBe('starting')
    await row?.find('.focus-terminal').trigger('click')
    expect(wrapper.emitted('focusTerminal')).toEqual([[PALETTE]])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('shows a live session with its word and the time since its last status event', async () => {
    const wrapper = render(launchable({ [PALETTE]: live() }))
    const row = rowOf(wrapper, '#1 Palette')
    expect(row?.find('.play').exists()).toBe(false)
    expect(row?.find('.session').text()).toBe('live · 12s')
    expect(row?.find('.session').classes()).not.toContain('needs')
    await row?.find('.focus-terminal').trigger('click')
    expect(wrapper.emitted('focusTerminal')).toEqual([[PALETTE]])
  })

  it('marks a session that needs me', () => {
    const row = rowOf(render(launchable({ [PALETTE]: live('failed') })), '#1 Palette')
    expect(row?.find('.session').text()).toBe('failed · 12s')
    expect(row?.find('.session').classes()).toContain('needs')
  })

  it('says a quiet terminal has no status yet, with the whole hint on hover', () => {
    const quiet: SessionState = { ...starting, hint: true } as SessionState
    const row = rowOf(render(launchable({ [PALETTE]: quiet })), '#1 Palette')
    expect(row?.find('.session').text()).toBe('starting · no status yet')
    expect(row?.find('.session').attributes('title')).toContain('trust dialog')
  })

  it('says ended with the detail on hover and offers ▶ again', () => {
    const row = rowOf(render(launchable({ [PALETTE]: ended('exited with code 3') })), '#1 Palette')
    expect(row?.find('.session').text()).toBe('ended · exited with code 3')
    expect(row?.find('.session').attributes('title')).toBe('exited with code 3, 1m ago')
    expect(row?.find('.play').exists()).toBe(true)
  })
})

describe('the command in the Focus pane', () => {
  it('shows the command whole in a code block, the env on a muted second line, and the shared checkout note', () => {
    const wrapper = render(launchable(), PALETTE)
    const command = wrapper.find('.pane .command').text()
    expect(command).toBe(rowOf(wrapper, '#1 Palette')?.find('.play').attributes('title'))
    expect(command).toContain('--plugin-dir /ext/claude-plugin')
    expect(wrapper.find('.pane .env').text()).toBe(
      'env: HERO_SYNERGY_TICKET=1 HERO_SYNERGY_EVENTS=/storage/events/repo.jsonl',
    )
    expect(wrapper.find('.pane .shared').text()).toBe(
      'No worktree on a local tracker: this session shares the checkout.',
    )
  })

  it('has a Work ticket button and a copy button that post the ticket', async () => {
    const wrapper = render(launchable(), PALETTE)
    await wrapper.find('.pane .run').trigger('click')
    await wrapper.find('.pane .copy').trigger('click')
    expect(wrapper.emitted('launch')).toEqual([[PALETTE, 'work-ticket']])
    expect(wrapper.emitted('copy')).toEqual([[PALETTE, 'work-ticket']])
  })

  it('greys the button with the reason and keeps the command when claude is missing', async () => {
    const wrapper = render({ ...NOT_LAUNCHING, wayfinder: '/wayfinder' }, PALETTE)
    expect(wrapper.find('.pane .run').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('.pane .reason').text()).toBe('claude was not found.')
    expect(wrapper.find('.pane .command').exists()).toBe(true)
    await wrapper.find('.pane .run').trigger('click')
    expect(wrapper.emitted('launch')).toBeUndefined()
  })

  it('shows no command block, no copy and the reason when the wayfinder skill is missing', () => {
    const wrapper = render({ ...launchable(), wayfinder: null }, PALETTE)
    expect(wrapper.find('.pane .command').exists()).toBe(false)
    expect(wrapper.find('.pane .copy').exists()).toBe(false)
    expect(wrapper.find('.pane .reason').text()).toContain('wayfinder skill was not found')
  })

  it('shows no command for a blocked ticket, and Launch fresh for one claimed elsewhere', () => {
    expect(render(launchable(), 'map:3:ticket:2').find('.pane .action').exists()).toBe(false)
    const claimed = render(launchable(), 'map:3:ticket:4')
    expect(claimed.findAll('.pane .action')).toHaveLength(1)
    expect(claimed.find('.pane .run').text()).toBe('Launch fresh')
  })

  it('lists Launch fresh then Resume by name once the session ended, each posting its own id', async () => {
    const wrapper = render(launchable({ [PALETTE]: ended('window closed') }), PALETTE)
    expect(wrapper.findAll('.pane .run').map((button) => button.text())).toEqual([
      'Launch fresh',
      'Resume by name',
    ])
    await wrapper.findAll('.pane .run')[1]?.trigger('click')
    await wrapper.findAll('.pane .copy')[1]?.trigger('click')
    expect(wrapper.emitted('launch')).toEqual([[PALETTE, 'resume-by-name']])
    expect(wrapper.emitted('copy')).toEqual([[PALETTE, 'resume-by-name']])
    expect(wrapper.findAll('.pane .command')[1]?.text()).toBe("claude --resume '#1 Palette'")
  })

  it('swaps the command for the session state, with focus terminal, while starting', async () => {
    const wrapper = render(launchable({ [PALETTE]: starting }), PALETTE)
    expect(wrapper.find('.pane .action').exists()).toBe(false)
    expect(wrapper.find('.pane .session dd').text()).toContain('starting')
    await wrapper.find('.pane .session .link').trigger('click')
    expect(wrapper.emitted('focusTerminal')).toEqual([[PALETTE]])
  })

  it('shows the live status word with its age in the pane', async () => {
    const wrapper = render(launchable({ [PALETTE]: live('failed') }), PALETTE)
    expect(wrapper.find('.pane .session dd').text()).toContain('failed · 12s ago')
    await wrapper.find('.pane .session .link').trigger('click')
    expect(wrapper.emitted('focusTerminal')).toEqual([[PALETTE]])
  })

  it('shows the hint in the pane once the terminal has been quiet', () => {
    const quiet: SessionState = { ...starting, hint: true } as SessionState
    const wrapper = render(launchable({ [PALETTE]: quiet }), PALETTE)
    expect(wrapper.find('.pane .session .hint').text()).toBe(
      'no status yet, the session may be waiting at the trust dialog, open the terminal',
    )
  })

  it('says how a session ended', () => {
    const wrapper = render(launchable({ [PALETTE]: ended('window closed') }), PALETTE)
    expect(wrapper.find('.pane .session dd').text()).toBe('ended: window closed · 1m ago')
  })
})

describe('To spec on a finished map', () => {
  const FINISHED = new Set(['map:2', 'map:3', 'finished', 'map:1'])
  const renderFinished = (launching: Launching, selected: string | null = null): VueWrapper =>
    mount(Tree, {
      props: {
        viewModel: buildViewModel(snapshot, FINISHED, selected, undefined, null, null, launching),
      },
    })
  const mapRow = (wrapper: VueWrapper, selector: string) =>
    wrapper.findAll('[role="treeitem"]').filter((row) => row.find(selector).exists())

  it('puts ▶ on the ⚑ Map row of the finished map only, with the command in its tooltip', async () => {
    const wrapper = renderFinished(launchable())
    const rows = mapRow(wrapper, '.play').filter((row) =>
      row.find('.label').text().startsWith('Map'),
    )
    expect(rows).toHaveLength(1)
    const play = rows[0]?.find('.play')
    expect(play?.attributes('aria-label')).toBe('To spec #1')
    expect(play?.attributes('title')).toBe("claude '/to-spec .scratch/archive-search/map.md'")
    await play?.trigger('click')
    expect(wrapper.emitted('launch')).toEqual([['map:1:map', 'to-spec']])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('shows To spec with its command in the pane, and nothing in an unfinished map pane', () => {
    const finished = renderFinished(launchable(), 'map:1:map')
    expect(finished.find('.pane .run').text()).toBe('To spec')
    expect(finished.find('.pane .command').text()).toBe(
      "claude '/to-spec .scratch/archive-search/map.md'",
    )
    expect(renderFinished(launchable(), 'map:3:map').find('.pane .action').exists()).toBe(false)
  })

  it('greys it with the reason when the to-spec skill is not found', async () => {
    const wrapper = renderFinished({ ...launchable(), toSpec: null }, 'map:1:map')
    expect(wrapper.find('.pane .run').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('.pane .reason').text()).toContain('to-spec skill was not found')
    await wrapper.find('.pane .run').trigger('click')
    expect(wrapper.emitted('launch')).toBeUndefined()
  })

  it('shows it in the Detail of the finished map', async () => {
    const wrapper = mount(Detail, {
      props: {
        view: { detail: detailOf(snapshot, 'map:1:map', launchable()), section: null, scroll: 0 },
      },
    })
    expect(wrapper.find('.run').text()).toBe('To spec')
    await wrapper.find('.run').trigger('click')
    expect(wrapper.emitted('launch')).toEqual([['map:1:map', 'to-spec']])
  })
})

describe('the command in the Detail', () => {
  const renderDetail = (launching: Launching): VueWrapper =>
    mount(Detail, {
      props: { view: { detail: detailOf(snapshot, PALETTE, launching), section: null, scroll: 0 } },
    })

  it('shows the same command as the Tree row, with copy and the Work ticket button', async () => {
    const tree = render(launchable())
    const wrapper = renderDetail(launchable())
    expect(wrapper.find('.command').text()).toBe(
      rowOf(tree, '#1 Palette')?.find('.play').attributes('title'),
    )
    expect(wrapper.find('.env').text()).toContain('HERO_SYNERGY_TICKET=1')
    await wrapper.find('.run').trigger('click')
    await wrapper.find('.copy').trigger('click')
    expect(wrapper.emitted('launch')).toEqual([[PALETTE, 'work-ticket']])
    expect(wrapper.emitted('copy')).toEqual([[PALETTE, 'work-ticket']])
  })

  it('offers focus terminal while starting, and no command', async () => {
    const wrapper = renderDetail(launchable({ [PALETTE]: starting }))
    expect(wrapper.find('.command').exists()).toBe(false)
    await wrapper.find('.session .link').trigger('click')
    expect(wrapper.emitted('focusTerminal')).toEqual([[PALETTE]])
  })
})
