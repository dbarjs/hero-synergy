// PROTOTYPE (#202) — pulls this repo's real maps, specs and build tickets into fixture.json.
// Usage (from packages/vscode): node webview/src/prototype/refresh-fixture.mjs
// Public issues of dbarjs/hero-synergy only; nothing from the private local corpus.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

/** The maps and specs whose children the prototype draws, and the stray ready-for-agent issue. */
const ROOTS = [195, 159, 130, 123, 1, 64, 22, 37, 163, 155]
const LONE = [36]

const ISSUE = `
  number title url state createdAt closedAt body
  labels(first: 10) { nodes { name } }
  assignees(first: 5) { nodes { login } }
  blockedBy(first: 30) { nodes { number } }
  parent { number }
  closedByPullRequestsReferences(first: 5, includeClosedPrs: true) {
    nodes { number title url state isDraft headRefName mergedAt }
  }
  comments(last: 1) { nodes { body createdAt author { login } } }
`

const gql = (query) =>
  JSON.parse(
    execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  ).data.repository

const flat = (node) => ({
  number: node.number,
  title: node.title,
  url: node.url,
  state: node.state.toLowerCase(),
  createdAt: node.createdAt,
  closedAt: node.closedAt,
  body: node.body,
  labels: node.labels.nodes.map((label) => label.name),
  assignees: node.assignees.nodes.map((user) => user.login),
  blockedBy: node.blockedBy.nodes.map((issue) => issue.number),
  parent: node.parent?.number ?? null,
  prs: node.closedByPullRequestsReferences.nodes.map((pr) => ({
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state.toLowerCase(),
    draft: pr.isDraft,
    branch: pr.headRefName,
    mergedAt: pr.mergedAt,
  })),
  lastComment: node.comments.nodes[0]
    ? {
        body: node.comments.nodes[0].body,
        at: node.comments.nodes[0].createdAt,
        author: node.comments.nodes[0].author?.login ?? null,
      }
    : null,
})

const issues = {}
for (const root of ROOTS) {
  const repo = gql(`query { repository(owner: "dbarjs", name: "hero-synergy") {
    issue(number: ${root}) { ${ISSUE} subIssues(first: 60) { nodes { ${ISSUE} } } }
  } }`)
  const issue = repo.issue
  issues[root] = { ...flat(issue), children: issue.subIssues.nodes.map((child) => child.number) }
  for (const child of issue.subIssues.nodes) issues[child.number] = { ...flat(child), children: [] }
}
for (const lone of LONE) {
  const repo = gql(`query { repository(owner: "dbarjs", name: "hero-synergy") {
    issue(number: ${lone}) { ${ISSUE} }
  } }`)
  issues[lone] = { ...flat(repo.issue), children: [] }
}

// Open pull requests from worktree branches, for the build tickets still being built.
const open = JSON.parse(
  execFileSync(
    'gh',
    [
      'pr',
      'list',
      '--repo',
      'dbarjs/hero-synergy',
      '--state',
      'open',
      '--json',
      'number,title,url,headRefName,isDraft,statusCheckRollup,reviewDecision',
    ],
    { encoding: 'utf8' },
  ),
).map((pr) => ({
  number: pr.number,
  title: pr.title,
  url: pr.url,
  branch: pr.headRefName,
  draft: pr.isDraft,
  review: pr.reviewDecision || null,
  checks: pr.statusCheckRollup.some((check) => check.conclusion === 'FAILURE')
    ? 'failing'
    : pr.statusCheckRollup.some((check) => !check.conclusion)
      ? 'pending'
      : 'passing',
}))

const fixture = { readAt: new Date().toISOString(), issues, openPullRequests: open }
writeFileSync(new URL('./fixture.json', import.meta.url), `${JSON.stringify(fixture, null, 1)}\n`)
console.log(`${Object.keys(issues).length} issues, ${open.length} open pull requests`)
