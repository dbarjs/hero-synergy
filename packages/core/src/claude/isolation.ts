import { Effect } from 'effect'

import { FileSystem } from '../file-system.ts'

/**
 * Whether the window runs in an isolated environment: a Dev Containers or Codespaces window, or a
 * Docker or Podman container that is not toolbx or distrobox. It gates nothing but whether the
 * bypass flag is added. Isolated means "in a container", never "sandboxed": a repo's
 * `devcontainer.json` can mount the home directory or the Docker socket.
 *
 * The host reads the facts once at activation; {@link isolationOf} is the rule over them.
 * Environment variables never count: a shell profile reaches the extension host.
 */

/** The `vscode.env.remoteName` values a resolver sets only inside a container. */
export const isolatedRemoteNames = [
  'dev-container',
  'attached-container',
  'k8s-container',
  'apple-container',
  'codespaces',
] as const

export type IsolatedRemoteName = (typeof isolatedRemoteNames)[number]

/** The files a container engine writes into its containers, in the order they count. */
export const containerMarkers = ['/.dockerenv', '/run/.containerenv'] as const

export type ContainerMarker = (typeof containerMarkers)[number]

/** toolbx and distrobox write it: a container that shares the home, the SSH agent and D-Bus. */
export const TOOLBOX_MARKER = '/run/.toolboxenv'

/** What the host saw at activation. */
export interface IsolationFacts {
  /** `vscode.env.remoteName`; null in a local window. */
  readonly remoteName: string | null
  /** Which of the marker files exist. */
  readonly dockerenv: boolean
  readonly containerenv: boolean
  readonly toolboxenv: boolean
}

export type IsolationSignal =
  | { readonly kind: 'remote'; readonly remoteName: IsolatedRemoteName }
  | { readonly kind: 'marker'; readonly path: ContainerMarker }

export type Isolation =
  | { readonly isolated: true; readonly signal: IsolationSignal }
  | {
      readonly isolated: false
      readonly vetoedBy: typeof TOOLBOX_MARKER | null
      readonly remoteName: string | null
    }

const isIsolatedRemote = (name: string | null): name is IsolatedRemoteName =>
  name !== null && (isolatedRemoteNames as ReadonlyArray<string>).includes(name)

/**
 * The detection rule, first match wins: an allowlisted `remoteName`, then `/.dockerenv`, then
 * `/run/.containerenv`. `/run/.toolboxenv` vetoes the markers, never the remote name.
 */
export function isolationOf(facts: IsolationFacts): Isolation {
  if (isIsolatedRemote(facts.remoteName)) {
    return { isolated: true, signal: { kind: 'remote', remoteName: facts.remoteName } }
  }
  const marker = facts.dockerenv ? '/.dockerenv' : facts.containerenv ? '/run/.containerenv' : null
  if (marker !== null && !facts.toolboxenv) {
    return { isolated: true, signal: { kind: 'marker', path: marker } }
  }
  return {
    isolated: false,
    vetoedBy: marker !== null ? TOOLBOX_MARKER : null,
    remoteName: facts.remoteName,
  }
}

/** The facts, with the marker files checked through the file system; a check that fails reads as absent. */
export function collectIsolationFacts(
  remoteName: string | null,
): Effect.Effect<IsolationFacts, never, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem
    const exists = (path: string) => fs.exists(path).pipe(Effect.catch(() => Effect.succeed(false)))
    return {
      remoteName,
      dockerenv: yield* exists('/.dockerenv'),
      containerenv: yield* exists('/run/.containerenv'),
      toolboxenv: yield* exists(TOOLBOX_MARKER),
    }
  })
}
