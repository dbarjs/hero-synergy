import { Clock, Effect } from 'effect'

import { FileSystem, type FileSystemError, type FileSystemShape } from '../file-system.ts'
import { readMapStatus } from '../snapshot/map-status.ts'
import type { Snapshot, Ticket, WayfinderMap } from '../snapshot/model.ts'
import {
  type Collected,
  type CollectedMap,
  type CollectedTicket,
  readSnapshot,
} from '../snapshot/read.ts'
import { joinPath } from './paths.ts'

/** Where a local tracker keeps its efforts, relative to the repo root. */
export const SCRATCH_DIRECTORY = '.scratch'

/** The local template's name for an effort's map file; any casing of it is the map. */
const MAP_FILE = 'map.md'

/**
 * One effort of a local tracker, as the files report it before any body is
 * read: a file named `map.md` in any casing directly in `.scratch/<effort>/` is
 * the map, `issues/NN-<slug>.md` the tickets in number order. Every effort
 * directory is numbered by its 1-based position in directory order, whether it
 * holds a map or not, so no map renumbers when another closes; an effort
 * without a map file has no map, and its tickets go to `unmapped`.
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

/** One effort of a local tracker, read, with nothing hidden. */
export interface EffortReading {
  /** The effort's directory under `.scratch`. */
  readonly directory: string
  /** Its map with all its tickets, closed ones included; null when the effort holds no map file. */
  readonly map: WayfinderMap | null
  /** The map's own state, from its Status header line; null with no map. */
  readonly mapState: 'open' | 'closed' | null
  /** Its issue files that are no map's tickets, closed ones included, in number order. */
  readonly unmapped: ReadonlyArray<Ticket>
}

/**
 * Reads every effort under `.scratch` into one snapshot of the open maps. A
 * repo with no `.scratch` directory has no maps and no error: the tracker is
 * there, it holds nothing yet. A map closed by its own Status line is left out
 * with all its tickets, as a closed map is on GitHub.
 */
export function readLocalTracker(
  repoRoot: string,
): Effect.Effect<Snapshot, FileSystemError, FileSystem> {
  return Effect.gen(function* () {
    const efforts = yield* readLocalEfforts(repoRoot)
    const collectedAt = yield* currentTime
    return {
      tracker: { kind: 'local' },
      repoRoot,
      collectedAt,
      maps: efforts.flatMap((effort) =>
        effort.map !== null && effort.mapState === 'open' ? [effort.map] : [],
      ),
      unmapped: efforts.flatMap((effort) => effort.unmapped),
      // A local tracker keeps no repo-wide labels, the one thing a snapshot warns about.
      warnings: [],
    }
  })
}

/**
 * Reads every effort under `.scratch`, in directory order, and hides nothing:
 * each one's map with every ticket, the map's own state, and the issue files
 * that are no map's tickets. Only reads. `readLocalTracker` builds the
 * snapshot from it; tests read through it to check what the snapshot hides.
 */
export function readLocalEfforts(
  repoRoot: string,
): Effect.Effect<ReadonlyArray<EffortReading>, FileSystemError, FileSystem> {
  return Effect.gen(function* () {
    const efforts = yield* collectLocal(repoRoot)
    return efforts.map((effort): EffortReading => {
      const snapshot = readSnapshot(effort.collected)
      const collectedMap = effort.collected.maps[0]
      return {
        directory: effort.slug,
        map: snapshot.maps[0] ?? null,
        mapState: collectedMap === undefined ? null : readMapStatus(collectedMap.body).state,
        unmapped: snapshot.unmapped,
      }
    })
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

      // The map file is found by listing, never by a fixed name, so every disk reads the same files.
      const mapFiles: Array<{ name: string; body: string }> = []
      const entries = yield* listDirectory(fs, joinPath(repoRoot, effortPath))
      for (const name of entries.filter((entry) => entry.toLowerCase() === MAP_FILE).sort()) {
        const body = yield* readIfFile(fs, joinPath(repoRoot, effortPath, name))
        if (body !== null) mapFiles.push({ name, body })
      }
      const mapFile = mapFiles.find((file) => file.name === MAP_FILE) ?? mapFiles[0]
      const mapBody = mapFile?.body ?? null
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
        mapFile === undefined
          ? []
          : [
              {
                number: mapNumber,
                title: null,
                ref: { tracker: 'local', path: joinPath(effortPath, mapFile.name) },
                body: mapFile.body,
                children: tickets.map((ticket) => ticket.number),
                ...(mapFiles.length > 1 ? { mapFiles: mapFiles.map((file) => file.name) } : {}),
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
