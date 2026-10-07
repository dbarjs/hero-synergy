import { Effect } from 'effect'

import { FileSystem, type FileSystemError, type FileSystemShape } from '../file-system.ts'
import { firstH1, linkTargets, sections } from '../snapshot/markdown.ts'
import { joinPath } from './paths.ts'

/**
 * The tracker doc decides which tracker a repo uses, by its heading alone.
 * `/setup-matt-pocock-skills` writes it at {@link TRACKER_DOC_PATH} and links
 * it from the `## Agent skills` block of `CLAUDE.md` or `AGENTS.md`; the home
 * path is looked at first, the link second.
 */

/** Where the setup skill writes the tracker doc. */
export const TRACKER_DOC_PATH = 'docs/agents/issue-tracker.md'

/** The files whose `## Agent skills` block may link the tracker doc, in the order they are tried. */
const AGENT_FILES = ['CLAUDE.md', 'AGENTS.md'] as const

export type TrackerKind = 'github' | 'local' | 'unsupported'

export interface TrackerHeading {
  readonly kind: TrackerKind
  /** The tracker the heading names (`GitHub`, `Local Markdown`, `GitLab`); null when the doc has no H1. */
  readonly name: string | null
}

/** A tracker doc that was found: where, and what its heading says. */
export interface TrackerDoc extends TrackerHeading {
  /** The doc's path, relative to the repo root. */
  readonly path: string
}

const HEADING = /^Issue tracker:\s*(.+?)\s*$/i

/** What a tracker doc's first H1 says. Case does not matter; anything but GitHub and Local Markdown is unsupported. */
export function readTrackerHeading(markdown: string): TrackerHeading {
  const h1 = firstH1(markdown)
  if (h1 === null) return { kind: 'unsupported', name: null }
  const name = HEADING.exec(h1)?.[1] ?? h1
  const key = name.toLowerCase().replace(/\s+/g, ' ')
  if (key === 'github') return { kind: 'github', name }
  if (key === 'local markdown') return { kind: 'local', name }
  return { kind: 'unsupported', name }
}

/**
 * The tracker doc of a repo, or null when there is none: the home path first,
 * then the first `.md` the Agent skills block of `CLAUDE.md` or `AGENTS.md`
 * points at, as a Markdown link or a backticked path.
 */
export function locateTrackerDoc(
  repoRoot: string,
): Effect.Effect<TrackerDoc | null, FileSystemError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem
    const home = yield* readIfFile(fs, joinPath(repoRoot, TRACKER_DOC_PATH))
    if (home !== null) return { path: TRACKER_DOC_PATH, ...readTrackerHeading(home) }

    for (const agentFile of AGENT_FILES) {
      const markdown = yield* readIfFile(fs, joinPath(repoRoot, agentFile))
      if (markdown === null) continue
      const linked = linkedTrackerDoc(markdown)
      if (linked === null) continue
      const content = yield* readIfFile(fs, joinPath(repoRoot, linked))
      if (content !== null) return { path: linked, ...readTrackerHeading(content) }
    }
    return null
  })
}

const BACKTICKED = /`([^`\n]+\.md)`/g

/** The repo-relative path the Agent skills block names for the tracker doc, or null. */
export function linkedTrackerDoc(markdown: string): string | null {
  const block = sections(markdown).find((section) => section.key === 'agent skills')
  if (block === undefined) return null
  // The block has one subsection per concern; the tracker's is the one that names it, else the whole block.
  const scope =
    /###\s+Issue tracker\s*\n([\s\S]*?)(?=\n###\s|$)/i.exec(block.text)?.[1] ?? block.text
  const candidates = [
    ...linkTargets(scope),
    ...[...scope.matchAll(BACKTICKED)].map((match) => match[1] ?? ''),
  ]
  for (const candidate of candidates) {
    if (/^[a-z]+:\/\//i.test(candidate) || !/\.md$/i.test(candidate)) continue
    return candidate.replace(/^\.\//, '')
  }
  return null
}

/** The file's content, or null when nothing is at the path or a directory is. */
const readIfFile = (
  fs: FileSystemShape,
  path: string,
): Effect.Effect<string | null, FileSystemError> =>
  fs.readFile(path).pipe(
    Effect.catchIf(
      (error) => error.code === 'NotFound' || error.code === 'IsADirectory',
      () => Effect.succeed(null),
    ),
  )
