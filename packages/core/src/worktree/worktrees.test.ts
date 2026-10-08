import { Effect } from 'effect'
import { describe, expect, test } from 'vite-plus/test'

import listing from '../../fixtures/process/git-worktree-list-porcelain.json' with { type: 'json' }
import log12 from '../../fixtures/process/git-log-main-worktree-12.json' with { type: 'json' }
import log13 from '../../fixtures/process/git-log-main-worktree-13.json' with { type: 'json' }
import log14 from '../../fixtures/process/git-log-main-worktree-14.json' with { type: 'json' }
import status12 from '../../fixtures/process/git-status-worktree-12.json' with { type: 'json' }
import status13 from '../../fixtures/process/git-status-worktree-13.json' with { type: 'json' }
import status14 from '../../fixtures/process/git-status-worktree-14.json' with { type: 'json' }
import { type ProcessRecording, type ProcessRequest, ProcessRunner } from '../process-runner.ts'
import { parseWorktreeList, readWorktrees, ticketOfBranch } from './worktrees.ts'

const recordings: ReadonlyArray<ProcessRecording> = [
  listing,
  status12,
  status13,
  status14,
  log12,
  log13,
  log14,
]

/** Reads through the replay layer and writes down every request it is given. */
const read = (wanted: ReadonlyArray<number>, served = recordings) => {
  const requests: ProcessRequest[] = []
  const states = Effect.gen(function* () {
    const replay = yield* ProcessRunner
    return yield* readWorktrees(
      {
        run: (request) => {
          requests.push(request)
          return replay.run(request)
        },
      },
      '/work/hero-synergy',
      wanted,
    )
  }).pipe(Effect.provide(ProcessRunner.replay(served)), Effect.runPromise)
  return { requests, states }
}

describe('parseWorktreeList', () => {
  test('reads each block, a detached head having no branch', () => {
    expect(parseWorktreeList(listing.stdout).map(({ path, branch }) => [path, branch])).toEqual([
      ['/work/hero-synergy', 'main'],
      ['/work/hero-synergy/.claude/worktrees/12', 'worktree-12'],
      ['/work/hero-synergy/.claude/worktrees/13', 'worktree-13'],
      ['/work/hero-synergy/.claude/worktrees/14', 'worktree-14'],
      ['/work/scratch', null],
    ])
  })

  test('names the ticket only for a `worktree-<number>` branch', () => {
    expect(ticketOfBranch('worktree-61')).toBe(61)
    expect(ticketOfBranch('worktree-61-fix')).toBeNull()
    expect(ticketOfBranch('main')).toBeNull()
    expect(ticketOfBranch(null)).toBeNull()
  })
})

describe('readWorktrees over the replay runner', () => {
  test('yields clean, uncommitted and ahead-of-main states', async () => {
    const states = await read([12, 13, 14]).states
    expect(states.get(12)).toMatchObject({ uncommitted: 0, ahead: 0 })
    expect(states.get(13)).toMatchObject({ uncommitted: 2, ahead: 0 })
    expect(states.get(14)).toMatchObject({ uncommitted: 0, ahead: 2 })
    expect(states.get(14)?.path).toBe('/work/hero-synergy/.claude/worktrees/14')
  })

  test('leaves out a ticket with no worktree and reads only the tickets asked for', async () => {
    const { states, requests } = read([13, 99])
    expect([...(await states).keys()]).toEqual([13])
    expect(requests.map((request) => request.args.join(' '))).toEqual([
      'worktree list --porcelain',
      '-C /work/hero-synergy/.claude/worktrees/13 --no-optional-locks status --porcelain',
      '-C /work/hero-synergy/.claude/worktrees/13 log --format=%H main..worktree-13',
    ])
  })

  test('issues no git command that writes', async () => {
    const { requests, states } = read([12, 13, 14])
    await states
    const verbs = requests.map((request) => {
      const args = request.args.filter((arg, i, all) => arg !== '-C' && all[i - 1] !== '-C')
      return args.find((arg) => !arg.startsWith('--no-'))
    })
    expect(new Set(verbs)).toEqual(new Set(['worktree', 'status', 'log']))
    expect(requests.every((request) => request.command === 'git')).toBe(true)
    // `worktree list` is the only `worktree` subcommand ever asked for.
    const worktree = requests.filter((request) => request.args[0] === 'worktree')
    expect(worktree.map((request) => request.args.slice(1).join(' '))).toEqual(['list --porcelain'])
  })

  test('shows nothing when git cannot list, and an unknown ahead when the log fails', async () => {
    expect((await read([12], []).states).size).toBe(0)
    const noLog = await read([14], [listing, status14]).states
    expect(noLog.get(14)).toMatchObject({ uncommitted: 0, ahead: null })
  })
})
