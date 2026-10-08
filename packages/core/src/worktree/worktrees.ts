import { Effect } from 'effect'

import type { ProcessRunnerShape } from '../process-runner.ts'

/**
 * A ticket's worktree, read through three read-only git commands: `git worktree list --porcelain`,
 * `git status --porcelain` and `git log main..<branch>`. Claude Code creates the worktree
 * (`.claude/worktrees/<number>` on branch `worktree-<number>`); nothing here ever creates,
 * merges or removes one, and no git command that writes is issued.
 */
export interface WorktreeState {
  /** Where the worktree is checked out. */
  readonly path: string
  readonly branch: string
  /** How many files have uncommitted changes, untracked ones included. */
  readonly uncommitted: number
  /** How many commits the branch has that `main` lacks; null when git could not say. */
  readonly ahead: number | null
}

/** One entry of `git worktree list --porcelain`: a checked-out path and its branch, null when detached. */
export interface ListedWorktree {
  readonly path: string
  readonly branch: string | null
}

const BRANCH_PREFIX = 'refs/heads/'

/** Reads `git worktree list --porcelain`: blocks of `worktree <path>`, `HEAD <sha>`, `branch <ref>`. */
export function parseWorktreeList(stdout: string): ReadonlyArray<ListedWorktree> {
  const listed: ListedWorktree[] = []
  for (const block of stdout.split(/\r?\n\r?\n/)) {
    let path: string | null = null
    let branch: string | null = null
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) path = line.slice('worktree '.length)
      else if (line.startsWith('branch ')) {
        const ref = line.slice('branch '.length)
        branch = ref.startsWith(BRANCH_PREFIX) ? ref.slice(BRANCH_PREFIX.length) : ref
      }
    }
    if (path !== null) listed.push({ path, branch })
  }
  return listed
}

/** The ticket number a worktree branch names (`worktree-61`), else null. */
export function ticketOfBranch(branch: string | null): number | null {
  const match = branch === null ? null : /^worktree-(\d+)$/.exec(branch)
  return match === null ? null : Number(match[1])
}

const countLines = (stdout: string): number =>
  stdout.split(/\r?\n/).filter((line) => line.trim() !== '').length

/**
 * The state of the worktrees of the tickets in `wanted`, keyed by ticket number; a ticket with no
 * worktree is absent. A git command that fails leaves its worktree out (or its `ahead` unknown)
 * and never fails the read.
 */
export const readWorktrees = (
  runner: ProcessRunnerShape,
  repoRoot: string,
  wanted: ReadonlyArray<number>,
): Effect.Effect<ReadonlyMap<number, WorktreeState>> =>
  Effect.gen(function* () {
    const output = (args: ReadonlyArray<string>): Effect.Effect<string | null> =>
      runner.run({ command: 'git', args, cwd: repoRoot }).pipe(
        Effect.map((result) => (result.exitCode === 0 ? result.stdout : null)),
        Effect.catch(() => Effect.succeed(null)),
      )
    const listing = yield* output(['worktree', 'list', '--porcelain'])
    if (listing === null) return new Map<number, WorktreeState>()
    const numbers = new Set(wanted)
    const found = parseWorktreeList(listing).flatMap((entry) => {
      const number = ticketOfBranch(entry.branch)
      return number !== null && numbers.has(number) && entry.branch !== null
        ? [{ number, path: entry.path, branch: entry.branch }]
        : []
    })
    const states = yield* Effect.forEach(
      found,
      ({ number, path, branch }) =>
        Effect.gen(function* () {
          const status = yield* output(['-C', path, '--no-optional-locks', 'status', '--porcelain'])
          // A directory git cannot read (a worktree deleted by hand) is not a worktree to show.
          if (status === null) return null
          const log = yield* output(['-C', path, 'log', '--format=%H', `main..${branch}`])
          const state: WorktreeState = {
            path,
            branch,
            uncommitted: countLines(status),
            ahead: log === null ? null : countLines(log),
          }
          return [number, state] as const
        }),
      { concurrency: 4 },
    )
    return new Map(states.flatMap((entry) => (entry === null ? [] : [entry])))
  })
