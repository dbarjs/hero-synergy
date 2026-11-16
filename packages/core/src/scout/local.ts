import { Clock, Effect } from 'effect'

import { FileSystem, type FileSystemError, type FileSystemShape } from '../file-system.ts'
import { headerValue, readHeaderLines } from '../snapshot/header-lines.ts'
import { readMapStatus } from '../snapshot/map-status.ts'
import type { Snapshot, Ticket, UnmappedGroup, WayfinderMap } from '../snapshot/model.ts'
import {
  type Collected,
  type CollectedMap,
  type CollectedTicket,
  type MapLine,
  readSnapshot,
} from '../snapshot/read.ts'
import { fileTarget, resolveTarget } from '../snapshot/reference-line.ts'
import { joinPath } from './paths.ts'

/** Where a local tracker keeps its efforts, relative to the repo root. */
export const SCRATCH_DIRECTORY = '.scratch'

/** The local template's name for an effort's map file; any casing of it is the map. */
const MAP_FILE = 'map.md'

/**
 * One effort of a local tracker, as the files report it: a file named `map.md`
 * in any casing directly in `.scratch/<effort>/` is the map, `issues/NN-<slug>.md`
 * the issue files in number order. Every effort directory is numbered by its
 * 1-based position in directory order, whether it holds a map or not, so no map
 * renumbers when another closes. Only the header lines that decide membership
 * are read here (#139): an issue file is a ticket of its effort's map unless the
 * effort has no map file or its `Parent:` line names another file, such as a
 * PRD; every other issue file is an unmapped issue.
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
 * with all its tickets, as a closed map is on GitHub. Each effort's open
 * unmapped issues form one group, in directory order, titled with the effort's
 * map title, open or closed, or, without a map, its directory name. A closed
 * unmapped issue is left out, and an effort with no open one adds no group (#139).
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
      unmapped: efforts.flatMap((effort): UnmappedGroup[] => {
        const open = effort.unmapped.filter((ticket) => ticket.state === 'open')
        return open.length === 0
          ? []
          : [
              {
                effort: effort.directory,
                title: effort.map?.title ?? effort.directory,
                tickets: open,
              },
            ]
      }),
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
        unmapped: snapshot.unmapped.flatMap((group) => group.tickets),
      }
    })
  })
}

/** The efforts under `.scratch`, in directory order, bodies unread but for the membership lines. */
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
    // Each directory a `Map:` or `Parent:` line points into is listed once per collect.
    const listings = new Map<string, ReadonlyArray<string>>()
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
      const issues = yield* listDirectory(fs, joinPath(repoRoot, effortPath, 'issues'))

      const files = issues
        .map((file) => ({ file, number: ticketNumber(file) }))
        .filter((entry): entry is { file: string; number: number } => entry.number !== null)
        .sort((a, b) => a.number - b.number || a.file.localeCompare(b.file))

      const mapPath = mapFile === undefined ? null : joinPath(effortPath, mapFile.name)
      const tickets: CollectedTicket[] = []
      for (const { file, number } of files) {
        const path = joinPath(effortPath, 'issues', file)
        const body = yield* readIfFile(fs, joinPath(repoRoot, path))
        if (body === null) continue
        const mapLines = yield* readMapLines(fs, repoRoot, path, body, mapPath, listings)
        // A ticket of the effort's map, unless its `Parent:` names another file, such as a PRD (#139).
        const member =
          mapPath !== null &&
          !mapLines.some((line) => line.key === 'parent' && line.points === 'file')
        tickets.push({
          number,
          title: null,
          ref: { tracker: 'local', path },
          body,
          state: null,
          labels: [],
          assignees: [],
          parent: member ? mapNumber : null,
          blockedBy: [],
          lastComment: null,
          ...(mapLines.length > 0 ? { mapLines } : {}),
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
                children: tickets
                  .filter((ticket) => ticket.parent === mapNumber)
                  .map((ticket) => ticket.number),
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

/** A map file of some effort, `.scratch/<effort>/map.md` in any case, whether or not it is there. */
const MAP_PATH = new RegExp(String.raw`^${SCRATCH_DIRECTORY}/[^/]+/${MAP_FILE}$`, 'i')

/**
 * Where the ticket's first `Map:` and first `Parent:` header lines point, each read only as a
 * link target or a bare path resolved against the ticket's directory (#137). `mapPath` is the
 * effort's map file, null without one. A target is the effort's own map when it names that file
 * in any case; away when it names another effort's map file, a missing file or nothing in the
 * repo; and any other file found by listing its directory, so every disk reads the same files.
 */
const readMapLines = (
  fs: FileSystemShape,
  repoRoot: string,
  path: string,
  body: string,
  mapPath: string | null,
  listings: Map<string, ReadonlyArray<string>>,
): Effect.Effect<ReadonlyArray<MapLine>, FileSystemError> =>
  Effect.gen(function* () {
    const header = readHeaderLines(body)
    const lines: MapLine[] = []
    for (const key of ['map', 'parent'] as const) {
      const value = headerValue(header, key)
      const target = value === null ? null : fileTarget(value)
      if (target === null) continue
      const resolved = resolveTarget(path, target)
      let points: MapLine['points']
      if (resolved === null) points = 'away'
      else if (mapPath !== null && resolved.toLowerCase() === mapPath.toLowerCase())
        points = 'own-map'
      else if (MAP_PATH.test(resolved)) points = 'away'
      else points = (yield* isFileAt(fs, repoRoot, resolved, listings)) ? 'file' : 'away'
      lines.push({ key, target, points })
    }
    return lines
  })

/** Whether a file, not a directory, is at the repo-relative path, by its exact name in a listing. */
const isFileAt = (
  fs: FileSystemShape,
  repoRoot: string,
  path: string,
  listings: Map<string, ReadonlyArray<string>>,
): Effect.Effect<boolean, FileSystemError> =>
  Effect.gen(function* () {
    const slash = path.lastIndexOf('/')
    const directory = slash === -1 ? '' : path.slice(0, slash)
    const name = path.slice(slash + 1)
    let names = listings.get(directory)
    if (names === undefined) {
      names = yield* listDirectory(fs, joinPath(repoRoot, ...(directory === '' ? [] : [directory])))
      listings.set(directory, names)
    }
    return names.includes(name) && !(yield* isDirectory(fs, joinPath(repoRoot, path)))
  })

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
