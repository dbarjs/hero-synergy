import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, layer } from '@effect/vitest'
import { Effect } from 'effect'

import { FileSystem } from './file-system.ts'

const seed = {
  '/repo/.claude/skills/wayfinder/SKILL.md': '---\nname: wayfinder\n---\n',
  '/repo/.claude/skills/grilling/SKILL.md': '---\nname: grilling\n---\n',
  '/repo/.scratch/cockpit/map.md': '## Destination\n',
}

layer(FileSystem.inMemory(seed))('FileSystem.inMemory', (it) => {
  it.effect('reads a seeded file', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const content = yield* fs.readFile('/repo/.scratch/cockpit/map.md')
      expect(content).toBe('## Destination\n')
    }),
  )

  it.effect('reads from a byte offset and reports the whole size', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      yield* fs.writeFile('/logs/events.jsonl', 'é1\nline2\n')
      // `é` is two bytes: the offset counts bytes, not characters.
      expect(yield* fs.readFrom('/logs/events.jsonl', 4)).toEqual({ text: 'line2\n', size: 10 })
      expect(yield* fs.readFrom('/logs/events.jsonl', 10)).toEqual({ text: '', size: 10 })
      expect(yield* fs.readFrom('/logs/events.jsonl', 99)).toEqual({ text: '', size: 10 })
      const missing = yield* Effect.flip(fs.readFrom('/logs/nowhere.jsonl', 0))
      expect([missing.code, missing.operation]).toEqual(['NotFound', 'readFrom'])
    }),
  )

  it.effect('reads back what it wrote, creating the parents on the way', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      yield* fs.writeFile('/repo/.scratch/cockpit/cache/snapshot.json', '{}')
      expect(yield* fs.readFile('/repo/.scratch/cockpit/cache/snapshot.json')).toBe('{}')
      expect(yield* fs.exists('/repo/.scratch/cockpit/cache')).toBe(true)
      expect(yield* fs.readDirectory('/repo/.scratch/cockpit')).toEqual(['cache', 'map.md'])
    }),
  )

  it.effect('lists a directory by the names of its entries, sorted', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      expect(yield* fs.readDirectory('/repo/.claude/skills/')).toEqual(['grilling', 'wayfinder'])
      expect(yield* fs.readDirectory('/repo')).toEqual(['.claude', '.scratch'])
    }),
  )

  it.effect('answers exists for files, directories and nothing', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      expect(yield* fs.exists('/repo/.claude/skills/wayfinder/SKILL.md')).toBe(true)
      expect(yield* fs.exists('/repo/.claude')).toBe(true)
      expect(yield* fs.exists('/repo/.claude/skills/missing')).toBe(false)
    }),
  )

  it.effect('fails with coded errors, as the disk would', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const missing = yield* Effect.flip(fs.readFile('/repo/nowhere.md'))
      expect(missing.code).toBe('NotFound')
      expect(missing.operation).toBe('readFile')
      expect(missing.path).toBe('/repo/nowhere.md')

      const directory = yield* Effect.flip(fs.readFile('/repo/.claude'))
      expect(directory.code).toBe('IsADirectory')

      const file = yield* Effect.flip(fs.readDirectory('/repo/.scratch/cockpit/map.md'))
      expect(file.code).toBe('NotADirectory')

      const under = yield* Effect.flip(fs.writeFile('/repo/.scratch/cockpit/map.md/x', ''))
      expect(under.code).toBe('NotADirectory')

      const nowhere = yield* Effect.flip(fs.readDirectory('/elsewhere'))
      expect(nowhere.code).toBe('NotFound')
    }),
  )
})

describe('FileSystem.live', () => {
  const temporaryDirectory = Effect.acquireRelease(
    Effect.promise(() => mkdtemp(join(tmpdir(), 'hero-synergy-fs-'))),
    (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
  )

  it.live('writes, reads, lists and checks real files', () =>
    Effect.gen(function* () {
      const root = yield* temporaryDirectory
      const fs = yield* FileSystem
      yield* fs.writeFile(join(root, 'nested', 'deeper', 'note.md'), 'hello')
      expect(yield* fs.readFile(join(root, 'nested', 'deeper', 'note.md'))).toBe('hello')
      expect(yield* fs.readDirectory(join(root, 'nested'))).toEqual(['deeper'])
      expect(yield* fs.exists(join(root, 'nested'))).toBe(true)
      expect(yield* fs.exists(join(root, 'absent'))).toBe(false)
    }).pipe(Effect.provide(FileSystem.live)),
  )

  it.live('reads from a byte offset like the in-memory layer', () =>
    Effect.gen(function* () {
      const root = yield* temporaryDirectory
      const fs = yield* FileSystem
      yield* fs.writeFile(join(root, 'events.jsonl'), 'é1\nline2\n')
      expect(yield* fs.readFrom(join(root, 'events.jsonl'), 4)).toEqual({
        text: 'line2\n',
        size: 10,
      })
      expect(yield* fs.readFrom(join(root, 'events.jsonl'), 99)).toEqual({ text: '', size: 10 })
      const missing = yield* Effect.flip(fs.readFrom(join(root, 'nowhere.jsonl'), 0))
      expect(missing.code).toBe('NotFound')
    }).pipe(Effect.provide(FileSystem.live)),
  )

  it.live('maps the disk errors to the same codes as the in-memory layer', () =>
    Effect.gen(function* () {
      const root = yield* temporaryDirectory
      const fs = yield* FileSystem
      yield* fs.writeFile(join(root, 'file.txt'), '')

      const missing = yield* Effect.flip(fs.readFile(join(root, 'missing.txt')))
      expect(missing.code).toBe('NotFound')
      expect(missing.operation).toBe('readFile')

      const directory = yield* Effect.flip(fs.readFile(root))
      expect(directory.code).toBe('IsADirectory')

      const file = yield* Effect.flip(fs.readDirectory(join(root, 'file.txt')))
      expect(file.code).toBe('NotADirectory')
    }).pipe(Effect.provide(FileSystem.live)),
  )
})
