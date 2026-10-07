import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { fixtureRepo as seed } from '../../fixtures/local-tracker/seed.ts'
import { FileSystem } from '../file-system.ts'
import { type ProcessRecording, ProcessRunner } from '../process-runner.ts'
import { findRepo, ownerAndRepo, type RepoTracker } from './find-repo.ts'

const fixtureRepo = (root = '/home/ana/billing') => seed(root)

/** What `git -C <folder> rev-parse --show-toplevel` answers inside a repo. */
const inRepo = (folder: string, root: string): ProcessRecording => ({
  command: 'git',
  args: ['-C', folder, 'rev-parse', '--show-toplevel'],
  stdout: `${root}\n`,
  stderr: '',
  exitCode: 0,
})

/** What it answers outside one: a folder holding several repos, a plain directory, a path that is not there. */
const notARepo = (folder: string): ProcessRecording => ({
  command: 'git',
  args: ['-C', folder, 'rev-parse', '--show-toplevel'],
  stdout: '',
  stderr: 'fatal: not a git repository (or any of the parent directories): .git\n',
  exitCode: 128,
})

/** What `git -C <root> remote -v` prints: fetch and push lines per remote, in the order git lists them. */
const remotes = (
  root: string,
  named: ReadonlyArray<readonly [string, string]>,
): ProcessRecording => ({
  command: 'git',
  args: ['-C', root, 'remote', '-v'],
  stdout: named.map(([name, url]) => `${name}\t${url} (fetch)\n${name}\t${url} (push)\n`).join(''),
  stderr: '',
  exitCode: 0,
})

const LOCAL_DOC = '# Issue tracker: Local Markdown\n\nIssues live in `.scratch/`.\n'
const GITHUB_DOC = '# Issue tracker: GitHub\n\nIssues live on GitHub.\n'

const find = (
  folders: ReadonlyArray<string>,
  files: Record<string, string>,
  recordings: ReadonlyArray<ProcessRecording>,
) =>
  findRepo(folders).pipe(
    Effect.provide(FileSystem.inMemory(files)),
    Effect.provide(ProcessRunner.replay(recordings)),
  )

const failure = (
  folders: ReadonlyArray<string>,
  files: Record<string, string>,
  recordings: ReadonlyArray<ProcessRecording>,
) => Effect.flip(find(folders, files, recordings))

describe('findRepo: which folder', () => {
  it.effect('a workspace of one folder at the root of a repo on the local tracker', () =>
    Effect.gen(function* () {
      const found = yield* find(['/home/ana/billing'], fixtureRepo(), [
        inRepo('/home/ana/billing', '/home/ana/billing'),
      ])
      expect(found).toEqual<RepoTracker>({
        repoRoot: '/home/ana/billing',
        tracker: { kind: 'local' },
        trackerDoc: 'docs/agents/issue-tracker.md',
      })
    }),
  )

  it.effect(
    'a folder two levels inside a repo resolves the root and reads the tracker doc there',
    () =>
      Effect.gen(function* () {
        const found = yield* find(['/home/ana/billing/packages/api'], fixtureRepo(), [
          inRepo('/home/ana/billing/packages/api', '/home/ana/billing'),
        ])
        expect(found.repoRoot).toBe('/home/ana/billing')
        expect(found.tracker).toEqual({ kind: 'local' })
      }),
  )

  it.effect('two folders where only the second has a tracker doc picks the second', () =>
    Effect.gen(function* () {
      const found = yield* find(['/home/ana/notes', '/home/ana/billing'], fixtureRepo(), [
        inRepo('/home/ana/notes', '/home/ana/notes'),
        inRepo('/home/ana/billing', '/home/ana/billing'),
      ])
      expect(found.repoRoot).toBe('/home/ana/billing')
    }),
  )

  it.effect('the first folder with a tracker doc wins, in workspace order', () =>
    Effect.gen(function* () {
      const files = {
        ...fixtureRepo('/home/ana/billing'),
        ...fixtureRepo('/home/ana/shop'),
      }
      const found = yield* find(['/home/ana/shop/packages/web', '/home/ana/billing'], files, [
        inRepo('/home/ana/shop/packages/web', '/home/ana/shop'),
        inRepo('/home/ana/billing', '/home/ana/billing'),
      ])
      expect(found.repoRoot).toBe('/home/ana/shop')
    }),
  )

  it.effect(
    'folders inside repos without a tracker doc: the first repo gets the setup message',
    () =>
      Effect.gen(function* () {
        const error = yield* failure(
          ['/home/ana/notes', '/home/ana/shop'],
          { '/home/ana/notes/README.md': '', '/home/ana/shop/README.md': '' },
          [
            inRepo('/home/ana/notes', '/home/ana/notes'),
            inRepo('/home/ana/shop', '/home/ana/shop'),
          ],
        )
        expect(error).toEqual(
          expect.objectContaining({ _tag: 'NoTrackerDoc', repoRoot: '/home/ana/notes' }),
        )
      }),
  )

  it.effect(
    'a folder outside any repo before one with a doc is skipped, not the setup message',
    () =>
      Effect.gen(function* () {
        const found = yield* find(['/home/ana', '/home/ana/billing'], fixtureRepo(), [
          notARepo('/home/ana'),
          inRepo('/home/ana/billing', '/home/ana/billing'),
        ])
        expect(found.repoRoot).toBe('/home/ana/billing')
      }),
  )

  it.effect('no folder in a repo, such as one holding several repos, is no repo found', () =>
    Effect.gen(function* () {
      const error = yield* failure(['/home/ana/projects'], fixtureRepo(), [
        notARepo('/home/ana/projects'),
      ])
      expect(error).toEqual(
        expect.objectContaining({ _tag: 'NoRepoFound', folders: ['/home/ana/projects'] }),
      )
    }),
  )

  it.effect('an empty workspace is no repo found', () =>
    Effect.gen(function* () {
      const error = yield* failure([], {}, [])
      expect(error._tag).toBe('NoRepoFound')
    }),
  )

  it.effect('a git that cannot be run surfaces as the process error, not as no repo', () =>
    Effect.gen(function* () {
      const error = yield* failure(['/home/ana/billing'], fixtureRepo(), [])
      expect(error._tag).toBe('ProcessNotRecorded')
    }),
  )
})

describe('findRepo: which tracker', () => {
  const root = '/home/ana/shop'
  const folders = [root]
  const git = [inRepo(root, root)]
  const doc = (content: string, path = 'docs/agents/issue-tracker.md') => ({
    [`${root}/${path}`]: content,
  })

  it.effect('a GitHub doc takes owner and repo from the origin remote', () =>
    Effect.gen(function* () {
      const found = yield* find(folders, doc(GITHUB_DOC), [
        ...git,
        remotes(root, [['origin', 'https://github.com/ana/shop.git']]),
      ])
      expect(found).toEqual<RepoTracker>({
        repoRoot: root,
        tracker: { kind: 'github', owner: 'ana', repo: 'shop' },
        trackerDoc: 'docs/agents/issue-tracker.md',
      })
    }),
  )

  it.effect('prefers upstream over origin, as gh does, and reads scp-like URLs', () =>
    Effect.gen(function* () {
      const found = yield* find(folders, doc(GITHUB_DOC), [
        ...git,
        remotes(root, [
          ['origin', 'git@github.com:ana/shop-fork.git'],
          ['upstream', 'git@github.com:acme/shop.git'],
        ]),
      ])
      expect(found.tracker).toEqual({ kind: 'github', owner: 'acme', repo: 'shop' })
    }),
  )

  it.effect(
    'a remote off github.com is still named, so the collect tries it and shows the error',
    () =>
      Effect.gen(function* () {
        const found = yield* find(folders, doc(GITHUB_DOC), [
          ...git,
          remotes(root, [['origin', 'https://git.acme.example/ana/shop']]),
        ])
        expect(found.tracker).toEqual({ kind: 'github', owner: 'ana', repo: 'shop' })
      }),
  )

  it.effect('a GitHub doc in a repo with no remote is NoRemote', () =>
    Effect.gen(function* () {
      const error = yield* failure(folders, doc(GITHUB_DOC), [...git, remotes(root, [])])
      expect(error).toEqual(
        expect.objectContaining({ _tag: 'NoRemote', repoRoot: root, remote: null }),
      )
    }),
  )

  it.effect(
    'a GitHub doc with a remote that names no owner and repo is NoRemote with the URL',
    () =>
      Effect.gen(function* () {
        const error = yield* failure(folders, doc(GITHUB_DOC), [
          ...git,
          remotes(root, [['origin', '/srv/git/shop.git']]),
        ])
        expect(error).toEqual(
          expect.objectContaining({
            _tag: 'NoRemote',
            repoRoot: root,
            remote: '/srv/git/shop.git',
          }),
        )
      }),
  )

  it.effect('a GitLab doc is an unsupported tracker, named', () =>
    Effect.gen(function* () {
      const error = yield* failure(folders, doc('# Issue tracker: GitLab\n'), git)
      expect(error).toEqual(
        expect.objectContaining({
          _tag: 'UnsupportedTracker',
          repoRoot: root,
          trackerDoc: 'docs/agents/issue-tracker.md',
          name: 'GitLab',
        }),
      )
    }),
  )

  it.effect(
    'a doc whose heading is not an issue-tracker heading is unsupported under that heading',
    () =>
      Effect.gen(function* () {
        const error = yield* failure(folders, doc('# Linear\n\nWe use Linear.\n'), git)
        expect(error).toEqual(
          expect.objectContaining({ _tag: 'UnsupportedTracker', name: 'Linear' }),
        )
      }),
  )

  it.effect('a doc with no heading is unsupported with no name', () =>
    Effect.gen(function* () {
      const error = yield* failure(folders, doc('Issues live somewhere.\n'), git)
      expect(error).toEqual(expect.objectContaining({ _tag: 'UnsupportedTracker', name: null }))
    }),
  )

  it.effect('the heading is read without regard to case or spacing', () =>
    Effect.gen(function* () {
      const found = yield* find(folders, doc('#  issue tracker:   local   markdown  \n'), git)
      expect(found.tracker).toEqual({ kind: 'local' })
    }),
  )

  it.effect(
    'the doc linked from the Agent skills block of CLAUDE.md is read when the home path is empty',
    () =>
      Effect.gen(function* () {
        const found = yield* find(
          folders,
          {
            [`${root}/CLAUDE.md`]:
              '# Shop\n\n## Agent skills\n\n### Issue tracker\n\nIssues live in `.scratch/`. See `docs/tracking/tracker.md`.\n\n### Domain docs\n\nSee `docs/agents/domain.md`.\n',
            [`${root}/docs/tracking/tracker.md`]: LOCAL_DOC,
            [`${root}/docs/agents/domain.md`]: '# Domain docs\n',
          },
          git,
        )
        expect(found.trackerDoc).toBe('docs/tracking/tracker.md')
        expect(found.tracker).toEqual({ kind: 'local' })
      }),
  )

  it.effect(
    'a Markdown link in AGENTS.md works too, and the home path still wins when both exist',
    () =>
      Effect.gen(function* () {
        const files = {
          [`${root}/AGENTS.md`]:
            '## Agent skills\n\n### Issue tracker\n\nSee [the tracker doc](./docs/tracking/tracker.md).\n',
          [`${root}/docs/tracking/tracker.md`]: '# Issue tracker: GitLab\n',
        }
        const linked = yield* failure(folders, files, git)
        expect(linked).toEqual(
          expect.objectContaining({
            _tag: 'UnsupportedTracker',
            trackerDoc: 'docs/tracking/tracker.md',
          }),
        )
        const home = yield* find(folders, { ...files, ...doc(LOCAL_DOC) }, git)
        expect(home.trackerDoc).toBe('docs/agents/issue-tracker.md')
      }),
  )

  it.effect('a link to a file that is not there is no tracker doc', () =>
    Effect.gen(function* () {
      const error = yield* failure(
        folders,
        {
          [`${root}/CLAUDE.md`]:
            '## Agent skills\n\n### Issue tracker\n\nSee `docs/agents/issue-tracker.md`.\n',
        },
        git,
      )
      expect(error._tag).toBe('NoTrackerDoc')
    }),
  )

  it.effect('a CLAUDE.md without an Agent skills block is no tracker doc', () =>
    Effect.gen(function* () {
      const error = yield* failure(
        folders,
        { [`${root}/CLAUDE.md`]: '# Shop\n\nRun `pnpm test`. See `docs/testing.md`.\n' },
        git,
      )
      expect(error._tag).toBe('NoTrackerDoc')
    }),
  )
})

describe('ownerAndRepo', () => {
  it('reads the URL forms git remotes take', () => {
    expect(ownerAndRepo('https://github.com/dbarjs/hero-synergy.git')).toEqual({
      owner: 'dbarjs',
      repo: 'hero-synergy',
    })
    expect(ownerAndRepo('https://github.com/dbarjs/hero-synergy')).toEqual({
      owner: 'dbarjs',
      repo: 'hero-synergy',
    })
    expect(ownerAndRepo('https://user@github.com/dbarjs/hero-synergy/')).toEqual({
      owner: 'dbarjs',
      repo: 'hero-synergy',
    })
    expect(ownerAndRepo('git@github.com:dbarjs/hero-synergy.git')).toEqual({
      owner: 'dbarjs',
      repo: 'hero-synergy',
    })
    expect(ownerAndRepo('ssh://git@github.com/dbarjs/hero-synergy.git')).toEqual({
      owner: 'dbarjs',
      repo: 'hero-synergy',
    })
    expect(ownerAndRepo('ssh://git@github.com:22/dbarjs/hero-synergy.git')).toEqual({
      owner: 'dbarjs',
      repo: 'hero-synergy',
    })
    expect(ownerAndRepo('git://github.com/dbarjs/hero-synergy.git')).toEqual({
      owner: 'dbarjs',
      repo: 'hero-synergy',
    })
  })

  it('takes the last two segments on a host that nests groups', () => {
    expect(ownerAndRepo('https://gitlab.example/group/sub/project.git')).toEqual({
      owner: 'sub',
      repo: 'project',
    })
  })

  it('is null for a URL with no owner and repo', () => {
    expect(ownerAndRepo('/srv/git/shop.git')).toBeNull()
    expect(ownerAndRepo('https://github.com/shop')).toBeNull()
    expect(ownerAndRepo('')).toBeNull()
  })
})
