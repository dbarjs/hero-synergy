import { FileSystem, ProcessRunner } from '@hero-synergy/core'
import { Effect, Layer } from 'effect'
import type { ExtensionContext } from 'vscode'

import { makeCockpit } from './cockpit.ts'
import type { ViewModel } from './protocol.ts'
import { createLog, registerRefreshCommand, registerTreeView } from './vscode/tree-view.ts'
import { openerLive, storageLive, workspaceFoldersLive } from './vscode/workspace.ts'

/**
 * What the extension host tier looks at: what the extension has done so far. The
 * webview itself is out of the host's reach, so this is the seam where a test
 * sees the view resolve, the view model go out and a message get validated.
 */
export interface ExtensionApi {
  readonly state: () => {
    readonly viewResolved: boolean
    /** Processes the extension has started: `git` for the scout, later `gh` and `claude`. */
    readonly spawnedProcesses: number
    /** The last view model sent to the webview. */
    readonly viewModel: ViewModel | null
  }
  /** Delivers a message as if the webview had posted it; false when it was rejected. */
  readonly receive: (message: unknown) => Promise<boolean>
}

/**
 * Activation renders nothing and spawns nothing. The Tree's first collect runs
 * when VS Code shows the view, the Refresh command or button, or the webview
 * asking for the model it missed.
 */
export async function activate(context: ExtensionContext): Promise<ExtensionApi> {
  let spawnedProcesses = 0
  let viewModel: ViewModel | null = null

  const countedRunner = Layer.effect(
    ProcessRunner,
    Effect.gen(function* () {
      const live = yield* ProcessRunner
      return {
        run: (request: Parameters<typeof live.run>[0]) => {
          spawnedProcesses += 1
          return live.run(request)
        },
      }
    }),
  ).pipe(Layer.provide(ProcessRunner.live))

  const log = createLog(context)
  const cockpit = await Effect.runPromise(
    makeCockpit({
      publish: (next) => {
        viewModel = next
        // `tree` is registered below, before anything can ask the cockpit to publish.
        tree.post(next)
      },
      log,
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          workspaceFoldersLive,
          openerLive,
          storageLive(context.workspaceState),
          FileSystem.live,
          countedRunner,
        ),
      ),
    ),
  )

  const run = (effect: Effect.Effect<unknown>): void => void Effect.runPromise(effect)
  const tree = registerTreeView(context, {
    onShown: () => run(cockpit.show),
    onMessage: (message) => run(cockpit.receive(message)),
  })
  registerRefreshCommand(context, () => run(cockpit.refresh))

  return {
    state: () => ({ viewResolved: tree.resolved(), spawnedProcesses, viewModel }),
    receive: (message) => Effect.runPromise(cockpit.receive(message)),
  }
}

export function deactivate(): void {}
