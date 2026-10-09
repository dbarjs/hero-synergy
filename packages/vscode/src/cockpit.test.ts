import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from '@effect/vitest'
import {
  FileSystem,
  type ProcessRecording,
  readLocalTracker,
  ProcessRunner,
  type ProcessRunnerShape,
  renderCommand,
} from '@hero-synergy/core'
import { Effect, Fiber, Layer } from 'effect'
import { TestClock } from 'effect/testing'

import { workspaceFiles } from '../test/fixtures/workspace-files.ts'
import { type Cockpit, DISMISSED_KEY, EXPANDED_KEY, makeCockpit, SELECTED_KEY } from './cockpit.ts'
import type { DetailView, MapNode, ViewModel } from './protocol.ts'
import {
  type BypassSettings,
  Clipboard,
  CollectProgress,
  type EventsWatcherRecorder,
  EventsWatcher,
  HostEnvironment,
  type HostEnvironmentShape,
  Opener,
  Palette,
  type RegistryWatcherRecorder,
  RegistryWatcher,
  type SkillChoice,
  Storage,
  type TerminalRecorder,
  Terminals,
  WorkspaceFolders,
} from './services.ts'
import { CACHE_KEY, writeCache } from './snapshot-cache.ts'
import type { OpenTarget } from './view-model.ts'

const ROOT = '/home/ana/billing'

const inRepo = (folder: string, root: string): ProcessRecording => ({
  command: 'git',
  args: ['-C', folder, 'rev-parse', '--show-toplevel'],
  stdout: `${root}\n`,
  stderr: '',
  exitCode: 0,
})

const notARepo = (folder: string): ProcessRecording => ({
  command: 'git',
  args: ['-C', folder, 'rev-parse', '--show-toplevel'],
  stdout: '',
  stderr: 'fatal: not a git repository\n',
  exitCode: 128,
})

/** The version `claude --version` prints when a test records nothing for it: current, and not counted as a run. */
const CURRENT_CLAUDE = '2.1.300 (Claude Code)\n'

/** Answers from recordings like the replay layer does, and counts what it was asked to run. */
const countingRunner = (recordings: ReadonlyArray<ProcessRecording>, delayMillis = 0) => {
  let runs = 0
  const shape: ProcessRunnerShape = {
    run: (request) =>
      Effect.sleep(delayMillis).pipe(
        Effect.andThen(
          Effect.sync(() => {
            const recorded = recordings.find(
              (r) => r.command === request.command && r.args.join('\0') === request.args.join('\0'),
            )
            // The worktree reads are not collects: a repo with no recorded worktrees has none, uncounted.
            if (recorded === undefined && request.args.join(' ') === 'worktree list --porcelain') {
              return { stdout: '', stderr: '', exitCode: 0, timedOut: false }
            }
            if (recorded === undefined && request.args.join(' ') === '--version') {
              return { stdout: CURRENT_CLAUDE, stderr: '', exitCode: 0, timedOut: false }
            }
            runs += 1
            if (recorded === undefined) throw new Error(`not recorded: ${request.args.join(' ')}`)
            return { ...recorded, timedOut: recorded.timedOut ?? false }
          }),
        ),
      ),
  }
  return { layer: Layer.succeed(ProcessRunner, shape), runs: () => runs }
}

interface Setup {
  readonly files?: Record<string, string>
  readonly folders?: ReadonlyArray<string>
  /** Read at every run, so a test can change what the next collect gets. */
  readonly recordings?: ProcessRecording[]
  readonly stored?: Record<string, unknown>
  /** Each process takes this long on the test clock, so triggers can overlap a collect. */
  readonly delay?: number
  /** What the window says about `claude`, the plugin and the settings; nothing resolves by default. */
  readonly environment?: Partial<HostEnvironmentShape>
  /** What the Run skill… QuickPick chooses from the list it is shown; dismissed by default. */
  readonly choose?: (choices: ReadonlyArray<SkillChoice>) => string | null
  /** Whether Claude Code's sessions directory exists to be watched; default yes. */
  readonly registryDirectory?: boolean
  /** Storage across workspaces; windows given the same map share it, as one VS Code profile does. */
  readonly global?: Map<string, unknown>
}

/** Runs `body` against a Cockpit on the fixture workspace; every layer is in memory. */
const withCockpit = <A>(
  setup: Setup,
  body: (context: {
    cockpit: Cockpit
    published: ViewModel[]
    details: DetailView[]
    /** Each time the Detail panel was asked to open, with whether it should take focus. */
    shown: boolean[]
    logged: string[]
    opened: OpenTarget[]
    progress: { shown: number; open: number }
    runs: () => number
    fs: FileSystem['Service']
    terminals: TerminalRecorder
    copied: string[]
    /** The badge each time the Cockpit set it. */
    badges: number[]
    watcher: EventsWatcherRecorder
    /** The Run skill… QuickPicks shown, and the messages the palette commands gave. */
    palette: {
      picks: Array<{ title: string; choices: ReadonlyArray<SkillChoice> }>
      informed: string[]
    }
    registry: RegistryWatcherRecorder
  }) => Effect.Effect<
    A,
    never,
    Storage | WorkspaceFolders | FileSystem | ProcessRunner | Opener | CollectProgress
  >,
) => {
  const terminals = Terminals.inMemory()
  const watcher = EventsWatcher.inMemory()
  const registry = RegistryWatcher.inMemory(setup.registryDirectory ?? true)
  const copied: string[] = []
  const palette = { picks: [], informed: [] } as Parameters<typeof Palette.inMemory>[0]
  const runner = countingRunner(setup.recordings ?? [inRepo(ROOT, ROOT)], setup.delay)
  const opened: OpenTarget[] = []
  const progress = { shown: 0, open: 0 }
  const layer = Layer.mergeAll(
    Opener.inMemory(opened),
    CollectProgress.inMemory(progress),
    WorkspaceFolders.inMemory(setup.folders ?? [ROOT]),
    Storage.inMemory(setup.stored, setup.global),
    FileSystem.inMemory(setup.files ?? workspaceFiles(ROOT)),
    runner.layer,
    terminals.layer,
    watcher.layer,
    registry.layer,
    Clipboard.inMemory(copied),
    Palette.inMemory(palette, setup.choose),
    HostEnvironment.inMemory(setup.environment),
  )
  return Effect.gen(function* () {
    const published: ViewModel[] = []
    const logged: string[] = []
    const details: DetailView[] = []
    const shown: boolean[] = []
    const badges: number[] = []
    const cockpit = yield* makeCockpit({
      publish: (viewModel) => published.push(viewModel),
      publishDetail: (view) => details.push(view),
      showDetail: (focus) => shown.push(focus),
      badge: (count) => badges.push(count),
      log: (line) => logged.push(line),
    })
    const fs = yield* FileSystem
    return yield* body({
      cockpit,
      published,
      details,
      shown,
      logged,
      opened,
      progress,
      runs: runner.runs,
      fs,
      terminals: terminals.recorder,
      copied,
      badges,
      watcher: watcher.recorder,
      palette,
      registry: registry.recorder,
    })
  }).pipe(Effect.provide(layer))
}

const maps = (viewModel: ViewModel | undefined): ReadonlyArray<MapNode> => {
  if (viewModel?.kind !== 'maps') throw new Error(`expected maps, got ${viewModel?.kind}`)
  return viewModel.maps
}

describe('the Cockpit controller', () => {
  it.effect('renders nothing and spawns nothing until the view is shown', () =>
    withCockpit({}, ({ cockpit, published, runs }) =>
      Effect.gen(function* () {
        expect(published).toEqual([])
        expect(runs()).toBe(0)
        expect(yield* cockpit.current).toEqual({ kind: 'loading' })
      }),
    ),
  )

  it.effect('runs one collect when the view is shown and sends the view model', () =>
    withCockpit({}, ({ cockpit, published, runs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(runs()).toBe(1)
        expect(published).toHaveLength(1)
        expect(maps(published[0]).map((map) => `#${map.number} ${map.title}`)).toEqual([
          '#3 Cockpit colors',
          '#2 Billing rewrite',
        ])
      }),
    ),
  )

  it.effect(
    'answers a webview that just mounted with the current view model, collecting nothing',
    () =>
      withCockpit({}, ({ cockpit, published, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(yield* cockpit.receive({ type: 'ready' })).toBe(true)
          expect(runs()).toBe(1)
          expect(published).toHaveLength(2)
          expect(published[1]).toEqual(published[0])
        }),
      ),
  )

  it.effect('collects again on refresh and the Tree shows what changed', () =>
    withCockpit({}, ({ cockpit, published, runs, fs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(maps(published[0])[0]?.takeable).toBe(2)

        // Someone resolves the palette ticket: the prototype leaves the frontier, dark mode joins it.
        yield* fs
          .writeFile(
            `${ROOT}/.scratch/cockpit-colors/issues/01-palette.md`,
            '# Palette\n\nType: prototype\nStatus: resolved\n\n## Question\n\nWhich colors?\n\n## Answer\n\nFive.\n',
          )
          .pipe(Effect.orDie)
        expect(yield* cockpit.receive({ type: 'refresh' })).toBe(true)

        expect(runs()).toBe(2)
        const colors = maps(published.at(-1)).find((map) => map.number === 3)
        expect(colors?.tickets.map((t) => [t.number, t.place, t.next])).toEqual([
          [4, 'claimed', false],
          [2, 'frontier', true],
          [3, 'frontier', false],
        ])
      }),
    ),
  )

  it.effect('expands and collapses nodes, publishes each change and remembers them', () =>
    withCockpit({}, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(maps(published[0]).map((map) => map.expanded)).toEqual([true, false])

        yield* cockpit.receive({ type: 'expand', key: 'map:2' })
        yield* cockpit.receive({ type: 'expand', key: 'map:2:fog' })
        yield* cockpit.receive({ type: 'collapse', key: 'map:3' })
        const last = maps(published.at(-1))
        expect(last.map((map) => map.expanded)).toEqual([false, true])
        expect(last[1]?.fog.expanded).toBe(true)

        const storage = yield* Storage
        expect(new Set((yield* storage.get(EXPANDED_KEY)) as string[])).toEqual(
          new Set(['map:2', 'map:2:fog']),
        )
      }),
    ),
  )

  it.effect('keeps both of two expansions that arrive together', () =>
    withCockpit({}, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* Effect.all(
          [
            cockpit.receive({ type: 'expand', key: 'map:2' }),
            cockpit.receive({ type: 'expand', key: 'finished' }),
          ],
          { concurrency: 'unbounded' },
        )
        const last = published.at(-1)
        expect(maps(last).map((map) => map.expanded)).toEqual([true, true])
        expect(last?.kind === 'maps' && last.finished?.expanded).toBe(true)
      }),
    ),
  )

  it.effect('restores what was expanded, ignoring a stored value of the wrong shape', () =>
    Effect.gen(function* () {
      const restored = yield* withCockpit(
        { stored: { [EXPANDED_KEY]: ['map:2'] } },
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            return maps(published[0]).map((map) => map.expanded)
          }),
      )
      expect(restored).toEqual([false, true])

      const garbled = yield* withCockpit(
        { stored: { [EXPANDED_KEY]: [1, 2] } },
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            return maps(published[0]).map((map) => map.expanded)
          }),
      )
      expect(garbled).toEqual([true, false])
    }),
  )

  it.effect('selects one row, confirms it in the view model and remembers it', () =>
    withCockpit({}, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const selection = (): unknown => {
          const last = published.at(-1)
          return last?.kind === 'maps' ? last.selection : undefined
        }
        expect(selection()).toBeNull()

        yield* cockpit.receive({ type: 'select', key: 'map:3:ticket:4' })
        expect(selection()).toMatchObject({ kind: 'ticket', number: 4, state: 'open' })

        // Selecting another row replaces the first: there is one selection.
        yield* cockpit.receive({ type: 'select', key: 'map:3:map' })
        expect(selection()).toMatchObject({ kind: 'map', number: 3, title: 'Cockpit colors' })
        expect(yield* (yield* Storage).get(SELECTED_KEY)).toBe('map:3:map')

        yield* cockpit.receive({ type: 'select', key: null })
        expect(selection()).toBeNull()
        expect(yield* (yield* Storage).get(SELECTED_KEY)).toBeNull()
      }),
    ),
  )

  it.effect('restores the selected row and the expanded maps after a reload', () =>
    withCockpit(
      { stored: { [EXPANDED_KEY]: ['map:2'], [SELECTED_KEY]: 'map:2:map' } },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const shown = published[0]
          expect(maps(shown).map((map) => map.expanded)).toEqual([false, true])
          expect(shown?.kind === 'maps' && shown.selection).toMatchObject({
            kind: 'map',
            number: 2,
          })
        }),
    ),
  )

  it.effect(
    'keeps a dismissed drift entry hidden after a reload, and shows it again when its detail changes',
    () => {
      // Dark mode waits on a name, not a number: a loud `blockers-as-slugs` whose detail is the name.
      const filesWith = (slug: string): Record<string, string> => ({
        ...workspaceFiles(ROOT),
        [`${ROOT}/.scratch/cockpit-colors/issues/02-dark-mode.md`]: `# Dark mode\n\nType: research\nBlocked by: 01, ${slug}\n\n## Question\n\nDoes it?\n`,
      })
      const loudOfMap3 = (viewModel: ViewModel | undefined): string | null | undefined =>
        maps(viewModel).find((map) => map.number === 3)?.loud
      return Effect.gen(function* () {
        const stored = yield* withCockpit(
          { files: filesWith('palette-colors') },
          ({ cockpit, published, details }) =>
            Effect.gen(function* () {
              yield* cockpit.show
              expect(loudOfMap3(published.at(-1))).toBe('1 loud warning on 1 ticket')
              yield* cockpit.receive({ type: 'select', key: 'map:3:ticket:2' })
              const shown = details.at(-1)?.detail
              const entry = shown?.kind === 'ticket' ? shown.drift[0]?.entries[0] : undefined
              expect(entry).toMatchObject({ code: 'blockers-as-slugs', detail: 'palette-colors' })
              expect(
                yield* cockpit.receive({ type: 'dismiss-drift', dismissKey: entry?.dismissKey }),
              ).toBe(true)
              expect(loudOfMap3(published.at(-1))).toBeNull()
              const saved = yield* (yield* Storage).get(DISMISSED_KEY)
              expect(saved).toEqual([entry?.dismissKey])
              return { [DISMISSED_KEY]: saved }
            }),
        )

        // After a reload the dismissal comes back from the workspace state.
        yield* withCockpit(
          { files: filesWith('palette-colors'), stored },
          ({ cockpit, published }) =>
            Effect.gen(function* () {
              yield* cockpit.show
              expect(loudOfMap3(published.at(-1))).toBeNull()
            }),
        )

        // The ticket now waits on another name: a new detail, so the entry shows again.
        yield* withCockpit({ files: filesWith('dark-palette'), stored }, ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            expect(loudOfMap3(published.at(-1))).toBe('1 loud warning on 1 ticket')
          }),
        )
      })
    },
  )

  it.effect('shows no pane for a stored selection that no longer exists', () =>
    withCockpit({ stored: { [SELECTED_KEY]: 'map:9:ticket:9' } }, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(published[0]).toMatchObject({ kind: 'maps', selection: null })
      }),
    ),
  )

  it.effect('opens the selected ticket as its file on a local tracker, and a map as its file', () =>
    withCockpit({}, ({ cockpit, opened }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'open', key: 'map:3:ticket:4' })
        yield* cockpit.receive({ type: 'open', key: 'map:3:map' })
        yield* cockpit.receive({ type: 'open', key: 'map:3:ticket:99' })
        expect(opened).toHaveLength(2)
        expect(opened[0]).toMatchObject({ kind: 'file' })
        expect(opened[0]?.kind === 'file' && opened[0].path).toMatch(
          new RegExp(`^${ROOT}/\\.scratch/cockpit-colors/issues/`),
        )
        expect(opened[1]?.kind === 'file' && opened[1].path.startsWith(ROOT)).toBe(true)
      }),
    ),
  )

  it.effect.each([
    ['select without a key', { type: 'select' }],
    ['open without a key', { type: 'open' }],
    ['open with a null key', { type: 'open', key: null }],
    ['null', null],
    ['a string', 'refresh'],
    ['no type', { key: 'map:1' }],
    ['an unknown type', { type: 'run-action', key: 'map:1' }],
    ['expand without a key', { type: 'expand' }],
    ['a key that is not a string', { type: 'collapse', key: 3 }],
  ])('rejects a malformed message: %s', ([, message]) =>
    withCockpit({}, ({ cockpit, published, logged, runs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const before = published.length
        expect(yield* cockpit.receive(message)).toBe(false)
        expect(published).toHaveLength(before)
        expect(runs()).toBe(1)
        const rejected = logged.filter((line) => line.startsWith('Rejected'))
        expect(rejected).toHaveLength(1)
        expect(rejected[0]).toContain('Rejected a malformed message')
      }),
    ),
  )
})

describe('the Cockpit controller when there is nothing to show', () => {
  const messageOf = (viewModel: ViewModel | undefined) => {
    if (viewModel?.kind !== 'message') throw new Error(`expected a message, got ${viewModel?.kind}`)
    return viewModel
  }

  it.effect('says so when no workspace folder is in a git repository', () =>
    withCockpit({ recordings: [notARepo(ROOT)] }, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(messageOf(published[0]).message).toBe('No git repository to show.')
      }),
    ),
  )

  it.effect('shows the setup message for a repo without a tracker doc', () =>
    withCockpit({ files: { [`${ROOT}/README.md`]: '# billing\n' } }, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const shown = messageOf(published[0])
        expect(shown.message).toBe('This repo has no issue tracker set up.')
        expect(shown.detail).toContain('/setup-matt-pocock-skills')
      }),
    ),
  )

  it.effect('says a tracker it does not read is not read', () =>
    withCockpit(
      { files: { [`${ROOT}/docs/agents/issue-tracker.md`]: '# Issue tracker: GitLab\n' } },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(messageOf(published[0]).message).toBe('The Cockpit does not read GitLab trackers.')
        }),
    ),
  )

  it.effect('shows no maps for a local tracker with no efforts yet, and no message', () =>
    withCockpit(
      { files: { [`${ROOT}/docs/agents/issue-tracker.md`]: '# Issue tracker: Local Markdown\n' } },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(published[0]).toMatchObject({ kind: 'maps', maps: [], finished: null })
        }),
    ),
  )
})

const coreFixtures = resolve(dirname(fileURLToPath(import.meta.url)), '../../core/fixtures')
const recorded = (path: string): ProcessRecording =>
  JSON.parse(readFileSync(resolve(coreFixtures, path), 'utf8')) as ProcessRecording

const GITHUB_DOC = { [`${ROOT}/docs/agents/issue-tracker.md`]: '# Issue tracker: GitHub\n' }
const remotes = (url: string): ProcessRecording => ({
  command: 'git',
  args: ['-C', ROOT, 'remote', '-v'],
  stdout: `origin\t${url} (fetch)\norigin\t${url} (push)\n`,
  stderr: '',
  exitCode: 0,
})
const origin = (url: string): ProcessRecording => ({
  ...recorded('process/git-remote-get-url-origin.json'),
  stdout: `${url}\n`,
})
const REPO_URL = 'https://github.com/dbarjs/hero-synergy.git'

/** What a window on this repo's own GitHub tracker runs, with the recorded gh answers. */
const onGitHub = (...gh: ProcessRecording[]): ProcessRecording[] => [
  inRepo(ROOT, ROOT),
  remotes(REPO_URL),
  origin(REPO_URL),
  ...gh,
]
const goodCollect = (): ProcessRecording[] => [
  recorded('github/list-open-maps.json'),
  recorded('github/maps-1-64.json'),
]

const mapsOf = (viewModel: ViewModel | undefined) => {
  if (viewModel?.kind !== 'maps') throw new Error(`expected maps, got ${viewModel?.kind}`)
  return viewModel
}

describe('the Cockpit controller on a GitHub tracker', () => {
  it.effect("shows the repo's open maps as a local tracker gets them, named by the repo row", () =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(...goodCollect()) },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const shown = mapsOf(published[0])
          expect(shown.repo).toBe('dbarjs/hero-synergy')
          expect(shown.notice).toBeNull()
          expect(Date.parse(shown.collectedAt)).not.toBeNaN()
          const all = [...shown.maps, ...(shown.finished?.maps ?? [])]
          expect(all.map((map) => map.number).sort((a, b) => a - b)).toEqual([1, 64])
          expect(all.some((map) => map.tickets.length > 0)).toBe(true)
        }),
    ),
  )

  it.effect('opens a map on GitHub at its issue from the Focus pane', () =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(...goodCollect()) },
      ({ cockpit, opened }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(yield* cockpit.receive({ type: 'open', key: 'map:64:map' })).toBe(true)
          expect(opened).toEqual([
            { kind: 'url', url: 'https://github.com/dbarjs/hero-synergy/issues/64' },
          ])
        }),
    ),
  )

  it.effect('a local tracker has no repo row', () =>
    withCockpit({}, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(mapsOf(published[0]).repo).toBeNull()
      }),
    ),
  )

  it.effect.each([
    [
      'gh is not logged in',
      'github/list-not-logged-in.json',
      'gh is not logged in to GitHub.',
      'gh auth login',
    ],
    ['gh does not answer', 'github/list-timeout.json', 'GitHub did not answer in time.', 'Refresh'],
    ['the network is down', 'github/list-network.json', 'GitHub could not be reached.', 'network'],
    [
      'the rate limit is spent',
      'github/list-rate-limited.json',
      'The GitHub rate limit is spent.',
      'comes back',
    ],
  ])('shows one message and no maps when %s', ([, fixture, message, fix]) =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(recorded(fixture as string)) },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const shown = published[0]
          if (shown?.kind !== 'message') throw new Error(`expected a message, got ${shown?.kind}`)
          expect(shown.message).toBe(message)
          expect(shown.detail).toContain(fix as string)
        }),
    ),
  )

  it.effect('says no remote names a GitHub repository', () =>
    withCockpit(
      {
        files: GITHUB_DOC,
        recordings: [
          inRepo(ROOT, ROOT),
          {
            command: 'git',
            args: ['-C', ROOT, 'remote', '-v'],
            stdout: '',
            stderr: '',
            exitCode: 0,
          },
        ],
      },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(published[0]).toMatchObject({
            kind: 'message',
            message: 'No git remote names a GitHub repository.',
          })
        }),
    ),
  )

  it.effect('keeps the old maps on screen with the reason and the fix when a refresh fails', () => {
    const recordings = onGitHub(...goodCollect())
    return withCockpit({ files: GITHUB_DOC, recordings }, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const good = mapsOf(published[0])

        recordings.splice(3, recordings.length, recorded('github/list-not-logged-in.json'))
        yield* cockpit.refresh
        const after = mapsOf(published[1])
        expect(after.maps).toEqual(good.maps)
        expect(after.finished).toEqual(good.finished)
        expect(after.collectedAt).toBe(good.collectedAt)
        expect(after.notice).toEqual({
          message: 'gh is not logged in to GitHub.',
          fix: 'Run `gh auth login`.',
        })

        // The next good read clears it.
        recordings.splice(3, recordings.length, ...goodCollect())
        yield* cockpit.refresh
        expect(mapsOf(published[2]).notice).toBeNull()
      }),
    )
  })
})

describe('the Cockpit controller and the Detail', () => {
  const lastDetail = (details: ReadonlyArray<DetailView>): DetailView => {
    const last = details.at(-1)
    if (last === undefined) throw new Error('no Detail was published')
    return last
  }

  it.effect('opens the Detail on a row, selecting it, and follows the next selection', () =>
    withCockpit({}, ({ cockpit, published, details, shown }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(shown).toEqual([])

        yield* cockpit.receive({ type: 'open-detail', key: 'map:3:ticket:2', section: null })
        // The Tree keeps the keyboard; the panel only comes forward.
        expect(shown).toEqual([false])
        expect(lastDetail(details).detail).toMatchObject({ kind: 'ticket', number: 2 })
        const last = published.at(-1)
        expect(last?.kind === 'maps' && last.selection?.key).toBe('map:3:ticket:2')
        expect(yield* (yield* Storage).get(SELECTED_KEY)).toBe('map:3:ticket:2')

        yield* cockpit.receive({ type: 'select', key: 'map:3:ticket:1' })
        expect(shown).toEqual([false])
        expect(lastDetail(details).detail).toMatchObject({ kind: 'ticket', number: 1 })

        yield* cockpit.receive({ type: 'select', key: null })
        expect(lastDetail(details).detail).toBeNull()
      }),
    ),
  )

  it.effect('asks for a section on every request and forgets it when the selection moves', () =>
    withCockpit({}, ({ cockpit, details }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'open-detail', key: 'map:3:map', section: 'fog' })
        const first = lastDetail(details)
        expect(first.section).toBe('fog')

        yield* cockpit.receive({ type: 'open-detail', key: 'map:3:map', section: 'fog' })
        expect(lastDetail(details).scroll).toBeGreaterThan(first.scroll)

        yield* cockpit.receive({ type: 'open-detail', key: 'map:3:map', section: 'decisions' })
        expect(lastDetail(details).section).toBe('decisions')

        yield* cockpit.receive({ type: 'select', key: 'map:3:ticket:1' })
        expect(lastDetail(details).section).toBeNull()
      }),
    ),
  )

  it.effect('ignores a request to open a row that is not in the snapshot, and says so', () =>
    withCockpit({}, ({ cockpit, shown, logged }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'open-detail', key: 'map:9:map', section: null })
        expect(shown).toEqual([])
        expect(logged.some((line) => line.includes('map:9:map'))).toBe(true)
      }),
    ),
  )

  it.effect('rejects an open-detail for a section nobody has', () =>
    withCockpit({}, ({ cockpit }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(
          yield* cockpit.receive({ type: 'open-detail', key: 'map:3:map', section: 'notes' }),
        ).toBe(false)
        expect(yield* cockpit.receive({ type: 'open-detail', key: 'map:3:map' })).toBe(false)
      }),
    ),
  )

  it.effect('reveals a neighbour: selects it and unfolds its map, and the Finished fold', () =>
    withCockpit({ stored: { [EXPANDED_KEY]: [] } }, ({ cockpit, published, details }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(maps(published.at(-1)).map((map) => map.expanded)).toEqual([false, false])

        yield* cockpit.receive({ type: 'reveal', key: 'map:3:ticket:2' })
        expect(maps(published.at(-1)).map((map) => map.expanded)).toEqual([true, false])
        expect(lastDetail(details).detail).toMatchObject({ kind: 'ticket', number: 2 })
        const open = published.at(-1)
        expect(open?.kind === 'maps' && open.selection?.key).toBe('map:3:ticket:2')

        // A closed ticket also needs the Decisions fold open to show its row.
        yield* cockpit.receive({ type: 'reveal', key: 'map:3:ticket:5' })
        expect(maps(published.at(-1))[0]?.decisions.expanded).toBe(true)

        // A ticket of a finished map needs the Finished fold open too.
        yield* cockpit.receive({ type: 'reveal', key: 'map:1:ticket:1' })
        const last = published.at(-1)
        expect(last?.kind === 'maps' && last.finished?.expanded).toBe(true)
        expect(last?.kind === 'maps' && last.finished?.maps[0]?.expanded).toBe(true)
        expect(new Set((yield* (yield* Storage).get(EXPANDED_KEY)) as string[])).toEqual(
          new Set(['map:3', 'map:3:decisions', 'map:1', 'map:1:decisions', 'finished']),
        )
      }),
    ),
  )

  it.effect('does not reveal a row that is not in the snapshot', () =>
    withCockpit({}, ({ cockpit, published, logged }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const before = published.length
        yield* cockpit.receive({ type: 'reveal', key: 'map:3:ticket:99' })
        expect(published).toHaveLength(before)
        expect(logged.some((line) => line.includes('map:3:ticket:99'))).toBe(true)
      }),
    ),
  )

  it.effect('opens the Detail from the command on the selection, taking focus', () =>
    withCockpit({ stored: { [SELECTED_KEY]: 'map:2:ticket:3' } }, ({ cockpit, details, shown }) =>
      Effect.gen(function* () {
        yield* cockpit.openDetail
        expect(shown).toEqual([true])
        expect(lastDetail(details).detail).toMatchObject({ kind: 'ticket', number: 3 })
      }),
    ),
  )

  it.effect('opens the Detail from the command on the first map when nothing is selected', () =>
    withCockpit({}, ({ cockpit, details, shown, runs }) =>
      Effect.gen(function* () {
        // Nothing has collected yet: the command collects first.
        expect(runs()).toBe(0)
        yield* cockpit.openDetail
        expect(runs()).toBe(1)
        expect(shown).toEqual([true])
        expect(lastDetail(details).detail).toMatchObject({ kind: 'map', number: 3 })
        expect(yield* (yield* Storage).get(SELECTED_KEY)).toBe('map:3:map')
      }),
    ),
  )

  it.effect('falls back to the first map when the stored selection is gone', () =>
    withCockpit({ stored: { [SELECTED_KEY]: 'map:9:map' } }, ({ cockpit, details }) =>
      Effect.gen(function* () {
        yield* cockpit.openDetail
        expect(lastDetail(details).detail).toMatchObject({ kind: 'map', number: 3 })
      }),
    ),
  )

  it.effect('answers a panel that just mounted with the Detail of the stored selection', () =>
    withCockpit({ stored: { [SELECTED_KEY]: 'map:3:ticket:5' } }, ({ cockpit, details }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'ready' })
        expect(lastDetail(details).detail).toMatchObject({
          kind: 'ticket',
          number: 5,
          state: 'closed',
        })
        expect(yield* cockpit.currentDetail).toEqual(lastDetail(details))
      }),
    ),
  )

  it.effect('opens only web links from a rendered body', () =>
    withCockpit({}, ({ cockpit, opened, logged }) =>
      Effect.gen(function* () {
        yield* cockpit.receive({ type: 'open-link', url: 'https://example.com/spec' })
        yield* cockpit.receive({ type: 'open-link', url: 'javascript:alert(1)' })
        yield* cockpit.receive({ type: 'open-link', url: 'file:///etc/passwd' })
        expect(opened).toEqual([{ kind: 'url', url: 'https://example.com/spec' }])
        expect(logged).toHaveLength(2)
      }),
    ),
  )
})

/** The recorded second request with the budget it reports changed. */
const withRemaining = (remaining: number): ProcessRecording[] => {
  const [list, maps] = goodCollect() as [ProcessRecording, ProcessRecording]
  return [
    list,
    { ...maps, stdout: maps.stdout.replace('"remaining":4828', `"remaining":${remaining}`) },
  ]
}
const RESET_AT = Date.parse('2026-10-07T18:47:48Z')

describe('the Cockpit refreshes on causes, never on a timer', () => {
  it.effect('collects on show and focus, but not again within 60 s on a GitHub tracker', () =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(...goodCollect()) },
      ({ cockpit, runs, progress }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const perCollect = runs()
          yield* TestClock.adjust('30 seconds')
          yield* cockpit.focus
          expect(runs()).toBe(perCollect)
          yield* TestClock.adjust('31 seconds')
          yield* cockpit.focus
          expect(runs()).toBeGreaterThan(perCollect)
          expect(progress).toEqual({ shown: 2, open: 0 })
        }),
    ),
  )

  it.effect('lets the button ignore the gap', () =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(...goodCollect()) },
      ({ cockpit, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const perCollect = runs()
          yield* TestClock.adjust('1 second')
          yield* cockpit.refresh
          expect(runs()).toBe(perCollect * 2)
        }),
    ),
  )

  it.effect('has no gap on a local tracker', () =>
    withCockpit({}, ({ cockpit, runs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.focus
        yield* cockpit.show
        expect(runs()).toBe(3)
      }),
    ),
  )

  it.effect(
    'coalesces triggers during a collect into one queued collect and attaches the button',
    () =>
      withCockpit({ delay: 1000 }, ({ cockpit, runs, published }) =>
        Effect.gen(function* () {
          const first = yield* Effect.forkChild(cockpit.show)
          yield* Effect.yieldNow
          const during = [
            yield* Effect.forkChild(cockpit.focus),
            yield* Effect.forkChild(cockpit.focus),
            yield* Effect.forkChild(cockpit.refresh),
          ]
          yield* TestClock.adjust('1 minute')
          yield* Fiber.joinAll([first, ...during])
          // One collect for show, one queued for the two focuses; the button joined the first.
          expect(runs()).toBe(2)
          expect(published).toHaveLength(2)
        }),
      ),
  )

  it.effect(
    'collects once after the debounce when a .scratch file changes on a local tracker',
    () =>
      withCockpit({}, ({ cockpit, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(runs()).toBe(1)
          yield* cockpit.scratchChanged
          yield* TestClock.adjust('500 millis')
          yield* cockpit.scratchChanged
          yield* TestClock.adjust('999 millis')
          expect(runs()).toBe(1)
          yield* TestClock.adjust('1 millis')
          expect(runs()).toBe(2)
          yield* TestClock.adjust('10 seconds')
          expect(runs()).toBe(2)
        }),
      ),
  )

  it.effect('does nothing when a .scratch file changes on a GitHub tracker', () =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(...goodCollect()) },
      ({ cockpit, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const perCollect = runs()
          yield* TestClock.adjust('2 minutes')
          yield* cockpit.scratchChanged
          yield* TestClock.adjust('5 seconds')
          expect(runs()).toBe(perCollect)
        }),
    ),
  )

  it.effect(
    'pauses automatic triggers below 1,000 points until resetAt; the button still works',
    () =>
      withCockpit(
        { files: GITHUB_DOC, recordings: onGitHub(...withRemaining(999)) },
        ({ cockpit, runs, published }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            const perCollect = runs()
            expect(mapsOf(published[0]).budget).toEqual({
              kind: 'paused',
              until: '2026-10-07T18:47:48.000Z',
            })
            yield* TestClock.adjust('5 minutes')
            yield* cockpit.focus
            expect(runs()).toBe(perCollect)
            yield* cockpit.refresh
            expect(runs()).toBe(perCollect * 2)
            yield* TestClock.setTime(RESET_AT + 1000)
            yield* cockpit.focus
            expect(runs()).toBe(perCollect * 3)
          }),
      ),
  )

  it.effect('stops at 0 points and the button says rate-limited without calling', () =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(...withRemaining(0)) },
      ({ cockpit, runs, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const perCollect = runs()
          yield* TestClock.adjust('5 minutes')
          yield* cockpit.focus
          yield* cockpit.refresh
          expect(runs()).toBe(perCollect)
          expect(mapsOf(published.at(-1)).budget).toEqual({
            kind: 'rate-limited',
            until: '2026-10-07T18:47:48.000Z',
          })
        }),
    ),
  )

  it.effect('does not try again on its own after a failure; the next trigger does', () => {
    const recordings = onGitHub(recorded('github/list-timeout.json'))
    return withCockpit({ files: GITHUB_DOC, recordings }, ({ cockpit, runs, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const failed = runs()
        yield* TestClock.adjust('10 minutes')
        expect(runs()).toBe(failed)
        recordings.splice(3, recordings.length, ...goodCollect())
        yield* cockpit.focus
        expect(runs()).toBeGreaterThan(failed)
        expect(mapsOf(published.at(-1)).notice).toBeNull()
      }),
    )
  })

  it.effect('backs automatic triggers off after a secondary limit', () =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(recorded('github/list-secondary-limit.json')) },
      ({ cockpit, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const perCollect = runs()
          yield* TestClock.adjust('30 seconds')
          yield* cockpit.focus
          expect(runs()).toBe(perCollect)
        }),
    ),
  )
})

describe('the Cockpit keeps the last snapshot', () => {
  const localSnapshot = readLocalTracker(ROOT).pipe(
    Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT))),
  )

  it.effect('renders the cache before any process spawns, then swaps it for a fresh collect', () =>
    Effect.gen(function* () {
      const snapshot = yield* localSnapshot
      const stored = { [CACHE_KEY]: writeCache(undefined, [ROOT], snapshot) }
      yield* withCockpit({ stored }, ({ cockpit, runs, published }) =>
        Effect.gen(function* () {
          expect(runs()).toBe(0)
          expect(maps(yield* cockpit.current)).toHaveLength(2)
          yield* cockpit.show
          expect(runs()).toBe(1)
          expect(published).toHaveLength(1)
        }),
      )
    }),
  )

  it.effect('stores the last successful snapshot for the next activation', () =>
    withCockpit({}, ({ cockpit }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const storage = yield* Storage
        expect(yield* storage.get(CACHE_KEY)).toMatchObject({
          last: { folders: [ROOT], key: `local|${ROOT}|v2` },
        })
      }),
    ),
  )

  it.effect('ignores a cache under an older schema version, another repo or other folders', () =>
    Effect.gen(function* () {
      const snapshot = yield* localSnapshot
      const good = writeCache(undefined, [ROOT], snapshot) as {
        last: { folders: string[]; key: string }
        entries: Record<string, { version: number }>
      }
      const entry = good.entries[good.last.key] as { version: number }
      const moved = (key: string) => ({
        last: { folders: [ROOT], key },
        entries: { [key]: entry },
      })
      const cases: ReadonlyArray<unknown> = [
        { ...good, entries: { [good.last.key]: { ...entry, version: 0 } } },
        moved('local|/home/ana/another|v1'),
        { ...good, last: { ...good.last, folders: ['/elsewhere'] } },
        'garbage',
      ]
      for (const value of cases) {
        yield* withCockpit({ stored: { [CACHE_KEY]: value } }, ({ cockpit }) =>
          Effect.gen(function* () {
            expect(yield* cockpit.current).toEqual({ kind: 'loading' })
          }),
        )
      }
    }),
  )
})

const CLAUDE = '/opt/claude'
const pluginList = (stdout: string): ProcessRecording => ({
  command: CLAUDE,
  args: ['plugin', 'list', '--json'],
  stdout,
  stderr: '',
  exitCode: 0,
})
const WAYFINDER_SKILL =
  '---\nname: wayfinder\ndescription: Plan a map.\ndisable-model-invocation: true\n---\n# Wayfinder\n'

/** A window where `claude` and the wayfinder skill are both there. */
const launchable = (overrides: Partial<HostEnvironmentShape> = {}): Setup => ({
  files: {
    ...workspaceFiles(ROOT),
    [CLAUDE]: '#!/bin/sh\n',
    [`${ROOT}/.claude/skills/wayfinder/SKILL.md`]: WAYFINDER_SKILL,
  },
  recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
  environment: { claudeSetting: Effect.succeed(CLAUDE), ...overrides },
})

const PALETTE = 'map:3:ticket:1'

const ticketRowOf = (viewModel: ViewModel | undefined, key: string) =>
  maps(viewModel)
    .flatMap((map) => map.tickets)
    .find((row) => row.key === key)

describe('the Cockpit controller launching a ticket', () => {
  it.effect('shows the command ▶ will run on each row that offers one, and on no blocked row', () =>
    withCockpit(launchable(), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const rows = maps(published[0]).flatMap((map) => map.tickets)
        expect(
          rows
            .filter((row) => row.action !== null)
            .map((row) => [row.number, row.place, row.action?.label]),
        ).toEqual(
          rows
            .filter((row) => row.place !== 'blocked')
            .map((row) => [
              row.number,
              row.place,
              row.place === 'frontier' ? 'Work ticket' : 'Launch fresh',
            ]),
        )
        expect(rows.filter((row) => row.place === 'blocked' && row.action !== null)).toEqual([])
        const palette = ticketRowOf(published[0], PALETTE)
        expect(palette?.action).toEqual({
          id: 'work-ticket',
          label: 'Work ticket',
          command: expect.stringMatching(
            /^claude -n '#1 Palette' --plugin-dir \/ext\/claude-plugin /,
          ),
          envLine: 'env: HERO_SYNERGY_TICKET=1 HERO_SYNERGY_EVENTS=/storage/events/repo.jsonl',
          disabled: null,
          note: 'No worktree on a local tracker: this session shares the checkout.',
        })
      }),
    ),
  )

  it.effect('spawns claude as the terminal itself with the argv the pane showed', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const shown = ticketRowOf(published[0], PALETTE)?.action?.command
        expect(yield* cockpit.receive({ type: 'launch', key: PALETTE })).toBe(true)

        expect(terminals.opened).toHaveLength(1)
        const [spec] = terminals.opened
        expect(spec).toMatchObject({
          name: '#1 Palette',
          shellPath: CLAUDE,
          cwd: ROOT,
          env: { HERO_SYNERGY_TICKET: '1', HERO_SYNERGY_EVENTS: '/storage/events/repo.jsonl' },
          icon: 'beaker',
          location: 'panel',
        })
        expect(spec?.shellArgs.slice(0, 4)).toEqual([
          '-n',
          '#1 Palette',
          '--plugin-dir',
          '/ext/claude-plugin',
        ])
        expect(spec?.shellArgs).not.toContain('-w')
        expect(renderCommand(['claude', ...(spec?.shellArgs ?? [])])).toBe(shown)
      }),
    ),
  )

  it.effect('opens the terminal in the editor area when the setting says so', () =>
    withCockpit(
      launchable({ terminalLocation: Effect.succeed('editor') }),
      ({ cockpit, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          expect(terminals.opened[0]?.location).toBe('editor')
        }),
    ),
  )

  it.effect('creates the events file before the plugin first appends to it', () =>
    withCockpit(launchable(), ({ cockpit, fs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        expect(yield* fs.readFile('/storage/events/repo.jsonl').pipe(Effect.orDie)).toBe('')
      }),
    ),
  )

  it.effect('moves the ticket to starting, drops ▶ and keeps one launch to a ticket', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* Effect.all(
          [
            cockpit.receive({ type: 'launch', key: PALETTE }),
            cockpit.receive({ type: 'launch', key: PALETTE }),
          ],
          { concurrency: 'unbounded' },
        )
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        expect(terminals.opened).toHaveLength(1)
        const row = ticketRowOf(published.at(-1), PALETTE)
        expect(row?.session).toEqual({ kind: 'starting', hint: null })
        expect(row?.action).toBeNull()
      }),
    ),
  )

  it.effect('focuses the terminal of a starting ticket and of no other', () =>
    withCockpit(launchable(), ({ cockpit, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'focus-terminal', key: PALETTE })
        expect(terminals.focused).toEqual([])
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* cockpit.receive({ type: 'focus-terminal', key: PALETTE })
        yield* cockpit.receive({ type: 'focus-terminal', key: 'map:3:ticket:3' })
        expect(terminals.focused).toEqual([1])
      }),
    ),
  )

  it.effect.each([
    ['the user closes it', { reason: 'user', code: null }, 'terminal closed'],
    ['the window closes', { reason: 'shutdown', code: null }, 'window closed'],
    ['the process exits non-zero', { reason: 'process', code: 3 }, 'exited with code 3'],
  ] as const)('ends the ticket with the detail when %s', ([, exit, detail]) =>
    withCockpit(launchable(), ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        terminals.close(1, exit)
        yield* Effect.yieldNow
        const row = ticketRowOf(published.at(-1), PALETTE)
        expect(row?.session).toMatchObject({ kind: 'ended', detail })
        // Ended is not live: the ticket can be taken again.
        expect(row?.action?.disabled).toBeNull()
      }),
    ),
  )

  it.effect('ignores the close of a terminal that belongs to no ticket', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const before = published.length
        terminals.close(99, { reason: 'user', code: null })
        yield* Effect.yieldNow
        expect(published).toHaveLength(before)
      }),
    ),
  )

  it.effect('launches again after the session ended, in a fresh terminal', () =>
    withCockpit(launchable(), ({ cockpit, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        terminals.close(1, { reason: 'user', code: null })
        yield* Effect.yieldNow
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        expect(terminals.opened).toHaveLength(2)
      }),
    ),
  )

  it.effect('launches nothing for a blocked ticket, an unfinished map or no row', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals, logged }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        // #2 Dark mode waits on #1; the map is unfinished.
        yield* cockpit.receive({ type: 'launch', key: 'map:3:ticket:2' })
        yield* cockpit.receive({ type: 'launch', key: 'map:3:map' })
        yield* cockpit.receive({ type: 'launch', key: 'map:9:ticket:9' })
        yield* cockpit.receive({ type: 'launch', key: 'repo' })
        expect(terminals.opened).toEqual([])
        expect(logged.filter((line) => line.startsWith('Nothing to launch'))).toHaveLength(4)
        expect(ticketRowOf(published.at(-1), 'map:3:ticket:2')?.action).toBeNull()
      }),
    ),
  )

  it.effect('offers Launch fresh on a ticket claimed elsewhere and starts a session on it', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        // #4 Row density is claimed.
        const claimed = ticketRowOf(published[0], 'map:3:ticket:4')
        expect(claimed?.place).toBe('claimed')
        expect(claimed?.action).toMatchObject({ id: 'launch-fresh', label: 'Launch fresh' })
        yield* cockpit.receive({ type: 'launch', key: 'map:3:ticket:4' })
        expect(terminals.opened).toHaveLength(1)
        expect(terminals.opened[0]).toMatchObject({ name: '#4 Row density', shellPath: CLAUDE })
        expect(ticketRowOf(published.at(-1), 'map:3:ticket:4')?.session.kind).toBe('starting')
      }),
    ),
  )

  it.effect(
    'offers Resume by name then Launch fresh on an ended session with no id, and resumes plain',
    () =>
      withCockpit(launchable(), ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          terminals.close(1, { reason: 'user', code: null })
          yield* Effect.yieldNow
          yield* cockpit.receive({ type: 'select', key: PALETTE })
          const shown = published.at(-1)
          const selection = shown?.kind === 'maps' ? shown.selection : null
          const actions = selection?.kind === 'ticket' ? selection.actions : []
          expect(actions.map((action) => action.id)).toEqual(['resume-by-name', 'launch-fresh'])
          expect(actions[0]).toMatchObject({
            label: 'Resume by name',
            command: "claude --resume '#1 Palette'",
            envLine: null,
            disabled: null,
          })
          yield* cockpit.receive({ type: 'launch', key: PALETTE, action: 'resume-by-name' })
          expect(terminals.opened).toHaveLength(2)
          // By name: the session name alone, no plugin and no env, and no tracked session.
          expect(terminals.opened[1]).toMatchObject({
            name: '#1 Palette',
            shellPath: CLAUDE,
            shellArgs: ['--resume', '#1 Palette'],
            env: {},
          })
          expect(ticketRowOf(published.at(-1), PALETTE)?.session.kind).toBe('ended')
        }),
      ),
  )

  it.effect('copies the command the pane shows', () =>
    withCockpit(launchable(), ({ cockpit, published, copied }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'copy', key: PALETTE })
        expect(copied).toEqual([ticketRowOf(published[0], PALETTE)?.action?.command])
      }),
    ),
  )

  it.effect('puts the Work ticket Action in the pane of the selected frontier ticket', () =>
    withCockpit(launchable(), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'select', key: PALETTE })
        const shown = published.at(-1)
        const selection = shown?.kind === 'maps' ? shown.selection : null
        expect(selection?.kind === 'ticket' && selection.actions[0]?.command).toBe(
          ticketRowOf(shown, PALETTE)?.action?.command,
        )
        expect(selection?.kind === 'ticket' && selection.session).toEqual({ kind: 'none' })
      }),
    ),
  )

  it.effect('discovers skills on every refresh, reading the plugin list once each time', () =>
    withCockpit(launchable(), ({ cockpit, runs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        // git for the repo root, then claude plugin list --json.
        expect(runs()).toBe(2)
        yield* cockpit.refresh
        expect(runs()).toBe(4)
      }),
    ),
  )

  it.effect('finds wayfinder in a plugin and launches it by its namespaced command', () =>
    withCockpit(
      {
        ...launchable(),
        files: {
          ...workspaceFiles(ROOT),
          [CLAUDE]: '#!/bin/sh\n',
          '/plugins/mattpocock-skills/.claude-plugin/plugin.json': JSON.stringify({
            name: 'mattpocock-skills',
            version: '1.2.3',
            skills: ['./skills/wayfinder'],
          }),
          '/plugins/mattpocock-skills/skills/wayfinder/SKILL.md': WAYFINDER_SKILL,
        },
        recordings: [
          inRepo(ROOT, ROOT),
          pluginList(
            JSON.stringify([
              {
                id: 'mattpocock-skills@claude-plugins-official',
                version: '1.2.3',
                enabled: true,
                installPath: '/plugins/mattpocock-skills',
              },
            ]),
          ),
        ],
      },
      ({ cockpit, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          expect(terminals.opened[0]?.shellArgs.at(-1)).toMatch(
            /^\/mattpocock-skills:wayfinder \.scratch\//,
          )
        }),
    ),
  )
})

describe('the Cockpit controller with no claude, or no wayfinder skill', () => {
  it.effect('greys ▶ with the reason and spawns nothing when claude cannot be resolved', () =>
    withCockpit(
      { ...launchable(), environment: { pathVariable: '/usr/bin' } },
      ({ cockpit, published, terminals, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          // Only git ran: there is no claude to ask for the plugin list.
          expect(runs()).toBe(1)
          const action = ticketRowOf(published[0], PALETTE)?.action
          expect(action?.disabled).toContain('claude was not found on PATH')
          expect(action?.command).toContain('claude -n')
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          expect(terminals.opened).toEqual([])
          expect(ticketRowOf(published.at(-1), PALETTE)?.session).toEqual({ kind: 'none' })
        }),
    ),
  )

  it.effect('finds claude on PATH when the setting is empty', () =>
    withCockpit(
      {
        ...launchable(),
        files: { ...launchable().files, '/usr/bin/claude': '' },
        recordings: [inRepo(ROOT, ROOT), { ...pluginList('[]'), command: '/usr/bin/claude' }],
        environment: { pathVariable: '/usr/bin' },
      },
      ({ cockpit, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          expect(terminals.opened[0]?.shellPath).toBe('/usr/bin/claude')
        }),
    ),
  )

  it.effect('logs where claude resolved at activation, spawning nothing', () =>
    withCockpit(launchable(), ({ cockpit, logged, runs }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        expect(logged).toEqual([
          'Visual Studio Code (desktop) 1.105.0 on linux',
          `claude resolved to ${CLAUDE} (heroSynergy.claude.path)`,
          'not an isolated environment: local window',
        ])
        expect(runs()).toBe(0)
      }),
    ),
  )

  it.effect('logs why claude did not resolve at activation', () =>
    withCockpit({}, ({ cockpit, logged }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        expect(logged).toEqual([
          'Visual Studio Code (desktop) 1.105.0 on linux',
          'claude not resolved: claude was not found on PATH. Set heroSynergy.claude.path to its location.',
          'not an isolated environment: local window',
        ])
      }),
    ),
  )

  it.effect('greys ▶ with the install hint when no wayfinder skill is found', () =>
    withCockpit(
      { ...launchable(), files: { ...workspaceFiles(ROOT), [CLAUDE]: '#!/bin/sh\n' } },
      ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const action = ticketRowOf(published[0], PALETTE)?.action
          expect(action?.disabled).toContain('wayfinder skill was not found')
          expect(action?.command).toBeNull()
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          yield* cockpit.receive({ type: 'copy', key: PALETTE })
          expect(terminals.opened).toEqual([])
        }),
    ),
  )
})

const EVENTS = '/storage/events/repo.jsonl'

const eventLine = (
  ticket: string,
  hook: string,
  session: string,
  detail: string | null = null,
  at = '2026-10-08T10:00:00.000Z',
) => `${JSON.stringify({ ticket, hook, session, detail, at, payload: {} })}\n`

describe('the Cockpit controller driving a session from status events', () => {
  /** What the plugin does: append to the events file, then the disk tells the watcher. */
  const appendEvents = (
    fs: FileSystem['Service'],
    watcher: { change: () => void },
    text: string,
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const before = yield* fs.readFile(EVENTS).pipe(Effect.orElseSucceed(() => ''))
      yield* fs.writeFile(EVENTS, before + text).pipe(Effect.orDie)
      watcher.change()
      // The read runs on its own fiber, then the view model goes out.
      for (let i = 0; i < 20; i++) yield* Effect.yieldNow
    })

  const sessionOf = (published: ViewModel[]) => ticketRowOf(published.at(-1), PALETTE)?.session
  const rowSession = (published: ViewModel[], key: string) =>
    ticketRowOf(published.at(-1), key)?.session

  it.effect('creates the events file and watches it once the repo is known', () =>
    withCockpit(launchable(), ({ cockpit, fs, watcher }) =>
      Effect.gen(function* () {
        expect(yield* fs.exists(EVENTS).pipe(Effect.orDie)).toBe(false)
        yield* cockpit.show
        expect(yield* fs.exists(EVENTS).pipe(Effect.orDie)).toBe(true)
        expect(watcher.watched).toEqual([EVENTS])
      }),
    ),
  )

  it.effect('shows live on SessionStart and ended "exited" on SessionEnd', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        expect(terminals.opened).toHaveLength(1)

        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
        expect(sessionOf(published)).toMatchObject({ kind: 'live', status: null, needsYou: false })
        // The row keeps its terminal: focusing still reaches it.
        yield* cockpit.receive({ type: 'focus-terminal', key: PALETTE })
        expect(terminals.focused).toEqual([1])

        yield* appendEvents(fs, watcher, eventLine('1', 'SessionEnd', 'A', 'prompt_input_exit'))
        expect(sessionOf(published)).toMatchObject({ kind: 'ended', detail: 'exited' })
        // Ended is not running: the ticket can be taken again.
        expect(ticketRowOf(published.at(-1), PALETTE)?.action?.disabled).toBeNull()
      }),
    ),
  )

  it.effect('takes the time of the status event, not the time it was read', () =>
    withCockpit(launchable(), ({ cockpit, published, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        const at = '2026-10-08T09:59:00.000Z'
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup', at))
        expect(sessionOf(published)).toMatchObject({ kind: 'live', since: Date.parse(at) })
      }),
    ),
  )

  it.effect('treats a SessionEnd read before its SessionStart as final', () =>
    withCockpit(launchable(), ({ cockpit, published, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionEnd', 'A', 'prompt_input_exit'))
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
        expect(sessionOf(published)).toMatchObject({ kind: 'ended', detail: 'exited' })
      }),
    ),
  )

  it.effect('keeps the ticket going through /clear and takes the new session id', () =>
    withCockpit(launchable(), ({ cockpit, published, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* appendEvents(
          fs,
          watcher,
          eventLine('1', 'SessionStart', 'A', 'startup') +
            eventLine('1', 'SessionEnd', 'A', 'clear') +
            eventLine('1', 'SessionStart', 'B', 'clear'),
        )
        expect(sessionOf(published)).toMatchObject({ kind: 'live' })
      }),
    ),
  )

  it.effect('counts a failed session in the badge, and nothing else', () =>
    withCockpit(launchable(), ({ cockpit, published, badges, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(badges.at(-1)).toBe(0)
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        expect(badges.at(-1)).toBe(0) // starting

        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
        expect(badges.at(-1)).toBe(0) // live, no status

        yield* appendEvents(fs, watcher, eventLine('1', 'StopFailure', 'A', 'rate_limit'))
        expect(sessionOf(published)).toMatchObject({
          kind: 'live',
          status: 'failed',
          needsYou: true,
        })
        expect(badges.at(-1)).toBe(1)

        yield* appendEvents(fs, watcher, eventLine('1', 'SessionEnd', 'A', 'other'))
        expect(sessionOf(published)).toMatchObject({ kind: 'ended', detail: 'other' })
        expect(badges.at(-1)).toBe(0) // ended
      }),
    ),
  )

  it.effect('shows the hint once the terminal has been quiet for 15 s, and not before', () =>
    withCockpit(launchable(), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        expect(sessionOf(published)).toEqual({ kind: 'starting', hint: null })
        yield* TestClock.adjust('14 seconds')
        expect(sessionOf(published)).toEqual({ kind: 'starting', hint: null })
        yield* TestClock.adjust('1 second')
        expect(sessionOf(published)).toEqual({
          kind: 'starting',
          hint: 'no status yet, the session may be waiting at the trust dialog, open the terminal',
        })
      }),
    ),
  )

  it.effect('shows no hint to a session that reported in time', () =>
    withCockpit(launchable(), ({ cockpit, published, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
        yield* TestClock.adjust('15 seconds')
        expect(sessionOf(published)).toMatchObject({ kind: 'live' })
      }),
    ),
  )

  it.effect('reads an event the watcher dropped on the slow poll while a session runs', () =>
    withCockpit(launchable(), ({ cockpit, published, fs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        // The disk changed but the watcher said nothing.
        yield* fs
          .writeFile(EVENTS, eventLine('1', 'SessionStart', 'A', 'startup'))
          .pipe(Effect.orDie)
        expect(sessionOf(published)).toEqual({ kind: 'starting', hint: null })
        yield* TestClock.adjust('5 seconds')
        expect(sessionOf(published)).toMatchObject({ kind: 'live' })
      }),
    ),
  )

  it.effect('does not poll while no session runs', () =>
    withCockpit(launchable(), ({ cockpit, published, fs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const before = published.length
        yield* fs
          .writeFile(EVENTS, eventLine('1', 'SessionStart', 'A', 'startup'))
          .pipe(Effect.orDie)
        yield* TestClock.adjust('1 minute')
        expect(published).toHaveLength(before)
      }),
    ),
  )

  it.effect('ends a live session when its terminal closes with no SessionEnd', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
        terminals.close(1, { reason: 'process', code: 137 })
        yield* Effect.yieldNow
        expect(sessionOf(published)).toMatchObject({
          kind: 'ended',
          detail: 'exited with code 137',
        })
      }),
    ),
  )

  it.effect(
    'shows a session the file says was live as ended, window closed, after a reload',
    () => {
      const setup = launchable()
      return withCockpit(
        { ...setup, files: { ...setup.files, [EVENTS]: eventLine('4', 'SessionStart', 'A') } },
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            expect(rowSession(published, 'map:3:ticket:4')).toMatchObject({
              kind: 'ended',
              detail: 'window closed',
            })
          }),
      )
    },
  )

  it.effect('shows a session the file says ended with its reason after a reload', () => {
    const setup = launchable()
    const text = eventLine('4', 'SessionStart', 'A') + eventLine('4', 'SessionEnd', 'A', 'logout')
    return withCockpit(
      { ...setup, files: { ...setup.files, [EVENTS]: text } },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(rowSession(published, 'map:3:ticket:4')).toMatchObject({
            kind: 'ended',
            detail: 'logout',
          })
        }),
    )
  })

  it.effect('spawns nothing and reads nothing at activation with no snapshot cached', () =>
    withCockpit(launchable(), ({ cockpit, watcher, runs }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        expect(watcher.watched).toEqual([])
        expect(runs()).toBe(0)
      }),
    ),
  )

  it.effect(
    'reads and watches the file at activation when the last snapshot names the repo',
    () => {
      const setup = launchable()
      return withCockpit(
        {
          ...setup,
          files: { ...setup.files, [EVENTS]: eventLine('4', 'SessionEnd', 'A', 'logout') },
        },
        ({ cockpit, watcher, runs, published }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            // Seeding the cache through a first window, then a second one over the same storage, is
            // the extension host tier's job; here the first collect is the one that names the repo.
            expect(watcher.watched).toEqual([EVENTS])
            expect(runs()).toBeGreaterThan(0)
            expect(rowSession(published, 'map:3:ticket:4')).toMatchObject({
              kind: 'ended',
              detail: 'logout',
            })
          }),
      )
    },
  )

  it.effect('compacts a file above the size cap, keeping each ticket’s last event', () => {
    const setup = launchable()
    const lines = Array.from({ length: 4_000 }, (_, i) =>
      eventLine(String(1 + (i % 2)), 'StopFailure', 'A', `error-${i}`),
    ).join('')
    return withCockpit(
      { ...setup, files: { ...setup.files, [EVENTS]: lines } },
      ({ cockpit, fs, logged }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const kept = (yield* fs.readFile(EVENTS).pipe(Effect.orDie)).trim().split('\n')
          expect(kept.map((line) => (JSON.parse(line) as { detail: string }).detail)).toEqual([
            'error-3998',
            'error-3999',
          ])
          expect(logged.some((line) => line.startsWith('Compacted '))).toBe(true)
        }),
    )
  })

  it.effect('logs a status event for a ticket that is not in view and goes on', () =>
    withCockpit(launchable(), ({ cockpit, published, logged, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* appendEvents(
          fs,
          watcher,
          eventLine('999', 'SessionStart', 'Z', 'startup') +
            eventLine('1', 'SessionStart', 'A', 'startup'),
        )
        expect(logged).toContain('Status event SessionStart for #999 matches no ticket in view')
        expect(sessionOf(published)).toMatchObject({ kind: 'live' })
      }),
    ),
  )
})

const skillFile = (name: string, userInvoked = true): string =>
  `---\nname: ${name}\ndescription: What ${name} does.\n${
    userInvoked ? 'disable-model-invocation: true\n' : ''
  }---\n# ${name}\n`

/** Project skills by name; the `hidden` ones are invoked by the model, not by the user. */
const skillsOf = (names: ReadonlyArray<string>, hidden: ReadonlyArray<string> = []) =>
  Object.fromEntries([
    ...names.map((name) => [`${ROOT}/.claude/skills/${name}/SKILL.md`, skillFile(name)]),
    ...hidden.map((name) => [`${ROOT}/.claude/skills/${name}/SKILL.md`, skillFile(name, false)]),
  ])

const ALL_SKILLS = ['wayfinder', 'to-spec', 'setup-matt-pocock-skills', 'grill-me']

/** A window where `claude` is there and these project skills are installed, on the fixture tracker. */
const withSkillsInstalled = (names: ReadonlyArray<string>): Setup => ({
  files: { ...workspaceFiles(ROOT), [CLAUDE]: '#!/bin/sh\n', ...skillsOf(names) },
  recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
  environment: { claudeSetting: Effect.succeed(CLAUDE) },
})

const finishedMapOf = (viewModel: ViewModel | undefined) => {
  if (viewModel?.kind !== 'maps') throw new Error(`expected maps, got ${viewModel?.kind}`)
  const [finished] = viewModel.finished?.maps ?? []
  if (finished === undefined) throw new Error('expected a finished map')
  return { viewModel, finished }
}

const selectionActions = (viewModel: ViewModel | undefined) =>
  viewModel?.kind === 'maps' &&
  viewModel.selection !== null &&
  viewModel.selection.kind !== 'health'
    ? viewModel.selection.actions
    : []

describe('the Cockpit controller offering To spec on a finished map', () => {
  it.effect('carries the map path on a local tracker, in a plain terminal with no env', () =>
    withCockpit(withSkillsInstalled(ALL_SKILLS), ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const { viewModel, finished } = finishedMapOf(published[0])
        // Only the finished map offers it: the unfinished ones offer nothing.
        expect(viewModel.maps.map((map) => map.action)).toEqual([null, null])
        expect(finished.action).toEqual({
          id: 'to-spec',
          label: 'To spec',
          command: "claude '/to-spec .scratch/archive-search/map.md'",
          envLine: null,
          disabled: null,
          note: null,
        })
        yield* cockpit.receive({ type: 'select', key: finished.focusKey })
        expect(selectionActions(published.at(-1)).map((action) => action.id)).toEqual(['to-spec'])
        yield* cockpit.receive({ type: 'launch', key: finished.focusKey })
        expect(terminals.opened).toHaveLength(1)
        expect(terminals.opened[0]).toMatchObject({
          name: 'To spec #1 Archive search',
          shellPath: CLAUDE,
          shellArgs: ['/to-spec .scratch/archive-search/map.md'],
          sendText: null,
          cwd: ROOT,
          env: {},
        })
      }),
    ),
  )

  it.effect('offers nothing in the Focus pane or the Detail of an unfinished map', () =>
    withCockpit(withSkillsInstalled(ALL_SKILLS), ({ cockpit, published, details, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'select', key: 'map:3:map' })
        expect(selectionActions(published.at(-1))).toEqual([])
        expect(details.at(-1)?.detail).toMatchObject({ kind: 'map', actions: [] })
        yield* cockpit.receive({ type: 'launch', key: 'map:3:map' })
        yield* cockpit.receive({ type: 'launch', key: 'map:3:map', action: 'to-spec' })
        expect(terminals.opened).toEqual([])
      }),
    ),
  )

  it.effect('puts To spec in the Detail of a finished map, and copies its command', () =>
    withCockpit(withSkillsInstalled(ALL_SKILLS), ({ cockpit, details, copied }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'select', key: 'map:1:map' })
        expect(details.at(-1)?.detail).toMatchObject({
          kind: 'map',
          actions: [{ id: 'to-spec', label: 'To spec' }],
        })
        yield* cockpit.receive({ type: 'copy', key: 'map:1:map', action: 'to-spec' })
        expect(copied).toEqual(["claude '/to-spec .scratch/archive-search/map.md'"])
      }),
    ),
  )

  it.effect('carries the map URL on GitHub', () =>
    withCockpit(
      {
        files: { ...GITHUB_DOC, [CLAUDE]: '#!/bin/sh\n', ...skillsOf(ALL_SKILLS) },
        recordings: [...onGitHub(...goodCollect()), pluginList('[]')],
        environment: { claudeSetting: Effect.succeed(CLAUDE) },
      },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const { finished } = finishedMapOf(published[0])
          expect(finished.number).toBe(1)
          expect(finished.action?.command).toBe(
            "claude '/to-spec https://github.com/dbarjs/hero-synergy/issues/1'",
          )
        }),
    ),
  )

  it.effect(
    'greys To spec with the install hint when the skill is not found, and launches nothing',
    () =>
      withCockpit(withSkillsInstalled(['wayfinder']), ({ cockpit, published, terminals, logged }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const { finished } = finishedMapOf(published[0])
          expect(finished.action).toMatchObject({
            id: 'to-spec',
            command: null,
            disabled: expect.stringContaining('to-spec skill was not found'),
          })
          yield* cockpit.receive({ type: 'launch', key: finished.focusKey })
          yield* cockpit.receive({ type: 'copy', key: finished.focusKey })
          expect(terminals.opened).toEqual([])
          expect(logged.some((line) => line.startsWith('Not launching map:1:map'))).toBe(true)
        }),
      ),
  )

  it.effect(
    'greys To spec with the reason when claude cannot be resolved, keeping the command',
    () =>
      withCockpit(
        { ...withSkillsInstalled(ALL_SKILLS), environment: { pathVariable: '/usr/bin' } },
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            const { finished } = finishedMapOf(published[0])
            expect(finished.action?.disabled).toContain('claude was not found on PATH')
            expect(finished.action?.command).toContain('/to-spec')
          }),
      ),
  )
})

describe('the Cockpit controller running a skill from the palette', () => {
  const PLUGIN_SKILLS: Setup = {
    files: {
      ...workspaceFiles(ROOT),
      [CLAUDE]: '#!/bin/sh\n',
      ...skillsOf(['wayfinder'], ['internal']),
      '/plugins/mattpocock-skills/.claude-plugin/plugin.json': JSON.stringify({
        name: 'mattpocock-skills',
        version: '1.2.3',
        skills: ['./skills/grill-me', './skills/to-spec'],
      }),
      '/plugins/mattpocock-skills/skills/grill-me/SKILL.md': skillFile('grill-me'),
      '/plugins/mattpocock-skills/skills/to-spec/SKILL.md': skillFile('to-spec'),
    },
    recordings: [
      inRepo(ROOT, ROOT),
      pluginList(
        JSON.stringify([
          {
            id: 'mattpocock-skills@claude-plugins-official',
            version: '1.2.3',
            scope: 'user',
            enabled: true,
            installPath: '/plugins/mattpocock-skills',
          },
        ]),
      ),
    ],
    environment: { claudeSetting: Effect.succeed(CLAUDE) },
  }

  it.effect('lists every user-invoked skill with its command, origin and description', () =>
    withCockpit({ ...PLUGIN_SKILLS, choose: () => null }, ({ cockpit, palette, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.runSkill
        expect(palette.picks).toHaveLength(1)
        expect(palette.picks[0]?.title).toBe('Runs claude "<skill>" in a new terminal')
        expect(palette.picks[0]?.choices).toEqual([
          {
            label: '/mattpocock-skills:grill-me',
            description: 'plugin 1.2.3',
            detail: 'What grill-me does.',
          },
          {
            label: '/mattpocock-skills:to-spec',
            description: 'plugin 1.2.3',
            detail: 'What to-spec does.',
          },
          { label: '/wayfinder', description: 'project', detail: 'What wayfinder does.' },
        ])
        // A skill the model invokes is not listed, and a dismissed pick runs nothing.
        expect(terminals.opened).toEqual([])
      }),
    ),
  )

  it.effect('opens a plain, untracked terminal running the chosen command', () =>
    withCockpit(
      { ...PLUGIN_SKILLS, choose: () => '/mattpocock-skills:grill-me' },
      ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.runSkill
          expect(terminals.opened).toHaveLength(1)
          expect(terminals.opened[0]).toMatchObject({
            name: '/mattpocock-skills:grill-me',
            shellPath: CLAUDE,
            shellArgs: ['/mattpocock-skills:grill-me'],
            sendText: null,
            cwd: ROOT,
            env: {},
          })
          // No ticket session, no badge: every row is as it was.
          const rows = maps(published.at(-1)).flatMap((map) => map.tickets)
          expect(rows.every((row) => row.session.kind === 'none')).toBe(true)
        }),
    ),
  )

  it.effect('runs before the view is ever shown, discovering the skills itself', () =>
    withCockpit(
      { ...PLUGIN_SKILLS, choose: () => '/wayfinder' },
      ({ cockpit, palette, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.runSkill
          expect(palette.picks).toHaveLength(1)
          expect(terminals.opened[0]?.shellArgs).toEqual(['/wayfinder'])
        }),
    ),
  )

  it.effect('says so and shows no list when no user-invoked skill is found', () =>
    withCockpit(
      {
        files: { ...workspaceFiles(ROOT), [CLAUDE]: '#!/bin/sh\n', ...skillsOf([], ['internal']) },
        recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
        environment: { claudeSetting: Effect.succeed(CLAUDE) },
      },
      ({ cockpit, palette, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.runSkill
          expect(palette.picks).toEqual([])
          expect(palette.informed).toHaveLength(1)
          expect(palette.informed[0]).toContain('claude plugins install mattpocock-skills')
          expect(terminals.opened).toEqual([])
        }),
    ),
  )

  it.effect('says why when claude cannot be resolved', () =>
    withCockpit(
      { ...PLUGIN_SKILLS, environment: { pathVariable: '/usr/bin' } },
      ({ cockpit, palette, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.runSkill
          expect(palette.picks).toEqual([])
          expect(palette.informed[0]).toContain('claude was not found on PATH')
          expect(terminals.opened).toEqual([])
        }),
    ),
  )
})

describe('the Cockpit controller charting a map from the title bar', () => {
  it.effect('opens a plain terminal on the wayfinder command with no input', () =>
    withCockpit(withSkillsInstalled(ALL_SKILLS), ({ cockpit, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.chartMap
        expect(terminals.opened).toHaveLength(1)
        expect(terminals.opened[0]).toMatchObject({
          name: 'Chart a map',
          shellPath: CLAUDE,
          shellArgs: ['-n', 'Chart a map', '/wayfinder'],
          sendText: null,
          cwd: ROOT,
          env: {},
        })
      }),
    ),
  )

  it.effect('says why the wayfinder skill is missing instead of opening a terminal', () =>
    withCockpit(withSkillsInstalled(['grill-me']), ({ cockpit, palette, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.chartMap
        expect(terminals.opened).toEqual([])
        expect(palette.informed).toHaveLength(1)
        expect(palette.informed[0]).toContain('wayfinder skill was not found')
      }),
    ),
  )
})

describe('the Cockpit controller empty states', () => {
  const messageOf = (viewModel: ViewModel | undefined) => {
    if (viewModel?.kind !== 'message') throw new Error(`expected a message, got ${viewModel?.kind}`)
    return viewModel
  }
  const idsOf = (viewModel: ViewModel | undefined) =>
    viewModel !== undefined && viewModel.kind !== 'loading'
      ? viewModel.start.actions.map((action) => action.id)
      : []

  const LOCAL_DOC = {
    [`${ROOT}/docs/agents/issue-tracker.md`]: '# Issue tracker: Local Markdown\n',
  }
  const NO_DOC = { [`${ROOT}/README.md`]: '# billing\n' }

  it.effect(
    'leads with both install commands, each with ▶, when no user-invoked skill is found',
    () =>
      withCockpit(
        {
          files: { ...LOCAL_DOC, [CLAUDE]: '#!/bin/sh\n', ...skillsOf([], ['internal']) },
          recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
          environment: { claudeSetting: Effect.succeed(CLAUDE) },
        },
        ({ cockpit, published, terminals }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            const shown = published[0]
            expect(shown).toMatchObject({ kind: 'maps', maps: [], finished: null })
            expect(shown?.kind === 'maps' && shown.start.note).toBe('Pick one, never both.')
            expect(
              shown?.kind === 'maps' &&
                shown.start.actions.map((a) => [a.id, a.command, a.disabled, a.envLine]),
            ).toEqual([
              ['install-plugin', 'claude plugins install mattpocock-skills', null, null],
              ['install-npx', 'npx skills@latest add mattpocock/skills', null, null],
            ])
            yield* cockpit.receive({ type: 'launch', key: 'repo', action: 'install-plugin' })
            yield* cockpit.receive({ type: 'launch', key: 'repo', action: 'install-npx' })
            // Typed into the default shell, in a plain terminal: no plugin, no env.
            expect(terminals.opened.map((t) => [t.shellPath, t.sendText, t.env])).toEqual([
              [null, 'claude plugins install mattpocock-skills', {}],
              [null, 'npx skills@latest add mattpocock/skills', {}],
            ])
          }),
      ),
  )

  it.effect('leads with the installs for a repo with no tracker doc and no skills too', () =>
    withCockpit(
      {
        files: { ...NO_DOC, [CLAUDE]: '#!/bin/sh\n' },
        recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
        environment: { claudeSetting: Effect.succeed(CLAUDE) },
      },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(messageOf(published[0]).message).toBe('This repo has no issue tracker set up.')
          expect(idsOf(published[0])).toEqual(['install-plugin', 'install-npx'])
        }),
    ),
  )

  it.effect('greys the plugin install when claude is missing, not the npx one', () =>
    withCockpit(
      {
        files: { ...NO_DOC },
        recordings: [inRepo(ROOT, ROOT)],
        environment: { pathVariable: '/usr/bin' },
      },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const { start } = messageOf(published[0])
          expect(start.actions.map((a) => [a.id, a.disabled === null])).toEqual([
            ['install-plugin', false],
            ['install-npx', true],
          ])
        }),
    ),
  )

  it.effect('leads with Setup when skills are found but the repo has no tracker doc', () =>
    withCockpit(
      {
        files: { ...NO_DOC, [CLAUDE]: '#!/bin/sh\n', ...skillsOf(ALL_SKILLS) },
        recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
        environment: { claudeSetting: Effect.succeed(CLAUDE) },
      },
      ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const shown = messageOf(published[0])
          expect(shown.message).toBe('This repo has no issue tracker set up.')
          expect(shown.start.note).toBeNull()
          expect(shown.start.actions).toEqual([
            {
              id: 'setup',
              label: 'Setup',
              command: 'claude /setup-matt-pocock-skills',
              envLine: null,
              disabled: null,
              note: null,
            },
          ])
          yield* cockpit.receive({ type: 'launch', key: 'repo', action: 'setup' })
          expect(terminals.opened).toHaveLength(1)
          expect(terminals.opened[0]).toMatchObject({
            shellPath: CLAUDE,
            shellArgs: ['/setup-matt-pocock-skills'],
            sendText: null,
            env: {},
          })
        }),
    ),
  )

  it.effect('leads with Chart a map when the tracker doc has no open map', () =>
    withCockpit(
      {
        files: { ...LOCAL_DOC, [CLAUDE]: '#!/bin/sh\n', ...skillsOf(ALL_SKILLS) },
        recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
        environment: { claudeSetting: Effect.succeed(CLAUDE) },
      },
      ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(idsOf(published[0])).toEqual(['chart-map'])
          expect(published[0]?.kind === 'maps' && published[0].start.actions[0]?.command).toBe(
            "claude -n 'Chart a map' /wayfinder",
          )
          yield* cockpit.receive({ type: 'launch', key: 'repo', action: 'chart-map' })
          expect(terminals.opened[0]).toMatchObject({
            name: 'Chart a map',
            shellArgs: ['-n', 'Chart a map', '/wayfinder'],
            env: {},
          })
        }),
    ),
  )

  it.effect('greys Chart a map with the install hint when the wayfinder skill is missing', () =>
    withCockpit(
      {
        files: { ...LOCAL_DOC, [CLAUDE]: '#!/bin/sh\n', ...skillsOf(['grill-me']) },
        recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
        environment: { claudeSetting: Effect.succeed(CLAUDE) },
      },
      ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const action = published[0]?.kind === 'maps' ? published[0].start.actions[0] : undefined
          expect(action).toMatchObject({
            id: 'chart-map',
            command: null,
            disabled: expect.stringContaining('wayfinder skill was not found'),
          })
          yield* cockpit.receive({ type: 'launch', key: 'repo', action: 'chart-map' })
          expect(terminals.opened).toEqual([])
        }),
    ),
  )

  it.effect('leads with the maps, and no Action, once the repo has some', () =>
    withCockpit(withSkillsInstalled(ALL_SKILLS), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        expect(idsOf(published[0])).toEqual([])
      }),
    ),
  )

  it.effect('discovers again on every refresh, so installing a skill clears the installs', () =>
    withCockpit(
      {
        files: { ...LOCAL_DOC, [CLAUDE]: '#!/bin/sh\n' },
        recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
        environment: { claudeSetting: Effect.succeed(CLAUDE) },
      },
      ({ cockpit, published, fs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(idsOf(published.at(-1))).toEqual(['install-plugin', 'install-npx'])
          for (const name of ALL_SKILLS) {
            yield* fs
              .writeFile(`${ROOT}/.claude/skills/${name}/SKILL.md`, skillFile(name))
              .pipe(Effect.orDie)
          }
          yield* cockpit.refresh
          expect(idsOf(published.at(-1))).toEqual(['chart-map'])
        }),
    ),
  )
})

describe('the Cockpit controller reading the registry', () => {
  const ROW = 'map:3:ticket:4'
  const AGENTS_ARGS = ['agents', '--json']
  const agents = (entries: ReadonlyArray<Record<string, unknown>>): ProcessRecording => ({
    command: CLAUDE,
    args: AGENTS_ARGS,
    stdout: JSON.stringify(entries),
    stderr: '',
    exitCode: 0,
  })
  const entry = (
    name: string,
    status: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    sessionId: `id-${name}`,
    name,
    status,
    kind: 'interactive',
    startedAt: 1,
    ...extra,
  })

  /** The launchable workspace with a registry the test can change between reads. */
  const withRegistry = (
    initial: ReadonlyArray<Record<string, unknown>>,
    body: (
      context: Parameters<Parameters<typeof withCockpit<void>>[1]>[0] & {
        listing: (entries: ReadonlyArray<Record<string, unknown>>) => void
      },
    ) => Effect.Effect<void, never, never>,
  ) => {
    const setup = launchable()
    const recordings = [...setup.recordings!, agents(initial)]
    const slot = recordings.length - 1
    return withCockpit({ ...setup, recordings }, (context) =>
      body({
        ...context,
        listing: (entries) => {
          recordings[slot] = agents(entries)
        },
      }),
    )
  }

  const flush = Effect.gen(function* () {
    for (let i = 0; i < 20; i++) yield* Effect.yieldNow
  })
  const sessionOfKey = (published: ViewModel[], key: string) =>
    ticketRowOf(published.at(-1), key)?.session

  it.effect('makes a ticket live from a registry entry with no Cockpit terminal', () =>
    withRegistry([entry('#4 Row density', 'busy')], ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.visible(true)
        expect(sessionOfKey(published, ROW)).toMatchObject({
          kind: 'live',
          status: 'working',
          needsYou: false,
          focusable: false,
          warning: null,
        })
        expect(terminals.opened).toEqual([])
      }),
    ),
  )

  it.effect('reads the registry once when the view is shown, even before the first collect', () =>
    withRegistry([entry('#4 Row density', 'idle')], ({ cockpit, published, badges }) =>
      Effect.gen(function* () {
        yield* cockpit.visible(true)
        expect(published).toEqual([])
        yield* cockpit.show
        yield* flush
        expect(sessionOfKey(published, ROW)).toMatchObject({
          status: 'waiting for you',
          needsYou: true,
        })
        expect(badges.at(-1)).toBe(1)
      }),
    ),
  )

  it.effect('warns under the ticket when a second live session has its number', () =>
    withRegistry(
      [
        entry('#4 Row density', 'busy', { startedAt: 1 }),
        entry('#4 Row density-calm-otter', 'idle', { startedAt: 2 }),
      ],
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.visible(true)
          expect(sessionOfKey(published, ROW)).toMatchObject({
            kind: 'live',
            status: 'working',
            warning: 'Another live session has this ticket’s number',
          })
        }),
    ),
  )

  it.effect(
    'does not keep the collect open while it reads the registry, so Refresh still collects',
    () => {
      const setup = launchable()
      return withCockpit(
        { ...setup, recordings: [...setup.recordings!, agents([])], delay: 1000 },
        ({ cockpit, runs }) =>
          Effect.gen(function* () {
            yield* cockpit.visible(true)
            const shown = yield* Effect.forkChild(cockpit.show)
            // The collect runs the repo lookup and plugin list; the registry read that waited for it starts after.
            yield* TestClock.adjust('2 seconds')
            yield* flush
            const refreshed = yield* Effect.forkChild(cockpit.refresh)
            yield* TestClock.adjust('1 minute')
            yield* Fiber.joinAll([shown, refreshed])
            // show: repo lookup, plugin list, registry; refresh: repo lookup and plugin list again.
            expect(runs()).toBe(5)
          }),
      )
    },
  )

  it.effect('leaves entries whose names carry no ticket number alone', () =>
    withRegistry([entry('refactor the build', 'busy')], ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.visible(true)
        expect(sessionOfKey(published, ROW)).toEqual({ kind: 'none' })
      }),
    ),
  )

  it.effect('reads again a second after the sessions directory changes, once for a burst', () =>
    withRegistry(
      [entry('#4 Row density', 'busy')],
      ({ cockpit, published, registry, listing, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.visible(true)
          const before = runs()
          listing([entry('#4 Row density', 'idle')])
          registry.change()
          yield* TestClock.adjust('600 millis')
          registry.change()
          registry.change()
          yield* TestClock.adjust('999 millis')
          yield* flush
          expect(runs()).toBe(before)
          expect(sessionOfKey(published, ROW)).toMatchObject({ status: 'working' })
          yield* TestClock.adjust('1 millis')
          yield* flush
          expect(runs()).toBe(before + 1)
          expect(sessionOfKey(published, ROW)).toMatchObject({ status: 'waiting for you' })
        }),
    ),
  )

  it.effect('falls back to the last status event when the entry vanishes', () =>
    withRegistry(
      [entry('#1 Palette', 'idle')],
      ({ cockpit, published, registry, listing, terminals, fs, watcher }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          expect(terminals.opened).toHaveLength(1)
          yield* cockpit.visible(true)
          yield* fs
            .writeFile(EVENTS, eventLine('1', 'SessionStart', 'id-#1 Palette', 'startup'))
            .pipe(Effect.orDie)
          watcher.change()
          yield* flush
          expect(sessionOfKey(published, PALETTE)).toMatchObject({ status: 'waiting for you' })
          listing([])
          registry.change()
          yield* TestClock.adjust('1 second')
          yield* flush
          expect(sessionOfKey(published, PALETTE)).toMatchObject({ kind: 'live', status: null })
        }),
    ),
  )

  it.effect('forgets a hand-started session once the registry stops listing it', () =>
    withRegistry([entry('#4 Row density', 'busy')], ({ cockpit, published, registry, listing }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.visible(true)
        listing([])
        registry.change()
        yield* TestClock.adjust('1 second')
        yield* flush
        expect(sessionOfKey(published, ROW)).toEqual({ kind: 'none' })
      }),
    ),
  )

  it.effect('stops watching while hidden, spawns nothing, and reads once when shown again', () =>
    withRegistry(
      [entry('#4 Row density', 'busy')],
      ({ cockpit, published, registry, listing, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.visible(true)
          expect(registry.watching()).toBe(true)
          yield* cockpit.visible(false)
          expect(registry.watching()).toBe(false)
          const hidden = runs()
          listing([entry('#4 Row density', 'idle')])
          registry.change()
          yield* TestClock.adjust('10 seconds')
          yield* flush
          expect(runs()).toBe(hidden)
          expect(sessionOfKey(published, ROW)).toMatchObject({ status: 'working' })
          yield* cockpit.visible(true)
          expect(runs()).toBe(hidden + 1)
          expect(registry.watching()).toBe(true)
          expect(sessionOfKey(published, ROW)).toMatchObject({ status: 'waiting for you' })
        }),
    ),
  )

  it.effect('drops a read still waiting out its debounce when the view is hidden', () =>
    withRegistry([entry('#4 Row density', 'busy')], ({ cockpit, registry, runs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.visible(true)
        registry.change()
        yield* TestClock.adjust('500 millis')
        const before = runs()
        yield* cockpit.visible(false)
        yield* TestClock.adjust('5 seconds')
        yield* flush
        expect(runs()).toBe(before)
      }),
    ),
  )

  it.effect(
    'says nothing about a registry it cannot read and keeps the sessions as they are',
    () => {
      const setup = launchable()
      const recordings = [...setup.recordings!, { ...agents([]), stdout: 'not json' }]
      return withCockpit({ ...setup, recordings }, ({ cockpit, published, logged }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          yield* cockpit.visible(true)
          expect(logged.some((line) => line.startsWith('registry: registry-unreadable'))).toBe(true)
          expect(sessionOfKey(published, PALETTE)).toMatchObject({ kind: 'starting' })
        }),
      )
    },
  )

  it.effect('reads nothing when claude cannot be found', () =>
    withCockpit({}, ({ cockpit, runs }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const before = runs()
        yield* cockpit.visible(true)
        expect(runs()).toBe(before)
      }),
    ),
  )

  it.effect('still reads the registry where there is no sessions directory to watch', () =>
    withCockpit(
      {
        ...launchable(),
        recordings: [...launchable().recordings!, agents([])],
        registryDirectory: false,
      },
      ({ cockpit, registry, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const before = runs()
          yield* cockpit.visible(true)
          expect(registry.watching()).toBe(false)
          expect(runs()).toBe(before + 1)
        }),
    ),
  )

  describe('when the tracker and the session side disagree', () => {
    const unlistedOf = (viewModel: ViewModel | undefined) =>
      viewModel?.kind === 'maps' ? viewModel.unlisted : undefined
    const decisionsOf = (viewModel: ViewModel | undefined) =>
      maps(viewModel).find((map) => map.number === 3)?.decisions

    it.effect(
      'keeps a closed ticket wrapping up in the Decisions fold, counting for the badge',
      () =>
        withRegistry([entry('#5 Icon set', 'idle')], ({ cockpit, published, badges }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            yield* cockpit.visible(true)
            const decisions = decisionsOf(published.at(-1))
            expect(decisions?.wrappingUp).toBe(1)
            expect(decisions?.entries).toEqual([
              expect.objectContaining({
                number: 5,
                session: expect.objectContaining({ kind: 'live', status: 'waiting for you' }),
                disagreement: expect.objectContaining({ kind: 'wrapping-up' }),
              }),
            ])
            expect(badges.at(-1)).toBe(1)
          }),
        ),
    )

    it.effect(
      'lists a registry session #999 with no ticket in one row, counting for the badge',
      () =>
        withRegistry(
          [entry('#999 Elsewhere', 'idle')],
          ({ cockpit, published, badges, terminals }) =>
            Effect.gen(function* () {
              yield* cockpit.show
              yield* cockpit.visible(true)
              expect(unlistedOf(published.at(-1))).toEqual([
                expect.objectContaining({
                  number: 999,
                  title: 'Elsewhere',
                  session: expect.objectContaining({ kind: 'live', needsYou: true }),
                }),
              ])
              expect(badges.at(-1)).toBe(1)
              // Nothing of the Cockpit runs it, so focus terminal has nowhere to go.
              yield* cockpit.receive({ type: 'focus-terminal', key: 'unlisted:ticket:999' })
              expect(terminals.focused).toEqual([])
            }),
        ),
    )

    it.effect('keeps the ended record of a session with no ticket after it ends', () =>
      withRegistry(
        [entry('#999 Elsewhere', 'idle')],
        ({ cockpit, published, badges, registry, listing }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            yield* cockpit.visible(true)
            listing([])
            registry.change()
            yield* TestClock.adjust('1 second')
            yield* flush
            expect(unlistedOf(published.at(-1))).toEqual([
              expect.objectContaining({
                number: 999,
                session: expect.objectContaining({ kind: 'ended', detail: 'process gone' }),
              }),
            ])
            expect(badges.at(-1)).toBe(0)
          }),
      ),
    )

    it.effect('reads the tracker again when the registry stops listing a session', () =>
      withRegistry([entry('#4 Row density', 'busy')], ({ cockpit, registry, listing, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          yield* cockpit.visible(true)
          const before = runs()
          listing([])
          registry.change()
          yield* TestClock.adjust('1 second')
          yield* flush
          // The registry read, and the collect it asked for: the repo lookup and the plugin list.
          expect(runs()).toBe(before + 3)
        }),
      ),
    )
  })
})

describe('the Cockpit controller reading the tracker again for sessions', () => {
  const NINE_59 = Date.parse('2026-10-08T09:59:00.000Z')
  const TEN = Date.parse('2026-10-08T10:00:00.000Z')
  const PALETTE_FILE = `${ROOT}/.scratch/cockpit-colors/issues/01-palette.md`
  const CLAIMED_PALETTE =
    '# Palette\n\nType: prototype\nStatus: claimed\n\n## Question\n\nWhich colors?\n'

  const appendEvents = (
    fs: FileSystem['Service'],
    watcher: { change: () => void },
    text: string,
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const before = yield* fs.readFile(EVENTS).pipe(Effect.orElseSucceed(() => ''))
      yield* fs.writeFile(EVENTS, before + text).pipe(Effect.orDie)
      watcher.change()
      for (let i = 0; i < 40; i++) yield* Effect.yieldNow
    })

  const rowOf = (published: ViewModel[], key = PALETTE) => ticketRowOf(published.at(-1), key)
  const nextOf = (published: ViewModel[]) =>
    maps(published.at(-1))
      .find((map) => map.number === 3)
      ?.tickets.find((row) => row.next)?.number

  it.effect(
    'takes a launched ticket off the frontier at once and says the claim is not there yet',
    () =>
      withCockpit(launchable(), ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(NINE_59)
          yield* cockpit.show
          expect(nextOf(published)).toBe(1)
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          expect(rowOf(published)).toMatchObject({
            place: 'claimed',
            disagreement: { kind: 'claim-pending', text: 'live · claim not on tracker yet' },
          })
          expect(nextOf(published)).toBe(3)
        }),
      ),
  )

  it.effect(
    'collects when SessionStart arrives, and clears the text once the snapshot has the claim',
    () =>
      withCockpit(launchable(), ({ cockpit, published, fs, watcher, runs }) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(NINE_59)
          yield* cockpit.show
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          const before = runs()
          yield* TestClock.setTime(TEN)
          // The tracker catches up: the wayfinder session claimed the ticket.
          yield* fs.writeFile(PALETTE_FILE, CLAIMED_PALETTE).pipe(Effect.orDie)
          yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
          expect(runs()).toBeGreaterThan(before)
          expect(rowOf(published)).toMatchObject({
            place: 'claimed',
            disagreement: null,
            session: { kind: 'live' },
          })
        }),
      ),
  )

  it.effect(
    'warns "not claimed on the tracker" when the snapshot after SessionStart has no claim',
    () =>
      withCockpit(launchable(), ({ cockpit, published, fs, watcher }) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(NINE_59)
          yield* cockpit.show
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          yield* TestClock.setTime(TEN)
          yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
          expect(rowOf(published)).toMatchObject({
            place: 'claimed',
            disagreement: {
              kind: 'unclaimed',
              text: 'not claimed on the tracker',
              level: 'warning',
            },
          })
          expect(nextOf(published)).toBe(3)
        }),
      ),
  )

  it.effect('collects when a ticket session ends', () =>
    withCockpit(launchable(), ({ cockpit, published, fs, watcher, runs }) =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NINE_59)
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
        const before = runs()
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionEnd', 'A', 'prompt_input_exit'))
        expect(runs()).toBeGreaterThan(before)
        // Ended is no session to hold the ticket: it is on the frontier again.
        expect(rowOf(published)).toMatchObject({ place: 'frontier', disagreement: null })
      }),
    ),
  )

  it.effect('collects when the terminal of a session closes', () =>
    withCockpit(launchable(), ({ cockpit, fs, watcher, runs, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'A', 'startup'))
        const before = runs()
        terminals.close(1, { reason: 'user', code: null })
        for (let i = 0; i < 40; i++) yield* Effect.yieldNow
        expect(runs()).toBeGreaterThan(before)
      }),
    ),
  )

  it.effect('leaves the 60 s gap to the policy on a GitHub tracker', () =>
    withCockpit(
      { files: GITHUB_DOC, recordings: onGitHub(...goodCollect()) },
      ({ cockpit, published, fs, watcher, runs }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const perCollect = runs()
          const number = maps(published.at(-1)).flatMap((map) => map.tickets)[0]?.number
          if (number === undefined) throw new Error('expected an open ticket in the recording')
          yield* TestClock.adjust('10 seconds')
          yield* appendEvents(
            fs,
            watcher,
            eventLine(String(number), 'SessionStart', 'A', 'startup'),
          )
          expect(runs()).toBe(perCollect)
          yield* TestClock.adjust('61 seconds')
          yield* appendEvents(
            fs,
            watcher,
            eventLine(String(number), 'SessionEnd', 'A', 'prompt_input_exit'),
          )
          expect(runs()).toBe(perCollect * 2)
        }),
    ),
  )

  it.effect(
    'names who claimed a ticket when a session is live here and the claim is not mine',
    () => {
      const user = (login: string): ProcessRecording => ({
        command: 'gh',
        args: ['api', 'user', '--jq', '.login'],
        stdout: `${login}\n`,
        stderr: '',
        exitCode: 0,
      })
      /** The recording with ticket #66, open and unclaimed in it, assigned to dbarjs. */
      const claimed66 = (recording: ProcessRecording): ProcessRecording => {
        const at = recording.stdout.indexOf('"number":66')
        return {
          ...recording,
          stdout:
            recording.stdout.slice(0, at) +
            recording.stdout
              .slice(at)
              .replace('"assignees":{"nodes":[]}', '"assignees":{"nodes":[{"login":"dbarjs"}]}'),
        }
      }
      const claimedRow = (published: ViewModel[]) =>
        maps(published.at(-1))
          .flatMap((map) => map.tickets)
          .find((row) => row.number === 66)
      const run = (login: string) =>
        withCockpit(
          {
            files: GITHUB_DOC,
            recordings: onGitHub(goodCollect()[0]!, claimed66(goodCollect()[1]!), user(login)),
          },
          ({ cockpit, published, fs, watcher }) =>
            Effect.gen(function* () {
              yield* cockpit.show
              const claimed = claimedRow(published)
              if (claimed === undefined)
                throw new Error('expected a claimed ticket in the recording')
              yield* appendEvents(fs, watcher, eventLine('66', 'SessionStart', 'A', 'startup'))
              return claimedRow(published)?.disagreement ?? null
            }),
        )
      return Effect.gen(function* () {
        expect(yield* run('someone-else')).toEqual({
          kind: 'claimed-by-other',
          text: 'claimed by dbarjs on the tracker, session live here',
          level: 'warning',
        })
        expect(yield* run('dbarjs')).toBeNull()
      })
    },
  )
})

describe('the Cockpit controller resuming, adopting terminals and showing worktrees', () => {
  const FOURTH = 'map:3:ticket:4'

  /** What the plugin does: append to the events file, then the disk tells the watcher. */
  const appendEvents = (
    fs: FileSystem['Service'],
    watcher: { change: () => void },
    text: string,
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const before = yield* fs.readFile(EVENTS).pipe(Effect.orElseSucceed(() => ''))
      yield* fs.writeFile(EVENTS, before + text).pipe(Effect.orDie)
      watcher.change()
      for (let i = 0; i < 20; i++) yield* Effect.yieldNow
    })

  const sessionOf = (published: ViewModel[], key: string) =>
    ticketRowOf(published.at(-1), key)?.session

  it.effect('resumes an ended session by its id, with the plugin and the env set again', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals, fs, watcher }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* appendEvents(fs, watcher, eventLine('1', 'SessionStart', 'sess-1', 'startup'))
        terminals.close(1, { reason: 'user', code: null })
        yield* Effect.yieldNow
        yield* cockpit.receive({ type: 'select', key: PALETTE })
        const shown = published.at(-1)
        const selection = shown?.kind === 'maps' ? shown.selection : null
        const actions = selection?.kind === 'ticket' ? selection.actions : []
        expect(actions.map((action) => action.id)).toEqual(['resume', 'launch-fresh'])
        expect(actions[0]).toMatchObject({
          label: 'Resume',
          command: "claude --resume sess-1 -n '#1 Palette' --plugin-dir /ext/claude-plugin",
          disabled: null,
        })
        expect(actions[0]?.envLine).toContain('HERO_SYNERGY_TICKET=1')

        yield* cockpit.receive({ type: 'launch', key: PALETTE, action: 'resume' })
        expect(terminals.opened).toHaveLength(2)
        expect(terminals.opened[1]).toMatchObject({
          name: '#1 Palette',
          shellPath: CLAUDE,
          shellArgs: [
            '--resume',
            'sess-1',
            '-n',
            '#1 Palette',
            '--plugin-dir',
            '/ext/claude-plugin',
          ],
          cwd: ROOT,
          env: { HERO_SYNERGY_TICKET: '1', HERO_SYNERGY_EVENTS: EVENTS },
        })
        // A tracked session again: starting, with the same id remembered for the next resume.
        expect(sessionOf(published, PALETTE)?.kind).toBe('starting')
      }),
    ),
  )

  it.effect('runs Launch fresh as the plain Work ticket command on an ended session', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        terminals.close(1, { reason: 'user', code: null })
        yield* Effect.yieldNow
        yield* cockpit.receive({ type: 'launch', key: PALETTE, action: 'launch-fresh' })
        expect(terminals.opened).toHaveLength(2)
        expect(terminals.opened[1]?.shellArgs).toEqual(terminals.opened[0]?.shellArgs)
        expect(sessionOf(published, PALETTE)?.kind).toBe('starting')
      }),
    ),
  )

  it.effect(
    'adopts a terminal named for a ticket after a reload, keeping what the file said of its session',
    () => {
      const setup = launchable()
      const text = eventLine('4', 'SessionStart', 'A')
      return withCockpit(
        { ...setup, files: { ...setup.files, [EVENTS]: text } },
        ({ cockpit, published, terminals }) =>
          Effect.gen(function* () {
            terminals.kept.push('zsh', '#4 Row density')
            yield* cockpit.show
            // #4 has a terminal named for it: its last event stands, and focus reaches the terminal.
            expect(sessionOf(published, FOURTH)).toMatchObject({ kind: 'live', focusable: true })
            yield* cockpit.receive({ type: 'focus-terminal', key: FOURTH })
            expect(terminals.focused).toEqual([1000 + 1])
            // The adopted terminal closing ends its ticket like any other.
            terminals.close(1001, { reason: 'user', code: null })
            yield* Effect.yieldNow
            expect(sessionOf(published, FOURTH)).toMatchObject({
              kind: 'ended',
              detail: 'terminal closed',
            })
          }),
      )
    },
  )

  it.effect(
    'adopts a named terminal the file knows nothing of as starting, for the registry to confirm',
    () =>
      withCockpit(launchable(), ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          terminals.kept.push('#4 Row density', 'build', '#12abc')
          yield* cockpit.show
          expect(sessionOf(published, FOURTH)?.kind).toBe('starting')
          // Only a name that starts with `#<number>` counts; the rest of the Tree is untouched.
          expect(sessionOf(published, PALETTE)?.kind).toBe('none')
        }),
      ),
  )

  describe('on a GitHub tracker', () => {
    const worktreeList = (number: number): ProcessRecording => ({
      command: 'git',
      args: ['worktree', 'list', '--porcelain'],
      stdout: `worktree ${ROOT}\nHEAD 1111\nbranch refs/heads/main\n\nworktree ${ROOT}/.claude/worktrees/${number}\nHEAD 2222\nbranch refs/heads/worktree-${number}\n`,
      stderr: '',
      exitCode: 0,
    })
    const inWorktree = (number: number, args: string[], stdout: string): ProcessRecording => ({
      command: 'git',
      args: ['-C', `${ROOT}/.claude/worktrees/${number}`, ...args],
      stdout,
      stderr: '',
      exitCode: 0,
    })

    it.effect('shows a ticket’s worktree in the Focus pane and the Detail, read-only', () => {
      const recordings = onGitHub(...goodCollect())
      return withCockpit({ files: GITHUB_DOC, recordings }, ({ cockpit, published, details }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          const rows = mapsOf(published[0]).maps.flatMap((map) => map.tickets)
          const [withTree, without] = rows
          if (withTree === undefined || without === undefined) throw new Error('no tickets')
          const n = withTree.number
          recordings.push(
            worktreeList(n),
            inWorktree(n, ['--no-optional-locks', 'status', '--porcelain'], ' M a.ts\n?? b.ts\n'),
            inWorktree(n, ['log', '--format=%H', `main..worktree-${n}`], 'c0ffee\n'),
          )
          yield* cockpit.refresh
          yield* cockpit.receive({ type: 'select', key: withTree.key })
          expect(mapsOf(published.at(-1)).selection).toMatchObject({
            kind: 'ticket',
            worktree: { branch: `worktree-${n}`, uncommitted: 2, ahead: 1 },
          })
          expect(details.at(-1)?.detail).toMatchObject({
            kind: 'ticket',
            worktree: { branch: `worktree-${n}`, uncommitted: 2, ahead: 1 },
          })
          // A ticket with no worktree shows none.
          yield* cockpit.receive({ type: 'select', key: without.key })
          expect(mapsOf(published.at(-1)).selection).toMatchObject({
            kind: 'ticket',
            worktree: null,
          })
        }),
      )
    })
  })

  it.effect('reads no worktree on a local tracker, which has none', () =>
    withCockpit(launchable(), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        yield* cockpit.receive({ type: 'select', key: PALETTE })
        expect(mapsOf(published.at(-1)).selection).toMatchObject({ worktree: null })
      }),
    ),
  )
})

describe('the Cockpit controller reporting health', () => {
  const flush = Effect.gen(function* () {
    for (let i = 0; i < 20; i++) yield* Effect.yieldNow
  })
  const printsVersion = (stdout: string): ProcessRecording => ({
    command: CLAUDE,
    args: ['--version'],
    stdout,
    stderr: '',
    exitCode: 0,
  })
  /** The launchable window, where nothing is wrong unless a test makes it so. */
  const withVersion = (stdout: string, extra: Partial<Setup> = {}): Setup => {
    const setup = launchable()
    return { ...setup, recordings: [...setup.recordings!, printsVersion(stdout)], ...extra }
  }
  const healthOf = (viewModel: ViewModel | undefined) => {
    if (viewModel?.kind === 'loading') throw new Error('expected a view model with a health field')
    return viewModel?.health ?? null
  }
  const codes = (viewModel: ViewModel | undefined) =>
    healthOf(viewModel)?.entries.map((entry) => entry.code) ?? []

  it.effect('is loud for a claude below 2.1.212, with the hint to update', () =>
    withCockpit(withVersion('2.1.211 (Claude Code)\n'), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.checkClaude
        yield* cockpit.show
        const health = healthOf(published.at(-1))
        expect(health).toMatchObject({ loud: true, label: 'Health · 1 warning' })
        expect(health?.entries[0]).toMatchObject({
          code: 'claude-below-floor',
          level: 'loud',
          detail: '2.1.211',
        })
        expect(health?.entries[0]?.hint).toContain('claude update')
        expect(health?.hover).toEqual([health?.entries[0]?.message])
      }),
    ),
  )

  it.effect('says nothing for 2.1.212, or for a version above the tested ceiling', () =>
    Effect.gen(function* () {
      for (const version of ['2.1.212 (Claude Code)\n', '2.1.1000\n', '3.0.0-beta.1\n']) {
        yield* withCockpit(withVersion(version), ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.activated
            yield* cockpit.checkClaude
            yield* cockpit.show
            expect(healthOf(published.at(-1)), version).toBeNull()
          }),
        )
      }
    }),
  )

  it.effect('compares the leading x.y.z by number, so 2.1.9 is below 2.1.212', () =>
    withCockpit(withVersion('2.1.9\n'), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.checkClaude
        yield* cockpit.show
        expect(codes(published.at(-1))).toEqual(['claude-below-floor'])
      }),
    ),
  )

  it.effect('notes a version it cannot read quietly, and skips the floor check', () =>
    withCockpit(withVersion('banana\n'), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.checkClaude
        yield* cockpit.show
        const health = healthOf(published.at(-1))
        expect(health).toMatchObject({ loud: false, label: 'Health · 1 note', hover: [] })
        expect(codes(published.at(-1))).toEqual(['claude-version-unreadable'])
      }),
    ),
  )

  it.effect('reads claude --version once at activation, and again on the Refresh button', () =>
    withCockpit(withVersion('2.1.300\n'), ({ cockpit, runs, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        expect(runs()).toBe(0)
        yield* cockpit.checkClaude
        expect(runs()).toBe(1)
        // A healthy claude at activation publishes nothing: the Tree is not registered yet.
        expect(published).toEqual([])
        yield* cockpit.show
        // The collect found claude where activation did: no second read for the same path.
        const afterShow = runs()
        yield* cockpit.refresh
        // Refresh reads the version again, then collects (repo lookup and plugin list).
        expect(runs()).toBe(afterShow + 3)
      }),
    ),
  )

  it.effect('clears the entry when the Refresh button finds claude updated', () => {
    const setup = withVersion('2.1.211\n')
    return withCockpit(setup, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.checkClaude
        yield* cockpit.show
        expect(codes(published.at(-1))).toEqual(['claude-below-floor'])
        setup.recordings![setup.recordings!.length - 1] = printsVersion('2.1.212\n')
        yield* cockpit.refresh
        expect(healthOf(published.at(-1))).toBeNull()
      }),
    )
  })

  it.effect('reports a claude that is not found, and a missing wayfinder skill', () =>
    withCockpit({}, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.show
        expect(codes(published.at(-1))).toEqual(['claude-not-found', 'skill-missing'])
        expect(healthOf(published.at(-1))?.label).toBe('Health · 2 warnings')
      }),
    ),
  )

  it.effect('pins the row above the empty state too, and selects it for its pane', () =>
    withCockpit({ recordings: [notARepo(ROOT)] }, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.show
        const message = published.at(-1)
        expect(message?.kind).toBe('message')
        expect(codes(message)).toEqual(['claude-not-found'])
        yield* cockpit.receive({ type: 'select', key: 'health' })
        const selected = published.at(-1)
        expect(selected?.kind === 'message' && selected.selection).toMatchObject({
          kind: 'health',
          key: 'health',
        })
      }),
    ),
  )

  it.effect('raises the plugin manifest and hook problems the host reads', () => {
    const setup = launchable()
    return withCockpit(
      { ...setup, recordings: [inRepo(ROOT, ROOT), pluginList('not json')] },
      ({ cockpit, published, fs, watcher }) =>
        Effect.gen(function* () {
          yield* cockpit.show
          expect(codes(published.at(-1))).toEqual(['plugin-manifest-unreadable'])
          yield* fs.writeFile(EVENTS, '{"nope":1}\n').pipe(Effect.orDie)
          watcher.change()
          yield* flush
          expect(codes(published.at(-1))).toEqual([
            'hook-payload-unreadable',
            'plugin-manifest-unreadable',
          ])
          // A hook line the same fault again is the same entry.
          yield* fs.writeFile(EVENTS, '{"nope":1}\n{"nope":2}\n').pipe(Effect.orDie)
          watcher.change()
          yield* flush
          expect(codes(published.at(-1))).toEqual([
            'hook-payload-unreadable',
            'plugin-manifest-unreadable',
          ])
        }),
    )
  })

  describe('when the registry cannot be decoded', () => {
    const AGENTS = ['agents', '--json']
    const registryFor = (stdout: string): ProcessRecording => ({
      command: CLAUDE,
      args: AGENTS,
      stdout,
      stderr: '',
      exitCode: 0,
    })
    const live = (name: string, status: string) =>
      JSON.stringify([{ sessionId: `id-${name}`, name, status, kind: 'interactive', startedAt: 1 }])

    const withRegistry = (
      initial: string,
      body: (
        context: Parameters<Parameters<typeof withCockpit<void>>[1]>[0] & {
          prints: (stdout: string) => void
        },
      ) => Effect.Effect<void, never, never>,
    ) => {
      const setup = launchable()
      const recordings = [...setup.recordings!, registryFor(initial)]
      const slot = recordings.length - 1
      return withCockpit({ ...setup, recordings }, (context) =>
        body({
          ...context,
          prints: (stdout) => {
            recordings[slot] = registryFor(stdout)
          },
        }),
      )
    }

    it.effect(
      'gives one loud entry, shows status unknown with no badge, and keeps the terminal and the ended record',
      () =>
        withRegistry(
          live('#1 Palette', 'idle'),
          ({ cockpit, published, badges, registry, prints, terminals }) =>
            Effect.gen(function* () {
              yield* cockpit.checkClaude
              yield* cockpit.show
              yield* cockpit.receive({ type: 'launch', key: PALETTE })
              yield* cockpit.visible(true)
              expect(ticketRowOf(published.at(-1), PALETTE)?.session).toMatchObject({
                kind: 'live',
                status: 'waiting for you',
                needsYou: true,
                focusable: true,
              })
              expect(badges.at(-1)).toBe(1)
              expect(healthOf(published.at(-1))).toBeNull()

              prints('{"sessions": []}')
              registry.change()
              yield* TestClock.adjust('1 second')
              yield* flush

              const health = healthOf(published.at(-1))
              expect(health).toMatchObject({ loud: true, label: 'Health · 1 warning' })
              expect(health?.entries[0]).toMatchObject({
                code: 'registry-unreadable',
                level: 'loud',
              })
              expect(health?.entries[0]?.message).toContain('Claude Code 2.1.300')
              expect(ticketRowOf(published.at(-1), PALETTE)?.session).toMatchObject({
                kind: 'live',
                status: 'status unknown',
                needsYou: false,
                focusable: true,
              })
              expect(badges.at(-1)).toBe(0)

              // The record of a session that ends meanwhile is kept, unknown or not.
              terminals.close(1, { reason: 'user', code: null })
              yield* flush
              expect(ticketRowOf(published.at(-1), PALETTE)?.session).toMatchObject({
                kind: 'ended',
                detail: 'terminal closed',
              })
            }),
        ),
    )

    it.effect('goes back to the registry’s word, and the entry goes, once it decodes again', () =>
      withRegistry(
        live('#4 Row density', 'idle'),
        ({ cockpit, published, badges, registry, prints }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            yield* cockpit.visible(true)
            prints('nonsense')
            registry.change()
            yield* TestClock.adjust('1 second')
            yield* flush
            expect(codes(published.at(-1))).toEqual(['registry-unreadable'])
            expect(ticketRowOf(published.at(-1), 'map:3:ticket:4')?.session).toMatchObject({
              status: 'status unknown',
            })

            prints(live('#4 Row density', 'idle'))
            registry.change()
            yield* TestClock.adjust('1 second')
            yield* flush
            expect(healthOf(published.at(-1))).toBeNull()
            expect(ticketRowOf(published.at(-1), 'map:3:ticket:4')?.session).toMatchObject({
              status: 'waiting for you',
              needsYou: true,
            })
            expect(badges.at(-1)).toBe(1)
          }),
      ),
    )

    it.effect('reports an entry it cannot read and a status it does not know', () =>
      withRegistry(
        JSON.stringify([
          { sessionId: 'a', name: '#4 Row density', status: 'napping' },
          { name: 'no id', status: 'busy' },
        ]),
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.show
            yield* cockpit.visible(true)
            expect(codes(published.at(-1))).toEqual([
              'registry-status-unknown',
              'registry-entry-unreadable',
            ])
            // The registry as a whole decoded: nobody's status is unknown on its account.
            expect(healthOf(published.at(-1))?.label).toBe('Health · 2 warnings')
          }),
      ),
    )
  })

  describe('dismissing an entry', () => {
    const dismissFirst = (published: ViewModel[], cockpit: Cockpit) => {
      const key = healthOf(published.at(-1))?.entries[0]?.dismissKey
      if (key === undefined) throw new Error('expected an entry to dismiss')
      return cockpit.receive({ type: 'dismiss-health', dismissKey: key })
    }

    it.effect('stays dismissed in another workspace, and returns when its detail changes', () => {
      const global = new Map<string, unknown>()
      return Effect.gen(function* () {
        yield* withCockpit(withVersion('2.1.211\n', { global }), ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.checkClaude
            yield* cockpit.show
            expect(codes(published.at(-1))).toEqual(['claude-below-floor'])
            yield* dismissFirst(published, cockpit)
            expect(healthOf(published.at(-1))).toBeNull()
          }),
        )
        // Another workspace of the same profile: nothing of its own was stored.
        yield* withCockpit(
          withVersion('2.1.211\n', { global, stored: {} }),
          ({ cockpit, published }) =>
            Effect.gen(function* () {
              yield* cockpit.checkClaude
              yield* cockpit.show
              expect(healthOf(published.at(-1))).toBeNull()
            }),
        )
        // A different version is a different detail: the entry is back.
        yield* withCockpit(withVersion('2.1.210\n', { global }), ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.checkClaude
            yield* cockpit.show
            expect(codes(published.at(-1))).toEqual(['claude-below-floor'])
          }),
        )
      })
    })

    it.effect('does not use the workspace’s own storage', () => {
      const global = new Map<string, unknown>()
      return withCockpit(withVersion('2.1.211\n', { global }), ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.checkClaude
          yield* cockpit.show
          yield* dismissFirst(published, cockpit)
          expect(global.get('dismissedHealth')).toHaveLength(1)
        }),
      )
    })
  })

  describe('the output channel', () => {
    it.effect('logs each entry once, with what was seen, across two refreshes', () =>
      withCockpit(withVersion('2.1.211 (Claude Code)\n'), ({ cockpit, logged }) =>
        Effect.gen(function* () {
          yield* cockpit.activated
          yield* cockpit.checkClaude
          yield* cockpit.show
          yield* cockpit.refresh
          yield* cockpit.refresh
          const lines = logged.filter((line) => line.startsWith('health '))
          expect(lines).toHaveLength(1)
          expect(lines[0]).toContain('claude-below-floor')
          expect(lines[0]).toContain('saw "2.1.211 (Claude Code)\\n"')
        }),
      ),
    )

    it.effect('cuts what was seen at 2 KB', () =>
      withCockpit(withVersion('x'.repeat(5000)), ({ cockpit, logged }) =>
        Effect.gen(function* () {
          yield* cockpit.checkClaude
          const line = logged.find((entry) => entry.includes('claude-version-unreadable'))
          expect(line).toBeDefined()
          expect(line!.length).toBeLessThan(2048 + 400)
        }),
      ),
    )

    it.effect('logs an entry again when it comes back with another detail', () => {
      const setup = withVersion('2.1.211\n')
      return withCockpit(setup, ({ cockpit, logged }) =>
        Effect.gen(function* () {
          yield* cockpit.checkClaude
          setup.recordings![setup.recordings!.length - 1] = printsVersion('2.1.210\n')
          yield* cockpit.refresh
          expect(logged.filter((line) => line.startsWith('health ')).length).toBe(2)
        }),
      )
    })
  })
})

describe('the Cockpit controller bypassing permissions', () => {
  const AUDIT = 'map:3:ticket:3'
  const FLAG = '--permission-mode bypassPermissions'
  const DEV_CONTAINER = { remoteName: 'dev-container' } as const

  const bypassing = (
    mode: BypassSettings['mode'],
    overrides: Partial<HostEnvironmentShape> = {},
    onlyWhenIsolated = true,
  ): Setup => {
    const setup = withSkillsInstalled(ALL_SKILLS)
    return {
      ...setup,
      environment: {
        ...setup.environment,
        bypassSettings: Effect.succeed({ mode, onlyWhenIsolated }),
        ...overrides,
      },
    }
  }
  const healthOf = (viewModel: ViewModel | undefined) =>
    viewModel?.kind === 'loading' ? null : (viewModel?.health ?? null)
  const codes = (viewModel: ViewModel | undefined) =>
    healthOf(viewModel)?.entries.map((entry) => entry.code) ?? []
  const commandOf = (published: ViewModel[], key: string) =>
    ticketRowOf(published.at(-1), key)?.action?.command

  it.effect(
    'bypasses the AFK ticket and not the HITL one under afkTickets, in a dev container',
    () =>
      withCockpit(
        bypassing('afkTickets', DEV_CONTAINER),
        ({ cockpit, published, terminals, copied }) =>
          Effect.gen(function* () {
            yield* cockpit.activated
            yield* cockpit.show
            expect(commandOf(published, AUDIT)).toMatch(
              /^claude --permission-mode bypassPermissions -n '#3 Contrast audit' /,
            )
            expect(commandOf(published, PALETTE)).not.toContain(FLAG)
            expect(codes(published.at(-1))).toEqual([])

            // The shown command, Copy command and the spawned argv are one.
            const shown = commandOf(published, AUDIT)
            yield* cockpit.receive({ type: 'copy', key: AUDIT })
            expect(copied).toEqual([shown])
            yield* cockpit.receive({ type: 'launch', key: AUDIT })
            yield* cockpit.receive({ type: 'launch', key: PALETTE })
            const [audit, palette] = terminals.opened
            expect(audit?.shellArgs.slice(0, 2)).toEqual(['--permission-mode', 'bypassPermissions'])
            expect(renderCommand(['claude', ...(audit?.shellArgs ?? [])])).toBe(shown)
            expect(palette?.shellArgs).not.toContain('--permission-mode')
          }),
      ),
  )

  it.effect('keeps plain Actions interactive under afkTickets', () =>
    withCockpit(bypassing('afkTickets', DEV_CONTAINER), ({ cockpit, published, terminals }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.show
        expect(finishedMapOf(published.at(-1)).finished.action?.command).not.toContain(FLAG)
        yield* cockpit.chartMap
        expect(terminals.opened[0]?.shellArgs).toEqual(['-n', 'Chart a map', '/wayfinder'])
      }),
    ),
  )

  it.effect('bypasses every ticket and every plain Action under allSessions', () =>
    withCockpit(
      { ...bypassing('allSessions', DEV_CONTAINER), choose: () => '/grill-me' },
      ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.activated
          yield* cockpit.show
          expect(commandOf(published, PALETTE)).toContain(`claude ${FLAG} `)
          expect(commandOf(published, AUDIT)).toContain(`claude ${FLAG} `)
          expect(finishedMapOf(published.at(-1)).finished.action?.command).toBe(
            `claude ${FLAG} '/to-spec .scratch/archive-search/map.md'`,
          )
          yield* cockpit.chartMap
          yield* cockpit.runSkill
          expect(terminals.opened.map((spec) => spec.shellArgs)).toEqual([
            ['--permission-mode', 'bypassPermissions', '-n', 'Chart a map', '/wayfinder'],
            ['--permission-mode', 'bypassPermissions', '/grill-me'],
          ])
        }),
    ),
  )

  it.effect('never bypasses the installs, even under allSessions', () =>
    withCockpit(
      {
        // A repo with no skills and no tracker doc: the installs are what it leads with.
        files: { [`${ROOT}/README.md`]: '# billing\n', [CLAUDE]: '#!/bin/sh\n' },
        recordings: [inRepo(ROOT, ROOT), pluginList('[]')],
        environment: {
          claudeSetting: Effect.succeed(CLAUDE),
          bypassSettings: Effect.succeed({ mode: 'allSessions', onlyWhenIsolated: false }),
        },
      },
      ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.activated
          yield* cockpit.show
          const shown = published.at(-1)
          const start = shown?.kind === 'maps' || shown?.kind === 'message' ? shown.start : null
          expect(start?.actions.map((action) => action.id)).toEqual([
            'install-plugin',
            'install-npx',
          ])
          for (const action of start?.actions ?? []) expect(action.command).not.toContain(FLAG)
        }),
    ),
  )

  it.effect('carries the flag on Resume by name and Resume by id of an AFK ticket', () =>
    withCockpit(
      bypassing('afkTickets', DEV_CONTAINER),
      ({ cockpit, published, terminals, fs, watcher }) =>
        Effect.gen(function* () {
          yield* cockpit.activated
          yield* cockpit.show
          // Ended with no id: Resume by name.
          yield* cockpit.receive({ type: 'launch', key: AUDIT })
          terminals.close(1, { reason: 'user', code: null })
          yield* Effect.yieldNow
          yield* cockpit.receive({ type: 'select', key: AUDIT })
          expect(selectionActions(published.at(-1))[0]).toMatchObject({
            id: 'resume-by-name',
            command: `claude ${FLAG} --resume '#3 Contrast audit'`,
          })
          yield* cockpit.receive({ type: 'launch', key: AUDIT, action: 'resume-by-name' })
          expect(terminals.opened[1]?.shellArgs).toEqual([
            '--permission-mode',
            'bypassPermissions',
            '--resume',
            '#3 Contrast audit',
          ])

          // Ended with an id: Resume by id passes the flag again, since --resume drops it.
          terminals.close(2, { reason: 'user', code: null })
          yield* Effect.yieldNow
          yield* cockpit.receive({ type: 'launch', key: AUDIT, action: 'launch-fresh' })
          const before = yield* fs.readFile(EVENTS).pipe(Effect.orElseSucceed(() => ''))
          yield* fs
            .writeFile(EVENTS, before + eventLine('3', 'SessionStart', 'sess-3', 'startup'))
            .pipe(Effect.orDie)
          watcher.change()
          for (let i = 0; i < 20; i++) yield* Effect.yieldNow
          terminals.close(3, { reason: 'user', code: null })
          yield* Effect.yieldNow
          yield* cockpit.receive({ type: 'select', key: AUDIT })
          expect(selectionActions(published.at(-1))[0]).toMatchObject({
            id: 'resume',
            command: `claude ${FLAG} --resume sess-3 -n '#3 Contrast audit' --plugin-dir /ext/claude-plugin`,
          })
        }),
    ),
  )

  it.effect('keeps the prompts outside an isolated environment, with a quiet note saying why', () =>
    withCockpit(bypassing('afkTickets', { remoteName: 'ssh-remote' }), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.show
        expect(commandOf(published, AUDIT)).not.toContain(FLAG)
        expect(healthOf(published.at(-1))?.entries).toEqual([
          expect.objectContaining({
            code: 'bypass-not-isolated',
            level: 'quiet',
            detail: 'Remote-SSH, no container marker',
            hint: 'Reopen the folder in a Dev Container, or turn off heroSynergy.sessions.bypassPermissionsOnlyWhenIsolated.',
          }),
        ])
      }),
    ),
  )

  it.effect('counts a Docker or Podman marker as isolated, and not one in toolbx', () =>
    Effect.gen(function* () {
      for (const marker of ['/.dockerenv', '/run/.containerenv']) {
        const setup = bypassing('afkTickets')
        yield* withCockpit(
          { ...setup, files: { ...setup.files, [marker]: '' } },
          ({ cockpit, published }) =>
            Effect.gen(function* () {
              yield* cockpit.activated
              yield* cockpit.show
              expect(commandOf(published, AUDIT), marker).toContain(FLAG)
              expect(codes(published.at(-1)), marker).toEqual([])
            }),
        )
      }
      const setup = bypassing('afkTickets')
      yield* withCockpit(
        { ...setup, files: { ...setup.files, '/run/.containerenv': '', '/run/.toolboxenv': '' } },
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.activated
            yield* cockpit.show
            expect(commandOf(published, AUDIT)).not.toContain(FLAG)
            expect(healthOf(published.at(-1))?.entries[0]?.detail).toBe(
              'local window, a toolbx or distrobox container',
            )
          }),
      )
    }),
  )

  it.effect('adds the flag anywhere, with no note, once the isolation gate is off', () =>
    withCockpit(bypassing('afkTickets', {}, false), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.show
        expect(commandOf(published, AUDIT)).toContain(FLAG)
        expect(healthOf(published.at(-1))).toBeNull()
      }),
    ),
  )

  it.effect('adds nothing and says nothing while the setting is off', () =>
    withCockpit(bypassing('off', { root: true }), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.show
        expect(commandOf(published, AUDIT)).not.toContain(FLAG)
        expect(healthOf(published.at(-1))).toBeNull()
      }),
    ),
  )

  it.effect('warns loudly as root with no sandbox variable, and still adds the flag', () =>
    Effect.gen(function* () {
      yield* withCockpit(
        bypassing('afkTickets', { ...DEV_CONTAINER, root: true }),
        ({ cockpit, published, terminals }) =>
          Effect.gen(function* () {
            yield* cockpit.activated
            yield* cockpit.show
            const health = healthOf(published.at(-1))
            expect(health).toMatchObject({ loud: true, label: 'Health · 1 warning' })
            expect(health?.entries[0]).toMatchObject({
              code: 'bypass-refused-as-root',
              level: 'loud',
            })
            expect(health?.entries[0]?.hint).not.toContain('IS_SANDBOX')
            const shown = commandOf(published, AUDIT)
            expect(shown).toContain(FLAG)
            yield* cockpit.receive({ type: 'launch', key: AUDIT })
            expect(renderCommand(['claude', ...(terminals.opened[0]?.shellArgs ?? [])])).toBe(shown)
          }),
      )
      yield* withCockpit(
        bypassing('afkTickets', { ...DEV_CONTAINER, root: true, sandboxEnv: true }),
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.activated
            yield* cockpit.show
            expect(healthOf(published.at(-1))).toBeNull()
          }),
      )
    }),
  )

  it.effect('plans the commands and the Health row again when a setting changes', () => {
    let settings: BypassSettings = { mode: 'off', onlyWhenIsolated: true }
    return withCockpit(
      bypassing('off', { bypassSettings: Effect.sync(() => settings) }),
      ({ cockpit, published, terminals }) =>
        Effect.gen(function* () {
          yield* cockpit.activated
          yield* cockpit.show
          // A running session is left alone by the change.
          yield* cockpit.receive({ type: 'launch', key: PALETTE })
          expect(commandOf(published, AUDIT)).not.toContain(FLAG)
          expect(healthOf(published.at(-1))).toBeNull()

          settings = { mode: 'afkTickets', onlyWhenIsolated: true }
          const count = published.length
          yield* cockpit.settingsChanged
          expect(published.length).toBe(count + 1)
          expect(codes(published.at(-1))).toEqual(['bypass-not-isolated'])
          expect(commandOf(published, AUDIT)).not.toContain(FLAG)

          settings = { mode: 'afkTickets', onlyWhenIsolated: false }
          yield* cockpit.settingsChanged
          expect(healthOf(published.at(-1))).toBeNull()
          expect(commandOf(published, AUDIT)).toContain(FLAG)
          expect(ticketRowOf(published.at(-1), PALETTE)?.session?.kind).toBe('starting')

          // The next launch takes the new setting.
          yield* cockpit.receive({ type: 'launch', key: AUDIT })
          expect(terminals.opened[1]?.shellArgs.slice(0, 2)).toEqual([
            '--permission-mode',
            'bypassPermissions',
          ])

          // An unchanged read publishes nothing.
          const settled = published.length
          yield* cockpit.settingsChanged
          expect(published.length).toBe(settled)
        }),
    )
  })

  it.effect('names the bypass dialog in the hint of a bypassed launch, and only there', () =>
    withCockpit(bypassing('afkTickets', DEV_CONTAINER), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.show
        yield* cockpit.receive({ type: 'launch', key: AUDIT })
        yield* cockpit.receive({ type: 'launch', key: PALETTE })
        yield* TestClock.adjust('15 seconds')
        expect(ticketRowOf(published.at(-1), AUDIT)?.session).toEqual({
          kind: 'starting',
          hint: 'no status yet, the session may be waiting at the trust or bypass-permissions dialog, open the terminal',
        })
        expect(ticketRowOf(published.at(-1), PALETTE)?.session).toEqual({
          kind: 'starting',
          hint: 'no status yet, the session may be waiting at the trust dialog, open the terminal',
        })
      }),
    ),
  )

  it.effect("reads the repo's triage labels and a local ticket's Labels line", () => {
    const setup = bypassing('afkTickets', DEV_CONTAINER)
    const palette = `${ROOT}/.scratch/cockpit-colors/issues/01-palette.md`
    const audit = `${ROOT}/.scratch/cockpit-colors/issues/03-contrast-audit.md`
    const files = {
      ...setup.files,
      // A HITL type labelled for an agent, under a renamed label; a task marked for a human.
      [palette]: setup.files![palette]!.replace('Type: prototype', 'Type: prototype\nLabels: afk'),
      [audit]: setup.files![audit]!.replace('Type: task', 'Type: task\nLabels: human-only'),
      [`${ROOT}/docs/agents/triage-labels.md`]:
        '| Role | Label |\n| --- | --- |\n| `ready-for-agent` | `afk` |\n| `ready-for-human` | `human-only` |\n',
    }
    return withCockpit({ ...setup, files }, ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        yield* cockpit.show
        expect(commandOf(published, PALETTE)).toContain(FLAG)
        expect(commandOf(published, AUDIT)).not.toContain(FLAG)
      }),
    )
  })

  it.effect('keeps a dismissed not-isolated note dismissed only where it was dismissed', () => {
    const global = new Map<string, unknown>()
    const dismissFirst = (published: ViewModel[], cockpit: Cockpit) => {
      const key = healthOf(published.at(-1))?.entries[0]?.dismissKey
      if (key === undefined) throw new Error('expected an entry to dismiss')
      return cockpit.receive({ type: 'dismiss-health', dismissKey: key })
    }
    return Effect.gen(function* () {
      yield* withCockpit(
        { ...bypassing('afkTickets', { remoteName: 'ssh-remote' }), global },
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.activated
            yield* cockpit.show
            yield* dismissFirst(published, cockpit)
            expect(healthOf(published.at(-1))).toBeNull()
          }),
      )
      // The same folder over Remote-SSH again: still dismissed.
      yield* withCockpit(
        { ...bypassing('afkTickets', { remoteName: 'ssh-remote' }), global },
        ({ cockpit, published }) =>
          Effect.gen(function* () {
            yield* cockpit.activated
            yield* cockpit.show
            expect(healthOf(published.at(-1))).toBeNull()
          }),
      )
      // A local window is somewhere else: the note is back.
      yield* withCockpit({ ...bypassing('afkTickets'), global }, ({ cockpit, published }) =>
        Effect.gen(function* () {
          yield* cockpit.activated
          yield* cockpit.show
          expect(healthOf(published.at(-1))?.entries[0]?.detail).toBe(
            'local window, no container marker',
          )
        }),
      )
    })
  })
})
