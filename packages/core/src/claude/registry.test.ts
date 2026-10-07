import { describe, expect, test } from 'vite-plus/test'

import ceiling from '../../fixtures/process/claude-agents-json-2.1.292.json' with { type: 'json' }
import floor from '../../fixtures/process/claude-agents-json-2.1.212.json' with { type: 'json' }
import { fixtureText } from './fixtures.ts'
import { readRegistry, registryStatusWord, type RegistryStatusWord } from './registry.ts'

// The made-up registry both recordings were taken from, one entry per case.
const expected: ReadonlyArray<[string, RegistryStatusWord]> = [
  ['#46 Decode Claude Code', 'working'],
  ['#47 Idle one', 'waiting-for-you'],
  ['#48 Needs approval', 'needs-approval'], // permission prompt
  ['#49 Needs input', 'waiting-for-you'], // input needed
  ['#50 Dialog', 'waiting-for-you'], // dialog open
  ['#51 Sandbox', 'needs-approval'], // sandbox request
  ['#52 Worker', 'needs-approval'], // worker request
]

describe.each([
  ['2.1.212, the floor', floor],
  ['2.1.292, the tested ceiling', ceiling],
])('claude agents --json recorded from %s', (_version, recording) => {
  const read = readRegistry(recording.stdout)

  test('decodes every entry with no warning', () => {
    expect(read.warnings).toEqual([])
    expect(read.value.map((entry) => entry.name)).toEqual(expected.map(([name]) => name))
  })

  test.each(expected)('%s maps to its status word', (name, word) => {
    const entry = read.value.find((candidate) => candidate.name === name)
    expect(entry).toBeDefined()
    expect(registryStatusWord(entry!)).toBe(word)
  })

  test('keeps the detail a waiting session is blocked on', () => {
    const waiting = read.value.filter((entry) => entry.status === 'waiting')
    expect(waiting.map((entry) => entry.waitingFor)).toEqual([
      'permission prompt',
      'input needed',
      'dialog open',
      'sandbox request',
      'worker request',
    ])
    expect(read.value[0]).toMatchObject({ status: 'busy', waitingFor: null, kind: 'interactive' })
  })
})

describe('the registry of a newer Claude Code', () => {
  test('ignores fields it does not know and reads background sessions', () => {
    const read = readRegistry(
      JSON.stringify([
        {
          sessionId: 'a',
          name: '#1 x',
          status: 'idle',
          id: '40432f0d',
          kind: 'background',
          state: 'blocked',
          newField: { nested: true },
        },
      ]),
    )
    expect(read.warnings).toEqual([])
    expect(read.value[0]).toMatchObject({ sessionId: 'a', kind: 'background', status: 'idle' })
  })

  test('maps a waiting session with an unknown or missing detail to needs approval', () => {
    const [unknown, missing] = readRegistry(
      JSON.stringify([
        { sessionId: 'a', name: '#1 x', status: 'waiting', waitingFor: 'something new' },
        { sessionId: 'b', name: '#2 y', status: 'waiting' },
      ]),
    ).value
    expect(registryStatusWord(unknown!)).toBe('needs-approval')
    expect(registryStatusWord(missing!)).toBe('needs-approval')
  })

  test('reads an empty registry as no sessions, without a warning', () => {
    expect(readRegistry('[]')).toEqual({ value: [], warnings: [] })
  })
})

describe('what the registry can get wrong', () => {
  test('an output that is not an array of entries is registry-unreadable, and only that', () => {
    const read = readRegistry(fixtureText('health/registry-unreadable.json'))
    expect(read.value).toEqual([])
    expect(read.warnings.map((warning) => warning.code)).toEqual(['registry-unreadable'])
  })

  test('output that is not JSON is registry-unreadable', () => {
    const read = readRegistry('Error: not logged in')
    expect(read.warnings.map((warning) => warning.code)).toEqual(['registry-unreadable'])
  })

  test('an entry without a name is registry-entry-unreadable, and the others still decode', () => {
    const read = readRegistry(fixtureText('health/registry-entry-unreadable.json'))
    expect(read.value).toEqual([])
    expect(read.warnings.map((warning) => warning.code)).toEqual(['registry-entry-unreadable'])

    const mixed = readRegistry(
      JSON.stringify([
        { name: 'no id', status: 'busy' },
        { sessionId: 'a', name: '#1 x', status: 'busy' },
      ]),
    )
    expect(mixed.value.map((entry) => entry.sessionId)).toEqual(['a'])
    expect(mixed.warnings.map((warning) => warning.code)).toEqual(['registry-entry-unreadable'])
  })

  test('a status that is not busy, idle or waiting is registry-status-unknown; the entry stays, as unknown', () => {
    const read = readRegistry(fixtureText('health/registry-status-unknown.json'))
    expect(read.warnings).toEqual([{ code: 'registry-status-unknown', detail: 'napping' }])
    expect(read.value).toHaveLength(1)
    expect(read.value[0]).toMatchObject({ status: 'unknown' })
    expect(registryStatusWord(read.value[0]!)).toBe('unknown')
  })
})
