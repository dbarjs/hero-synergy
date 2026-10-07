import { describe, expect, it } from '@effect/vitest'

import { GitHubCollectFailed } from './response.ts'
import { collectGitHubPromise } from './run.ts'

describe('collecting through a Promise', () => {
  it('rejects with the coded failure when the repo root has no origin', async () => {
    const error = await collectGitHubPromise('/').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(GitHubCollectFailed)
    expect((error as GitHubCollectFailed).reason).toBe('no-remote')
  })
})
