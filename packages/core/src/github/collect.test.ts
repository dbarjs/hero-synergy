import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from '@effect/vitest'
import { Duration, Effect, Layer } from 'effect'

import {
  ProcessRunner,
  ProcessSpawnFailed,
  type ProcessRecording,
  type ProcessRequest,
} from '../process-runner.ts'
import { readSnapshot } from '../snapshot/read.ts'
import { collectGitHubMaps, ghTimeout } from './collect.ts'
import { collectGitHub, parseRemote } from './remote.ts'
import { listMapsArgs, mapsArgs } from './query.ts'
import { parseGhOutput } from './response.ts'

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (path: string): ProcessRecording =>
  JSON.parse(readFileSync(resolve(fixtures, path), 'utf8')) as ProcessRecording
const github = (name: string) => fixture(`github/${name}.json`)
const origin = fixture('process/git-remote-get-url-origin.json')

const target = { owner: 'dbarjs', repo: 'hero-synergy' }
const repoRoot = '/work/hero-synergy'

/** The JSON body of a recorded `gh api -i` run. */
const bodyOf = (recording: ProcessRecording) =>
  JSON.parse(recording.stdout.slice(recording.stdout.search(/\r?\n\r?\n/) + 4)) as {
    data: { repository: Record<string, any>; rateLimit: { remaining: number; resetAt: string } }
  }

const collect = (...recordings: ProcessRecording[]) =>
  collectGitHub(repoRoot).pipe(Effect.provide(ProcessRunner.replay([origin, ...recordings])))

/** The failure a collect ends in, as the plain fields the refresh policy reads. */
const failureOf = (...recordings: ProcessRecording[]) =>
  collect(...recordings).pipe(
    Effect.flip,
    Effect.map((error) => error as unknown as Record<string, unknown>),
  )

describe('collecting this repo from the recorded gh outputs', () => {
  it.effect(
    'yields every ticket of both open maps typed, claimed, blocked and classified as the tracker shows',
    () =>
      Effect.gen(function* () {
        const { collected } = yield* collect(github('list-open-maps'), github('maps-1-64'))
        const raw = bodyOf(github('maps-1-64')).data.repository

        expect(collected.tracker).toEqual({ kind: 'github', owner: 'dbarjs', repo: 'hero-synergy' })
        expect(collected.repoRoot).toBe(repoRoot)
        expect(collected.labels).toEqual([
          'wayfinder:task',
          'wayfinder:grilling',
          'wayfinder:prototype',
          'wayfinder:research',
          'wayfinder:map',
        ])
        expect(collected.maps.map((map) => map.number)).toEqual([1, 64])

        const snapshot = readSnapshot(collected)
        expect(snapshot.unmapped).toEqual([])
        expect(snapshot.warnings).toEqual([])

        for (const map of snapshot.maps) {
          const nodes = raw[`m${map.number}`].subIssues.nodes as Array<any>
          expect(map.tickets.map((ticket) => ticket.number)).toEqual(
            nodes.map((node) => node.number),
          )
          for (const [index, ticket] of map.tickets.entries()) {
            const node = nodes[index]
            const labels: string[] = node.labels.nodes.map((label: any) => label.name)
            const logins: string[] = node.assignees.nodes.map((assignee: any) => assignee.login)
            expect(ticket.state, `#${ticket.number} state`).toBe(node.state.toLowerCase())
            expect(`wayfinder:${ticket.type}`, `#${ticket.number} type`).toSatisfy(
              (label: string) => labels.includes(label),
            )
            expect(ticket.claim, `#${ticket.number} claim`).toEqual(
              logins.length > 0 ? { by: logins } : null,
            )
            expect(
              ticket.blockedBy.map((blocker) => [blocker.number, blocker.state]),
              `#${ticket.number} blockers`,
            ).toEqual(
              node.blockedBy.nodes.map((blocker: any) => [
                blocker.number,
                blocker.state.toLowerCase(),
              ]),
            )
            expect(ticket.warnings.map((warning) => warning.code)).not.toContain('type-missing')
            expect(ticket.warnings.map((warning) => warning.code)).not.toContain('no-map')
            if (ticket.state === 'closed') expect(ticket.outcome).not.toBeNull()
            else expect(ticket.outcome).toBeNull()
          }
        }
      }),
  )

  it.effect('reads one ticket exactly: Scaffold the workspace', () =>
    Effect.gen(function* () {
      const { collected } = yield* collect(github('list-open-maps'), github('maps-1-64'))
      const scaffold = collected.tickets.find((ticket) => ticket.number === 2)
      expect(scaffold).toMatchObject({
        number: 2,
        title: 'Scaffold the workspace',
        ref: { tracker: 'github', url: 'https://github.com/dbarjs/hero-synergy/issues/2' },
        state: 'closed',
        labels: ['wayfinder:task'],
        assignees: ['dbarjs'],
        parent: 1,
        blockedBy: [],
        lastComment: { author: 'dbarjs', at: '2026-10-02T20:02:50Z' },
      })
      expect(scaffold?.lastComment?.body.startsWith('## Answer')).toBe(true)
      const map = collected.maps.find((candidate) => candidate.number === 1)
      expect(map?.title).toBe('hero-synergy v0.1.0, fully decided')
      expect(map?.children[0]).toBe(2)
    }),
  )

  it.effect('keeps a closed blocker in the nodes with its state', () =>
    Effect.gen(function* () {
      const { collected } = yield* collect(github('list-open-maps'), github('maps-1-64'))
      const states = collected.tickets.flatMap((ticket) =>
        ticket.blockedBy.map((blocker) => blocker.state),
      )
      expect(states).toContain('closed')
      const raw = JSON.stringify(bodyOf(github('maps-1-64')).data.repository)
      expect(raw).toContain('"state":"CLOSED"')
    }),
  )

  it.effect('carries the rate-limit figures of the last request on a successful result', () =>
    Effect.gen(function* () {
      const { rateLimit } = yield* collect(github('list-open-maps'), github('maps-1-64'))
      expect(rateLimit).toEqual(bodyOf(github('maps-1-64')).data.rateLimit)
      expect(typeof rateLimit.remaining).toBe('number')
      expect(rateLimit.resetAt).toMatch(/^\d{4}-\d\d-\d\dT/)
    }),
  )

  it.effect('stamps the collect with the clock', () =>
    Effect.gen(function* () {
      const { collected } = yield* collect(github('list-open-maps'), github('maps-1-64'))
      expect(new Date(collected.collectedAt).toISOString()).toBe(collected.collectedAt)
    }),
  )
})

describe('the requests', () => {
  /** A runner that serves the recordings and notes every request and how many ran at once. */
  const spied = (recordings: ProcessRecording[]) => {
    const requests: ProcessRequest[] = []
    let running = 0
    let peak = 0
    const inner = Effect.runSync(
      Effect.gen(function* () {
        return yield* ProcessRunner
      }).pipe(Effect.provide(ProcessRunner.replay(recordings))),
    )
    const layer = Layer.succeed(ProcessRunner, {
      run: (request) => {
        requests.push(request)
        running += 1
        peak = Math.max(peak, running)
        return inner.run(request).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              running -= 1
            }),
          ),
        )
      },
    })
    return { layer, requests, peak: () => peak }
  }

  it.effect(
    'collects seven open maps in two requests of five and two, in order, one after another',
    () =>
      Effect.gen(function* () {
        const five = github('maps-1-64-2-3-4')
        const two = github('maps-5-6')
        const { layer, requests, peak } = spied([origin, github('list-seven-maps'), five, two])

        const { collected } = yield* collectGitHub(repoRoot).pipe(Effect.provide(layer))

        const gh = requests.filter((request) => request.command === 'gh')
        expect(gh.map((request) => request.args)).toEqual([
          github('list-seven-maps').args,
          five.args,
          two.args,
        ])
        // The recorded query text, exactly: the aliased blocks of the chunk and nothing else varies.
        const text = (request: ProcessRequest) =>
          request.args.find((arg) => arg.startsWith('query='))?.slice('query='.length)
        expect(text(gh[1]!)).toContain('m1: issue(number: 1) { ...WayfinderMap }')
        expect(text(gh[1]!)).toContain('m4: issue(number: 4) { ...WayfinderMap }')
        expect(text(gh[2]!)).toContain('m5: issue(number: 5) { ...WayfinderMap }')
        expect(text(gh[2]!)).not.toContain('m4: issue')
        expect(text(gh[1]!)).toBe(text({ command: 'gh', args: mapsArgs(target, [1, 64, 2, 3, 4]) }))
        expect(collected.maps.map((map) => map.number)).toEqual([1, 64, 2, 3, 4, 5, 6])
        expect(peak()).toBe(1)
        for (const request of gh) {
          expect(Duration.toMillis(request.timeout!)).toBe(Duration.toMillis(ghTimeout))
          expect(Duration.toMillis(ghTimeout)).toBe(20_000)
        }
      }),
  )

  it.effect('asks for open maps only, by label name, with no preview header', () =>
    Effect.gen(function* () {
      const list = github('list-open-maps')
      expect(list.args).toEqual(listMapsArgs(target))
      const query = list.args.find((arg) => arg.startsWith('query='))!
      expect(query).toContain('states: [OPEN]')
      expect(query).toContain('rateLimit { remaining resetAt }')
      expect(list.args).toContain('labels[]=wayfinder:map')
      expect(list.args.join(' ')).not.toMatch(/GraphQL-Features|-H /)
      expect(list.args[2]).toBe('-i')
      expect(github('maps-1-64').args.find((arg) => arg.startsWith('query='))).toContain(
        'rateLimit { remaining resetAt }',
      )
      yield* Effect.void
    }),
  )

  it.effect('follows the list to its next page', () =>
    Effect.gen(function* () {
      const first = github('list-open-maps')
      const split = first.stdout.search(/\r?\n\r?\n/) + 4
      const body = JSON.parse(first.stdout.slice(split))
      body.data.repository.issues.nodes = [{ number: 1 }]
      body.data.repository.issues.pageInfo = { hasNextPage: true, endCursor: 'CURSOR' }
      const next = JSON.parse(first.stdout.slice(split))
      next.data.repository.issues.nodes = [{ number: 64 }]
      const page = (args: ReadonlyArray<string>, json: unknown): ProcessRecording => ({
        ...first,
        args,
        stdout: first.stdout.slice(0, split) + JSON.stringify(json),
      })
      const { collected } = yield* collect(
        page(listMapsArgs(target), body),
        page(listMapsArgs(target, 'CURSOR'), next),
        github('maps-1-64'),
      )
      expect(collected.maps.map((map) => map.number)).toEqual([1, 64])
    }),
  )

  it.effect('runs gh in the repo root', () =>
    Effect.gen(function* () {
      const { layer, requests } = spied([origin, github('list-open-maps'), github('maps-1-64')])
      yield* collectGitHub(repoRoot).pipe(Effect.provide(layer))
      expect(requests.map((request) => request.cwd)).toEqual([repoRoot, repoRoot, repoRoot])
    }),
  )
})

describe('a map that is gone or a request that fails', () => {
  it.effect('drops a map answering NOT_FOUND and yields the others without an error', () =>
    Effect.gen(function* () {
      const { collected } = yield* collect(github('list-with-gone-map'), github('maps-not-found'))
      expect(collected.maps.map((map) => map.number)).toEqual([1, 64])
      expect(collected.tickets.length).toBeGreaterThan(0)
    }),
  )

  it.effect('fails the whole collect with a typed failure on any other GraphQL error', () =>
    Effect.gen(function* () {
      const error = yield* failureOf(github('list-open-maps'), github('maps-graphql-error'))
      expect(error).toMatchObject({ _tag: 'GitHubCollectFailed', reason: 'graphql-error' })
      expect(error.message).toContain('Something went wrong')
    }),
  )

  const cases: Array<[string, string, Record<string, unknown>]> = [
    ['exit 4 (not logged in)', 'list-not-logged-in', { reason: 'not-logged-in' }],
    ['a 401', 'list-unauthorized', { reason: 'not-logged-in' }],
    [
      'a 403 with retry-after',
      'list-secondary-limit',
      { reason: 'secondary-limit', retryAfter: 60 },
    ],
    ['a spent primary limit', 'list-rate-limited', { reason: 'rate-limited' }],
    ['a 5xx', 'list-server-error', { reason: 'server', status: 502 }],
    ['a timeout', 'list-timeout', { reason: 'timeout' }],
    ['a refused connection', 'list-network', { reason: 'network' }],
  ]
  for (const [title, name, expected] of cases) {
    it.effect(`says ${String(expected.reason)} for ${title}`, () =>
      Effect.gen(function* () {
        const error = yield* failureOf(github(name))
        expect(error).toMatchObject({ _tag: 'GitHubCollectFailed', ...expected })
      }),
    )
  }

  it.effect('reads when the spent limit comes back', () =>
    Effect.gen(function* () {
      const error = yield* failureOf(github('list-rate-limited'))
      expect(error.resetAt).toBe(new Date(1791398868 * 1000).toISOString().replace('.000Z', 'Z'))
    }),
  )

  it.effect('says gh-missing when gh cannot be started', () =>
    Effect.gen(function* () {
      const missing = Layer.succeed(ProcessRunner, {
        run: (request) =>
          request.command === 'git'
            ? Effect.succeed({ stdout: origin.stdout, stderr: '', exitCode: 0, timedOut: false })
            : Effect.fail(
                new ProcessSpawnFailed({
                  command: request.command,
                  args: request.args,
                  message: 'spawn gh ENOENT',
                }),
              ),
      })
      const error = yield* collectGitHub(repoRoot).pipe(
        Effect.provide(missing),
        Effect.flip,
        Effect.map((failure) => failure as unknown as Record<string, unknown>),
      )
      expect(error).toMatchObject({ reason: 'gh-missing' })
    }),
  )

  it.effect('says no-remote when the repo has no origin', () =>
    Effect.gen(function* () {
      const error = yield* collectGitHub(repoRoot).pipe(
        Effect.provide(
          ProcessRunner.replay([
            {
              ...origin,
              stdout: '',
              stderr: "error: No such remote 'origin'\n",
              exitCode: 2,
            },
          ]),
        ),
        Effect.flip,
        Effect.map((failure) => failure as unknown as Record<string, unknown>),
      )
      expect(error).toMatchObject({ reason: 'no-remote' })
    }),
  )

  it.effect('tries a remote that is not on github.com and returns its error', () =>
    Effect.gen(function* () {
      const host = 'git.example.com'
      const args = listMapsArgs({ host, ...target })
      expect(args.slice(0, 5)).toEqual(['api', 'graphql', '-i', '--hostname', host])
      const error = yield* collectGitHub(repoRoot).pipe(
        Effect.provide(
          ProcessRunner.replay([
            { ...origin, stdout: 'git@git.example.com:dbarjs/hero-synergy.git\n' },
            {
              command: 'gh',
              args,
              stdout: '',
              stderr:
                'none of the git remotes configured for this repository point to a known GitHub host.\n',
              exitCode: 1,
            },
          ]),
        ),
        Effect.flip,
        Effect.map((failure) => failure as unknown as Record<string, unknown>),
      )
      expect(error).toMatchObject({ reason: 'request-failed' })
      expect(error.message).toContain('known GitHub host')
    }),
  )
})

describe('what is never collected', () => {
  it.effect('does not collect a task-list child and gives the map children-as-task-list', () =>
    Effect.gen(function* () {
      const { collected } = yield* collect(github('list-task-list-map'), github('maps-task-list'))
      expect(collected.tickets).toEqual([])
      const snapshot = readSnapshot(collected)
      const map = snapshot.maps[0]!
      expect(map.number).toBe(7)
      expect(map.tickets).toEqual([])
      expect(map.warnings.map((warning) => warning.code)).toContain('children-as-task-list')
      expect(snapshot.unmapped).toEqual([])
    }),
  )

  it.effect('collects only the native sub-issues of a map, so unmapped is empty', () =>
    Effect.gen(function* () {
      const { collected } = yield* collect(github('list-open-maps'), github('maps-1-64'))
      const raw = bodyOf(github('maps-1-64')).data.repository
      const expected = [...raw.m1.subIssues.nodes, ...raw.m64.subIssues.nodes].map(
        (node: any) => node.number,
      )
      expect(collected.tickets.map((ticket) => ticket.number)).toEqual(expected)
      expect(readSnapshot(collected).unmapped).toEqual([])
    }),
  )
})

describe('parseRemote', () => {
  it('reads the three remote forms and leaves the host out for github.com', () => {
    for (const url of [
      'https://github.com/dbarjs/hero-synergy.git',
      'https://github.com/dbarjs/hero-synergy',
      'git@github.com:dbarjs/hero-synergy.git',
      'ssh://git@github.com/dbarjs/hero-synergy.git\n',
      'https://github.com/dbarjs/hero-synergy.git/',
    ]) {
      expect(parseRemote(url), url).toEqual({ owner: 'dbarjs', repo: 'hero-synergy' })
    }
  })

  it('names any other host so the request can try it', () => {
    expect(parseRemote('git@git.example.com:team/app.git')).toEqual({
      host: 'git.example.com',
      owner: 'team',
      repo: 'app',
    })
    expect(parseRemote('https://gitlab.com/team/app.git')).toEqual({
      host: 'gitlab.com',
      owner: 'team',
      repo: 'app',
    })
  })

  it('reads nothing from a remote that is not owner/name', () => {
    for (const url of [
      '',
      'not a url',
      'https://github.com/only-owner',
      'https://github.com/a/b/c',
    ]) {
      expect(parseRemote(url), url).toBeNull()
    }
  })
})

describe('parseGhOutput', () => {
  it('splits a recorded `gh api -i` run into status, headers and body', () => {
    const output = parseGhOutput(github('list-secondary-limit').stdout)
    expect(output.status).toBe(403)
    expect(output.headers['retry-after']).toBe('60')
    expect(output.body).toMatchObject({ message: expect.stringContaining('secondary') })
  })

  it('reads nothing from empty output', () => {
    expect(parseGhOutput('')).toEqual({ status: null, headers: {}, body: undefined })
  })
})

describe('collectGitHubMaps', () => {
  it.effect('collects a repo named directly, without reading the remote', () =>
    Effect.gen(function* () {
      const { collected } = yield* collectGitHubMaps(target, repoRoot).pipe(
        Effect.provide(ProcessRunner.replay([github('list-open-maps'), github('maps-1-64')])),
      )
      expect(collected.maps.map((map) => map.number)).toEqual([1, 64])
    }),
  )
})
