import { Data } from 'effect'

/**
 * The cases where the Cockpit shows one plain message and no maps. They are
 * errors of the scout's entry, never snapshot fields: a snapshot exists only
 * once a repo and a supported tracker were found. The GitHub collect adds its
 * own cases (`gh` missing or not logged in, rate limits, the network) to the
 * union when it lands.
 */

/** No workspace folder is inside a git repo; a folder holding several repos is this case too. */
export class NoRepoFound extends Data.TaggedError('NoRepoFound')<{
  readonly folders: ReadonlyArray<string>
}> {}

/** The repo has no tracker doc, neither at its home path nor linked from the Agent skills block: the setup message. */
export class NoTrackerDoc extends Data.TaggedError('NoTrackerDoc')<{
  readonly repoRoot: string
}> {}

/** The tracker doc names a tracker the Cockpit does not read (GitLab, "Other"), or has no heading to name one. */
export class UnsupportedTracker extends Data.TaggedError('UnsupportedTracker')<{
  readonly repoRoot: string
  /** The doc's path, relative to the repo root. */
  readonly trackerDoc: string
  /** The tracker the heading names; null when the doc has no heading at all. */
  readonly name: string | null
}> {}

/** A GitHub doc, but no remote names an owner and a repository to collect from. */
export class NoRemote extends Data.TaggedError('NoRemote')<{
  readonly repoRoot: string
  /** The URL that was looked at, when there was one. */
  readonly remote: string | null
}> {}

export type ScoutError = NoRepoFound | NoTrackerDoc | UnsupportedTracker | NoRemote
