import type { TerminalExit } from '@hero-synergy/core'
import { Context, Effect, Layer } from 'effect'

import type { OpenTarget } from './view-model.ts'

/**
 * The window's facts the Cockpit reads without importing `vscode`. Each service
 * has an in-memory layer here for tests; the live layers use `vscode` and sit in
 * `./vscode` (ADR 0004).
 */

export interface WorkspaceFoldersShape {
  /** The window's workspace folders as file-system paths, in order; none for an empty window. */
  readonly paths: Effect.Effect<ReadonlyArray<string>>
}

export class WorkspaceFolders extends Context.Service<WorkspaceFolders, WorkspaceFoldersShape>()(
  'hero-synergy/WorkspaceFolders',
) {
  static readonly inMemory = (paths: ReadonlyArray<string>): Layer.Layer<WorkspaceFolders> =>
    Layer.succeed(WorkspaceFolders, { paths: Effect.succeed(paths) })
}

export interface StorageShape {
  /** The JSON value stored under the key, or `undefined` when nothing is. */
  readonly get: (key: string) => Effect.Effect<unknown>
  readonly set: (key: string, value: unknown) => Effect.Effect<void>
  /** The same, across every workspace: what a dismissed health entry is remembered in. */
  readonly getGlobal: (key: string) => Effect.Effect<unknown>
  readonly setGlobal: (key: string, value: unknown) => Effect.Effect<void>
}

/** Storage for what the Cockpit remembers: per workspace (the expanded nodes) and across workspaces. */
export class Storage extends Context.Service<Storage, StorageShape>()('hero-synergy/Storage') {
  /** `global` is shared by every layer given the same map, as one VS Code profile is by its windows. */
  static readonly inMemory = (
    initial: Readonly<Record<string, unknown>> = {},
    global: Map<string, unknown> = new Map(),
  ): Layer.Layer<Storage> =>
    Layer.sync(Storage, () => {
      const values = new Map<string, unknown>(Object.entries(initial))
      return {
        get: (key) => Effect.sync(() => values.get(key)),
        set: (key, value) =>
          Effect.sync(() => {
            values.set(key, value)
          }),
        getGlobal: (key) => Effect.sync(() => global.get(key)),
        setGlobal: (key, value) =>
          Effect.sync(() => {
            global.set(key, value)
          }),
      }
    })
}

export interface OpenerShape {
  /** Opens an issue URL in the browser or a ticket's file in an editor. */
  readonly open: (target: OpenTarget) => Effect.Effect<void>
  /** Opens a web link from a rendered body in the browser. */
  readonly openLink: (url: string) => Effect.Effect<void>
}

/** What ↗ Open launches, kept behind a service so tests see the target instead of a browser. */
export class Opener extends Context.Service<Opener, OpenerShape>()('hero-synergy/Opener') {
  /** Records each target in `opened` instead of opening it. */
  static readonly inMemory = (opened: OpenTarget[]): Layer.Layer<Opener> =>
    Layer.succeed(Opener, {
      open: (target) =>
        Effect.sync(() => {
          opened.push(target)
        }),
      openLink: (url) =>
        Effect.sync(() => {
          opened.push({ kind: 'url', url })
        }),
    })
}

export interface CollectProgressShape {
  /** A collect began: shows VS Code's progress bar and returns the effect that ends it. */
  readonly begin: Effect.Effect<Effect.Effect<void>>
}

/** The progress bar over the Tree while a collect runs; the Tree has no row spinners. */
export class CollectProgress extends Context.Service<CollectProgress, CollectProgressShape>()(
  'hero-synergy/CollectProgress',
) {
  /** Counts the bars shown in `shown` and how many are still open in `open`. */
  static readonly inMemory = (counts: {
    shown: number
    open: number
  }): Layer.Layer<CollectProgress> =>
    Layer.succeed(CollectProgress, {
      begin: Effect.sync(() => {
        counts.shown += 1
        counts.open += 1
        return Effect.sync(() => {
          counts.open -= 1
        })
      }),
    })
}

export type TerminalLocation = 'panel' | 'editor'

/** A terminal the Cockpit opens: the process is the terminal's own, never typed into a shell. */
export interface TerminalSpec {
  readonly name: string
  /** The program that is the terminal's own process; null opens the default shell. */
  readonly shellPath: string | null
  readonly shellArgs: ReadonlyArray<string>
  /** Typed into the shell once it is up, for a command that is not a `claude` session; null otherwise. */
  readonly sendText: string | null
  readonly cwd: string
  readonly env: Readonly<Record<string, string>>
  /** A codicon id, without the `$(…)` wrapper. */
  readonly icon: string
  readonly location: TerminalLocation
}

export type { TerminalExit }

export interface TerminalClosed {
  readonly id: number
  readonly exit: TerminalExit
}

/** A terminal the window already had when the Cockpit looked, such as one a reload kept. */
export interface ExistingTerminal {
  /** The Cockpit's own id for it, valid until it closes. */
  readonly id: number
  readonly name: string
}

export interface TerminalsShape {
  /** Creates and shows a terminal; its id is the Cockpit's own, valid until it closes. */
  readonly open: (spec: TerminalSpec) => Effect.Effect<number>
  /** The terminals the window has that this service did not open, each given an id so it can be focused. */
  readonly existing: Effect.Effect<ReadonlyArray<ExistingTerminal>>
  readonly focus: (id: number) => Effect.Effect<void>
  /** Calls the listener each time a terminal this service opened closes. */
  readonly onClosed: (listener: (closed: TerminalClosed) => void) => void
}

/** What a test holds to see the terminals the Cockpit opens and to play one closing. */
export interface TerminalRecorder {
  readonly opened: TerminalSpec[]
  /** Names of terminals the window already had, as a reload leaves them; ids follow the opened ones. */
  readonly kept: string[]
  readonly focused: number[]
  readonly close: (id: number, exit: TerminalExit) => void
}

/** The terminals the Cockpit launches sessions in, behind a service so tests see the spec and drive the close. */
export class Terminals extends Context.Service<Terminals, TerminalsShape>()(
  'hero-synergy/Terminals',
) {
  /** A recorder and the layer over it: ids are 1, 2, … in opening order. */
  static readonly inMemory = (): { recorder: TerminalRecorder; layer: Layer.Layer<Terminals> } => {
    const listeners: Array<(closed: TerminalClosed) => void> = []
    const recorder: TerminalRecorder = {
      opened: [],
      kept: [],
      focused: [],
      close: (id, exit) => listeners.forEach((listener) => listener({ id, exit })),
    }
    return {
      recorder,
      layer: Layer.succeed(Terminals, {
        open: (spec) =>
          Effect.sync(() => {
            recorder.opened.push(spec)
            return recorder.opened.length
          }),
        existing: Effect.sync(() =>
          recorder.kept.map((name, index) => ({ id: 1000 + index, name })),
        ),
        focus: (id) =>
          Effect.sync(() => {
            recorder.focused.push(id)
          }),
        onClosed: (listener) => {
          listeners.push(listener)
        },
      }),
    }
  }
}

export interface EventsWatcherShape {
  /**
   * Calls `onChange` each time the events file changes. The file exists by the time this is
   * called; the watcher lives as long as the window, and a change may be reported more than once
   * or not at all, which is why a slow poll backs it.
   */
  readonly watch: (file: string, onChange: () => void) => Effect.Effect<void>
}

/** What a test holds to see which files are watched and to play a change. */
export interface EventsWatcherRecorder {
  readonly watched: string[]
  readonly change: () => void
}

/** The events file's watcher, behind a service so tests play the change instead of waiting for a disk. */
export class EventsWatcher extends Context.Service<EventsWatcher, EventsWatcherShape>()(
  'hero-synergy/EventsWatcher',
) {
  static readonly inMemory = (): {
    recorder: EventsWatcherRecorder
    layer: Layer.Layer<EventsWatcher>
  } => {
    const listeners: Array<() => void> = []
    const recorder: EventsWatcherRecorder = {
      watched: [],
      change: () => listeners.forEach((listener) => listener()),
    }
    return {
      recorder,
      layer: Layer.succeed(EventsWatcher, {
        watch: (file, onChange) =>
          Effect.sync(() => {
            recorder.watched.push(file)
            listeners.push(onChange)
          }),
      }),
    }
  }
}

/** One skill in the Run skill… list: the command as label, where it came from, what it does. */
export interface SkillChoice {
  /** `/mattpocock-skills:grill-me`. */
  readonly label: string
  /** `plugin 1.2.3`, `project` or `personal`. */
  readonly description: string
  /** The skill's frontmatter description. */
  readonly detail: string
}

export interface PaletteShape {
  /** Shows a native QuickPick; resolves to the chosen label, or null when it was dismissed. */
  readonly pickSkill: (
    title: string,
    choices: ReadonlyArray<SkillChoice>,
  ) => Effect.Effect<string | null>
  /** Tells the person why a palette command did nothing. */
  readonly inform: (message: string) => Effect.Effect<void>
}

/** The native QuickPick and messages behind the palette commands, behind a service so tests see the choices and make one. */
export class Palette extends Context.Service<Palette, PaletteShape>()('hero-synergy/Palette') {
  /** Records each pick and message; `choose` answers a pick with the label to choose, or null to dismiss. */
  static readonly inMemory = (
    record: {
      picks: Array<{ title: string; choices: ReadonlyArray<SkillChoice> }>
      informed: string[]
    },
    choose: (choices: ReadonlyArray<SkillChoice>) => string | null = () => null,
  ): Layer.Layer<Palette> =>
    Layer.succeed(Palette, {
      pickSkill: (title, choices) =>
        Effect.sync(() => {
          record.picks.push({ title, choices })
          return choose(choices)
        }),
      inform: (message) =>
        Effect.sync(() => {
          record.informed.push(message)
        }),
    })
}

export interface RegistryWatcherShape {
  /**
   * Calls `onChange` each time something under Claude Code's sessions directory changes: a trigger
   * to read the registry, never a source (the files are not parsed). Returns the effect that
   * stops the watcher, or null where there is nothing to watch (no such directory yet).
   */
  readonly watch: (onChange: () => void) => Effect.Effect<Effect.Effect<void> | null>
}

/** What a test holds to see whether the registry is watched and to play a change. */
export interface RegistryWatcherRecorder {
  /** How many watchers were started, stopped ones included. */
  readonly started: () => number
  /** Whether a watcher is running now. */
  readonly watching: () => boolean
  readonly change: () => void
}

/** The registry directory's watcher, behind a service so tests play the change instead of waiting for a disk. */
export class RegistryWatcher extends Context.Service<RegistryWatcher, RegistryWatcherShape>()(
  'hero-synergy/RegistryWatcher',
) {
  /** `available: false` is a machine with no sessions directory. */
  static readonly inMemory = (
    available = true,
  ): { recorder: RegistryWatcherRecorder; layer: Layer.Layer<RegistryWatcher> } => {
    const running = new Set<() => void>()
    let started = 0
    const recorder: RegistryWatcherRecorder = {
      started: () => started,
      watching: () => running.size > 0,
      change: () => [...running].forEach((listener) => listener()),
    }
    return {
      recorder,
      layer: Layer.succeed(RegistryWatcher, {
        watch: (onChange) =>
          Effect.sync(() => {
            if (!available) return null
            started += 1
            running.add(onChange)
            return Effect.sync(() => {
              running.delete(onChange)
            })
          }),
      }),
    }
  }
}

export interface ClipboardShape {
  readonly write: (text: string) => Effect.Effect<void>
}

/** The copy button's destination, behind a service so tests see the text instead of a clipboard. */
export class Clipboard extends Context.Service<Clipboard, ClipboardShape>()(
  'hero-synergy/Clipboard',
) {
  static readonly inMemory = (written: string[]): Layer.Layer<Clipboard> =>
    Layer.succeed(Clipboard, {
      write: (text) =>
        Effect.sync(() => {
          written.push(text)
        }),
    })
}

export interface HostEnvironmentShape {
  /** `process.platform`. */
  readonly platform: string
  /** `vscode.env.appName`, logged at activation for a bug report from a fork. */
  readonly appName: string
  /** `vscode.env.appHost`: `desktop`, or the web host. */
  readonly appHost: string
  /** `vscode.version`. */
  readonly vscodeVersion: string
  /** The home directory, whose `.claude/skills` holds personal skills; null when unknown. */
  readonly home: string | null
  /** The `PATH` variable. */
  readonly pathVariable: string
  /** `heroSynergy.claude.path`, read each time so a change applies to the next launch. */
  readonly claudeSetting: Effect.Effect<string>
  /** `heroSynergy.sessions.terminalLocation`, read each time. */
  readonly terminalLocation: Effect.Effect<TerminalLocation>
  /** The full path of the extension's `claude-plugin` directory. */
  readonly pluginPath: string
  /** The status events file for a repo, one per repo identity. */
  readonly eventsFile: (repoRoot: string) => string
}

/** What the window and the extension's install say about where things are. */
export class HostEnvironment extends Context.Service<HostEnvironment, HostEnvironmentShape>()(
  'hero-synergy/HostEnvironment',
) {
  static readonly inMemory = (
    overrides: Partial<HostEnvironmentShape> = {},
  ): Layer.Layer<HostEnvironment> =>
    Layer.succeed(HostEnvironment, {
      platform: 'linux',
      appName: 'Visual Studio Code',
      appHost: 'desktop',
      vscodeVersion: '1.105.0',
      home: null,
      pathVariable: '',
      claudeSetting: Effect.succeed(''),
      terminalLocation: Effect.succeed<TerminalLocation>('panel'),
      pluginPath: '/ext/claude-plugin',
      eventsFile: () => '/storage/events/repo.jsonl',
      ...overrides,
    })
}
