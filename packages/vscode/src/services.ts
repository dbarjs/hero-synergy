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
