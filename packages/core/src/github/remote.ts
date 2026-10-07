import { Effect } from 'effect'

import { ProcessRunner, type ProcessNotRecorded } from '../process-runner.ts'
import { collectGitHubMaps, type GitHubCollect } from './collect.ts'
import type { GitHubRepo } from './query.ts'
import { GitHubCollectFailed } from './response.ts'

/**
 * Reads `owner/name` and the host from a remote URL: `https://host/owner/name(.git)`,
 * `ssh://git@host/owner/name.git` and the scp form `git@host:owner/name.git`.
 * `host` is left out for github.com, the one host the Cockpit supports; any
 * other host is returned so the request can try it and show its error.
 */
export function parseRemote(url: string): GitHubRepo | null {
  const text = url.trim()
  const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/.exec(text)
  let host: string
  let path: string
  if (scp?.[1] !== undefined && scp[2] !== undefined) {
    host = scp[1]
    path = scp[2]
  } else {
    try {
      const parsed = new URL(text)
      host = parsed.hostname
      path = parsed.pathname
    } catch {
      return null
    }
  }
  const segments = path
    .replace(/\.git\/?$/, '')
    .split('/')
    .filter((segment) => segment !== '')
  const [owner, repo, ...rest] = segments
  if (owner === undefined || repo === undefined || rest.length > 0 || host === '') return null
  const lowered = host.toLowerCase()
  return lowered === 'github.com' || lowered === 'www.github.com'
    ? { owner, repo }
    : { host: lowered, owner, repo }
}

/** The repo `origin` points at, read with read-only `git` in the repo root. */
export const findGitHubRepo = (
  repoRoot: string,
): Effect.Effect<GitHubRepo, GitHubCollectFailed | ProcessNotRecorded, ProcessRunner> =>
  Effect.gen(function* () {
    const runner = yield* ProcessRunner
    const result = yield* runner
      .run({ command: 'git', args: ['remote', 'get-url', 'origin'], cwd: repoRoot })
      .pipe(
        Effect.mapError((error) =>
          error._tag === 'ProcessNotRecorded'
            ? error
            : new GitHubCollectFailed({ reason: 'no-remote', message: error.message }),
        ),
      )
    if (result.exitCode !== 0) {
      return yield* Effect.fail(
        new GitHubCollectFailed({
          reason: 'no-remote',
          message: result.stderr.trim() || 'the repo has no `origin` remote',
        }),
      )
    }
    const repo = parseRemote(result.stdout)
    if (repo === null) {
      return yield* Effect.fail(
        new GitHubCollectFailed({
          reason: 'no-remote',
          message: `the \`origin\` remote is not an owner/name repo: ${result.stdout.trim()}`,
        }),
      )
    }
    return repo
  })

/** Collects the open maps of the GitHub repo the repo root's `origin` names. */
export const collectGitHub = (
  repoRoot: string,
): Effect.Effect<GitHubCollect, GitHubCollectFailed | ProcessNotRecorded, ProcessRunner> =>
  Effect.flatMap(findGitHubRepo(repoRoot), (target) => collectGitHubMaps(target, repoRoot))
