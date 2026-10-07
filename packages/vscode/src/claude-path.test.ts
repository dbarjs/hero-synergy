import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { type ClaudeResolution, resolveClaude } from './claude-path.ts'

const resolve = (
  input: { setting?: string; pathVariable?: string; platform?: string },
  files: ReadonlyArray<string>,
): Promise<ClaudeResolution> =>
  Effect.runPromise(
    resolveClaude({
      setting: input.setting ?? '',
      pathVariable: input.pathVariable ?? '',
      platform: input.platform ?? 'linux',
      isFile: (path) => Effect.succeed(files.includes(path)),
    }),
  )

describe('resolving claude', () => {
  it('finds claude in the first PATH directory that has it', async () => {
    const found = await resolve({ pathVariable: '/a:/b:/c' }, ['/b/claude', '/c/claude'])
    expect(found).toEqual({
      kind: 'found',
      claude: { path: '/b/claude', source: 'path', shim: false },
    })
  })

  it('lets the setting override PATH', async () => {
    const found = await resolve({ setting: '/opt/claude', pathVariable: '/a' }, [
      '/a/claude',
      '/opt/claude',
    ])
    expect(found).toEqual({
      kind: 'found',
      claude: { path: '/opt/claude', source: 'setting', shim: false },
    })
  })

  it('says so when the setting names no file, without falling back to PATH', async () => {
    const found = await resolve({ setting: '/opt/gone', pathVariable: '/a' }, ['/a/claude'])
    expect(found).toEqual({
      kind: 'missing',
      reason: 'heroSynergy.claude.path names /opt/gone, which is not a file.',
    })
  })

  it('says so when nothing is on PATH, and names the setting', async () => {
    const found = await resolve({ pathVariable: '/a:/b' }, [])
    expect(found.kind).toBe('missing')
    expect(found.kind === 'missing' && found.reason).toContain('heroSynergy.claude.path')
  })

  it('treats a blank setting as unset and ignores empty PATH entries', async () => {
    const found = await resolve({ setting: '  ', pathVariable: '::/a:' }, ['/a/claude'])
    expect(found).toMatchObject({ kind: 'found', claude: { path: '/a/claude' } })
  })

  describe('on Windows', () => {
    it('prefers claude.exe anywhere on PATH to an npm shim earlier on it', async () => {
      const found = await resolve({ platform: 'win32', pathVariable: 'C:\\npm;C:\\Claude\\bin' }, [
        'C:\\npm\\claude.cmd',
        'C:\\Claude\\bin\\claude.exe',
      ])
      expect(found).toEqual({
        kind: 'found',
        claude: { path: 'C:\\Claude\\bin\\claude.exe', source: 'path', shim: false },
      })
    })

    it('falls back to the npm shim, marked as best effort', async () => {
      const found = await resolve({ platform: 'win32', pathVariable: 'C:\\npm' }, [
        'C:\\npm\\claude.cmd',
      ])
      expect(found).toEqual({
        kind: 'found',
        claude: { path: 'C:\\npm\\claude.cmd', source: 'path', shim: true },
      })
    })

    it('strips quotes around a PATH entry', async () => {
      const found = await resolve(
        { platform: 'win32', pathVariable: '"C:\\Program Files\\Claude"' },
        ['C:\\Program Files\\Claude\\claude.exe'],
      )
      expect(found).toMatchObject({
        kind: 'found',
        claude: { path: 'C:\\Program Files\\Claude\\claude.exe' },
      })
    })
  })
})
