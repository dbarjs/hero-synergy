import type { Decoded } from './decode.ts'
import { warn } from './decode.ts'

/** A Claude Code version, three numbers. */
export interface ClaudeVersion {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

/** The oldest Claude Code the Cockpit supports: before it, some prompts show as `busy` in the registry. */
export const claudeVersionFloor: ClaudeVersion = { major: 2, minor: 1, patch: 212 }

/**
 * The version line of `claude --version`, read as its leading `x.y.z`. What
 * follows (` (Claude Code)`, `-beta.1`) is ignored; a line that does not start
 * with three numbers is unreadable, and the floor check is skipped.
 */
export function readClaudeVersion(stdout: string): Decoded<ClaudeVersion | null> {
  const match = /^\s*(\d+)\.(\d+)\.(\d+)/.exec(stdout)
  if (match === null) {
    return {
      value: null,
      warnings: [warn('claude-version-unreadable', stdout.trim().slice(0, 200))],
    }
  }
  return {
    value: { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) },
    warnings: [],
  }
}

/** Negative when `a` is older than `b`, zero when equal, positive when newer; compared by number, not text. */
export function compareClaudeVersions(a: ClaudeVersion, b: ClaudeVersion): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export const isBelowClaudeFloor = (version: ClaudeVersion): boolean =>
  compareClaudeVersions(version, claudeVersionFloor) < 0
