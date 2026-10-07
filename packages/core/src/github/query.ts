/**
 * The GraphQL the scout sends. Both documents are plain text with no
 * interpolated values besides issue numbers, and the recorded fixtures pin
 * them byte for byte: change a character here and the replay finds no
 * recording until the fixtures are recorded again.
 */

/** The label the list asks for, by name: the API matches a label list as an OR and ignores names it does not know. */
export const mapLabels: ReadonlyArray<string> = ['wayfinder:map']

/** A request carries at most this many maps, so one request never grows past a few hundred nodes. */
export const mapsPerRequest = 5

/** The list asks for this many open maps per page. */
export const listPageSize = 100

/**
 * The cheap first request: the open maps, numbers only, and the repository's
 * `wayfinder:` labels for the unknown-labels check. `query` matches a label's
 * name or description, so the caller keeps only names that start with
 * `wayfinder:`.
 */
export const listMapsQuery = `query WayfinderMapList($owner: String!, $repo: String!, $labels: [String!]!, $after: String) {
  repository(owner: $owner, name: $repo) {
    labels(query: "wayfinder:", first: 100) {
      nodes { name }
    }
    issues(labels: $labels, states: [OPEN], first: ${listPageSize}, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes { number }
    }
  }
  rateLimit { remaining resetAt }
}
`

/** The repository a request addresses; `host` is set only when the remote is not on github.com. */
export interface GitHubRepo {
  readonly host?: string | undefined
  readonly owner: string
  readonly repo: string
}

const base = (target: GitHubRepo, query: string): Array<string> => [
  'api',
  'graphql',
  '-i',
  ...(target.host === undefined ? [] : ['--hostname', target.host]),
  '-f',
  `query=${query}`,
  '-f',
  `owner=${target.owner}`,
  '-f',
  `repo=${target.repo}`,
]

/** The arguments of one page of the list request; `after` is the previous page's end cursor. */
export const listMapsArgs = (target: GitHubRepo, after?: string): ReadonlyArray<string> => [
  ...base(target, listMapsQuery),
  ...mapLabels.flatMap((label) => ['-f', `labels[]=${label}`]),
  ...(after === undefined ? [] : ['-f', `after=${after}`]),
]

/** The alias a map's block answers under. */
export const mapAlias = (number: number): string => `m${number}`

/**
 * One aliased `issue(number:)` block per map. A sub-issue connection holds at
 * most 100 children and a dependency list at most 50, so nothing here needs a
 * second page. A closed blocker stays in `blockedBy` with its state.
 */
export function mapsQuery(numbers: ReadonlyArray<number>): string {
  const blocks = numbers
    .map((number) => `    ${mapAlias(number)}: issue(number: ${number}) { ...WayfinderMap }`)
    .join('\n')
  return `query WayfinderMaps($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
${blocks}
  }
  rateLimit { remaining resetAt }
}

fragment WayfinderMap on Issue {
  number
  title
  url
  body
  subIssues(first: 100) {
    nodes {
      number
      title
      url
      state
      body
      labels(first: 50) { nodes { name } }
      assignees(first: 10) { nodes { login } }
      parent { number }
      blockedBy(first: 50) { nodes { number title state url } }
      comments(last: 1) { nodes { author { login } createdAt body } }
    }
  }
}
`
}

/** The arguments of one request for up to {@link mapsPerRequest} maps. */
export const mapsArgs = (
  target: GitHubRepo,
  numbers: ReadonlyArray<number>,
): ReadonlyArray<string> => base(target, mapsQuery(numbers))
