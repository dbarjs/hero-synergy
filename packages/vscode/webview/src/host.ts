import type { WebviewMessage } from '../../src/protocol.ts'

interface VsCodeApi {
  postMessage: (message: WebviewMessage) => void
}

/** Provided by the webview host; there is one per page, and it may be acquired only once. */
declare function acquireVsCodeApi(): VsCodeApi

let api: VsCodeApi | undefined

/** Sends a message to the extension host. */
export const post = (message: WebviewMessage): void => {
  api ??= acquireVsCodeApi()
  api.postMessage(message)
}
