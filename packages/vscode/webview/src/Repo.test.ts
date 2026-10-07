import { FileSystem, readLocalTracker } from '@hero-synergy/core'
import { mount } from '@vue/test-utils'
import { Effect } from 'effect'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { workspaceFiles } from '../../test/fixtures/workspace-files.ts'
import type { ViewModel } from '../../src/protocol.ts'
import { buildViewModel } from '../../src/view-model.ts'
import Tree from './Tree.vue'

const ROOT = '/home/ana/billing'

let local: Extract<ViewModel, { kind: 'maps' }>

beforeAll(async () => {
  const snapshot = await Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )
  local = buildViewModel(snapshot, new Set(['map:3'])) as typeof local
})

afterEach(() => vi.useRealTimers())

/** The fixture's maps as a GitHub tracker reports them, under a repo row. */
const onGitHub = (overrides: Partial<typeof local> = {}): ViewModel => ({
  ...local,
  repo: 'dbarjs/hero-synergy',
  ...overrides,
})

describe('the repo row', () => {
  it('names the repo and how old the read is, and refreshes when activated', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-07T00:05:00.000Z') })
    const wrapper = mount(Tree, {
      props: { viewModel: onGitHub({ collectedAt: '2026-10-07T00:00:00.000Z' }) },
    })
    const row = wrapper.find('.repo')
    expect(row.text()).toContain('dbarjs/hero-synergy')
    expect(row.text()).toContain('tracker read 5 min ago')
    await row.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('is absent on a local tracker', () => {
    expect(
      mount(Tree, { props: { viewModel: local } })
        .find('.repo')
        .exists(),
    ).toBe(false)
  })

  it('shows the reason and the fix of a failed collect above the maps it kept', () => {
    const wrapper = mount(Tree, {
      props: {
        viewModel: onGitHub({
          notice: { message: 'gh is not logged in to GitHub.', fix: 'Run `gh auth login`.' },
        }),
      },
    })
    const notice = wrapper.find('[role="alert"]')
    expect(notice.text()).toContain('gh is not logged in to GitHub.')
    expect(notice.text()).toContain('Run `gh auth login`.')
    expect(wrapper.text()).toContain('Cockpit colors')
  })

  it('shows no notice when the last collect worked', () => {
    expect(
      mount(Tree, { props: { viewModel: onGitHub() } })
        .find('[role="alert"]')
        .exists(),
    ).toBe(false)
  })
})
