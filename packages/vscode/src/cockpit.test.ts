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
import { type Cockpit, EXPANDED_KEY, makeCockpit, SELECTED_KEY } from './cockpit.ts'
import type { DetailView, MapNode, ViewModel } from './protocol.ts'
import {
  Clipboard,
  CollectProgress,
  HostEnvironment,
  type HostEnvironmentShape,
  Opener,
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

/** Answers from recordings like the replay layer does, and counts what it was asked to run. */
const countingRunner = (recordings: ReadonlyArray<ProcessRecording>, delayMillis = 0) => {
  let runs = 0
  const shape: ProcessRunnerShape = {
    run: (request) =>
      Effect.sleep(delayMillis).pipe(
        Effect.andThen(
          Effect.sync(() => {
            runs += 1
            const recorded = recordings.find(
              (r) => r.command === request.command && r.args.join('\0') === request.args.join('\0'),
            )
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
  }) => Effect.Effect<
    A,
    never,
    Storage | WorkspaceFolders | FileSystem | ProcessRunner | Opener | CollectProgress
  >,
) => {
  const terminals = Terminals.inMemory()
  const copied: string[] = []
  const runner = countingRunner(setup.recordings ?? [inRepo(ROOT, ROOT)], setup.delay)
  const opened: OpenTarget[] = []
  const progress = { shown: 0, open: 0 }
  const layer = Layer.mergeAll(
    Opener.inMemory(opened),
    CollectProgress.inMemory(progress),
    WorkspaceFolders.inMemory(setup.folders ?? [ROOT]),
    Storage.inMemory(setup.stored),
    FileSystem.inMemory(setup.files ?? workspaceFiles(ROOT)),
    runner.layer,
    terminals.layer,
    Clipboard.inMemory(copied),
    HostEnvironment.inMemory(setup.environment),
  )
  return Effect.gen(function* () {
    const published: ViewModel[] = []
    const logged: string[] = []
    const details: DetailView[] = []
    const shown: boolean[] = []
    const cockpit = yield* makeCockpit({
      publish: (viewModel) => published.push(viewModel),
      publishDetail: (view) => details.push(view),
      showDetail: (focus) => shown.push(focus),
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
        expect(logged).toHaveLength(1)
        expect(logged[0]).toContain('Rejected a malformed message')
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
          last: { folders: [ROOT], key: `local|${ROOT}|v1` },
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
  it.effect('shows the command ▶ will run on each frontier row, and only there', () =>
    withCockpit(launchable(), ({ cockpit, published }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        const rows = maps(published[0]).flatMap((map) => map.tickets)
        expect(
          rows.filter((row) => row.action !== null).map((row) => [row.number, row.place]),
        ).toEqual([
          [1, 'frontier'],
          [3, 'frontier'],
        ])
        const palette = ticketRowOf(published[0], PALETTE)
        expect(palette?.action).toEqual({
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
        expect(row?.session).toEqual({ kind: 'starting' })
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
        expect(row?.session).toEqual({ kind: 'ended', detail })
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

  it.effect('launches nothing for a ticket that is not on the frontier, or for no ticket', () =>
    withCockpit(launchable(), ({ cockpit, published, terminals, logged }) =>
      Effect.gen(function* () {
        yield* cockpit.show
        // #4 Row density is claimed, #2 Dark mode waits on #1.
        yield* cockpit.receive({ type: 'launch', key: 'map:3:ticket:4' })
        yield* cockpit.receive({ type: 'launch', key: 'map:3:ticket:2' })
        yield* cockpit.receive({ type: 'launch', key: 'map:3:map' })
        yield* cockpit.receive({ type: 'launch', key: 'map:9:ticket:9' })
        expect(terminals.opened).toEqual([])
        expect(logged.filter((line) => line.startsWith('Nothing to launch'))).toHaveLength(4)
        expect(ticketRowOf(published.at(-1), 'map:3:ticket:4')?.action).toBeNull()
        expect(ticketRowOf(published.at(-1), 'map:3:ticket:2')?.action).toBeNull()
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
        expect(selection?.kind === 'ticket' && selection.action?.command).toBe(
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
        expect(logged).toEqual([`claude resolved to ${CLAUDE} (heroSynergy.claude.path)`])
        expect(runs()).toBe(0)
      }),
    ),
  )

  it.effect('logs why claude did not resolve at activation', () =>
    withCockpit({}, ({ cockpit, logged }) =>
      Effect.gen(function* () {
        yield* cockpit.activated
        expect(logged).toEqual([
          'claude not resolved: claude was not found on PATH. Set heroSynergy.claude.path to its location.',
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
