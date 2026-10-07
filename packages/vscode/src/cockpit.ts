import {
  FileSystem,
  type FileSystemError,
  findRepo,
  type GitHubCollectFailed,
  type ProcessError,
  ProcessRunner,
  readGitHubTracker,
  readLocalTracker,
  type ScoutError,
  type Snapshot,
} from '@hero-synergy/core'
import { Effect, Ref } from 'effect'

import { decodeWebviewMessage } from './messages.ts'
import { describeCollectFailure } from './notices.ts'
import type { DetailView, MapSection, Notice, ViewModel } from './protocol.ts'
import { Opener, Storage, WorkspaceFolders } from './services.ts'
import {
  buildViewModel,
  defaultExpanded,
  detailOf,
  firstFocusKey,
  revealKeys,
  selectionOf,
} from './view-model.ts'

/** The key the expanded nodes are stored under in workspace storage. */
export const EXPANDED_KEY = 'expanded'
/** The key the selected row is stored under: a row key, or nothing selected. */
export const SELECTED_KEY = 'selected'

export interface CockpitOptions {
  /** Sends a view model to the Tree's webview. */
  readonly publish: (viewModel: ViewModel) => void
  /** Sends the Detail's view to its panel, if one is open. */
  readonly publishDetail: (view: DetailView) => void
  /** Opens the Detail panel, or brings the open one forward; `focus` moves the keyboard into it. */
  readonly showDetail: (focus: boolean) => void
  /** Writes a line to the Cockpit's output channel. */
  readonly log: (line: string) => void
}

/**
 * The Tree's controller: collects through the scout, derives the view model and
 * holds what the Tree remembers (the expanded nodes). It runs one collect only
 * when asked, so an activated extension with its view hidden spawns nothing.
 */
export interface Cockpit {
  /** The view was shown: collect once and publish. */
  readonly show: Effect.Effect<void>
  /** The Refresh button: collect again and publish. */
  readonly refresh: Effect.Effect<void>
  /** A message from the webview; false when it was rejected as malformed. */
  readonly receive: (input: unknown) => Effect.Effect<boolean>
  /** The view model as it stands, for a webview that just mounted. */
  readonly current: Effect.Effect<ViewModel>
  /** `Hero Synergy: Open Cockpit Detail`: the current selection, else the first map in order. */
  readonly openDetail: Effect.Effect<void>
  /** The Detail as it stands, for a panel that just mounted or was restored. */
  readonly currentDetail: Effect.Effect<DetailView>
}

type Base =
  | { readonly kind: 'loading' }
  | { readonly kind: 'message'; readonly message: string; readonly detail: string | null }
  | { readonly kind: 'snapshot'; readonly snapshot: Snapshot; readonly notice: Notice | null }

/** What one collect came to: a base to show, or a failure that keeps the old snapshot if there is one. */
type Loaded = Base | { readonly kind: 'failed'; readonly notice: Notice }

type LoadError = ScoutError | FileSystemError | ProcessError | GitHubCollectFailed

/** The one plain message a collect that found no maps shows, per case. */
const describeError = (error: LoadError): { message: string; detail: string | null } => {
  switch (error._tag) {
    case 'NoRepoFound':
      return {
        message: 'No git repository to show.',
        detail: 'Open a folder that is inside a git repository.',
      }
    case 'NoTrackerDoc':
      return {
        message: 'This repo has no issue tracker set up.',
        detail:
          'Run /setup-matt-pocock-skills in Claude Code to create docs/agents/issue-tracker.md.',
      }
    case 'UnsupportedTracker':
      return {
        message:
          error.name === null
            ? 'The issue tracker doc names no tracker.'
            : `The Cockpit does not read ${error.name} trackers.`,
        detail: 'It reads GitHub and Local Markdown trackers.',
      }
    case 'NoRemote':
      return {
        message: 'No git remote names a GitHub repository.',
        detail: 'Add a GitHub remote, or switch the tracker doc to Local Markdown.',
      }
    case 'FileSystemError':
      return { message: 'The tracker could not be read.', detail: error.message }
    case 'ProcessSpawnFailed':
    case 'ProcessNotRecorded':
      return { message: 'git could not be run.', detail: error.message }
    case 'GitHubCollectFailed': {
      const { message, fix } = describeCollectFailure(error)
      return { message, detail: fix }
    }
  }
}

const load = Effect.gen(function* () {
  const folders = yield* (yield* WorkspaceFolders).paths
  const found = yield* findRepo(folders)
  const snapshot =
    found.tracker.kind === 'github'
      ? yield* readGitHubTracker(found.repoRoot)
      : yield* readLocalTracker(found.repoRoot)
  return { kind: 'snapshot', snapshot, notice: null } satisfies Loaded
}).pipe(
  Effect.catch((error: LoadError) =>
    Effect.succeed<Loaded>(
      error._tag === 'GitHubCollectFailed'
        ? { kind: 'failed', notice: describeCollectFailure(error) }
        : { kind: 'message', ...describeError(error) },
    ),
  ),
)

const storedExpanded = (value: unknown): ReadonlySet<string> | null =>
  Array.isArray(value) && value.every((entry): entry is string => typeof entry === 'string')
    ? new Set(value)
    : null

const storedSelected = (value: unknown): string | null => (typeof value === 'string' ? value : null)

export const makeCockpit = (
  options: CockpitOptions,
): Effect.Effect<
  Cockpit,
  never,
  WorkspaceFolders | Storage | FileSystem | ProcessRunner | Opener
> =>
  Effect.gen(function* () {
    const context = yield* Effect.context<WorkspaceFolders | Storage | FileSystem | ProcessRunner>()
    const storage = yield* Storage
    const opener = yield* Opener
    // The host holds the one selection; the webview only asks to change it.
    const selected = yield* Ref.make<string | null>(
      storedSelected(yield* storage.get(SELECTED_KEY)),
    )
    const base = yield* Ref.make<Base>({ kind: 'loading' })
    const expanded = yield* Ref.make<ReadonlySet<string> | null>(
      storedExpanded(yield* storage.get(EXPANDED_KEY)),
    )
    // Which section the Detail was asked to scroll to, and how many times it has been asked.
    const section = yield* Ref.make<MapSection | null>(null)
    const scroll = yield* Ref.make(0)
    // A collect that finishes after a newer one started must not overwrite it.
    const generation = yield* Ref.make(0)

    const current: Effect.Effect<ViewModel> = Effect.gen(function* () {
      const state = yield* Ref.get(base)
      if (state.kind !== 'snapshot') return state
      const open = (yield* Ref.get(expanded)) ?? defaultExpanded(state.snapshot)
      return buildViewModel(state.snapshot, open, yield* Ref.get(selected), undefined, state.notice)
    })

    const currentDetail: Effect.Effect<DetailView> = Effect.gen(function* () {
      const state = yield* Ref.get(base)
      const key = yield* Ref.get(selected)
      return {
        detail: state.kind === 'snapshot' ? detailOf(state.snapshot, key) : null,
        section: yield* Ref.get(section),
        scroll: yield* Ref.get(scroll),
      }
    })

    const publish = Effect.gen(function* () {
      options.publish(yield* current)
      options.publishDetail(yield* currentDetail)
    })

    const collect: Effect.Effect<void> = Effect.gen(function* () {
      const mine = yield* Ref.updateAndGet(generation, (n) => n + 1)
      const loaded = yield* load.pipe(Effect.provideContext(context))
      if ((yield* Ref.get(generation)) !== mine) return
      if (loaded.kind === 'failed') {
        // A failure after a good collect keeps the maps on screen with the reason; without one it is the whole view.
        const before = yield* Ref.get(base)
        yield* Ref.set(
          base,
          before.kind === 'snapshot'
            ? { ...before, notice: loaded.notice }
            : { kind: 'message', message: loaded.notice.message, detail: loaded.notice.fix },
        )
      } else {
        yield* Ref.set(base, loaded)
      }
      yield* publish
    })

    const setExpanded = (key: string, open: boolean): Effect.Effect<void> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(base)
        const fallback =
          state.kind === 'snapshot' ? defaultExpanded(state.snapshot) : new Set<string>()
        // One atomic update: two clicks in quick succession must both land.
        const after = yield* Ref.modify(expanded, (current) => {
          const next = new Set(current ?? fallback)
          if (open) next.add(key)
          else next.delete(key)
          return [next, next] as const
        })
        yield* storage.set(EXPANDED_KEY, [...after])
        yield* publish
      })

    const select = (key: string | null): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.set(selected, key)
        yield* Ref.set(section, null)
        yield* storage.set(SELECTED_KEY, key)
        yield* publish
      })

    /** Selects the row, then opens the Detail on it, scrolled to the section if one is asked for. */
    const openDetailOn = (
      key: string,
      wanted: MapSection | null,
      focus: boolean,
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.set(selected, key)
        yield* Ref.set(section, wanted)
        yield* Ref.update(scroll, (n) => n + 1)
        yield* storage.set(SELECTED_KEY, key)
        options.showDetail(focus)
        yield* publish
      })

    /** A neighbour clicked in the Detail: select it and open whatever hides its row. */
    const reveal = (key: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(base)
        if (state.kind !== 'snapshot' || selectionOf(state.snapshot, key) === null) {
          options.log(`Nothing to reveal for ${key}`)
          return
        }
        const open = revealKeys(state.snapshot, key)
        const after = yield* Ref.modify(expanded, (stored) => {
          const next = new Set(stored ?? defaultExpanded(state.snapshot))
          for (const node of open) next.add(node)
          return [next, next] as const
        })
        yield* storage.set(EXPANDED_KEY, [...after])
        yield* select(key)
      })

    const openDetailCommand: Effect.Effect<void> = Effect.gen(function* () {
      if ((yield* Ref.get(base)).kind === 'loading') yield* collect
      const state = yield* Ref.get(base)
      if (state.kind !== 'snapshot') return
      const key = yield* Ref.get(selected)
      const chosen =
        key !== null && selectionOf(state.snapshot, key) !== null
          ? key
          : firstFocusKey(state.snapshot)
      if (chosen === null) {
        options.log('Nothing to open: the tracker has no maps')
        return
      }
      yield* openDetailOn(chosen, null, true)
    })

    const open = (key: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(base)
        if (state.kind !== 'snapshot') return
        const found = selectionOf(state.snapshot, key)
        if (found === null) {
          options.log(`Nothing to open for ${key}`)
          return
        }
        yield* opener.open(found.target)
      })

    return {
      show: collect,
      refresh: collect,
      current,
      currentDetail,
      openDetail: openDetailCommand,
      receive: (input) =>
        Effect.gen(function* () {
          const message = decodeWebviewMessage(input)
          if (message === null) {
            options.log(`Rejected a malformed message from the webview: ${JSON.stringify(input)}`)
            return false
          }
          switch (message.type) {
            case 'ready':
              yield* publish
              break
            case 'refresh':
              yield* collect
              break
            case 'expand':
              yield* setExpanded(message.key, true)
              break
            case 'collapse':
              yield* setExpanded(message.key, false)
              break
            case 'select':
              yield* select(message.key)
              break
            case 'open':
              yield* open(message.key)
              break
            case 'open-detail': {
              const state = yield* Ref.get(base)
              if (state.kind !== 'snapshot' || selectionOf(state.snapshot, message.key) === null) {
                options.log(`No Detail to open for ${message.key}`)
                break
              }
              yield* openDetailOn(message.key, message.section, false)
              break
            }
            case 'reveal':
              yield* reveal(message.key)
              break
            case 'open-link':
              // A body is the tracker's text: only web links leave the Cockpit.
              if (/^https?:\/\//i.test(message.url)) yield* opener.openLink(message.url)
              else options.log(`Ignored a link that is not a web link: ${message.url}`)
              break
          }
          return true
        }),
    }
  })
