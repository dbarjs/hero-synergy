import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { FileSystem, FileSystemError } from '../file-system.ts'
import {
  collectIsolationFacts,
  type Isolation,
  type IsolationFacts,
  isolatedRemoteNames,
  isolationOf,
} from './isolation.ts'

const NOT_ISOLATED_REMOTES = ['ssh-remote', 'wsl', 'tunnel', null] as const

/** Every combination of the three marker files. */
const MARKERS: ReadonlyArray<Pick<IsolationFacts, 'dockerenv' | 'containerenv' | 'toolboxenv'>> = [
  false,
  true,
].flatMap((dockerenv) =>
  [false, true].flatMap((containerenv) =>
    [false, true].map((toolboxenv) => ({ dockerenv, containerenv, toolboxenv })),
  ),
)

const label = (markers: (typeof MARKERS)[number]): string =>
  Object.entries(markers)
    .filter(([, on]) => on)
    .map(([name]) => name)
    .join('+') || 'no markers'

describe('isolationOf', () => {
  describe.each(isolatedRemoteNames)('a %s window', (remoteName) => {
    it.each(MARKERS.map((markers) => [label(markers), markers] as const))(
      'is isolated by its remote name with %s, the toolbox marker never vetoing it',
      (_, markers) => {
        expect(isolationOf({ remoteName, ...markers })).toEqual<Isolation>({
          isolated: true,
          signal: { kind: 'remote', remoteName },
        })
      },
    )
  })

  describe.each(NOT_ISOLATED_REMOTES)('a window whose remote name is %s', (remoteName) => {
    it.each(MARKERS.map((markers) => [label(markers), markers] as const))(
      'with %s',
      (_, markers) => {
        const marker = markers.dockerenv
          ? '/.dockerenv'
          : markers.containerenv
            ? '/run/.containerenv'
            : null
        const expected: Isolation =
          marker !== null && !markers.toolboxenv
            ? { isolated: true, signal: { kind: 'marker', path: marker } }
            : {
                isolated: false,
                vetoedBy: marker !== null ? '/run/.toolboxenv' : null,
                remoteName,
              }
        expect(isolationOf({ remoteName, ...markers })).toEqual(expected)
      },
    )
  })

  it('takes /.dockerenv before /run/.containerenv when both exist', () => {
    expect(
      isolationOf({ remoteName: null, dockerenv: true, containerenv: true, toolboxenv: false }),
    ).toEqual({ isolated: true, signal: { kind: 'marker', path: '/.dockerenv' } })
  })

  it('counts a Remote-SSH window into a container by its marker (Gitpod, Ona)', () => {
    expect(
      isolationOf({
        remoteName: 'ssh-remote',
        dockerenv: false,
        containerenv: true,
        toolboxenv: false,
      }),
    ).toEqual({ isolated: true, signal: { kind: 'marker', path: '/run/.containerenv' } })
  })

  it('does not count a toolbx or distrobox container, which shares the home', () => {
    expect(
      isolationOf({ remoteName: null, dockerenv: false, containerenv: true, toolboxenv: true }),
    ).toEqual({ isolated: false, vetoedBy: '/run/.toolboxenv', remoteName: null })
  })

  it('does not count a resolver name it does not know', () => {
    expect(
      isolationOf({
        remoteName: 'some-container',
        dockerenv: false,
        containerenv: false,
        toolboxenv: false,
      }),
    ).toEqual({ isolated: false, vetoedBy: null, remoteName: 'some-container' })
  })
})

describe('collectIsolationFacts', () => {
  const collect = (files: Record<string, string>, remoteName: string | null = null) =>
    collectIsolationFacts(remoteName).pipe(Effect.provide(FileSystem.inMemory(files)))

  it.effect('reads no marker on a machine with none', () =>
    Effect.gen(function* () {
      expect(yield* collect({}, 'ssh-remote')).toEqual({
        remoteName: 'ssh-remote',
        dockerenv: false,
        containerenv: false,
        toolboxenv: false,
      })
    }),
  )

  it.effect('reads each marker file that exists', () =>
    Effect.gen(function* () {
      expect(yield* collect({ '/.dockerenv': '' })).toMatchObject({ dockerenv: true })
      expect(yield* collect({ '/run/.containerenv': 'engine="podman"' })).toMatchObject({
        dockerenv: false,
        containerenv: true,
      })
      expect(
        yield* collect({ '/run/.containerenv': '', '/run/.toolboxenv': '' }, 'dev-container'),
      ).toEqual({
        remoteName: 'dev-container',
        dockerenv: false,
        containerenv: true,
        toolboxenv: true,
      })
    }),
  )

  it.effect('reads a marker it cannot check as absent', () =>
    Effect.gen(function* () {
      const denied = (path: string) =>
        new FileSystemError({
          operation: 'exists',
          path,
          code: 'PermissionDenied',
          message: 'denied',
        })
      const facts = yield* collectIsolationFacts(null).pipe(
        Effect.provideService(FileSystem, {
          readFile: (path) => Effect.fail(denied(path)),
          readFrom: (path) => Effect.fail(denied(path)),
          writeFile: (path) => Effect.fail(denied(path)),
          exists: (path) => Effect.fail(denied(path)),
          readDirectory: (path) => Effect.fail(denied(path)),
        }),
      )
      expect(facts).toEqual({
        remoteName: null,
        dockerenv: false,
        containerenv: false,
        toolboxenv: false,
      })
    }),
  )
})
