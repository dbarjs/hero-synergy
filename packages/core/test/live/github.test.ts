import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vite-plus/test'

import { Effect } from 'effect'

import {
  decodeSnapshot,
  encodeSnapshot,
  readGitHubTracker,
  ProcessRunner,
} from '../../src/index.ts'

/**
 * The one test that talks to GitHub: the collect for real, against this repo's
 * own open maps, with whatever token `gh` finds (the workflow token in CI).
 * Every other test replays recordings. It runs in the `live` project, which
 * `vp test --project live` selects, and in no other run.
 */
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

describe("collecting this repo's own maps from GitHub", () => {
  it('finds the open maps with their tickets and reads them into a snapshot', async () => {
    const { snapshot, rateLimit } = await Effect.runPromise(
      readGitHubTracker(repoRoot).pipe(Effect.provide(ProcessRunner.live)),
    )

    expect(rateLimit.remaining).toBeGreaterThan(0)
    expect(Date.parse(rateLimit.resetAt)).not.toBeNaN()

    expect(snapshot.tracker).toEqual({ kind: 'github', owner: 'dbarjs', repo: 'hero-synergy' })
    expect(Date.parse(snapshot.collectedAt)).not.toBeNaN()
    // The snapshot is plain JSON that decodes back to itself.
    expect(decodeSnapshot(encodeSnapshot(snapshot))).toEqual(snapshot)

    // The effort is charted on this repo's tracker, so there is always a map to find.
    expect(snapshot.maps.length).toBeGreaterThan(0)
    for (const map of snapshot.maps) {
      expect(map.title).not.toBe('')
      expect(map.ref).toMatchObject({ tracker: 'github' })
      expect(map.ref.tracker === 'github' ? map.ref.url : '').toContain(
        `github.com/dbarjs/hero-synergy/issues/${map.number}`,
      )
      for (const ticket of map.tickets) expect(ticket.number).not.toBe(map.number)
    }
    // Tickets are collected only as sub-issues of an open map, so none is left outside one.
    expect(snapshot.unmapped).toEqual([])
  })
})
