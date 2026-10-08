import { createHash } from 'node:crypto'
import { existsSync, watch } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Effect, Layer } from 'effect'
import * as vscode from 'vscode'

import { TREE_VIEW_ID } from './tree-view.ts'
import {
  Clipboard,
  CollectProgress,
  EventsWatcher,
  HostEnvironment,
  Opener,
  Palette,
  RegistryWatcher,
  Storage,
  type TerminalClosed,
  type TerminalExit,
  Terminals,
  WorkspaceFolders,
} from '../services.ts'

/** The window's workspace folders, read each time so a folder added later is seen by the next collect. */
export const workspaceFoldersLive: Layer.Layer<WorkspaceFolders> = Layer.succeed(WorkspaceFolders, {
  paths: Effect.sync(() =>
    (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
  ),
})

/** Storage over the extension's `workspaceState`, and across workspaces over its `globalState`. */
export const storageLive = (
  memento: vscode.Memento,
  globalMemento: vscode.Memento,
): Layer.Layer<Storage> =>
  Layer.succeed(Storage, {
    get: (key) => Effect.sync(() => memento.get<unknown>(key)),
    set: (key, value) => Effect.promise(() => Promise.resolve(memento.update(key, value))),
    getGlobal: (key) => Effect.sync(() => globalMemento.get<unknown>(key)),
    setGlobal: (key, value) =>
      Effect.promise(() => Promise.resolve(globalMemento.update(key, value))),
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

/** Copy button: the text goes to the system clipboard. */
export const clipboardLive: Layer.Layer<Clipboard> = Layer.succeed(Clipboard, {
  write: (text) => Effect.promise(() => Promise.resolve(vscode.env.clipboard.writeText(text))),
})

const exitOf = (status: vscode.TerminalExitStatus | undefined): TerminalExit => {
  if (status === undefined) return { reason: 'unknown', code: null }
  const code = status.code ?? null
  switch (status.reason) {
    case vscode.TerminalExitReason.User:
      return { reason: 'user', code }
    case vscode.TerminalExitReason.Shutdown:
      return { reason: 'shutdown', code }
    case vscode.TerminalExitReason.Process:
      return { reason: 'process', code }
    case vscode.TerminalExitReason.Extension:
      return { reason: 'extension', code }
    default:
      return { reason: 'unknown', code }
  }
}

/**
 * The terminals sessions run in. `claude` is the terminal's own process (`shellPath` and
 * `shellArgs`), never typed into a shell. Neither transient nor hidden, so a reload keeps them.
 */
export const terminalsLive = (context: vscode.ExtensionContext): Layer.Layer<Terminals> =>
  Layer.sync(Terminals, () => {
    let nextId = 1
    const byId = new Map<number, vscode.Terminal>()
    const idOf = new Map<vscode.Terminal, number>()
    const listeners: Array<(closed: TerminalClosed) => void> = []
    context.subscriptions.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        const id = idOf.get(terminal)
        if (id === undefined) return
        idOf.delete(terminal)
        byId.delete(id)
        const closed = { id, exit: exitOf(terminal.exitStatus) }
        listeners.forEach((listener) => listener(closed))
      }),
    )
    return {
      open: (spec) =>
        Effect.sync(() => {
          const terminal = vscode.window.createTerminal({
            name: spec.name,
            ...(spec.shellPath === null
              ? {}
              : { shellPath: spec.shellPath, shellArgs: [...spec.shellArgs] }),
            cwd: spec.cwd,
            env: { ...spec.env },
            iconPath: new vscode.ThemeIcon(spec.icon),
            location:
              spec.location === 'editor'
                ? { viewColumn: vscode.ViewColumn.Active }
                : vscode.TerminalLocation.Panel,
            isTransient: false,
            hideFromUser: false,
          })
          const id = nextId++
          byId.set(id, terminal)
          idOf.set(terminal, id)
          terminal.show()
          if (spec.sendText !== null) terminal.sendText(spec.sendText)
          return id
        }),
      existing: Effect.sync(() =>
        vscode.window.terminals
          .filter((terminal) => !idOf.has(terminal))
          .map((terminal) => {
            // Known from now on, so focus and the close listener reach it like any other.
            const id = nextId++
            byId.set(id, terminal)
            idOf.set(terminal, id)
            return { id, name: terminal.name }
          }),
      ),
      focus: (id) =>
        Effect.sync(() => {
          byId.get(id)?.show()
        }),
      onClosed: (listener) => {
        listeners.push(listener)
      },
    }
  })

/**
 * Watches the events file's directory with Node's own watcher: the file lives under the
 * extension's global storage, outside the workspace, where VS Code's watchers do not reach
 * reliably. Watching the directory survives the file being replaced by a compaction.
 */
export const eventsWatcherLive = (context: vscode.ExtensionContext): Layer.Layer<EventsWatcher> =>
  Layer.succeed(EventsWatcher, {
    watch: (file, onChange) =>
      Effect.sync(() => {
        const name = path.basename(file)
        try {
          const watcher = watch(path.dirname(file), { persistent: false }, (_event, changed) => {
            if (changed === null || changed === name) onChange()
          })
          // A watcher that errors (the directory removed) stops; the slow poll still reads.
          watcher.on('error', () => watcher.close())
          context.subscriptions.push({ dispose: () => watcher.close() })
        } catch {
          // No watcher where the platform refuses one: the slow poll reads while a session runs.
        }
      }),
  })

/** Run skill…: VS Code's own QuickPick, matching on the description and detail too. */
export const paletteLive: Layer.Layer<Palette> = Layer.succeed(Palette, {
  pickSkill: (title, choices) =>
    Effect.promise(async () => {
      const picked = await vscode.window.showQuickPick(
        choices.map((choice) => ({ ...choice })),
        { title, matchOnDescription: true, matchOnDetail: true },
      )
      return picked?.label ?? null
    }),
  inform: (message) =>
    Effect.promise(async () => void (await vscode.window.showInformationMessage(message))),
})

/**
 * Claude Code's sessions directory, watched as a trigger only: a change means the registry may
 * have changed, and `claude agents --json` is what reads it. `CLAUDE_CONFIG_DIR` moves the
 * directory the way it moves the rest of Claude Code's state.
 */
export const registryWatcherLive: Layer.Layer<RegistryWatcher> = Layer.succeed(RegistryWatcher, {
  watch: (onChange) =>
    Effect.sync(() => {
      const configured = process.env.CLAUDE_CONFIG_DIR
      const directory = path.join(
        configured !== undefined && configured !== ''
          ? configured
          : path.join(os.homedir(), '.claude'),
        'sessions',
      )
      if (!existsSync(directory)) return null
      try {
        const watcher = watch(directory, { persistent: false }, () => onChange())
        watcher.on('error', () => watcher.close())
        return Effect.sync(() => watcher.close())
      } catch {
        return null
      }
    }),
})

const configuration = () => vscode.workspace.getConfiguration('heroSynergy')

/** Where things are: the settings, `PATH`, the extension's plugin and one events file per repo. */
export const hostEnvironmentLive = (
  context: vscode.ExtensionContext,
): Layer.Layer<HostEnvironment> =>
  Layer.succeed(HostEnvironment, {
    platform: process.platform,
    appName: vscode.env.appName,
    appHost: vscode.env.appHost,
    vscodeVersion: vscode.version,
    home: os.homedir(),
    pathVariable: process.env.PATH ?? process.env.Path ?? '',
    claudeSetting: Effect.sync(() => configuration().get<string>('claude.path', '')),
    terminalLocation: Effect.sync(() =>
      configuration().get<string>('sessions.terminalLocation', 'panel') === 'editor'
        ? 'editor'
        : 'panel',
    ),
    pluginPath: vscode.Uri.joinPath(context.extensionUri, 'claude-plugin').fsPath,
    eventsFile: (repoRoot) =>
      vscode.Uri.joinPath(
        context.globalStorageUri,
        'events',
        `${createHash('sha1').update(repoRoot).digest('hex').slice(0, 16)}.jsonl`,
      ).fsPath,
  })
