import { Effect, Layer } from 'effect'
import * as vscode from 'vscode'

import { Storage, WorkspaceFolders } from '../services.ts'

/** The window's workspace folders, read each time so a folder added later is seen by the next collect. */
export const workspaceFoldersLive: Layer.Layer<WorkspaceFolders> = Layer.succeed(WorkspaceFolders, {
  paths: Effect.sync(() =>
    (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
  ),
})

/** Per-workspace storage over the extension's `workspaceState`. */
export const storageLive = (memento: vscode.Memento): Layer.Layer<Storage> =>
  Layer.succeed(Storage, {
    get: (key) => Effect.sync(() => memento.get<unknown>(key)),
    set: (key, value) => Effect.promise(() => Promise.resolve(memento.update(key, value))),
  })
