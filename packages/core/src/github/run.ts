import { Effect } from 'effect'

import { ProcessRunner } from '../process-runner.ts'
import type { GitHubCollect } from './collect.ts'
import { collectGitHub } from './remote.ts'

/**
 * Collects the open maps of the repo root's GitHub `origin` with real
 * processes and settles as a Promise, for a caller that does not run Effect
 * programs itself. A failure rejects with the `GitHubCollectFailed`.
 */
export const collectGitHubPromise = (repoRoot: string): Promise<GitHubCollect> =>
  Effect.runPromise(collectGitHub(repoRoot).pipe(Effect.provide(ProcessRunner.live)))
