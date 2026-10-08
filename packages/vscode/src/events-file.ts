import {
  FileSystem,
  type HealthWarning,
  readStatusEvent,
  readStatusEvents,
  type StatusEvent,
} from '@hero-synergy/core'
import { Effect, Ref } from 'effect'

/**
 * The events file: the status plugin appends one JSON line per hook, the Cockpit reads it. One
 * full read at activation, then only the bytes added since, by offset. The reader never holds a
 * file handle, so another process may append, and the Cockpit may compact, between two reads.
 */

/** Above this many bytes the Cockpit compacts the file at activation. */
export const EVENTS_SIZE_CAP = 256 * 1024

/** How often the slow poll reads while a session is running: it backs the watcher, which can drop events. */
export const EVENTS_POLL_MS = 5_000

export interface EventsRead {
  /** The events in line order that were new since the last read. */
  readonly events: ReadonlyArray<StatusEvent>
  /** Whether the file was read again from its start because it shrank (another window compacted it). */
  readonly restarted: boolean
  /** Lines that could not be decoded, and a read that failed, as log lines. */
  readonly problems: ReadonlyArray<string>
  /** The same lines' coded health warnings, for the Health row. */
  readonly warnings: ReadonlyArray<HealthWarning>
}

export interface EventsReader {
  /** Reads what was appended since the last read. A missing file is an empty one. */
  readonly read: Effect.Effect<EventsRead>
  /**
   * Rewrites the file down to the last event per ticket when it is above `cap` bytes, and moves
   * the reader to the end of the rewrite. Leaves the file alone if anything was appended while
   * it was being compacted. Returns whether it rewrote.
   */
  readonly compact: (cap: number) => Effect.Effect<boolean>
}

const byteLength = (text: string): number => new TextEncoder().encode(text).length

/** The text up to and including its last newline: a line still being appended is not read yet. */
const completeLines = (text: string): string => text.slice(0, text.lastIndexOf('\n') + 1)

/**
 * What compaction keeps: each ticket's last event, plus, when that event belongs to a session
 * that has a `SessionEnd`, that end, so the ticket's last session is still final afterwards.
 * Lines that do not decode are dropped. Returns the text, newline-terminated, or '' when empty.
 */
export function compactEvents(text: string): string {
  const lines = text
    .split('\n')
    .map((raw) => ({ raw, event: readStatusEvent(raw).value }))
    .filter((line): line is { raw: string; event: StatusEvent } => line.event !== null)
  const keep = new Set<number>()
  const tickets = new Set(lines.map((line) => line.event.ticket))
  for (const ticket of tickets) {
    const own = lines.flatMap((line, index) => (line.event.ticket === ticket ? [index] : []))
    const last = own.at(-1)
    if (last === undefined) continue
    keep.add(last)
    const lastEvent = lines[last]!.event
    if (lastEvent.hook !== 'SessionEnd' && lastEvent.session !== null) {
      const ending = own.findLast(
        (index) =>
          lines[index]!.event.hook === 'SessionEnd' &&
          lines[index]!.event.session === lastEvent.session,
      )
      if (ending !== undefined) keep.add(ending)
    }
  }
  const kept = lines.filter((_, index) => keep.has(index)).map((line) => line.raw)
  return kept.length === 0 ? '' : `${kept.join('\n')}\n`
}

export const makeEventsReader = (file: string): Effect.Effect<EventsReader, never, FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem
    const offset = yield* Ref.make(0)

    const readFrom = (from: number) =>
      fs.readFrom(file, from).pipe(
        Effect.map((result) => ({ ...result, failure: null as string | null })),
        Effect.catch((error) =>
          Effect.succeed({
            text: '',
            size: 0,
            failure: error.code === 'NotFound' ? null : error.message,
          }),
        ),
      )

    const read: Effect.Effect<EventsRead> = Effect.gen(function* () {
      const from = yield* Ref.get(offset)
      let chunk = yield* readFrom(from)
      // A file shorter than the offset was rewritten: start over, as the activation read does.
      const restarted = chunk.failure === null && chunk.size < from
      if (restarted) {
        yield* Ref.set(offset, 0)
        chunk = yield* readFrom(0)
      }
      const complete = completeLines(chunk.text)
      yield* Ref.update(offset, (current) => current + byteLength(complete))
      const decoded = readStatusEvents(complete)
      return {
        events: decoded.value,
        restarted,
        warnings: decoded.warnings,
        problems: [
          ...(chunk.failure === null ? [] : [`Could not read ${file}: ${chunk.failure}`]),
          ...decoded.warnings.map(
            (warning) => `${file}: ${warning.code}${warning.detail ? ` (${warning.detail})` : ''}`,
          ),
        ],
      }
    })

    const compact = (cap: number): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const whole = yield* readFrom(0)
        if (whole.failure !== null || whole.size <= cap) return false
        const compacted = compactEvents(whole.text)
        // Something appended since the read would be lost by the rewrite: try again at the next start.
        const again = yield* readFrom(whole.size)
        if (again.failure !== null || again.size !== whole.size) return false
        yield* fs.writeFile(file, compacted)
        yield* Ref.set(offset, byteLength(compacted))
        return true
      }).pipe(Effect.catch(() => Effect.succeed(false)))

    return { read, compact }
  })
