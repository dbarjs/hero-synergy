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
}

/** Per-workspace storage for what the Cockpit remembers: which nodes are expanded. */
export class Storage extends Context.Service<Storage, StorageShape>()('hero-synergy/Storage') {
  static readonly inMemory = (
    initial: Readonly<Record<string, unknown>> = {},
  ): Layer.Layer<Storage> =>
    Layer.sync(Storage, () => {
      const values = new Map<string, unknown>(Object.entries(initial))
      return {
        get: (key) => Effect.sync(() => values.get(key)),
        set: (key, value) =>
          Effect.sync(() => {
            values.set(key, value)
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
  readonly shellPath: string
  readonly shellArgs: ReadonlyArray<string>
  readonly cwd: string
  readonly env: Readonly<Record<string, string>>
  /** A codicon id, without the `$(…)` wrapper. */
  readonly icon: string
  readonly location: TerminalLocation
}

/** How a terminal ended, from VS Code's exit status. */
export interface TerminalExit {
  readonly reason: 'user' | 'shutdown' | 'process' | 'extension' | 'unknown'
  readonly code: number | null
}

export interface TerminalClosed {
  readonly id: number
  readonly exit: TerminalExit
}

export interface TerminalsShape {
  /** Creates and shows a terminal; its id is the Cockpit's own, valid until it closes. */
  readonly open: (spec: TerminalSpec) => Effect.Effect<number>
  readonly focus: (id: number) => Effect.Effect<void>
  /** Calls the listener each time a terminal this service opened closes. */
  readonly onClosed: (listener: (closed: TerminalClosed) => void) => void
}

/** What a test holds to see the terminals the Cockpit opens and to play one closing. */
export interface TerminalRecorder {
  readonly opened: TerminalSpec[]
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
      home: null,
      pathVariable: '',
      claudeSetting: Effect.succeed(''),
      terminalLocation: Effect.succeed<TerminalLocation>('panel'),
      pluginPath: '/ext/claude-plugin',
      eventsFile: () => '/storage/events/repo.jsonl',
      ...overrides,
    })
}
