import { Effect } from 'effect'

import type { ProcessNotRecorded, ProcessRunner } from '../process-runner.ts'
import type { Snapshot } from '../snapshot/model.ts'
import { readSnapshot } from '../snapshot/read.ts'
import type { RateLimit } from './collect.ts'
import { collectGitHub } from './remote.ts'
import type { GitHubCollectFailed } from './response.ts'

/**
 * Reads the open maps of the GitHub repo the repo root's `origin` names into a
 * snapshot: the collect, then the readers, the same ones a local tracker goes
 * through, so the Tree draws both alike. The rate-limit figures of the last
 * request come with it, for the refresh policy's budget.
 */
export const readGitHubTracker = (
  repoRoot: string,
): Effect.Effect<
  { readonly snapshot: Snapshot; readonly rateLimit: RateLimit },
  GitHubCollectFailed | ProcessNotRecorded,
  ProcessRunner
> =>
  Effect.map(collectGitHub(repoRoot), ({ collected, rateLimit }) => ({
    snapshot: readSnapshot(collected),
    rateLimit,
  }))
