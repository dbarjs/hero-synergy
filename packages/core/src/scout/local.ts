import { Clock, Effect } from 'effect'

import { FileSystem, type FileSystemError, type FileSystemShape } from '../file-system.ts'
import type { Snapshot } from '../snapshot/model.ts'
import {
  type Collected,
  type CollectedMap,
  type CollectedTicket,
  readSnapshot,
} from '../snapshot/read.ts'
import { joinPath } from './paths.ts'

/** Where a local tracker keeps its efforts, relative to the repo root. */
export const SCRATCH_DIRECTORY = '.scratch'

/**
 * One effort of a local tracker, as the files report it before any body is
 * read: `.scratch/<effort>/map.md` is the map, `issues/NN-<slug>.md` the
 * tickets in number order. Every effort directory is a map, numbered by its
 * 1-based position in directory order; an effort without a readable `map.md`
 * has no map, and its tickets go to `unmapped`.
 *
 * Each effort is its own `Collected`: ticket numbers are file prefixes, unique
 * within an effort and not across the tracker, and a `Blocked by:` line only
 * ever names a file of the same effort.
 */
export interface LocalEffort {
  /** The effort directory's name, which a launch takes as the effort slug. */
  readonly slug: string
  readonly collected: Collected
}

/**
 * Reads every effort under `.scratch` into one snapshot. A repo with no
 * `.scratch` directory has no maps and no error: the tracker is there, it
 * holds nothing yet. Nothing on disk says open or closed; a user hides a map
 * by removing its directory.
 */
export function readLocalTracker(
  repoRoot: string,
): Effect.Effect<Snapshot, FileSystemError, FileSystem> {
  return Effect.gen(function* () {
    const efforts = yield* collectLocal(repoRoot)
    const collectedAt = yield* currentTime
    const snapshots = efforts.map((effort) => readSnapshot(effort.collected))
    return {
      tracker: { kind: 'local' },
      repoRoot,
      collectedAt,
      maps: snapshots.flatMap((snapshot) => snapshot.maps),
      unmapped: snapshots.flatMap((snapshot) => snapshot.unmapped),
      warnings: snapshots.flatMap((snapshot) => snapshot.warnings),
    }
  })
}

/** The efforts under `.scratch`, in directory order, bodies unread. */
export function collectLocal(
  repoRoot: string,
): Effect.Effect<ReadonlyArray<LocalEffort>, FileSystemError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem
    const collectedAt = yield* currentTime
    const scratch = joinPath(repoRoot, SCRATCH_DIRECTORY)
    const names = yield* listDirectory(fs, scratch)
    const directories: string[] = []
    for (const name of names) {
      if (yield* isDirectory(fs, joinPath(scratch, name))) directories.push(name)
    }

    const efforts: LocalEffort[] = []
    for (const [index, slug] of directories.entries()) {
      const mapNumber = index + 1
      const effortPath = joinPath(SCRATCH_DIRECTORY, slug)
      const mapPath = joinPath(effortPath, 'map.md')
      const mapBody = yield* readIfFile(fs, joinPath(repoRoot, mapPath))
      const issues = yield* listDirectory(fs, joinPath(repoRoot, effortPath, 'issues'))

      const files = issues
        .map((file) => ({ file, number: ticketNumber(file) }))
        .filter((entry): entry is { file: string; number: number } => entry.number !== null)
        .sort((a, b) => a.number - b.number || a.file.localeCompare(b.file))

      const tickets: CollectedTicket[] = []
      for (const { file, number } of files) {
        const path = joinPath(effortPath, 'issues', file)
        const body = yield* readIfFile(fs, joinPath(repoRoot, path))
        if (body === null) continue
        tickets.push({
          number,
          title: null,
          ref: { tracker: 'local', path },
          body,
          state: null,
          labels: [],
          assignees: [],
          parent: mapBody === null ? null : mapNumber,
          blockedBy: [],
          lastComment: null,
        })
      }

      const maps: CollectedMap[] =
        mapBody === null
          ? []
          : [
              {
                number: mapNumber,
                title: null,
                ref: { tracker: 'local', path: mapPath },
                body: mapBody,
                children: tickets.map((ticket) => ticket.number),
              },
            ]

      efforts.push({
        slug,
        collected: {
          tracker: { kind: 'local' },
          repoRoot,
          collectedAt,
          labels: [],
          maps,
          tickets,
        },
      })
    }
    return efforts
  })
}

/** `03-which-database.md` → 3; null for a file that is not a ticket. */
const ticketNumber = (file: string): number | null => {
  const match = /^(\d+)-[^/]*\.md$/i.exec(file)
  return match?.[1] === undefined ? null : Number(match[1])
}

const currentTime: Effect.Effect<string> = Clock.currentTimeMillis.pipe(
  Effect.map((millis) => new Date(millis).toISOString()),
)

/** The directory's entries, or none when nothing is at the path. */
const listDirectory = (
  fs: FileSystemShape,
  path: string,
): Effect.Effect<ReadonlyArray<string>, FileSystemError> =>
  fs.readDirectory(path).pipe(
    Effect.catchIf(
      (error) => error.code === 'NotFound' || error.code === 'NotADirectory',
      () => Effect.succeed([]),
    ),
  )

const isDirectory = (fs: FileSystemShape, path: string): Effect.Effect<boolean, FileSystemError> =>
  fs.readDirectory(path).pipe(
    Effect.map(() => true),
    Effect.catchIf(
      (error) => error.code === 'NotFound' || error.code === 'NotADirectory',
      () => Effect.succeed(false),
    ),
  )

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
