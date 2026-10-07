import { Context, Effect, Layer } from 'effect'

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
