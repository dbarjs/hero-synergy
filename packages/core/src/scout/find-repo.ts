import { Effect } from 'effect'

import { FileSystem, type FileSystemError } from '../file-system.ts'
import { type ProcessError, ProcessRunner, type ProcessRunnerShape } from '../process-runner.ts'
import type { Tracker } from '../snapshot/model.ts'
import { NoRemote, NoRepoFound, NoTrackerDoc, UnsupportedTracker } from './errors.ts'
import { locateTrackerDoc, type TrackerDoc } from './tracker-doc.ts'

/** The one repo a window shows, and the tracker its doc names. */
export interface RepoTracker {
  /** The repo root, as `git rev-parse --show-toplevel` prints it. */
  readonly repoRoot: string
  readonly tracker: Tracker
  /** The tracker doc's path, relative to the root. */
  readonly trackerDoc: string
}

/**
 * The scout's entry for a window. Given the workspace folders in order, it
 * finds the one repo the Cockpit shows: the first folder whose repo root has a
 * tracker doc; else the first folder inside a git repo, which gets the setup
 * message ({@link NoTrackerDoc}); else {@link NoRepoFound}. A folder inside a
 * repo resolves its root through git, so the tracker is read at the root and
 * sessions start there. A folder holding several repos is no repo.
 *
 * The doc decides the tracker by its heading. Anything but GitHub and Local
 * Markdown is {@link UnsupportedTracker}. A GitHub doc takes `owner/name` from
 * the git remote, whatever its host: a remote off github.com is tried and the
 * collect shows its error, and only a repo with no usable remote is
 * {@link NoRemote}.
 */
export function findRepo(
  folders: ReadonlyArray<string>,
): Effect.Effect<
  RepoTracker,
  NoRepoFound | NoTrackerDoc | UnsupportedTracker | NoRemote | FileSystemError | ProcessError,
  FileSystem | ProcessRunner
> {
  return Effect.gen(function* () {
    const runner = yield* ProcessRunner
    let firstRoot: string | null = null
    for (const folder of folders) {
      const repoRoot = yield* repoRootOf(runner, folder)
      if (repoRoot === null) continue
      firstRoot ??= repoRoot
      const doc = yield* locateTrackerDoc(repoRoot)
      if (doc !== null) return yield* trackerOf(runner, repoRoot, doc)
    }
    if (firstRoot === null) return yield* new NoRepoFound({ folders })
    return yield* new NoTrackerDoc({ repoRoot: firstRoot })
  })
}

/** The root of the repo the folder is in, or null when it is in none. */
const repoRootOf = (
  runner: ProcessRunnerShape,
  folder: string,
): Effect.Effect<string | null, ProcessError> =>
  runner
    .run({ command: 'git', args: ['-C', folder, 'rev-parse', '--show-toplevel'] })
    .pipe(
      Effect.map((result) =>
        result.exitCode === 0 && result.stdout.trim() !== '' ? result.stdout.trim() : null,
      ),
    )

const trackerOf = (
  runner: ProcessRunnerShape,
  repoRoot: string,
  doc: TrackerDoc,
): Effect.Effect<RepoTracker, UnsupportedTracker | NoRemote | ProcessError> =>
  Effect.gen(function* () {
    switch (doc.kind) {
      case 'local':
        return { repoRoot, tracker: { kind: 'local' }, trackerDoc: doc.path }
      case 'github': {
        const remote = yield* remoteOf(runner, repoRoot)
        const named = remote === null ? null : ownerAndRepo(remote)
        if (named === null) return yield* new NoRemote({ repoRoot, remote })
        return { repoRoot, tracker: { kind: 'github', ...named }, trackerDoc: doc.path }
      }
      case 'unsupported':
        return yield* new UnsupportedTracker({ repoRoot, trackerDoc: doc.path, name: doc.name })
    }
  })

/** The remotes `gh` prefers, in order; the first listed remote otherwise. */
const PREFERRED_REMOTES = ['upstream', 'github', 'origin']

/** The fetch URL of the remote `gh` would pick, or null when the repo has none. */
const remoteOf = (
  runner: ProcessRunnerShape,
  repoRoot: string,
): Effect.Effect<string | null, ProcessError> =>
  runner.run({ command: 'git', args: ['-C', repoRoot, 'remote', '-v'] }).pipe(
    Effect.map((result) => {
      if (result.exitCode !== 0) return null
      const fetch = new Map<string, string>()
      for (const line of result.stdout.split(/\r?\n/)) {
        const match = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line.trim())
        if (match?.[1] !== undefined && match[2] !== undefined && !fetch.has(match[1]))
          fetch.set(match[1], match[2])
      }
      for (const name of PREFERRED_REMOTES) {
        const url = fetch.get(name)
        if (url !== undefined) return url
      }
      return fetch.values().next().value ?? null
    }),
  )

/**
 * The owner and repository a remote URL names, on any host:
 * `https://github.com/owner/repo.git`, `git@github.com:owner/repo.git`,
 * `ssh://git@github.com/owner/repo`. Null when the URL has no such path.
 */
export function ownerAndRepo(url: string): { owner: string; repo: string } | null {
  const path =
    /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?[^/]+\/(.+)$/i.exec(url)?.[1] ??
    /^(?:[^@/]+@)?[^:/]+:(.+)$/.exec(url)?.[1] ??
    null
  if (path === null) return null
  const segments = path
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .split('/')
    .filter((segment) => segment !== '')
  const repo = segments.at(-1)
  const owner = segments.at(-2)
  if (repo === undefined || owner === undefined) return null
  return { owner, repo }
}
