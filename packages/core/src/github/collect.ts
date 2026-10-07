import { Clock, Duration, Effect, Schema } from 'effect'

import {
  ProcessRunner,
  type ProcessError,
  type ProcessNotRecorded,
  type ProcessResult,
} from '../process-runner.ts'
import type { Blocker, Ref } from '../snapshot/model.ts'
import type { Collected, CollectedMap, CollectedTicket } from '../snapshot/read.ts'
import { type GitHubRepo, listMapsArgs, mapAlias, mapsArgs, mapsPerRequest } from './query.ts'
import {
  failureOf,
  type GraphQLError,
  graphQLErrors,
  GitHubCollectFailed,
  parseGhOutput,
} from './response.ts'

/** `gh` is killed when a request has run this long. */
export const ghTimeout: Duration.Duration = Duration.seconds(20)

/** What the budget reads off a request: the points left and when they come back. */
export interface RateLimit {
  readonly remaining: number
  /** ISO time. */
  readonly resetAt: string
}

/** A successful collect and the rate-limit figures of its last request. */
export interface GitHubCollect {
  readonly collected: Collected
  readonly rateLimit: RateLimit
}

const Count = Schema.Struct({ remaining: Schema.Number, resetAt: Schema.String })

const ListData = Schema.Struct({
  repository: Schema.Struct({
    labels: Schema.Struct({ nodes: Schema.Array(Schema.Struct({ name: Schema.String })) }),
    issues: Schema.Struct({
      pageInfo: Schema.Struct({
        hasNextPage: Schema.Boolean,
        endCursor: Schema.NullOr(Schema.String),
      }),
      nodes: Schema.Array(Schema.Struct({ number: Schema.Number })),
    }),
  }),
  rateLimit: Count,
})

const State = Schema.Literals(['OPEN', 'CLOSED'])

const TicketNode = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  state: State,
  body: Schema.String,
  labels: Schema.Struct({ nodes: Schema.Array(Schema.Struct({ name: Schema.String })) }),
  assignees: Schema.Struct({ nodes: Schema.Array(Schema.Struct({ login: Schema.String })) }),
  parent: Schema.NullOr(Schema.Struct({ number: Schema.Number })),
  blockedBy: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        number: Schema.Number,
        title: Schema.String,
        state: State,
        url: Schema.String,
      }),
    ),
  }),
  comments: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        author: Schema.NullOr(Schema.Struct({ login: Schema.String })),
        createdAt: Schema.String,
        body: Schema.String,
      }),
    ),
  }),
})

const MapNode = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  body: Schema.String,
  subIssues: Schema.Struct({ nodes: Schema.Array(TicketNode) }),
})

const MapsData = Schema.Struct({
  repository: Schema.Record(Schema.String, Schema.NullOr(MapNode)),
  rateLimit: Count,
})

type TicketNode = typeof TicketNode.Type
type MapNode = typeof MapNode.Type

const decodeList = Schema.decodeUnknownSync(ListData)
const decodeMaps = Schema.decodeUnknownSync(MapsData)

const unexpected = (error: unknown): GitHubCollectFailed =>
  new GitHubCollectFailed({
    reason: 'unexpected-response',
    message: `GitHub's answer does not have the shape the query asks for: ${
      error instanceof Error ? error.message : String(error)
    }`,
  })

const github = (url: string): Ref => ({ tracker: 'github', url })
const lower = (state: 'OPEN' | 'CLOSED'): 'open' | 'closed' =>
  state === 'OPEN' ? 'open' : 'closed'

/** Runs one `gh api graphql` request and hands back its body and the GraphQL errors the caller may tolerate. */
const request = (args: ReadonlyArray<string>, repoRoot: string) =>
  Effect.gen(function* () {
    const runner = yield* ProcessRunner
    const result: ProcessResult = yield* runner
      .run({ command: 'gh', args, cwd: repoRoot, timeout: ghTimeout })
      .pipe(Effect.mapError(asCollectFailure))
    // `gh` skips `--jq` on GraphQL errors and exits 1 for nearly everything, so stdout is read whatever the exit code.
    const output = parseGhOutput(result.stdout)
    const failure = failureOf(result, output)
    if (failure !== null) return yield* Effect.fail(failure)
    if (output.body === undefined) {
      return yield* Effect.fail(
        new GitHubCollectFailed({
          reason: 'unexpected-response',
          message: 'GitHub answered without a JSON body',
        }),
      )
    }
    const body = output.body as { readonly data?: unknown }
    return { data: body.data, errors: graphQLErrors(output.body) }
  })

function asCollectFailure(error: ProcessError): GitHubCollectFailed | ProcessNotRecorded {
  if (error._tag === 'ProcessNotRecorded') return error
  return new GitHubCollectFailed({ reason: 'gh-missing', message: error.message })
}

const describeErrors = (errors: ReadonlyArray<GraphQLError>): string =>
  errors.map((error) => error.message).join('; ')

/** The open maps' numbers in tracker order, and the repository's `wayfinder:` labels. */
const listMaps = (target: GitHubRepo, repoRoot: string) =>
  Effect.gen(function* () {
    const numbers: number[] = []
    let labels: ReadonlyArray<string> = []
    let rateLimit: RateLimit | undefined
    let after: string | undefined
    for (;;) {
      const { data, errors } = yield* request(listMapsArgs(target, after), repoRoot)
      if (errors.length > 0) {
        return yield* Effect.fail(
          new GitHubCollectFailed({ reason: 'graphql-error', message: describeErrors(errors) }),
        )
      }
      const page = yield* Effect.try({ try: () => decodeList(data), catch: unexpected })
      if (after === undefined) {
        // `query` matches a label's name or description, so keep only the names that start the way a wayfinder label does.
        labels = page.repository.labels.nodes
          .map((label) => label.name)
          .filter((name) => name.startsWith('wayfinder:'))
      }
      numbers.push(...page.repository.issues.nodes.map((issue) => issue.number))
      rateLimit = page.rateLimit
      const { hasNextPage, endCursor } = page.repository.issues.pageInfo
      if (!hasNextPage || endCursor === null) break
      after = endCursor
    }
    return { numbers, labels, rateLimit: rateLimit as RateLimit }
  })

/** One request for up to five maps. A map that answers NOT_FOUND (closed or deleted since the list) is dropped; any other error fails the collect. */
const fetchMaps = (target: GitHubRepo, repoRoot: string, numbers: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    const { data, errors } = yield* request(mapsArgs(target, numbers), repoRoot)
    const aliases = new Set(numbers.map(mapAlias))
    const gone = new Set<string>()
    const fatal: GraphQLError[] = []
    for (const error of errors) {
      const alias = error.path?.[1]
      if (
        error.type === 'NOT_FOUND' &&
        error.path?.length === 2 &&
        error.path[0] === 'repository' &&
        typeof alias === 'string' &&
        aliases.has(alias)
      ) {
        gone.add(alias)
      } else {
        fatal.push(error)
      }
    }
    if (fatal.length > 0) {
      return yield* Effect.fail(
        new GitHubCollectFailed({ reason: 'graphql-error', message: describeErrors(fatal) }),
      )
    }
    const decoded = yield* Effect.try({ try: () => decodeMaps(data), catch: unexpected })
    const maps: MapNode[] = []
    for (const number of numbers) {
      const node = decoded.repository[mapAlias(number)]
      if (node !== null && node !== undefined) maps.push(node)
    }
    return { maps, rateLimit: decoded.rateLimit }
  })

const toCollectedMap = (node: MapNode): CollectedMap => ({
  number: node.number,
  title: node.title,
  ref: github(node.url),
  body: node.body,
  children: node.subIssues.nodes.map((child) => child.number),
})

const toCollectedTicket = (node: TicketNode): CollectedTicket => {
  const comment = node.comments.nodes.at(-1)
  return {
    number: node.number,
    title: node.title,
    ref: github(node.url),
    body: node.body,
    state: lower(node.state),
    labels: node.labels.nodes.map((label) => label.name),
    assignees: node.assignees.nodes.map((assignee) => assignee.login),
    parent: node.parent?.number ?? null,
    // A closed blocker stays in the nodes with its state; the readers gate on that state.
    blockedBy: node.blockedBy.nodes.map((blocker): Blocker => ({
      number: blocker.number,
      title: blocker.title,
      state: lower(blocker.state),
      ref: github(blocker.url),
    })),
    lastComment:
      comment === undefined
        ? null
        : { body: comment.body, author: comment.author?.login ?? null, at: comment.createdAt },
  }
}

/**
 * Collects a GitHub repo's open wayfinder maps and their sub-issues through
 * `gh api graphql`, one request after another.
 *
 * The list comes first: the open maps by label name, with the repository's
 * `wayfinder:` labels. The maps follow in requests of at most five, each an
 * aliased `issue(number:)` block per map with its sub-issues, so a ticket is
 * collected only as a native sub-issue of an open map. Relationships are read
 * fresh every time: `updatedAt` does not move when a parent or blocker is
 * added, so nothing is cached per item.
 */
export const collectGitHubMaps = (
  target: GitHubRepo,
  repoRoot: string,
): Effect.Effect<GitHubCollect, GitHubCollectFailed | ProcessNotRecorded, ProcessRunner> =>
  Effect.gen(function* () {
    const list = yield* listMaps(target, repoRoot)
    let rateLimit = list.rateLimit

    const maps: CollectedMap[] = []
    const tickets: CollectedTicket[] = []
    for (let start = 0; start < list.numbers.length; start += mapsPerRequest) {
      const chunk = list.numbers.slice(start, start + mapsPerRequest)
      const page = yield* fetchMaps(target, repoRoot, chunk)
      rateLimit = page.rateLimit
      for (const node of page.maps) {
        maps.push(toCollectedMap(node))
        tickets.push(...node.subIssues.nodes.map(toCollectedTicket))
      }
    }

    const collectedAt = new Date(yield* Clock.currentTimeMillis).toISOString()
    return {
      collected: {
        tracker: { kind: 'github', owner: target.owner, repo: target.repo },
        repoRoot,
        collectedAt,
        labels: list.labels,
        maps,
        tickets,
      },
      rateLimit,
    }
  })
