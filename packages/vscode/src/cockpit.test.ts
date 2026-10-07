import { describe, expect, it } from '@effect/vitest'
import {
  FileSystem,
  type ProcessRecording,
  ProcessRunner,
  type ProcessRunnerShape,
} from '@hero-synergy/core'
import { Effect, Layer } from 'effect'

import { workspaceFiles } from '../test/fixtures/workspace-files.ts'
import { type Cockpit, EXPANDED_KEY, makeCockpit, SELECTED_KEY } from './cockpit.ts'
import type { MapNode, ViewModel } from './protocol.ts'
import { Opener, Storage, WorkspaceFolders } from './services.ts'
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
const countingRunner = (recordings: ReadonlyArray<ProcessRecording>) => {
  let runs = 0
  const shape: ProcessRunnerShape = {
    run: (request) =>
      Effect.sync(() => {
        runs += 1
        const recorded = recordings.find(
          (r) => r.command === request.command && r.args.join('\0') === request.args.join('\0'),
        )
        if (recorded === undefined) throw new Error(`not recorded: ${request.args.join(' ')}`)
        return { ...recorded, timedOut: recorded.timedOut ?? false }
      }),
  }
  return { layer: Layer.succeed(ProcessRunner, shape), runs: () => runs }
}

interface Setup {
  readonly files?: Record<string, string>
  readonly folders?: ReadonlyArray<string>
  readonly recordings?: ReadonlyArray<ProcessRecording>
  readonly stored?: Record<string, unknown>
}

/** Runs `body` against a Cockpit on the fixture workspace; every layer is in memory. */
const withCockpit = <A>(
  setup: Setup,
  body: (context: {
    cockpit: Cockpit
    published: ViewModel[]
    logged: string[]
    opened: OpenTarget[]
    runs: () => number
    fs: FileSystem['Service']
  }) => Effect.Effect<A, never, Storage | WorkspaceFolders | FileSystem | ProcessRunner | Opener>,
) => {
  const runner = countingRunner(setup.recordings ?? [inRepo(ROOT, ROOT)])
  const opened: OpenTarget[] = []
  const layer = Layer.mergeAll(
    Opener.inMemory(opened),
    WorkspaceFolders.inMemory(setup.folders ?? [ROOT]),
    Storage.inMemory(setup.stored),
    FileSystem.inMemory(setup.files ?? workspaceFiles(ROOT)),
    runner.layer,
  )
  return Effect.gen(function* () {
    const published: ViewModel[] = []
    const logged: string[] = []
    const cockpit = yield* makeCockpit({
      publish: (viewModel) => published.push(viewModel),
      log: (line) => logged.push(line),
    })
    const fs = yield* FileSystem
    return yield* body({ cockpit, published, logged, opened, runs: runner.runs, fs })
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
