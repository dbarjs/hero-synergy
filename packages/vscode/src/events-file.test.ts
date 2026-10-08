import { FileSystem } from '@hero-synergy/core'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { compactEvents, makeEventsReader } from './events-file.ts'

const FILE = '/storage/events/repo.jsonl'

const line = (ticket: string, hook: string, session: string, detail: string | null = null) =>
  `${JSON.stringify({ ticket, hook, session, detail, at: '2026-10-08T10:00:00.000Z', payload: {} })}\n`

/** Appends text the way the plugin does: after whatever is there. */
const append = (text: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem
    const before = (yield* fs.exists(FILE)) ? yield* fs.readFile(FILE) : ''
    yield* fs.writeFile(FILE, before + text)
  })

const hooks = (read: { events: ReadonlyArray<{ ticket: string; hook: string }> }) =>
  read.events.map((event) => `${event.ticket}:${event.hook}`)

describe('the events-file reader', () => {
  it.effect('reads a missing file as empty, then the whole file once it exists', () =>
    Effect.gen(function* () {
      const reader = yield* makeEventsReader(FILE)
      expect(yield* reader.read).toEqual({ events: [], restarted: false, problems: [] })

      yield* append(line('57', 'SessionStart', 'A', 'startup') + line('58', 'SessionStart', 'B'))
      expect(hooks(yield* reader.read)).toEqual(['57:SessionStart', '58:SessionStart'])
    }).pipe(Effect.provide(FileSystem.inMemory())),
  )

  it.effect('reads only what was appended since, by byte offset', () =>
    Effect.gen(function* () {
      const reader = yield* makeEventsReader(FILE)
      yield* append(line('57', 'SessionStart', 'A'))
      expect(hooks(yield* reader.read)).toEqual(['57:SessionStart'])
      expect(hooks(yield* reader.read)).toEqual([])

      yield* append(line('57', 'StopFailure', 'A', 'rate_limit'))
      expect(hooks(yield* reader.read)).toEqual(['57:StopFailure'])
      expect(hooks(yield* reader.read)).toEqual([])
    }).pipe(Effect.provide(FileSystem.inMemory())),
  )

  it.effect('counts bytes, not characters, so a multi-byte title does not shift the offset', () =>
    Effect.gen(function* () {
      const reader = yield* makeEventsReader(FILE)
      yield* append(
        `${JSON.stringify({ ticket: '57', hook: 'SessionStart', session: 'é–ü', payload: {} })}\n`,
      )
      expect((yield* reader.read).events.map((event) => event.session)).toEqual(['é–ü'])
      yield* append(line('57', 'SessionEnd', 'é–ü', 'other'))
      expect(hooks(yield* reader.read)).toEqual(['57:SessionEnd'])
    }).pipe(Effect.provide(FileSystem.inMemory())),
  )

  it.effect('leaves a line that is still being appended for the next read', () =>
    Effect.gen(function* () {
      const reader = yield* makeEventsReader(FILE)
      const whole = line('57', 'SessionStart', 'A')
      yield* append(whole.slice(0, 30))
      expect(hooks(yield* reader.read)).toEqual([])
      yield* append(whole.slice(30))
      expect(hooks(yield* reader.read)).toEqual(['57:SessionStart'])
    }).pipe(Effect.provide(FileSystem.inMemory())),
  )

  it.effect('reports a line that does not decode and goes on with the next', () =>
    Effect.gen(function* () {
      const reader = yield* makeEventsReader(FILE)
      yield* append(`not json\n${line('57', 'SessionStart', 'A')}`)
      const read = yield* reader.read
      expect(hooks(read)).toEqual(['57:SessionStart'])
      expect(read.problems).toHaveLength(1)
      expect(read.problems[0]).toContain('hook-payload-unreadable')
    }).pipe(Effect.provide(FileSystem.inMemory())),
  )

  it.effect('reads the ISO times the plugin writes', () =>
    Effect.gen(function* () {
      const reader = yield* makeEventsReader(FILE)
      yield* append(line('57', 'SessionStart', 'A'))
      expect((yield* reader.read).events[0]?.at).toBe(Date.parse('2026-10-08T10:00:00.000Z'))
    }).pipe(Effect.provide(FileSystem.inMemory())),
  )

  it.effect(
    'survives a compaction by another window: the shorter file is read from its start',
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem
        const reader = yield* makeEventsReader(FILE)
        yield* append(
          line('57', 'SessionStart', 'A') +
            line('57', 'StopFailure', 'A', 'rate_limit') +
            line('58', 'SessionStart', 'B'),
        )
        expect(hooks(yield* reader.read)).toHaveLength(3)

        yield* fs.writeFile(FILE, line('57', 'StopFailure', 'A', 'rate_limit'))
        const read = yield* reader.read
        expect(read.restarted).toBe(true)
        expect(hooks(read)).toEqual(['57:StopFailure'])

        yield* append(line('57', 'SessionEnd', 'A', 'other'))
        expect(hooks(yield* reader.read)).toEqual(['57:SessionEnd'])
      }).pipe(Effect.provide(FileSystem.inMemory())),
  )
})

describe('compacting the events file', () => {
  it('keeps the last event of each ticket', () => {
    const text =
      line('57', 'SessionStart', 'A') +
      line('58', 'SessionStart', 'B') +
      line('57', 'StopFailure', 'A', 'rate_limit') +
      line('58', 'SessionEnd', 'B', 'other')
    expect(compactEvents(text)).toBe(
      line('57', 'StopFailure', 'A', 'rate_limit') + line('58', 'SessionEnd', 'B', 'other'),
    )
  })

  it('keeps the end of the last session too, so a late start stays behind it', () => {
    const text =
      line('57', 'SessionStart', 'A') +
      line('57', 'SessionEnd', 'A', 'other') +
      line('57', 'SessionStart', 'A')
    expect(compactEvents(text)).toBe(
      line('57', 'SessionEnd', 'A', 'other') + line('57', 'SessionStart', 'A'),
    )
  })

  it('drops lines that do not decode, and an empty file stays empty', () => {
    expect(compactEvents(`junk\n${line('57', 'SessionStart', 'A')}\n`)).toBe(
      line('57', 'SessionStart', 'A'),
    )
    expect(compactEvents('')).toBe('')
  })

  it.effect('rewrites only above the size cap, and the reader goes on from the rewrite', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const reader = yield* makeEventsReader(FILE)
      yield* append(
        line('57', 'SessionStart', 'A') +
          line('57', 'StopFailure', 'A', 'rate_limit') +
          line('57', 'SessionEnd', 'A', 'other'),
      )
      expect(hooks(yield* reader.read)).toHaveLength(3)

      expect(yield* reader.compact(1_000_000)).toBe(false)
      expect(yield* reader.compact(10)).toBe(true)
      expect(yield* fs.readFile(FILE)).toBe(line('57', 'SessionEnd', 'A', 'other'))

      // Nothing to replay after the rewrite, and the next append is read as new.
      expect(hooks(yield* reader.read)).toEqual([])
      yield* append(line('57', 'SessionStart', 'B'))
      expect(hooks(yield* reader.read)).toEqual(['57:SessionStart'])
    }).pipe(Effect.provide(FileSystem.inMemory())),
  )

  it.effect('compacts nothing when the file is missing', () =>
    Effect.gen(function* () {
      const reader = yield* makeEventsReader(FILE)
      expect(yield* reader.compact(0)).toBe(false)
    }).pipe(Effect.provide(FileSystem.inMemory())),
  )
})
