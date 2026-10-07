import {
  commandOf,
  discoverSkills,
  FileSystem,
  type FileSystemError,
  findRepo,
  type GitHubCollectFailed,
  type ProcessError,
  ProcessRunner,
  type RateLimit,
  readGitHubTracker,
  placeOf,
  readLocalTracker,
  type RepoTracker,
  readPluginList,
  type ScoutError,
  type Snapshot,
} from '@hero-synergy/core'
import { Clock, Deferred, Effect, Fiber, Ref } from 'effect'

import { type ClaudeResolution, resolveClaude } from './claude-path.ts'
import {
  canLaunchFrom,
  describeExit,
  type Launching,
  NOT_LAUNCHING,
  type SessionState,
  terminalIcon,
  workTicketLaunch,
} from './launch.ts'
import { decodeWebviewMessage } from './messages.ts'
import { describeCollectFailure } from './notices.ts'
import type { BudgetNote, DetailView, MapSection, Notice, ViewModel } from './protocol.ts'
import {
  admit,
  afterFailure,
  afterSuccess,
  budgetStatus,
  drain,
  initialPolicy,
  type PolicyState,
  type RateBudget,
  type TrackerKind,
  type Trigger,
} from './refresh-policy.ts'
import {
  Clipboard,
  CollectProgress,
  HostEnvironment,
  Opener,
  Storage,
  Terminals,
  WorkspaceFolders,
} from './services.ts'
import { CACHE_KEY, readCache, writeCache } from './snapshot-cache.ts'
import {
  buildViewModel,
  defaultExpanded,
  detailOf,
  firstFocusKey,
  revealKeys,
  selectionOf,
  ticketOf,
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

/** A file under `.scratch` changes this long before the local tracker is read again. */
export const SCRATCH_DEBOUNCE_MS = 1000

/**
 * The Tree's controller: collects through the scout, derives the view model and
 * holds what the Tree remembers (the expanded nodes). A collect starts only on
 * a cause the refresh policy admits, so an activated extension with its view
 * hidden spawns nothing, and nothing runs on a timer.
 */
export interface Cockpit {
  /** The view became visible, activation with the view open included: an automatic trigger. */
  readonly show: Effect.Effect<void>
  /** The window gained focus: an automatic trigger. */
  readonly focus: Effect.Effect<void>
  /** A file under `.scratch` changed: one automatic collect after the debounce, on a local tracker only. */
  readonly scratchChanged: Effect.Effect<void>
  /** The Refresh button: ignores the gap, and joins a collect that is already running. */
  readonly refresh: Effect.Effect<void>
  /** A message from the webview; false when it was rejected as malformed. */
  readonly receive: (input: unknown) => Effect.Effect<boolean>
  /** The view model as it stands, for a webview that just mounted. */
  readonly current: Effect.Effect<ViewModel>
  /** `Hero Synergy: Open Cockpit Detail`: the current selection, else the first map in order. */
  readonly openDetail: Effect.Effect<void>
  /** The Detail as it stands, for a panel that just mounted or was restored. */
  readonly currentDetail: Effect.Effect<DetailView>
  /** Activation: resolve `claude` and log where it is. Spawns nothing. */
  readonly activated: Effect.Effect<void>
}

type Base =
  | { readonly kind: 'loading' }
  | { readonly kind: 'message'; readonly message: string; readonly detail: string | null }
  | { readonly kind: 'snapshot'; readonly snapshot: Snapshot; readonly notice: Notice | null }

/** What one collect came to: a snapshot, a plain message, or a failure that keeps the old snapshot if there is one. */
type Loaded =
  | {
      readonly kind: 'snapshot'
      readonly snapshot: Snapshot
      readonly tracker: TrackerKind
      /** The figures of the last request; null on a local tracker. */
      readonly rateLimit: RateLimit | null
    }
  | { readonly kind: 'message'; readonly message: string; readonly detail: string | null }
  | {
      readonly kind: 'failed'
      readonly notice: Notice
      readonly error: GitHubCollectFailed
    }

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
  const found: RepoTracker = yield* findRepo(folders)
  if (found.tracker.kind === 'github') {
    const { snapshot, rateLimit } = yield* readGitHubTracker(found.repoRoot)
    return { kind: 'snapshot', snapshot, tracker: 'github', rateLimit } satisfies Loaded
  }
  const snapshot = yield* readLocalTracker(found.repoRoot)
  return { kind: 'snapshot', snapshot, tracker: 'local', rateLimit: null } satisfies Loaded
}).pipe(
  Effect.catch((error: LoadError) =>
    Effect.succeed<Loaded>(
      error._tag === 'GitHubCollectFailed'
        ? { kind: 'failed', notice: describeCollectFailure(error), error }
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
  | WorkspaceFolders
  | Storage
  | FileSystem
  | ProcessRunner
  | Opener
  | CollectProgress
  | Terminals
  | Clipboard
  | HostEnvironment
> =>
  Effect.gen(function* () {
    const context = yield* Effect.context<WorkspaceFolders | Storage | FileSystem | ProcessRunner>()
    const storage = yield* Storage
    const opener = yield* Opener
    const progress = yield* CollectProgress
    const workspace = yield* WorkspaceFolders
    // The last good snapshot of this window's repo is shown before anything spawns.
    const cached = readCache(yield* storage.get(CACHE_KEY), yield* workspace.paths)
    const terminals = yield* Terminals
    const clipboard = yield* Clipboard
    const environment = yield* HostEnvironment
    const fs = yield* FileSystem
    const runner = yield* ProcessRunner
    // Ticket row key to its session: absent is none.
    const sessions = yield* Ref.make<ReadonlyMap<string, SessionState>>(new Map())
    // What the last collect found: where `claude` is and the wayfinder command.
    const discovery = yield* Ref.make<{
      readonly claude: ClaudeResolution
      readonly wayfinder: string | null
    }>({ claude: NOT_LAUNCHING.claude, wayfinder: null })
    // The host holds the one selection; the webview only asks to change it.
    const selected = yield* Ref.make<string | null>(
      storedSelected(yield* storage.get(SELECTED_KEY)),
    )
    const base = yield* Ref.make<Base>(
      cached === null
        ? { kind: 'loading' }
        : { kind: 'snapshot', snapshot: cached.snapshot, notice: null },
    )
    const tracker = yield* Ref.make<TrackerKind | null>(cached?.repo.kind ?? null)
    // The cache counts as the last successful collect, so a reload does not spend the budget twice.
    const policy = yield* Ref.make<PolicyState>({
      ...initialPolicy,
      lastSuccessAt: cached === null ? null : Date.parse(cached.snapshot.collectedAt),
    })
    // Finishes when the collect now running does, for a button press to attach to.
    const running = yield* Ref.make<Deferred.Deferred<void> | null>(null)
    const debounced = yield* Ref.make<Fiber.Fiber<void> | null>(null)
    const expanded = yield* Ref.make<ReadonlySet<string> | null>(
      storedExpanded(yield* storage.get(EXPANDED_KEY)),
    )
    // Which section the Detail was asked to scroll to, and how many times it has been asked.
    const section = yield* Ref.make<MapSection | null>(null)
    const scroll = yield* Ref.make(0)
    /** What holds automatic refreshes back right now; a local tracker has no budget. */
    const budgetNote: Effect.Effect<BudgetNote | null> = Effect.gen(function* () {
      if ((yield* Ref.get(tracker)) !== 'github') return null
      const status = budgetStatus(yield* Ref.get(policy), yield* Clock.currentTimeMillis)
      return status === null
        ? null
        : { kind: status.kind, until: new Date(status.until).toISOString() }
    })

    const launchingFor = (repoRoot: string): Effect.Effect<Launching> =>
      Effect.gen(function* () {
        const found = yield* Ref.get(discovery)
        return {
          sessions: yield* Ref.get(sessions),
          claude: found.claude,
          wayfinder: found.wayfinder,
          pluginPath: environment.pluginPath,
          eventsFile: environment.eventsFile(repoRoot),
        }
      })

    const current: Effect.Effect<ViewModel> = Effect.gen(function* () {
      const state = yield* Ref.get(base)
      if (state.kind !== 'snapshot') return state
      const open = (yield* Ref.get(expanded)) ?? defaultExpanded(state.snapshot)
      return buildViewModel(
        state.snapshot,
        open,
        yield* Ref.get(selected),
        undefined,
        state.notice,
        yield* budgetNote,
        yield* launchingFor(state.snapshot.repoRoot),
      )
    })

    const currentDetail: Effect.Effect<DetailView> = Effect.gen(function* () {
      const state = yield* Ref.get(base)
      const key = yield* Ref.get(selected)
      return {
        detail:
          state.kind === 'snapshot'
            ? detailOf(state.snapshot, key, yield* launchingFor(state.snapshot.repoRoot))
            : null,
        section: yield* Ref.get(section),
        scroll: yield* Ref.get(scroll),
      }
    })

    /** Where `claude` is right now: the setting and `PATH` are read each time, so a change applies to the next launch. */
    const resolveNow: Effect.Effect<ClaudeResolution> = Effect.gen(function* () {
      return yield* resolveClaude({
        setting: yield* environment.claudeSetting,
        pathVariable: environment.pathVariable,
        platform: environment.platform,
        isFile: (path) => fs.exists(path).pipe(Effect.catch(() => Effect.succeed(false))),
      })
    })

    const describeResolution = (resolution: ClaudeResolution): string =>
      resolution.kind === 'found'
        ? `claude resolved to ${resolution.claude.path} (${
            resolution.claude.source === 'setting' ? 'heroSynergy.claude.path' : 'PATH'
          }${resolution.claude.shim ? ', an npm shim: best effort' : ''})`
        : `claude not resolved: ${resolution.reason}`

    const activated: Effect.Effect<void> = resolveNow.pipe(
      Effect.map((resolution) => options.log(describeResolution(resolution))),
    )

    /**
     * Skill discovery, on every refresh: `claude plugin list --json` for the plugins' install
     * paths (only when `claude` resolves; nothing to spawn otherwise), then the skill folders.
     */
    const discover = (repoRoot: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const claude = yield* resolveNow
        const listed =
          claude.kind === 'found'
            ? yield* runner
                .run({
                  command: claude.claude.path,
                  args: ['plugin', 'list', '--json'],
                  cwd: repoRoot,
                })
                .pipe(
                  Effect.map((result) => (result.exitCode === 0 ? result.stdout : '[]')),
                  Effect.catch((error) => {
                    options.log(`claude plugin list failed: ${error.message}`)
                    return Effect.succeed('[]')
                  }),
                )
            : '[]'
        const inventory = yield* discoverSkills({
          repoRoot,
          home: environment.home,
          plugins: readPluginList(listed).value,
        }).pipe(Effect.provideService(FileSystem, fs))
        yield* Ref.set(discovery, { claude, wayfinder: commandOf(inventory.skills, 'wayfinder') })
      })

    const publish = Effect.gen(function* () {
      options.publish(yield* current)
      options.publishDetail(yield* currentDetail)
    })

    const budgetOf = (rateLimit: RateLimit | null): RateBudget | null =>
      rateLimit === null
        ? null
        : { remaining: rateLimit.remaining, resetAt: Date.parse(rateLimit.resetAt) }

    /** Takes what one collect came to into the view, the cache and the policy. */
    const settle = (loaded: Loaded, now: number): Effect.Effect<void> =>
      Effect.gen(function* () {
        switch (loaded.kind) {
          case 'snapshot':
            yield* Ref.set(base, { kind: 'snapshot', snapshot: loaded.snapshot, notice: null })
            yield* Ref.set(tracker, loaded.tracker)
            yield* Ref.update(policy, (state) =>
              afterSuccess(state, now, budgetOf(loaded.rateLimit)),
            )
            yield* storage.set(
              CACHE_KEY,
              writeCache(yield* storage.get(CACHE_KEY), yield* workspace.paths, loaded.snapshot),
            )
            break
          case 'message':
            yield* Ref.set(base, loaded)
            yield* Ref.update(policy, (state) => afterFailure(state, now, { reason: 'message' }))
            break
          case 'failed': {
            // A failure after a good collect keeps the maps on screen with the reason; without one it is the whole view.
            const before = yield* Ref.get(base)
            yield* Ref.set(
              base,
              before.kind === 'snapshot'
                ? { ...before, notice: loaded.notice }
                : { kind: 'message', message: loaded.notice.message, detail: loaded.notice.fix },
            )
            yield* Ref.set(tracker, 'github')
            yield* Ref.update(policy, (state) => afterFailure(state, now, loaded.error))
            break
          }
        }
      })

    const collectOnce: Effect.Effect<void> = Effect.gen(function* () {
      const end = yield* progress.begin
      const loaded = yield* load.pipe(Effect.provideContext(context), Effect.ensuring(end))
      // Skill discovery runs with every collect that read a snapshot, before it is shown.
      if (loaded.kind === 'snapshot') yield* discover(loaded.snapshot.repoRoot)
      yield* settle(loaded, yield* Clock.currentTimeMillis)
      yield* publish
    })

    /** Runs the collect this call was admitted for, then the one queued behind it, one at a time. */
    const collectLoop: Effect.Effect<void> = Effect.gen(function* () {
      for (;;) {
        const finished = yield* Deferred.make<void>()
        yield* Ref.set(running, finished)
        yield* collectOnce.pipe(
          Effect.ensuring(
            Effect.andThen(Ref.set(running, null), Deferred.succeed(finished, undefined)),
          ),
        )
        const now = yield* Clock.currentTimeMillis
        const kind = (yield* Ref.get(tracker)) ?? 'github'
        const again = yield* Ref.modify(policy, (state) => drain(state, now, kind))
        if (!again) return
      }
    }).pipe(
      Effect.onInterrupt(() =>
        Ref.update(policy, (state) => ({ ...state, running: false, queued: false })),
      ),
    )

    /** One cause asks for a collect; the policy says whether it runs, waits, joins or is dropped. */
    const trigger = (cause: Trigger): Effect.Effect<void> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const kind = (yield* Ref.get(tracker)) ?? 'github'
        const decision = yield* Ref.modify(policy, (state) => {
          const [decided, next] = admit(state, cause, now, kind)
          return [decided, next] as const
        })
        switch (decision.action) {
          case 'start':
            return yield* collectLoop
          case 'attach': {
            const current = yield* Ref.get(running)
            if (current !== null) yield* Deferred.await(current)
            return
          }
          case 'refuse':
            // The row says "rate-limited until HH:MM"; nothing is called.
            return yield* publish
          case 'queue':
          case 'coalesced':
          case 'skip':
            return
        }
      })

    const scratchChanged: Effect.Effect<void> = Effect.gen(function* () {
      if ((yield* Ref.get(tracker)) !== 'local') return
      const previous = yield* Ref.getAndSet(debounced, null)
      if (previous !== null) yield* Fiber.interrupt(previous)
      const fiber = yield* Effect.forkDetach(
        Effect.sleep(SCRATCH_DEBOUNCE_MS).pipe(Effect.andThen(trigger('automatic'))),
      )
      yield* Ref.set(debounced, fiber)
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
      if ((yield* Ref.get(base)).kind === 'loading') yield* trigger('button')
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

    /** Every spawn on the launch path is async: the terminal, the events file and the resolution. */
    const launch = (key: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(base)
        if (state.kind !== 'snapshot') return
        const found = ticketOf(state.snapshot, key)
        if (found === null || placeOf(found.ticket) !== 'frontier') {
          options.log(`Nothing to launch for ${key}`)
          return
        }
        const claude = yield* resolveNow
        if (claude.kind === 'missing') {
          options.log(`Not launching ${key}: ${claude.reason}`)
          return
        }
        const facts = yield* launchingFor(state.snapshot.repoRoot)
        const planned = workTicketLaunch(state.snapshot, facts, found)
        if (planned === null) {
          options.log(`Not launching ${key}: the wayfinder skill was not found`)
          return
        }
        // One atomic claim, so two clicks in quick succession start one terminal.
        const claimed = yield* Ref.modify(sessions, (map) =>
          canLaunchFrom(map.get(key))
            ? ([true, new Map(map).set(key, { kind: 'starting', terminal: null })] as const)
            : ([false, map] as const),
        )
        if (!claimed) return
        yield* publish
        // The events file exists before the plugin first appends to it.
        yield* fs.exists(facts.eventsFile).pipe(
          Effect.flatMap((exists) => (exists ? Effect.void : fs.writeFile(facts.eventsFile, ''))),
          Effect.catch((error) => {
            options.log(`Could not create the events file: ${error.message}`)
            return Effect.void
          }),
        )
        const terminal = yield* terminals.open({
          name: `#${found.ticket.number} ${found.ticket.title}`,
          shellPath: claude.claude.path,
          shellArgs: planned.argv.slice(1),
          cwd: planned.cwd,
          env: planned.env,
          icon: terminalIcon(found.ticket.type),
          location: yield* environment.terminalLocation,
        })
        yield* Ref.update(sessions, (map) => {
          const now = map.get(key)
          // The terminal may already have closed while it was being created.
          return now?.kind === 'starting' ? new Map(map).set(key, { ...now, terminal }) : map
        })
        yield* publish
      })

    const focusTerminal = (key: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const session = (yield* Ref.get(sessions)).get(key)
        if (session?.kind === 'starting' && session.terminal !== null) {
          yield* terminals.focus(session.terminal)
        }
      })

    const copyCommand = (key: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(base)
        if (state.kind !== 'snapshot') return
        const found = ticketOf(state.snapshot, key)
        const planned =
          found === null
            ? null
            : workTicketLaunch(state.snapshot, yield* launchingFor(state.snapshot.repoRoot), found)
        if (planned === null) {
          options.log(`Nothing to copy for ${key}`)
          return
        }
        yield* clipboard.write(planned.command)
      })

    terminals.onClosed(({ id, exit }) => {
      Effect.runFork(
        Effect.gen(function* () {
          const detail = describeExit(exit)
          const ended = yield* Ref.modify(sessions, (map) => {
            const next = new Map(map)
            let changed = false
            for (const [key, session] of map) {
              if (session.kind === 'starting' && session.terminal === id) {
                next.set(key, { kind: 'ended', detail })
                changed = true
              }
            }
            return [changed, changed ? next : map] as const
          })
          if (ended) yield* publish
        }),
      )
    })

    return {
      activated,
      show: trigger('automatic'),
      focus: trigger('automatic'),
      scratchChanged,
      refresh: trigger('button'),
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
              yield* trigger('button')
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
            case 'launch':
              yield* launch(message.key)
              break
            case 'focus-terminal':
              yield* focusTerminal(message.key)
              break
            case 'copy':
              yield* copyCommand(message.key)
              break
          }
          return true
        }),
    }
  })
