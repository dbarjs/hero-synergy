import { FileSystem, ProcessRunner } from '@hero-synergy/core'
import { Effect, Layer } from 'effect'
import type { ExtensionContext, WebviewPanel } from 'vscode'

import { makeCockpit } from './cockpit.ts'
import type { DetailView, ViewModel } from './protocol.ts'
import { registerDetailPanel } from './vscode/detail-panel.ts'
import {
  createLog,
  registerActionCommands,
  registerRefreshCommand,
  registerRefreshTriggers,
  registerTreeView,
} from './vscode/tree-view.ts'
import {
  clipboardLive,
  collectProgressLive,
  eventsWatcherLive,
  hostEnvironmentLive,
  openerLive,
  paletteLive,
  registryWatcherLive,
  storageLive,
  terminalsLive,
  workspaceFoldersLive,
} from './vscode/workspace.ts'

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
    /** Whether the Detail panel is open. */
    readonly detailOpen: boolean
    /** The last view sent to the Detail panel (sent even while no panel is open). */
    readonly detailView: DetailView | null
    /** The Tree container's badge: how many sessions need me; 0 shows none. */
    readonly badge: number
  }
  /** Every line written to the output channel so far, in order. */
  readonly log: () => ReadonlyArray<string>
  /** Delivers a message as if the webview had posted it; false when it was rejected. */
  readonly receive: (message: unknown) => Promise<boolean>
  /** Adopts a panel as VS Code's serializer does after a reload. */
  readonly restoreDetail: (panel: WebviewPanel) => Promise<void>
}

/**
 * Activation spawns nothing, and renders the last good snapshot from storage once
 * the view exists. The Tree's first collect runs when VS Code shows the view, the
 * window gains focus, a `.scratch` file changes, or the Refresh command or button
 * is used; the refresh policy decides which of them collect.
 */
export async function activate(context: ExtensionContext): Promise<ExtensionApi> {
  let spawnedProcesses = 0
  let viewModel: ViewModel | null = null
  let detailView: DetailView | null = null
  let badge = 0

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

  const lines: string[] = []
  const write = createLog(context)
  const log = (line: string): void => {
    lines.push(line)
    write(line)
  }
  const cockpit = await Effect.runPromise(
    makeCockpit({
      publish: (next) => {
        viewModel = next
        // `tree` is registered below, before anything can ask the cockpit to publish.
        tree.post(next)
      },
      publishDetail: (next) => {
        detailView = next
        detail.post(next)
      },
      showDetail: (focus) => detail.show(focus),
      badge: (count) => {
        badge = count
        tree.setBadge(count)
      },
      log,
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          workspaceFoldersLive,
          collectProgressLive,
          openerLive,
          clipboardLive,
          paletteLive,
          terminalsLive(context),
          eventsWatcherLive(context),
          registryWatcherLive,
          hostEnvironmentLive(context),
          storageLive(context.workspaceState, context.globalState),
          FileSystem.live,
          countedRunner,
        ),
      ),
    ),
  )

  // Logs the environment, resolves `claude` on the setting or `PATH` and logs where it is; spawns nothing.
  await Effect.runPromise(cockpit.activated)

  const run = (effect: Effect.Effect<unknown>): void => void Effect.runPromise(effect)
  // The Cockpit is on screen while the Tree or the Detail is; the registry is read only then.
  const onScreen = { tree: false, detail: false }
  const setOnScreen = (surface: keyof typeof onScreen, visible: boolean): void => {
    onScreen[surface] = visible
    run(cockpit.visible(onScreen.tree || onScreen.detail))
  }
  const tree = registerTreeView(context, {
    onShown: () => run(cockpit.show),
    onVisibility: (visible) => setOnScreen('tree', visible),
    onMessage: (message) => run(cockpit.receive(message)),
  })
  // `detail` is read by the cockpit's callbacks above, which only run after this line.
  const detail = registerDetailPanel(context, {
    // A restored panel may be the only surface shown, so collect for it; the page also asks on mount.
    onShown: () => run(cockpit.show),
    onVisibility: (visible) => setOnScreen('detail', visible),
    onMessage: (message) => run(cockpit.receive(message)),
    onCommand: () => run(cockpit.openDetail),
  })
  registerRefreshCommand(context, () => run(cockpit.refresh))
  registerActionCommands(context, {
    chartMap: () => run(cockpit.chartMap),
    runSkill: () => run(cockpit.runSkill),
  })
  registerRefreshTriggers(context, {
    onFocus: () => run(cockpit.focus),
    onScratchChange: () => run(cockpit.scratchChanged),
  })
  // The floor check is one `claude --version`; it runs beside activation so a slow `claude` never holds it up.
  run(cockpit.checkClaude)

  return {
    state: () => ({
      viewResolved: tree.resolved(),
      spawnedProcesses,
      viewModel,
      detailOpen: detail.isOpen(),
      detailView,
      badge,
    }),
    log: () => lines,
    receive: (message) => Effect.runPromise(cockpit.receive(message)),
    restoreDetail: (panel) => {
      detail.adopt(panel)
      return Promise.resolve()
    },
  }
}

export function deactivate(): void {}
