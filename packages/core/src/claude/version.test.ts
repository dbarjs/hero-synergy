import { describe, expect, test } from 'vite-plus/test'

import ceiling from '../../fixtures/process/claude-version.json' with { type: 'json' }
import floor from '../../fixtures/process/claude-version-2.1.212.json' with { type: 'json' }
import { fixtureText } from './fixtures.ts'
import { compareClaudeVersions, isBelowClaudeFloor, readClaudeVersion } from './version.ts'

const numbers = (line: string) => {
  const { value, warnings } = readClaudeVersion(line)
  return { value: value && [value.major, value.minor, value.patch], warnings }
}

describe('reading the version line of claude --version', () => {
  test('reads the recorded lines of the floor and the tested ceiling', () => {
    expect(numbers(floor.stdout)).toEqual({ value: [2, 1, 212], warnings: [] })
    expect(numbers(ceiling.stdout)).toEqual({ value: [2, 1, 292], warnings: [] })
  })

  test('reads the leading x.y.z and ignores a suffix', () => {
    expect(numbers('2.1.292 (Claude Code)\n').value).toEqual([2, 1, 292])
    expect(numbers('2.1.300-beta.1').value).toEqual([2, 1, 300])
    expect(numbers('  2.2.0+build.5 (Claude Code)').value).toEqual([2, 2, 0])
  })

  test('a leading word means there is no leading x.y.z: unreadable, nothing else', () => {
    for (const line of ['Claude Code 2.1.292\n', 'v2.1.292\n']) {
      const read = readClaudeVersion(line)
      expect(read.value).toBeNull()
      expect(read.warnings.map((warning) => warning.code)).toEqual(['claude-version-unreadable'])
    }
  })

  test('a line with no number is unreadable, nothing else', () => {
    const read = readClaudeVersion(fixtureText('health/claude-version-unreadable.txt'))
    expect(read.value).toBeNull()
    expect(read.warnings).toEqual([
      { code: 'claude-version-unreadable', detail: 'Claude Code (version unknown)' },
    ])
    expect(readClaudeVersion('').warnings.map((warning) => warning.code)).toEqual([
      'claude-version-unreadable',
    ])
  })

  test('a version with fewer than three numbers is unreadable', () => {
    expect(readClaudeVersion('2.1\n').value).toBeNull()
  })
})

describe('the floor', () => {
  const below = (line: string) => isBelowClaudeFloor(readClaudeVersion(line).value!)

  test('2.1.211 is below it and 2.1.212 is not', () => {
    expect(below('2.1.211 (Claude Code)')).toBe(true)
    expect(below('2.1.212 (Claude Code)')).toBe(false)
    expect(below('2.1.213 (Claude Code)')).toBe(false)
  })

  test('compares by number, not as text', () => {
    expect(below('2.1.99')).toBe(true) // "99" sorts after "212" as text
    expect(below('2.1.1000')).toBe(false)
    expect(below('2.0.999')).toBe(true)
    expect(below('2.10.0')).toBe(false) // "10" sorts before "2" as text
    expect(below('3.0.0')).toBe(false)
    expect(below('1.99.999')).toBe(true)
  })

  test('orders two versions', () => {
    const a = readClaudeVersion('2.1.212').value!
    expect(compareClaudeVersions(a, a)).toBe(0)
    expect(compareClaudeVersions(a, readClaudeVersion('2.1.292').value!)).toBeLessThan(0)
    expect(compareClaudeVersions(readClaudeVersion('2.2.0').value!, a)).toBeGreaterThan(0)
  })
})
