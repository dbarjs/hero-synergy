import { Effect } from 'effect'

import type { ProcessNotRecorded, ProcessRunner } from '../process-runner.ts'
import type { Snapshot } from '../snapshot/model.ts'
import { readSnapshot } from '../snapshot/read.ts'
import { collectGitHub } from './remote.ts'
import type { GitHubCollectFailed } from './response.ts'

/**
 * Reads the open maps of the GitHub repo the repo root's `origin` names into a
 * snapshot: the collect, then the readers, the same ones a local tracker goes
 * through, so the Tree draws both alike.
 */
export const readGitHubTracker = (
  repoRoot: string,
): Effect.Effect<Snapshot, GitHubCollectFailed | ProcessNotRecorded, ProcessRunner> =>
  Effect.map(collectGitHub(repoRoot), ({ collected }) => readSnapshot(collected))
