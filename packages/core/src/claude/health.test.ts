import { describe, expect, it } from 'vite-plus/test'

import { healthCodes } from '../snapshot/warnings.ts'
import {
  checkClaudeVersion,
  HEALTH_TABLE,
  healthEntryList,
  healthEntryOf,
  healthLabel,
  healthLevel,
  raise,
  SEEN_LIMIT,
  skillOfDetail,
} from './health.ts'

const CONTEXT = { claude: '2.1.213' }

describe('the health table', () => {
  it('covers the whole HealthCode union, and nothing else', () => {
    expect(Object.keys(HEALTH_TABLE).sort()).toEqual([...healthCodes].sort())
  })

  it.each(healthCodes)('%s has a level, a message and a hint', (code) => {
    const entry = healthEntryOf(raise(code, 'wayfinder: what was seen'), CONTEXT)
    expect(['loud', 'quiet']).toContain(entry.level)
    expect(entry.message.trim()).not.toBe('')
    expect(entry.hint.trim()).not.toBe('')
    expect(entry.code).toBe(code)
  })

  it('has the levels of the spec', () => {
    const loud = [
      'claude-not-found',
      'claude-below-floor',
      'registry-unreadable',
      'registry-entry-unreadable',
      'registry-status-unknown',
      'hook-payload-unreadable',
      'plugin-manifest-unreadable',
      'skill-missing',
      'bypass-refused-as-root',
    ] as const
    const quiet = [
      'claude-version-unreadable',
      'hook-reason-missing',
      'skill-installed-twice',
      'plugin-disabled',
      'bypass-not-isolated',
    ] as const
    for (const code of loud) expect(healthLevel(code, null), code).toBe('loud')
    for (const code of quiet) expect(healthLevel(code, null), code).toBe('quiet')
  })

  it('makes an unreadable skill loud only for wayfinder and to-spec', () => {
    expect(healthLevel('skill-unreadable', 'plugin 1.2.3 wayfinder: no name')).toBe('loud')
    expect(healthLevel('skill-unreadable', '/repo/.claude/skills/to-spec: unreadable')).toBe('loud')
    expect(healthLevel('skill-unreadable', 'plugin 1.2.3 grilling: no name')).toBe('quiet')
    // A repo that happens to be called wayfinder-something does not make every skill loud.
    expect(healthLevel('skill-unreadable', '/work/wayfinder-app/.claude/skills/tdd: bad')).toBe(
      'quiet',
    )
    expect(healthLevel('skill-unreadable', '/home/ana/.claude/skills: cannot list')).toBe('quiet')
  })

  it('names the folder a skill detail is about', () => {
    expect(skillOfDetail('plugin 1.2.3 wayfinder: x')).toBe('wayfinder')
    expect(skillOfDetail('C:\\Users\\ana\\.claude\\skills\\to-spec: x')).toBe('to-spec')
    expect(skillOfDetail(undefined)).toBeNull()
  })

  it('names the upstream and the version it saw in every machine message', () => {
    const registry = healthEntryOf(raise('registry-unreadable', 'not an array of entries'), CONTEXT)
    expect(registry.message).toContain('Claude Code 2.1.213')
    expect(registry.message).toContain('not an array of entries')
    const unknown = healthEntryOf(raise('registry-unreadable', 'x'), { claude: null })
    expect(unknown.message).toContain('Claude Code (version unknown)')
    const floor = healthEntryOf(raise('claude-below-floor', '2.1.211'), CONTEXT)
    expect(floor.message).toContain('Claude Code 2.1.211')
    expect(floor.message).toContain('2.1.212')
    expect(floor.hint).toContain('claude update')
    expect(floor.hint).toContain('package manager')
  })

  it('cuts what was seen to a limit, and keeps the detail whole', () => {
    const raised = raise('registry-unreadable', 'bad', 'x'.repeat(SEEN_LIMIT + 10))
    expect(raised.seen).toHaveLength(SEEN_LIMIT)
    expect(raised.detail).toBe('bad')
    expect(raise('skill-missing', undefined)).toEqual({
      code: 'skill-missing',
      detail: null,
      seen: null,
    })
  })
})

describe('the entries of the Health row', () => {
  it('lists loud entries first, each code once at the same detail', () => {
    const entries = healthEntryList(
      [
        raise('hook-reason-missing', 'SessionEnd for ticket 4 has no reason'),
        raise('claude-below-floor', '2.1.211'),
        raise('claude-below-floor', '2.1.211'),
        raise('plugin-disabled', 'mp is disabled'),
      ],
      [{ code: 'unknown-wayfinder-labels', detail: 'wayfinder:epic' }],
      CONTEXT,
    )
    expect(entries.map((entry) => [entry.code, entry.level])).toEqual([
      ['claude-below-floor', 'loud'],
      ['hook-reason-missing', 'quiet'],
      ['plugin-disabled', 'quiet'],
      ['unknown-wayfinder-labels', 'quiet'],
    ])
  })

  it('lists a code again at another detail', () => {
    const entries = healthEntryList(
      [raise('plugin-disabled', 'a'), raise('plugin-disabled', 'b')],
      [],
      CONTEXT,
    )
    expect(entries.map((entry) => entry.detail)).toEqual(['a', 'b'])
  })
})

describe('the words of the Health row', () => {
  it('is nothing when there is nothing to report', () => {
    expect(healthLabel([])).toBeNull()
  })

  it('counts the loud entries as warnings, one in the singular', () => {
    const entries = healthEntryList(
      [
        raise('claude-below-floor', '2.1.211'),
        raise('registry-unreadable', 'not an array of entries'),
        raise('hook-reason-missing', 'x'),
      ],
      [],
      CONTEXT,
    )
    expect(healthLabel(entries)).toBe('Health · 2 warnings')
    expect(healthLabel(entries.slice(0, 1))).toBe('Health · 1 warning')
  })

  it('counts notes when no entry is loud', () => {
    const one = healthEntryList([raise('hook-reason-missing', 'x')], [], CONTEXT)
    expect(healthLabel(one)).toBe('Health · 1 note')
    const several = healthEntryList(
      [raise('hook-reason-missing', 'x'), raise('plugin-disabled', 'y')],
      [],
      CONTEXT,
    )
    expect(healthLabel(several)).toBe('Health · 2 notes')
  })
})

describe('the floor check on one run of claude --version', () => {
  const ran = (stdout: string, exitCode: number | null = 0, stderr = '') => ({
    exitCode,
    stdout,
    stderr,
  })

  it('reads the version and raises nothing at or above the floor', () => {
    expect(checkClaudeVersion(ran('2.1.212 (Claude Code)\n'))).toEqual({
      version: '2.1.212',
      raised: [],
    })
  })

  it('raises claude-below-floor with the version below it', () => {
    const { version, raised } = checkClaudeVersion(ran('2.1.211 (Claude Code)\n'))
    expect(version).toBe('2.1.211')
    expect(raised).toEqual([
      { code: 'claude-below-floor', detail: '2.1.211', seen: '2.1.211 (Claude Code)\n' },
    ])
  })

  it('raises claude-version-unreadable for a line that is not a version, naming what it printed', () => {
    const { version, raised } = checkClaudeVersion(ran('nightly build\n'))
    expect(version).toBeNull()
    expect(raised).toEqual([
      { code: 'claude-version-unreadable', detail: 'nightly build', seen: 'nightly build\n' },
    ])
  })

  it('raises claude-version-unreadable for a run that failed or never started', () => {
    expect(checkClaudeVersion(ran('', 1, 'boom'))).toEqual({
      version: null,
      raised: [{ code: 'claude-version-unreadable', detail: 'it exited with 1', seen: 'boom' }],
    })
    expect(checkClaudeVersion(ran('', null)).raised[0]?.detail).toBe('it exited with a timeout')
    expect(checkClaudeVersion(null)).toEqual({
      version: null,
      raised: [{ code: 'claude-version-unreadable', detail: 'it could not be run', seen: null }],
    })
  })
})
