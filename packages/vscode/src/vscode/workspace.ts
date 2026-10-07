import { Effect, Layer } from 'effect'
import * as vscode from 'vscode'

import { TREE_VIEW_ID } from './tree-view.ts'
import { CollectProgress, Opener, Storage, WorkspaceFolders } from '../services.ts'

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

/** ↗ Open: an issue in the browser, a local ticket in an editor. */
export const openerLive: Layer.Layer<Opener> = Layer.succeed(Opener, {
  open: (target) =>
    Effect.promise(async () => {
      if (target.kind === 'url') await vscode.env.openExternal(vscode.Uri.parse(target.url))
      else await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(target.path))
    }),
  openLink: (url) =>
    Effect.promise(async () => void (await vscode.env.openExternal(vscode.Uri.parse(url)))),
})

/** VS Code's progress bar over the Tree's view, shown from the start of a collect to its end. */
export const collectProgressLive: Layer.Layer<CollectProgress> = Layer.succeed(CollectProgress, {
  begin: Effect.sync(() => {
    let end: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      end = resolve
    })
    void vscode.window.withProgress({ location: { viewId: TREE_VIEW_ID } }, () => held)
    return Effect.sync(end)
  }),
})
