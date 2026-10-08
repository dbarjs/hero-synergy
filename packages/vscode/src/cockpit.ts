import {
  commandOf,
  type DiscoveredSkill,
  discoverSkills,
  FileSystem,
  type FileSystemError,
  findRepo,
  type GitHubCollectFailed,
  type Launch,
  type ProcessError,
  ProcessRunner,
  type RateLimit,
  readGitHubTracker,
  readLocalTracker,
  type RepoTracker,
  readPluginList,
  type ScoutError,
  type Snapshot,
  type StatusEvent,
  userInvokedSkills,
} from '@hero-synergy/core'
import { Clock, Deferred, Effect, Fiber, Ref, Semaphore } from 'effect'

import { type ClaudeResolution, resolveClaude } from './claude-path.ts'
import {
  EVENTS_POLL_MS,
  EVENTS_SIZE_CAP,
  type EventsReader,
  makeEventsReader,
} from './events-file.ts'
import {
  canLaunchFrom,
  chartMapAction,
  type Launching,
  mapActions,
  NOT_LAUNCHING,
  type Planned,
  RUN_SKILL_TITLE,
  runSkillAction,
  runSkillReason,
  startActionById,
  startOf,
  ticketActions,
} from './launch.ts'
import { decodeWebviewMessage } from './messages.ts'
import { describeCollectFailure } from './notices.ts'
import {
  type ActionId,
  type BudgetNote,
  type DetailView,
  type MapSection,
  type Notice,
  REPO_KEY,
  type ViewModel,
} from './protocol.ts'
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
  afterReload,
  HINT_AFTER_MS,
  isRunning,
  needsYou,
  reduceSession,
  type SessionInput,
  type SessionState,
} from './session.ts'
import {
  Clipboard,
  CollectProgress,
  EventsWatcher,
  HostEnvironment,
  Opener,
  Palette,
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
  focusKeyOf,
  revealKeys,
  selectionOf,
  ticketKey,
  ticketOf,
} from './view-model.ts'

/** The key the expanded nodes are stored under in workspace storage. */
export const EXPANDED_KEY = 'expanded'
/** The key the selected row is stored under: a row key, or nothing selected. */
export const SELECTED_KEY = 'selected'
/** The key the dismissed drift entries are stored under: their dismissal keys, each at its exact detail. */
export const DISMISSED_KEY = 'dismissedDrift'

export interface CockpitOptions {
  /** Sends a view model to the Tree's webview. */
  readonly publish: (viewModel: ViewModel) => void
  /** Sends the Detail's view to its panel, if one is open. */
  readonly publishDetail: (view: DetailView) => void
  /** Opens the Detail panel, or brings the open one forward; `focus` moves the keyboard into it. */
  readonly showDetail: (focus: boolean) => void
  /** Sets the Tree container's badge to the number of sessions that need me; 0 clears it. */
  readonly badge: (count: number) => void
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
  /** `Hero Synergy: Chart a map`, the Tree's title-bar button: a plain terminal on the wayfinder command. */
  readonly chartMap: Effect.Effect<void>
  /** `Hero Synergy: Run skill…`: a QuickPick of the user-invoked skills, then a plain terminal on the one chosen. */
  readonly runSkill: Effect.Effect<void>
}

/** A plain message in place of the maps, and what it needs to lead with an Action. */
interface MessageState {
  readonly kind: 'message'
  readonly message: string
  readonly detail: string | null
  /** The repo the message is about, for its terminals and skill discovery; null when there is none. */
  readonly repoRoot: string | null
  /** The repo has no tracker doc, which Setup writes. */
  readonly noTrackerDoc: boolean
}

type Base =
  | { readonly kind: 'loading' }
  | MessageState
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
  | MessageState
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
        : {
            kind: 'message',
            ...describeError(error),
            repoRoot: 'repoRoot' in error ? error.repoRoot : null,
            noTrackerDoc: error._tag === 'NoTrackerDoc',
          },
    ),
  ),
)

const storedExpanded = (value: unknown): ReadonlySet<string> | null =>
  Array.isArray(value) && value.every((entry): entry is string => typeof entry === 'string')
    ? new Set(value)
    : null

const storedDismissed = (value: unknown): ReadonlySet<string> =>
  new Set(Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [])

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
  | EventsWatcher
  | Clipboard
  | HostEnvironment
  | Palette
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
    const watcher = yield* EventsWatcher
    const clipboard = yield* Clipboard
    const palette = yield* Palette
    const environment = yield* HostEnvironment
    const fs = yield* FileSystem
    const runner = yield* ProcessRunner
    // Ticket row key to its session: absent is none.
    const sessions = yield* Ref.make<ReadonlyMap<string, SessionState>>(new Map())
    // The events file being read, once the repo is known.
    const events = yield* Ref.make<{ readonly file: string; readonly reader: EventsReader } | null>(
      null,
    )
    // One read of the events file at a time, so the watcher and the poll never read the same bytes twice.
    const reading = Semaphore.makeUnsafe(1)
    const polling = yield* Ref.make(false)
    // What the last discovery found: where `claude` is and the skills; null skills until it has run.
    const discovery = yield* Ref.make<{
      readonly claude: ClaudeResolution
      readonly skills: ReadonlyArray<DiscoveredSkill> | null
    }>({ claude: NOT_LAUNCHING.claude, skills: null })
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
    // Drift entries hidden by the person; a changed detail has a new key, so it shows again.
    const dismissed = yield* Ref.make<ReadonlySet<string>>(
      storedDismissed(yield* storage.get(DISMISSED_KEY)),
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

    /** The numbers of the tickets whose session needs me. */
    const needing = (map: ReadonlyMap<string, SessionState>): ReadonlySet<number> =>
      new Set(
        [...map].flatMap(([key, session]) =>
          needsYou(session) ? [Number(key.slice(key.lastIndexOf(':') + 1))] : [],
        ),
      )

    const launchingFor = (repoRoot: string): Effect.Effect<Launching> =>
      Effect.gen(function* () {
        const found = yield* Ref.get(discovery)
        const skills = found.skills ?? []
        return {
          sessions: yield* Ref.get(sessions),
          claude: found.claude,
          wayfinder: commandOf(skills, 'wayfinder'),
          toSpec: commandOf(skills, 'to-spec'),
          setup: commandOf(skills, 'setup-matt-pocock-skills'),
          userInvoked: found.skills === null ? null : userInvokedSkills(skills).length,
          pluginPath: environment.pluginPath,
          eventsFile: environment.eventsFile(repoRoot),
        }
      })

    const current: Effect.Effect<ViewModel> = Effect.gen(function* () {
      const state = yield* Ref.get(base)
      if (state.kind === 'loading') return state
      if (state.kind === 'message') {
        const facts = yield* launchingFor(state.repoRoot ?? '')
        return {
          kind: 'message',
          message: state.message,
          detail: state.detail,
          start: startOf(state.repoRoot, facts, state.noTrackerDoc ? 'tracker-doc' : 'other'),
        }
      }
      const open = (yield* Ref.get(expanded)) ?? defaultExpanded(state.snapshot)
      return buildViewModel(
        state.snapshot,
        open,
        yield* Ref.get(selected),
        { needsYou: needing(yield* Ref.get(sessions)) },
        state.notice,
        yield* budgetNote,
        yield* launchingFor(state.snapshot.repoRoot),
        yield* Ref.get(dismissed),
      )
    })

    const currentDetail: Effect.Effect<DetailView> = Effect.gen(function* () {
      const state = yield* Ref.get(base)
      const key = yield* Ref.get(selected)
      return {
        detail:
          state.kind === 'snapshot'
            ? detailOf(
                state.snapshot,
                key,
                yield* launchingFor(state.snapshot.repoRoot),
                yield* Ref.get(dismissed),
              )
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

    const activated: Effect.Effect<void> = Effect.gen(function* () {
      options.log(describeResolution(yield* resolveNow))
      // The last good snapshot names the repo, so the events file is read without a collect.
      // Nothing is published: the Tree is not registered yet.
      if (cached !== null) yield* startEvents(cached.snapshot.repoRoot, false)
    })

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
        yield* Ref.set(discovery, { claude, skills: inventory.skills })
      })

    /** Sets a ticket's session to what the reducer makes of the input. */
    const dispatch = (key: string, input: SessionInput): Effect.Effect<void> =>
      Ref.update(sessions, (map) => {
        const next = reduceSession(map.get(key), input)
        if (next === map.get(key)) return map
        const updated = new Map(map)
        if (next === undefined) updated.delete(key)
        else updated.set(key, next)
        return updated
      })

    /** Reads the events file while a session runs: the watcher can drop an event, the poll catches it. */
    const pollLoop: Effect.Effect<void> = Effect.gen(function* () {
      for (;;) {
        yield* Effect.sleep(EVENTS_POLL_MS)
        const running = [...(yield* Ref.get(sessions)).values()].some(isRunning)
        if (!running) return yield* Ref.set(polling, false)
        yield* drainEvents
      }
    })

    const ensurePolling: Effect.Effect<void> = Effect.gen(function* () {
      if (![...(yield* Ref.get(sessions)).values()].some(isRunning)) return
      const claimed = yield* Ref.modify(polling, (already) => [!already, true] as const)
      if (claimed) yield* Effect.forkDetach(pollLoop)
    })

    /** The repo the palette commands act in: the one on screen, else the window's. Null when there is none. */
    const repoRootNow: Effect.Effect<string | null> = Effect.gen(function* () {
      const state = yield* Ref.get(base)
      if (state.kind === 'snapshot') return state.snapshot.repoRoot
      if (state.kind === 'message' && state.repoRoot !== null) return state.repoRoot
      return yield* findRepo(yield* workspace.paths).pipe(
        Effect.map((found) => found.repoRoot),
        Effect.catch((error) => Effect.succeed('repoRoot' in error ? error.repoRoot : null)),
        Effect.provideContext(context),
      )
    })

    const publish: Effect.Effect<void> = Effect.gen(function* () {
      options.badge([...(yield* Ref.get(sessions)).values()].filter(needsYou).length)
      options.publish(yield* current)
      options.publishDetail(yield* currentDetail)
      yield* ensurePolling
    })

    /** The row key a status event's ticket number names: the one with a session, else the one in view. */
    const keyOfTicket = (ticket: string): Effect.Effect<string | null> =>
      Effect.gen(function* () {
        const suffix = `:ticket:${ticket}`
        const known = [...(yield* Ref.get(sessions))].filter(([key]) => key.endsWith(suffix))
        const running = known.find(([, session]) => isRunning(session))
        if (running !== undefined) return running[0]
        if (known.length > 0) return known[known.length - 1]![0]
        const state = yield* Ref.get(base)
        if (state.kind !== 'snapshot') return null
        const number = Number(ticket)
        const map = state.snapshot.maps.find((candidate) =>
          candidate.tickets.some((entry) => entry.number === number),
        )
        return map === undefined ? null : ticketKey(map, number)
      })

    /** Feeds status events to the tickets they name; true when any changed a session. */
    const applyEvents = (read: ReadonlyArray<StatusEvent>): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const before = yield* Ref.get(sessions)
        const now = yield* Clock.currentTimeMillis
        for (const event of read) {
          const key = yield* keyOfTicket(event.ticket)
          if (key === null) {
            options.log(`Status event ${event.hook} for #${event.ticket} matches no ticket in view`)
            continue
          }
          yield* dispatch(key, { type: 'event', event, at: event.at ?? now })
        }
        return (yield* Ref.get(sessions)) !== before
      })

    /** Reads what the plugin appended since the last read and applies it. */
    const drainEvents: Effect.Effect<void> = reading.withPermits(1)(
      Effect.gen(function* () {
        const current = yield* Ref.get(events)
        if (current === null) return
        const read = yield* current.reader.read
        for (const problem of read.problems) options.log(problem)
        if (read.events.length === 0) return
        if (yield* applyEvents(read.events)) yield* publish
      }),
    )

    /**
     * Starts reading the events file of a repo, once its root is known: the file is created before
     * it is watched, read in full once, compacted if it grew past the cap, then watched. What the
     * file says is live is not confirmed by a terminal of this window (adopting the terminals that
     * survived a reload comes with the registry), so it is shown as ended, "window closed".
     */
    const startEvents = (repoRoot: string, announce: boolean): Effect.Effect<void> =>
      reading
        .withPermits(1)(
          Effect.gen(function* () {
            const file = environment.eventsFile(repoRoot)
            if ((yield* Ref.get(events))?.file === file) return
            const created = yield* fs.exists(file).pipe(
              Effect.flatMap((exists) => (exists ? Effect.void : fs.writeFile(file, ''))),
              Effect.as(true),
              Effect.catch((error) => {
                options.log(`Could not create the events file: ${error.message}`)
                return Effect.succeed(false)
              }),
            )
            if (!created) return
            const reader = yield* makeEventsReader(file).pipe(Effect.provideService(FileSystem, fs))
            yield* Ref.set(events, { file, reader })
            const first = yield* reader.read
            for (const problem of first.problems) options.log(problem)
            const prior = yield* Ref.get(sessions)
            yield* applyEvents(first.events)
            const at = yield* Clock.currentTimeMillis
            // Only what the file put there: a terminal launched meanwhile is this window's own.
            yield* Ref.update(sessions, (map) => {
              const reloaded = new Map(map)
              for (const [key, session] of map) {
                if (session !== prior.get(key)) reloaded.set(key, afterReload(session, at))
              }
              return reloaded
            })
            if (yield* reader.compact(EVENTS_SIZE_CAP)) options.log(`Compacted ${file}`)
            yield* watcher.watch(file, () => Effect.runFork(drainEvents))
          }),
        )
        .pipe(Effect.andThen(announce ? publish : Effect.void))

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
                : {
                    kind: 'message',
                    message: loaded.notice.message,
                    detail: loaded.notice.fix,
                    repoRoot: null,
                    noTrackerDoc: false,
                  },
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
      // Skill discovery runs with every collect that found a repo, before it is shown: the empty states need it too.
      if (loaded.kind === 'snapshot') yield* discover(loaded.snapshot.repoRoot)
      else if (loaded.kind === 'message' && loaded.repoRoot !== null) {
        yield* discover(loaded.repoRoot)
      }
      yield* settle(loaded, yield* Clock.currentTimeMillis)
      // The events file is read once the first snapshot names the repo, before the Tree shows it.
      if (loaded.kind === 'snapshot') yield* startEvents(loaded.snapshot.repoRoot, false)
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

    const dismissDrift = (dismissKey: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const after = yield* Ref.modify(dismissed, (current) => {
          const next = new Set(current).add(dismissKey)
          return [next, next] as const
        })
        yield* storage.set(DISMISSED_KEY, [...after])
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

    /**
     * What the window knows right now: `claude` is resolved afresh, so a changed setting
     * applies to the very next launch.
     */
    const launchingNow = (repoRoot: string): Effect.Effect<Launching> =>
      Effect.gen(function* () {
        return { ...(yield* launchingFor(repoRoot)), claude: yield* resolveNow }
      })

    /** The Action a row offers: `id` when given, else the first of its context; null when it offers none. */
    const planFor = (
      state: Base,
      facts: Launching,
      key: string,
      id: ActionId | undefined,
    ): Planned | null => {
      const wanted = (all: ReadonlyArray<Planned>): Planned | null =>
        (id === undefined ? all[0] : all.find((planned) => planned.view.id === id)) ?? null
      if (key === REPO_KEY) {
        const repoRoot =
          state.kind === 'snapshot'
            ? state.snapshot.repoRoot
            : state.kind === 'message'
              ? state.repoRoot
              : null
        return repoRoot === null || id === undefined ? null : startActionById(repoRoot, facts, id)
      }
      if (state.kind !== 'snapshot') return null
      const found = ticketOf(state.snapshot, key)
      if (found !== null) return wanted(ticketActions(state.snapshot, facts, found, key))
      const map = state.snapshot.maps.find((candidate) => focusKeyOf(candidate) === key)
      return map === undefined ? null : wanted(mapActions(state.snapshot, facts, map))
    }

    /** Opens the terminal an Action plans: `claude` as its own process, or the default shell with the command typed in. */
    const spawnTerminal = (
      planned: Planned,
      launch: Launch,
      claude: ClaudeResolution,
    ): Effect.Effect<number | null> =>
      Effect.gen(function* () {
        const asClaude = planned.spawn === 'claude'
        if (asClaude && claude.kind === 'missing') return null
        return yield* terminals.open({
          name: planned.name,
          shellPath: asClaude && claude.kind === 'found' ? claude.claude.path : null,
          shellArgs: asClaude ? launch.argv.slice(1) : [],
          sendText: asClaude ? null : launch.command,
          cwd: launch.cwd,
          env: launch.env,
          icon: planned.icon,
          location: yield* environment.terminalLocation,
        })
      })

    /** A plain terminal for an Action that is not a ticket session: nothing is tracked, no state changes. */
    const runPlain = (planned: Planned, facts: Launching): Effect.Effect<void> =>
      Effect.gen(function* () {
        if (planned.view.disabled !== null || planned.launch === null) {
          yield* palette.inform(planned.view.disabled ?? `${planned.view.label} has no command.`)
          return
        }
        yield* spawnTerminal(planned, planned.launch, facts.claude)
      })

    /** Every spawn on the launch path is async: the terminal, the events file and the resolution. */
    const launch = (key: string, id: ActionId | undefined): Effect.Effect<void> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(base)
        const repoRoot =
          state.kind === 'snapshot'
            ? state.snapshot.repoRoot
            : state.kind === 'message'
              ? state.repoRoot
              : null
        if (repoRoot === null) {
          options.log(`Nothing to launch for ${key}`)
          return
        }
        const facts = yield* launchingNow(repoRoot)
        const planned = planFor(state, facts, key, id)
        if (planned === null) {
          options.log(`Nothing to launch for ${key}`)
          return
        }
        if (planned.view.disabled !== null || planned.launch === null) {
          options.log(`Not launching ${key}: ${planned.view.disabled ?? 'it has no command'}`)
          return
        }
        if (!planned.tracked) {
          yield* spawnTerminal(planned, planned.launch, facts.claude)
          return
        }
        // One atomic claim, so two clicks in quick succession start one terminal.
        const launchedAt = yield* Clock.currentTimeMillis
        const claimed = yield* Ref.modify(sessions, (map) =>
          canLaunchFrom(map.get(key))
            ? ([
                true,
                new Map(map).set(
                  key,
                  reduceSession(map.get(key), { type: 'launched', at: launchedAt })!,
                ),
              ] as const)
            : ([false, map] as const),
        )
        if (!claimed) return
        yield* publish
        // The events file exists before the plugin first appends to it (the reader made it already
        // once the repo was known; this covers a launch that beat the first read).
        yield* fs.exists(facts.eventsFile).pipe(
          Effect.flatMap((exists) => (exists ? Effect.void : fs.writeFile(facts.eventsFile, ''))),
          Effect.catch((error) => {
            options.log(`Could not create the events file: ${error.message}`)
            return Effect.void
          }),
        )
        const terminal = yield* spawnTerminal(planned, planned.launch, facts.claude)
        // A planned Action that runs as `claude` is disabled without it, so a terminal exists here.
        if (terminal === null) return
        // The terminal may already have closed while it was being created: the reducer then leaves it.
        yield* dispatch(key, { type: 'terminal', terminal })
        yield* publish
        // The only timer: 15 s after the terminal opens, a session with no status says so.
        yield* Effect.forkDetach(
          Effect.sleep(HINT_AFTER_MS).pipe(
            Effect.andThen(dispatch(key, { type: 'quiet', terminal })),
            Effect.andThen(publish),
          ),
        )
      })

    /** `Hero Synergy: Chart a map`: the wayfinder skill with no input, in a plain terminal. */
    const chartMapCommand: Effect.Effect<void> = Effect.gen(function* () {
      const repoRoot = yield* repoRootNow
      if (repoRoot === null) {
        yield* palette.inform('No git repository to chart a map in.')
        return
      }
      if ((yield* Ref.get(discovery)).skills === null) yield* discover(repoRoot)
      const facts = yield* launchingNow(repoRoot)
      yield* runPlain(chartMapAction(repoRoot, facts), facts)
    })

    /** `Hero Synergy: Run skill…`: pick a user-invoked skill, then run it in a plain terminal. */
    const runSkillCommand: Effect.Effect<void> = Effect.gen(function* () {
      const repoRoot = yield* repoRootNow
      if (repoRoot === null) {
        yield* palette.inform('No git repository to run a skill in.')
        return
      }
      if ((yield* Ref.get(discovery)).skills === null) yield* discover(repoRoot)
      const facts = yield* launchingNow(repoRoot)
      const reason = runSkillReason(facts)
      if (reason !== null) {
        yield* palette.inform(reason)
        return
      }
      const skills = userInvokedSkills((yield* Ref.get(discovery)).skills ?? [])
      const chosen = yield* palette.pickSkill(
        RUN_SKILL_TITLE,
        skills.map((skill) => ({
          label: skill.command,
          description: skill.origin,
          detail: skill.description,
        })),
      )
      if (chosen === null) return
      yield* runPlain(runSkillAction(repoRoot, facts, chosen), facts)
    })

    const focusTerminal = (key: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const session = (yield* Ref.get(sessions)).get(key)
        if (
          (session?.kind === 'starting' || session?.kind === 'live') &&
          session.terminal !== null
        ) {
          yield* terminals.focus(session.terminal)
        }
      })

    const copyCommand = (key: string, id: ActionId | undefined): Effect.Effect<void> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(base)
        const repoRoot =
          state.kind === 'snapshot'
            ? state.snapshot.repoRoot
            : state.kind === 'message'
              ? state.repoRoot
              : null
        const planned =
          repoRoot === null ? null : planFor(state, yield* launchingFor(repoRoot), key, id)
        if (planned?.launch == null) {
          options.log(`Nothing to copy for ${key}`)
          return
        }
        yield* clipboard.write(planned.launch.command)
      })

    terminals.onClosed(({ id, exit }) => {
      Effect.runFork(
        Effect.gen(function* () {
          const at = yield* Clock.currentTimeMillis
          const before = yield* Ref.get(sessions)
          for (const key of before.keys()) {
            yield* dispatch(key, { type: 'closed', terminal: id, exit, at })
          }
          if ((yield* Ref.get(sessions)) !== before) yield* publish
        }),
      )
    })

    return {
      activated,
      chartMap: chartMapCommand,
      runSkill: runSkillCommand,
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
              yield* launch(message.key, message.action)
              break
            case 'focus-terminal':
              yield* focusTerminal(message.key)
              break
            case 'copy':
              yield* copyCommand(message.key, message.action)
              break
            case 'dismiss-drift':
              yield* dismissDrift(message.dismissKey)
              break
          }
          return true
        }),
    }
  })
