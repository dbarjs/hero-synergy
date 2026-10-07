import { Data } from 'effect'

import type { ProcessResult } from '../process-runner.ts'

/**
 * Why a collect failed, in the terms the refresh policy acts on. Each reason
 * maps to one thing the Cockpit does next: show the `gh auth login` fix, pause
 * until the reset, back off for `retry-after`, or just try again at the next
 * trigger.
 */
export type GitHubFailureReason =
  /** `gh` is not installed. */
  | 'gh-missing'
  /** `gh` has no token (exit 4) or GitHub refused it (401). */
  | 'not-logged-in'
  /** The primary limit is spent; `resetAt` says when it comes back. */
  | 'rate-limited'
  /** The secondary limit (403 or `retry-after`); `retryAfter` is the wait in seconds. */
  | 'secondary-limit'
  /** No answer: DNS, proxy, TLS, a refused connection. */
  | 'network'
  /** `gh` ran past its 20 s and was killed. */
  | 'timeout'
  /** GitHub answered 5xx. */
  | 'server'
  /** GraphQL reported an error other than a map that is gone. */
  | 'graphql-error'
  /** The answer was not the shape the query asks for. */
  | 'unexpected-response'
  /** The repo has no readable `origin` remote. */
  | 'no-remote'
  /** `gh` failed in a way no other reason names: a missing repo, a refused permission, a non-github.com host's own error. */
  | 'request-failed'

/** The whole collect failed; nothing of it is kept. */
export class GitHubCollectFailed extends Data.TaggedError('GitHubCollectFailed')<{
  readonly reason: GitHubFailureReason
  readonly message: string
  /** Seconds to wait, for a `secondary-limit` that sent `retry-after`. */
  readonly retryAfter?: number
  /** ISO time the primary limit resets, for `rate-limited` when GitHub said. */
  readonly resetAt?: string
  /** The HTTP status, for `server`. */
  readonly status?: number
}> {}

export interface GraphQLError {
  readonly type?: string | undefined
  readonly message: string
  readonly path?: ReadonlyArray<string | number> | undefined
}

/** What `gh api graphql -i` printed on stdout: the status line, the headers (names in lower case) and the JSON body. */
export interface GhOutput {
  /** `null` when stdout holds no HTTP response at all. */
  readonly status: number | null
  readonly headers: Readonly<Record<string, string>>
  /** `undefined` when the body is missing or not JSON. */
  readonly body: unknown
}

const statusLine = /^HTTP\/\S+\s+(\d{3})/

/** Parses `gh api -i` output. `gh` writes the status line with `\n` and the headers with `\r\n`, so both are accepted. */
export function parseGhOutput(stdout: string): GhOutput {
  const status = statusLine.exec(stdout)
  if (status === null) return { status: null, headers: {}, body: undefined }
  const split = /\r?\n\r?\n/.exec(stdout)
  const head = split === null ? stdout : stdout.slice(0, split.index)
  const text = split === null ? '' : stdout.slice(split.index + split[0].length)

  const headers: Record<string, string> = {}
  for (const line of head.split(/\r?\n/).slice(1)) {
    const colon = line.indexOf(':')
    if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim()
  }

  let body: unknown
  try {
    body = text.trim() === '' ? undefined : JSON.parse(text)
  } catch {
    body = undefined
  }
  return { status: Number(status[1]), headers, body }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** The GraphQL errors of a body, in the order GitHub listed them. */
export function graphQLErrors(body: unknown): ReadonlyArray<GraphQLError> {
  if (!isRecord(body) || !Array.isArray(body.errors)) return []
  return body.errors.filter(isRecord).map((error) => ({
    type: typeof error.type === 'string' ? error.type : undefined,
    message: typeof error.message === 'string' ? error.message : 'unknown GraphQL error',
    path: Array.isArray(error.path) ? (error.path as ReadonlyArray<string | number>) : undefined,
  }))
}

const messageOf = (body: unknown): string | null =>
  isRecord(body) && typeof body.message === 'string' ? body.message : null

const networkTrouble =
  /dial tcp|no such host|proxyconnect|connection refused|connection reset|i\/o timeout|TLS handshake|could not resolve|error connecting to|network is unreachable|EOF/i

const resetAtOf = (headers: Readonly<Record<string, string>>): string | undefined => {
  const seconds = Number(headers['x-ratelimit-reset'])
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString().replace('.000Z', 'Z')
    : undefined
}

/**
 * Names what went wrong with a `gh api graphql` run, or `null` when it did not
 * fail at the transport level. A GraphQL error that is not a rate limit is
 * left to the caller, which knows which errors it tolerates. The order matters:
 * a killed run says nothing else, a missing token needs no body to be read, and
 * a 403 is a limit only when it says so.
 */
export function failureOf(result: ProcessResult, output: GhOutput): GitHubCollectFailed | null {
  const stderr = result.stderr.trim()
  const detail = messageOf(output.body) ?? (stderr === '' ? undefined : stderr)
  const said = (text: string) => (detail === undefined ? text : `${text}: ${detail}`)

  if (result.timedOut) {
    return new GitHubCollectFailed({ reason: 'timeout', message: 'gh did not answer in time' })
  }
  if (result.exitCode === 4 || output.status === 401) {
    return new GitHubCollectFailed({
      reason: 'not-logged-in',
      message: said('gh is not logged in'),
    })
  }

  const retryAfter = Number(output.headers['retry-after'])
  const hasRetryAfter = output.headers['retry-after'] !== undefined && Number.isFinite(retryAfter)
  const secondary = /secondary rate limit/i.test(detail ?? '')
  if ((output.status === 403 || output.status === 429) && (hasRetryAfter || secondary)) {
    return new GitHubCollectFailed({
      reason: 'secondary-limit',
      message: said('GitHub asked the Cockpit to slow down'),
      ...(hasRetryAfter ? { retryAfter } : {}),
    })
  }
  // A 200 that spends the last point is a success; only a refusal or a GraphQL `RATE_LIMITED` error is a spent limit.
  const refused = output.status === 403 || output.status === 429
  const spent =
    graphQLErrors(output.body).some((error) => error.type === 'RATE_LIMITED') ||
    (refused &&
      (output.headers['x-ratelimit-remaining'] === '0' || /rate limit/i.test(detail ?? '')))
  if (spent) {
    const resetAt = resetAtOf(output.headers)
    return new GitHubCollectFailed({
      reason: 'rate-limited',
      message: said('the GitHub rate limit is spent'),
      ...(resetAt === undefined ? {} : { resetAt }),
    })
  }

  if (output.status !== null && output.status >= 500) {
    return new GitHubCollectFailed({
      reason: 'server',
      message: said(`GitHub answered ${output.status}`),
      status: output.status,
    })
  }
  if (output.status === null) {
    if (result.exitCode === 0) {
      return new GitHubCollectFailed({
        reason: 'unexpected-response',
        message: 'gh printed no HTTP response',
      })
    }
    return new GitHubCollectFailed({
      reason: networkTrouble.test(stderr) ? 'network' : 'request-failed',
      message: stderr === '' ? `gh exited with ${result.exitCode}` : stderr,
    })
  }
  if (output.status >= 400) {
    return new GitHubCollectFailed({
      reason: 'request-failed',
      message: said(`GitHub answered ${output.status}`),
    })
  }
  return null
}
