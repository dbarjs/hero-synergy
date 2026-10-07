import * as vscode from 'vscode'

import type { DetailView, HostMessage } from '../protocol.ts'
import { makeNonce, webviewHtml } from '../webview-html.ts'

/** The panel's view type, which the serializer and the manifest's activation event name. */
export const DETAIL_VIEW_TYPE = 'heroSynergy.detail'
export const OPEN_DETAIL_COMMAND = 'heroSynergy.openDetail'

export interface DetailHandlers {
  /** The panel appeared: new, or restored after a reload. */
  readonly onShown: () => void
  /** A message from the webview, unvalidated. */
  readonly onMessage: (message: unknown) => void
  /** The command: open the Detail on the selection. */
  readonly onCommand: () => void
}

export interface DetailPanel {
  /** Opens the one panel, or brings it forward. */
  readonly show: (focus: boolean) => void
  /** Sends the view to the panel and titles the tab after it, if the panel is open. */
  readonly post: (view: DetailView) => void
  /** Adopts a panel VS Code restored after a reload; the same path the serializer takes. */
  readonly adopt: (panel: vscode.WebviewPanel) => void
  /** Whether a panel is open. */
  readonly isOpen: () => boolean
}

const titleOf = (view: DetailView): string =>
  view.detail === null ? 'Hero Synergy' : `#${view.detail.number} ${view.detail.title}`

/**
 * The Detail: one webview panel, reused and following the selection. Webview panels
 * open pinned, and `retainContextWhenHidden` keeps the page as it was left. A serializer
 * brings it back after a reload; its content comes from the host's stored selection.
 */
export function registerDetailPanel(
  context: vscode.ExtensionContext,
  handlers: DetailHandlers,
): DetailPanel {
  let current: vscode.WebviewPanel | null = null
  let lastTitle = 'Hero Synergy'
  const bundle = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')

  const adopt = (panel: vscode.WebviewPanel): void => {
    current = panel
    panel.webview.options = { enableScripts: true, localResourceRoots: [bundle] }
    panel.webview.html = webviewHtml({
      cspSource: panel.webview.cspSource,
      scriptUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(bundle, 'main.js')).toString(),
      styleUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(bundle, 'main.css')).toString(),
      nonce: makeNonce(),
      surface: 'detail',
    })
    const disposables = [
      panel.webview.onDidReceiveMessage(handlers.onMessage),
      panel.onDidDispose(() => {
        if (current === panel) current = null
        disposables.forEach((disposable) => disposable.dispose())
      }),
    ]
    handlers.onShown()
  }

  const create = (): vscode.WebviewPanel =>
    vscode.window.createWebviewPanel(
      DETAIL_VIEW_TYPE,
      lastTitle,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [bundle] },
    )

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_DETAIL_COMMAND, handlers.onCommand),
    vscode.window.registerWebviewPanelSerializer(DETAIL_VIEW_TYPE, {
      deserializeWebviewPanel: (panel) => {
        adopt(panel)
        return Promise.resolve()
      },
    }),
  )

  return {
    show: (focus) => {
      if (current !== null) current.reveal(undefined, !focus)
      else adopt(create())
    },
    post: (view) => {
      if (current === null) return
      lastTitle = titleOf(view)
      current.title = lastTitle
      const message: HostMessage = { type: 'detail', view }
      void current.webview.postMessage(message)
    },
    adopt,
    isOpen: () => current !== null,
  }
}
