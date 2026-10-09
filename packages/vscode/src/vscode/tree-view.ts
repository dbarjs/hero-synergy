import * as vscode from 'vscode'

import type { HostMessage, ViewModel } from '../protocol.ts'
import { makeNonce, webviewHtml } from '../webview-html.ts'

/** The id the manifest contributes the Tree under. */
export const TREE_VIEW_ID = 'heroSynergy.tree'
export const REFRESH_COMMAND = 'heroSynergy.refresh'

export interface TreeViewHandlers {
  /** The view was shown: on resolve, and each time it becomes visible again. */
  readonly onShown: () => void
  /** The view is on screen or not, each time that changes. */
  readonly onVisibility: (visible: boolean) => void
  /** A message from the webview, unvalidated. */
  readonly onMessage: (message: unknown) => void
}

export interface TreeView {
  /** Sends a view model to the webview, if it exists. */
  readonly post: (viewModel: ViewModel) => void
  /** Whether VS Code has asked for the view yet. */
  readonly resolved: () => boolean
  /** The badge on the Hero Synergy container: the sessions that need me, none at 0. */
  readonly setBadge: (count: number) => void
}

/**
 * Registers the Tree: a webview view that VS Code resolves the first time the
 * user shows it. Until then nothing is rendered and no handler runs. The page
 * keeps its context while hidden, so the Tree comes back as it was left.
 */
export function registerTreeView(
  context: vscode.ExtensionContext,
  handlers: TreeViewHandlers,
): TreeView {
  let current: vscode.WebviewView | null = null
  // The badge belongs to the view, which exists only once VS Code resolves it: keep the last count to give it then.
  let badge = 0
  const showBadge = (view: vscode.WebviewView): void => {
    view.badge =
      badge === 0
        ? undefined
        : {
            value: badge,
            tooltip: `${badge} ${badge === 1 ? 'session needs' : 'sessions need'} you`,
          }
  }
  const bundle = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')

  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView(view) {
      current = view
      showBadge(view)
      view.webview.options = { enableScripts: true, localResourceRoots: [bundle] }
      view.webview.html = webviewHtml({
        cspSource: view.webview.cspSource,
        scriptUri: view.webview.asWebviewUri(vscode.Uri.joinPath(bundle, 'main.js')).toString(),
        styleUri: view.webview.asWebviewUri(vscode.Uri.joinPath(bundle, 'main.css')).toString(),
        nonce: makeNonce(),
        surface: 'tree',
      })
      const disposables = [
        view.webview.onDidReceiveMessage(handlers.onMessage),
        view.onDidChangeVisibility(() => {
          handlers.onVisibility(view.visible)
          if (view.visible) handlers.onShown()
        }),
        view.onDidDispose(() => {
          if (current === view) {
            current = null
            handlers.onVisibility(false)
          }
          disposables.forEach((disposable) => disposable.dispose())
        }),
      ]
      handlers.onVisibility(view.visible)
      handlers.onShown()
    },
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TREE_VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  return {
    post: (viewModel) => {
      const message: HostMessage = { type: 'view-model', viewModel }
      void current?.webview.postMessage(message)
    },
    resolved: () => current !== null,
    setBadge: (count) => {
      badge = count
      if (current !== null) showBadge(current)
    },
  }
}

/** `Hero Synergy: Refresh`, also the Tree's title-bar button. */
export function registerRefreshCommand(context: vscode.ExtensionContext, run: () => void): void {
  context.subscriptions.push(vscode.commands.registerCommand(REFRESH_COMMAND, run))
}

export const CHART_MAP_COMMAND = 'heroSynergy.chartMap'
export const RUN_SKILL_COMMAND = 'heroSynergy.runSkill'

export interface ActionCommands {
  readonly chartMap: () => void
  readonly runSkill: () => void
}

/**
 * `Hero Synergy: Chart a map` and `Hero Synergy: Run skill…`, also the Tree's title-bar buttons.
 * Neither is disabled when its skill is missing (a disabled command would vanish from the
 * palette): pressed, it says why it did nothing.
 */
export function registerActionCommands(
  context: vscode.ExtensionContext,
  commands: ActionCommands,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(CHART_MAP_COMMAND, commands.chartMap),
    vscode.commands.registerCommand(RUN_SKILL_COMMAND, commands.runSkill),
  )
}

/** The output channel the Cockpit logs to. */
export function createLog(context: vscode.ExtensionContext): (line: string) => void {
  const channel = vscode.window.createOutputChannel('Hero Synergy')
  context.subscriptions.push(channel)
  return (line) => channel.appendLine(line)
}

export interface RefreshTriggers {
  /** The window gained focus. */
  readonly onFocus: () => void
  /** A file under `.scratch` was created, changed or deleted. */
  readonly onScratchChange: () => void
}

/** The automatic causes besides the view becoming visible: window focus and `.scratch` changes. Never a timer. */
export function registerRefreshTriggers(
  context: vscode.ExtensionContext,
  triggers: RefreshTriggers,
): void {
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) triggers.onFocus()
    }),
  )
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, '.scratch/**'),
    )
    context.subscriptions.push(
      watcher,
      watcher.onDidCreate(triggers.onScratchChange),
      watcher.onDidChange(triggers.onScratchChange),
      watcher.onDidDelete(triggers.onScratchChange),
    )
  }
}

/** The settings whose change re-plans every Action and the Health row. */
export const BYPASS_SETTINGS = [
  'heroSynergy.sessions.bypassPermissions',
  'heroSynergy.sessions.bypassPermissionsOnlyWhenIsolated',
] as const

/** Calls back when either bypass setting changes, so the planned commands never lag behind. */
export function registerSettingsTrigger(
  context: vscode.ExtensionContext,
  onBypassChange: () => void,
): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (BYPASS_SETTINGS.some((setting) => event.affectsConfiguration(setting))) onBypassChange()
    }),
  )
}
