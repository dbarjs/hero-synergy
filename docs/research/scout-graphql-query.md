# Can one GraphQL query collect everything the scout needs?

Research for the ticket [Can one GraphQL query collect everything the scout needs?](https://github.com/dbarjs/hero-synergy/issues/9). Everything below was checked on 2026-10-02 against github.com with `gh` 2.100.0, using this repo's own map ([hero-synergy v0.1.0, fully decided](https://github.com/dbarjs/hero-synergy/issues/1)) as test data. Read-only queries only.

Each claim is marked **[ran]** (I ran it and saw the result), **[schema]** (from live introspection of the GraphQL schema) or **[docs]** (from the linked GitHub page).

## Answer

**Yes.** One `gh api graphql` query returns every field the scout's collect step needs, for every map and ticket, with no preview header. On this repo it returned all 20 issues in one request of 1.6 s and 40 KB, at a cost of 6 rate-limit points.

Three limits on that "yes":

1. **One query, but one request only up to 100 issues.** A page holds at most 100 issues. Closed tickets keep their labels, so a repo with several finished maps will pass 100 and need `--paginate` (6 points per page).
2. **Labels can't be matched by prefix.** The query takes an explicit list of label names. The list is matched as an OR, and names that don't exist in the repo are ignored, so the scout can pass every wayfinder label it knows, including legacy ones.
3. **`updatedAt` does not move when a parent or a blocker is added.** It is not a safe cache key for relationships. See [Differences from the seed](#differences-from-the-seed).

### The query

```graphql
query WayfinderCollect(
  $owner: String!
  $repo: String!
  $labels: [String!]!
  $pageSize: Int = 100
  $endCursor: String
) {
  repository(owner: $owner, name: $repo) {
    # Every label whose name or description contains "wayfinder:".
    # Lets the scout spot wayfinder labels it did not ask for (drift).
    labels(query: "wayfinder:", first: 100) {
      nodes { name }
    }
    # Issues carrying ANY of $labels (the filter is an OR).
    issues(
      labels: $labels
      states: [OPEN, CLOSED]
      first: $pageSize
      after: $endCursor
      orderBy: { field: CREATED_AT, direction: ASC }
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        state
        stateReason
        updatedAt
        body
        labels(first: 50) { totalCount nodes { name } }
        assignees(first: 10) { totalCount nodes { login } }
        parent { number url }
        subIssues(first: 100) { totalCount nodes { number } }
        subIssuesSummary { total completed percentCompleted }
        blockedBy(first: 50) { totalCount nodes { number title state url } }
        blocking(first: 50) { totalCount nodes { number title state url } }
        issueDependenciesSummary { blockedBy totalBlockedBy blocking totalBlocking }
        comments(last: 5) {
          totalCount
          nodes { author { login } createdAt body }
        }
      }
    }
  }
  rateLimit { cost remaining limit nodeCount resetAt }
}
```

Run it (the query saved as `scout.graphql`):

```bash
gh api graphql -F query=@scout.graphql \
  -f owner=dbarjs -f repo=hero-synergy \
  -f 'labels[]=wayfinder:map' -f 'labels[]=wayfinder:research' \
  -f 'labels[]=wayfinder:prototype' -f 'labels[]=wayfinder:grilling' \
  -f 'labels[]=wayfinder:task'
```

Add `--paginate --slurp` when a repo may hold more than 100 wayfinder issues. The output is then an array of pages, and `--jq` can't be combined with `--slurp` **[ran]**.

### Real output, trimmed

A summary of all 20 nodes (one line per issue, built with `jq` from the response) **[ran]**:

```
rateLimit: {"cost":6,"remaining":4832,"limit":5000,"nodeCount":26700,"resetAt":"2026-10-02T20:15:30Z"}
labels:    ["wayfinder:task","wayfinder:grilling","wayfinder:prototype","wayfinder:research","wayfinder:map"]
issues:    {"totalCount":20,"pageInfo":{"hasNextPage":false,...}}

#1  OPEN labels=wayfinder:map       assignees=       parent=null subs=19 blockedBy=[]      blocking=[]
#2  OPEN labels=wayfinder:task      assignees=       parent=1    subs=0  blockedBy=[]      blocking=[14]
#3  OPEN labels=wayfinder:grilling  assignees=       parent=1    subs=0  blockedBy=[]      blocking=[]
#4  OPEN labels=wayfinder:grilling  assignees=       parent=1    subs=0  blockedBy=[]      blocking=[20]
#8  OPEN labels=wayfinder:research  assignees=dbarjs parent=1    subs=0  blockedBy=[]      blocking=[19]
#9  OPEN labels=wayfinder:research  assignees=dbarjs parent=1    subs=0  blockedBy=[]      blocking=[16]
#10 OPEN labels=wayfinder:research  assignees=dbarjs parent=1    subs=0  blockedBy=[]      blocking=[16]
#14 OPEN labels=wayfinder:task      assignees=       parent=1    subs=0  blockedBy=[2]     blocking=[15]
#15 OPEN labels=wayfinder:grilling  assignees=       parent=1    subs=0  blockedBy=[14]    blocking=[]
#16 OPEN labels=wayfinder:prototype assignees=       parent=1    subs=0  blockedBy=[10,9]  blocking=[]
#17 OPEN labels=wayfinder:grilling  assignees=       parent=1    subs=0  blockedBy=[12,11] blocking=[]
#18 OPEN labels=wayfinder:grilling  assignees=       parent=1    subs=0  blockedBy=[13]    blocking=[]
#19 OPEN labels=wayfinder:grilling  assignees=       parent=1    subs=0  blockedBy=[8]     blocking=[20]
#20 OPEN labels=wayfinder:grilling  assignees=       parent=1    subs=0  blockedBy=[19,4]  blocking=[]
```

(#5, #6, #7, #11, #12 and #13 are left out for length; they follow the same pattern.) The map's `subIssues.nodes` came back as `[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]`.

The full node for [Does the scout's interpret step earn its place?](https://github.com/dbarjs/hero-synergy/issues/16), with only the body cut **[ran]**:

```json
{
  "number": 16,
  "title": "Does the scout's interpret step earn its place?",
  "url": "https://github.com/dbarjs/hero-synergy/issues/16",
  "state": "OPEN",
  "stateReason": null,
  "updatedAt": "2026-10-02T19:23:08Z",
  "body": "## Question\n\nDoes the scout's hybrid pipeline (collect with code, interpret with…",
  "labels": { "totalCount": 1, "nodes": [{ "name": "wayfinder:prototype" }] },
  "assignees": { "totalCount": 0, "nodes": [] },
  "parent": { "number": 1, "url": "https://github.com/dbarjs/hero-synergy/issues/1" },
  "subIssues": { "totalCount": 0, "nodes": [] },
  "subIssuesSummary": { "total": 0, "completed": 0, "percentCompleted": 0 },
  "blockedBy": {
    "totalCount": 2,
    "nodes": [
      { "number": 10, "title": "Which wayfinder conventions exist in the wild?", "state": "OPEN", "url": "https://github.com/dbarjs/hero-synergy/issues/10" },
      { "number": 9, "title": "Can one GraphQL query collect everything the scout needs?", "state": "OPEN", "url": "https://github.com/dbarjs/hero-synergy/issues/9" }
    ]
  },
  "blocking": { "totalCount": 0, "nodes": [] },
  "issueDependenciesSummary": { "blockedBy": 2, "totalBlockedBy": 2, "blocking": 0, "totalBlocking": 0 },
  "comments": { "totalCount": 0, "nodes": [] }
}
```

The same facts match the REST endpoints and `gh issue view` (see [REST fallback](#rest-fallback)): children, labels, assignees (the claim on the six research tickets) and blocking edges are all correct.

## Fields, headers and `gh` version

All on the `Issue` object **[schema]**, all returned without any special header **[ran]**:

| Need | GraphQL field | Notes |
| --- | --- | --- |
| Parent (the map) | `parent` → `Issue` | `null` on a map. One parent per issue. |
| Children | `subIssues(first, after)` → `IssueConnection` | No `orderBy` argument. |
| Children count | `subIssuesSummary { total completed percentCompleted }` | |
| Blockers | `blockedBy(first, after, orderBy)` → `IssueConnection` | Default order `DEPENDENCY_ADDED_AT DESC`. |
| Blocked tickets | `blocking(first, after, orderBy)` → `IssueConnection` | Same. |
| Blocker counts | `issueDependenciesSummary { blockedBy totalBlockedBy blocking totalBlocking }` | `total*` is described as "open and closed"; the plain counts are not. |
| Labels | `labels(first)` → `LabelConnection` | |
| Assignees (the claim) | `assignees(first)` → `UserConnection` | |
| Body | `body` | Also `bodyText`, `bodyHTML`. |
| Latest comments | `comments(last: n)` → `IssueCommentConnection` | `last: 5` returned five of an issue's eight comments, oldest first (seen on `cli/cli`; this map has no comments) **[ran]**. |
| State | `state` (`OPEN`, `CLOSED`), `stateReason` | |
| Freshness | `updatedAt` | See the caveat under [Differences from the seed](#differences-from-the-seed). |

**Preview header: none needed.** Introspection and the query both ran with no `GraphQL-Features` header and returned every field **[ran]**. Sending `GraphQL-Features: sub_issues,issue_dependencies` gave the same result **[ran]**. The header was required during the sub-issues public preview ([community discussion 148714](https://github.com/orgs/community/discussions/148714)); sub-issues went generally available on 2025-04-09 and dependencies on 2025-08-21 **[docs]**. The current reference page for `Issue` mentions no preview or header **[docs]**. I found no GitHub page that says in so many words "the header is no longer required"; the evidence is that the query works without it.

**`gh` version: no meaningful minimum for the query.** `gh api graphql` just posts the query, so support depends on the server, not on `gh`. Two flags matter:

- `--paginate` for GraphQL needs the query to accept `$endCursor: String` and select `pageInfo { hasNextPage endCursor }` (`gh api --help`) **[ran]**.
- `--slurp` arrived in `gh` v2.48.0, released 2024-04-17 ([release notes](https://github.com/cli/cli/releases/tag/v2.48.0)).

Installed here: `gh version 2.100.0 (2026-09-03)`.

A higher-level route exists but does need a recent `gh`: since v2.94.0 (2026-06-10), `gh issue view` and `gh issue list` expose `parent`, `subIssues`, `subIssuesSummary`, `blockedBy` and `blocking` as `--json` fields ([release notes](https://github.com/cli/cli/releases/tag/v2.94.0), and the field list printed by `gh issue list --json` on 2.100.0 **[ran]**). I did not evaluate it further: the raw query has no version floor and reports its own cost.

**GitHub Enterprise Server:** the v2.94.0 release notes say "Issue types and sub-issues are available on GitHub.com and GHES 3.17+; relationships require GHES 3.19+". On an older server the `blockedBy` selection would fail the whole query. Not tested; I had no GHES instance.

## Selecting every wayfinder issue

No prefix or wildcard match on labels exists in any of the three routes. What works:

**Recommended: `repository.issues(labels: [...])` with the known names.**

- The list is an **OR**. `labels: ["wayfinder:map", "wayfinder:research"]` returned 7 issues (1 map + 6 research tickets), and the five-label list returned all 20 **[ran]**. `filterBy: { labels: [...] }` behaves the same **[ran]**.
- **Unknown names are ignored, not errors.** `["wayfinder:map", "wayfinder:claimed", "wayfinder:does-not-exist"]` returned just the map **[ran]**. So the scout can always pass a superset: the five current labels plus legacy ones such as `wayfinder:claimed`.
- Pass `states: [OPEN, CLOSED]` explicitly so the result does not depend on a default.
- It finds tickets by label alone, so it still sees tickets wired with the text fallback (`Part of #<map>`) instead of native sub-issues. That matches the seed's rule that labels decide what the scout sees.

**Drift check in the same request: `repository.labels(query: "wayfinder:")`.** It returned exactly the five wayfinder labels **[ran]**. The scout compares that list with the names it asked for; an unexpected `wayfinder:*` label is drift, and a second request can fetch its issues. Two cautions: the `query` argument "searches labels by name and description" **[schema]** (a search for `decision` matched four labels through their descriptions **[ran]**), so filter the result with `startsWith("wayfinder:")` in code.

**Alternatives, and why not:**

| Route | Result | Why not the default |
| --- | --- | --- |
| Label-first, fully dynamic: `labels(query: "wayfinder:") { nodes { issues(...) { ... } } }` | One query, no hardcoded names | Costs **120** points (dry run) against 6, and an issue with two wayfinder labels comes back twice **[ran]**. |
| Map-first: `issues(labels: ["wayfinder:map"]) { nodes { subIssues { nodes { ... } } } }` | One query | Costs **51** points for 10 maps (dry run) **[ran]**, and misses tickets that aren't native sub-issues. |
| `search(type: ISSUE, query: "repo:o/r is:issue label:\"wayfinder:map\",\"wayfinder:research\",…")` | Returned all 20; comma means OR **[ran]** **[docs]** | Capped at 1,000 results **[schema]**; goes through the search index. `label:wayfinder:*` returned 0 **[ran]**. |
| `search(type: ISSUE_ADVANCED, query: "… (label:\"a\" OR label:\"b\")")` | Returned all 20 **[ran]** | Same cap, no advantage. |

## Pagination and rate-limit cost

**Hard limits**

- `first` and `last` must be 1 to 100 **[docs]**. Asking for 101 fails with `EXCESSIVE_PAGINATION` and `repository: null` **[ran]**.
- A call may request at most 500,000 nodes **[docs]**. This query requests 26,700 (`rateLimit.nodeCount`) **[ran]**.
- A parent holds at most 100 sub-issues, nested up to eight levels **[docs]**. So `subIssues(first: 100)` never needs a second page, and a map with more than 100 tickets cannot exist as native sub-issues.
- An issue can be linked to at most 50 issues per relationship type **[docs]**. So `blockedBy(first: 50)` and `blocking(first: 50)` never need a second page.
- Requests that take longer than 10 seconds are terminated **[docs]**. Since 2025-09-01 a single query also has execution resource limits, which return partial data plus errors when exceeded **[docs]**.

Because of the 100 and 50 caps, the only connection that ever paginates is the top-level `issues`. The nested connections select `totalCount` so the scout can assert that nothing was cut (`nodes.length == totalCount`), which also covers labels and assignees.

`gh api --paginate` uses the **first** `pageInfo` it meets in the response ([`findEndCursor` in gh's source](https://github.com/cli/cli/blob/trunk/pkg/cmd/api/pagination.go)). Keep `pageInfo` before `nodes` on the top-level connection and don't select `pageInfo` on nested ones. With `pageSize=8` the query returned three pages (8, 8, 4 issues) correctly **[ran]**.

**Cost**

GitHub's formula: add the requests needed to fulfil each connection, divide by 100, round, minimum 1 **[docs]**. The cost depends on the `first` arguments, not on how many issues exist.

- This query: 1 (`labels`) + 1 (`issues`) + 100 issues × 6 nested connections = 602 requests → **6 points per page of 100** **[ran]**.
- With `pageSize=50`: 302 → **3 points** **[ran]**. With `pageSize=8`: 1 point **[ran]**.
- `remaining` dropped by exactly the reported cost between consecutive runs **[ran]**.
- `rateLimit(dryRun: true)` returns the cost without running the query or spending points **[ran]**.

For a map of around fifty tickets: **one request, 6 points** (or 3 with `pageSize=50`). The budget is 5,000 points per hour per user **[docs]**, so a refresh every minute uses 360 points an hour, about 7%. The secondary limit (2,000 points per minute on the GraphQL endpoint, a query without mutations counting 1) **[docs]** is nowhere near.

**Measured size and time**

| Run | Issues returned | Time | Response | Cost |
| --- | --- | --- | --- | --- |
| This repo, `pageSize=100` | 20 (no comments yet) | 1.6 s | 40 KB | 6 |
| `cli/cli`, labels `bug`+`enhancement`, `pageSize=50` | 50 (227 comments exist, 5 fetched each) | 4.2 s | 101 KB | 3 |
| `cli/cli`, same, `pageSize=100` | 100 | 6.7 s | 271 KB | 6 |

The `cli/cli` runs are a stand-in for a 50-ticket map, since this repo has only 20 issues. They returned no errors, but that repo has 4,745 matching issues, so its timing is a worst case rather than a forecast. 6.7 s is close enough to the 10 s cut-off that `pageSize=50` is the safer default for large repos.

## REST fallback

**REST gives no data that GraphQL lacks for this job.** The ticket's examples all have GraphQL twins: `issue_dependencies_summary` is `issueDependenciesSummary`, `sub_issues_summary` is `subIssuesSummary`, `parent_issue_url` is `parent`, and the `/sub_issues`, `/dependencies/blocked_by` and `/dependencies/blocking` lists are `subIssues`, `blockedBy` and `blocking`. Values matched on this map **[ran]**.

What REST does offer:

- **Conditional requests.** REST responses carry an `ETag`; resending it as `If-None-Match` returned `304 Not Modified` **[ran]**, and a 304 does not count against the primary rate limit **[docs]**. GraphQL has no equivalent.
- **A separate rate-limit bucket.** `GET /rate_limit` lists `core` and `graphql` as separate resources of 5,000 each **[ran]**.
- **Per-feature degradation.** On a server without dependencies, the REST list still works and only the `/dependencies/*` calls fail, whereas one unknown GraphQL field fails the whole query. Not tested (no old server available).

Endpoints, all verified against this map **[ran]**:

| Endpoint | Returns |
| --- | --- |
| `GET /repos/{o}/{r}/issues?state=all&labels=<one label>&per_page=100` | Issues with `labels`, `assignees`, `body`, `state`, `state_reason`, `updated_at`, `comments` (a count), `parent_issue_url`, `sub_issues_summary`, `issue_dependencies_summary`. |
| `GET /repos/{o}/{r}/issues/{n}/sub_issues` | The children as full issue objects (#1 → #2 to #20). |
| `GET /repos/{o}/{r}/issues/{n}/parent` | The parent issue (#9 → #1). |
| `GET /repos/{o}/{r}/issues/{n}/dependencies/blocked_by` | The blockers (#16 → #9, #10). |
| `GET /repos/{o}/{r}/issues/{n}/dependencies/blocking` | The blocked issues (#9 → #16). |
| `GET /repos/{o}/{r}/issues/{n}/comments` | Comments (not run; no comments exist here). |

Costs of the fallback:

- **`labels=a,b` is an AND**, the opposite of GraphQL: `labels=wayfinder:map,wayfinder:research` returned `[]` **[ran]**. So it takes one list call per label, or one unfiltered list filtered in code (which does allow a prefix match, but also returns pull requests **[docs]**).
- The list gives the parent and the counts but not the edges, so add one `blocked_by` call per ticket whose `issue_dependencies_summary.total_blocked_by > 0`, one `sub_issues` call per map, and one comments call per issue with `comments > 0`. For this map: 5 + 7 + 1 = 13 requests against 1.
- `per_page` defaults to 30 and tops out at 100 on all of these **[docs]**.

## Differences from the seed

1. **`updatedAt` is not a safe change signal for relationships.** The seed's step 2 sends only "maps and tickets whose `updatedAt` (or file hash) changed". On [Does the scout's interpret step earn its place?](https://github.com/dbarjs/hero-synergy/issues/16), `createdAt` and `updatedAt` are both `2026-10-02T19:23:08Z`, yet its timeline shows `parent_issue_added` at 19:23:43 and two `blocked_by_added` at 19:23:54 and 19:23:56 **[ran]**. Adding a parent or a blocker did not move `updatedAt` (REST `Last-Modified` stayed at 19:23:08 too). So:
   - `updatedAt` is fine as the cache key for the interpret step, which reads body and comments.
   - Parents, children, blockers must be taken from every fresh collect, never from the cache. That fits the seed's step 3 ("API facts win").
   - An incremental collect with `filterBy: { since: … }` (it exists and works **[ran]**) would miss new edges. Collect everything each time; at 6 points it is cheap.
2. **"In one `gh api graphql` query" holds per 100 issues.** The seed's pipe `gh api graphql -f query="$WAYFINDER_QUERY" | claude -p …` is right for one page. Past 100 wayfinder issues it needs `--paginate --slurp`, and the output becomes an array of pages.
3. **"Every issue with a `wayfinder:` label" can't be expressed as a prefix.** The query needs the label names as a variable. Not a contradiction of intent, but the seed's sample command has no variables.
4. The ticket assumed REST had fields GraphQL lacks (`issue_dependencies_summary`). It doesn't; see [REST fallback](#rest-fallback).

Nothing else in the seed's scout section is contradicted: number, title, state, labels, assignees, sub-issues, blockers, body, latest comments and `updatedAt` are all available.

## Not verified

- **Closed blockers.** Every blocker on this map is open, so I could not see whether a closed blocker stays in `blockedBy.nodes`. The schema describes `issueDependenciesSummary.totalBlockedBy` as "open and closed" and `blockedBy` without that phrase, which suggests the plain count is open blockers only. The query selects `state` on each blocker so the scout can decide for itself. Two attempts to find a public example through search failed.
- **Whether closing a blocker, or adding a comment, moves `updatedAt`.** No mutations were allowed and the map has no comments.
- **Whether `subIssues` comes back in map order.** It returned #2 to #20, which is both creation order and the order they were added. The connection has no `orderBy`, and sub-issues can be reprioritized, so list position is the likely order, but a reordered map was not available to prove it. The frontier's "first one in map order" depends on this.
- **Cross-repository parents and blockers.** Not present here. `url` is selected on each so the scout can tell.
- **GitHub Enterprise Server** behaviour, and the behaviour of the query on a server without dependencies.
- **A real 50-ticket map.** Cost is certain (it is computed from the query). Time and size were estimated from `cli/cli`.
- **Rate-limit bookkeeping.** `GET /rate_limit` reported `graphql.used: 1` throughout, while the query's own `rateLimit` field showed usage climbing as expected. I could not explain the mismatch; the `rateLimit` field in the query is the one that tracked reality. The token was also shared with other sessions, so absolute `remaining` values are noisy.
- Web pages were read through a fetch tool that summarises; the quoted numbers (100 sub-issues, eight levels, 50 dependencies, 500,000 nodes, 5,000 and 2,000 points, 10 seconds) come from those summaries of the linked pages.

## Sources

GitHub documentation and changelog:

- GraphQL reference, Issues (the `Issue` object and its fields): <https://docs.github.com/en/graphql/reference/issues>
- Rate limits and query limits for the GraphQL API: <https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api>
- GraphQL API resource limits (2025-09-01): <https://github.blog/changelog/2025-09-01-graphql-api-resource-limits/>
- Adding sub-issues (100 per parent, eight levels): <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues>
- Dependencies on issues, generally available (50 per relationship type): <https://github.blog/changelog/2025-08-21-dependencies-on-issues/>
- Evolving GitHub Issues and Projects, sub-issues generally available (2025-04-09): <https://github.blog/changelog/2025-04-09-evolving-github-issues-and-projects/>
- Sub-issues public preview, the old `GraphQL-Features: sub_issues` header: <https://github.com/orgs/community/discussions/148714>
- Searching issues and pull requests (`label:a,b` is an OR): <https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests>
- REST, sub-issues: <https://docs.github.com/en/rest/issues/sub-issues>
- REST, issue dependencies: <https://docs.github.com/en/rest/issues/issue-dependencies>
- REST, list repository issues: <https://docs.github.com/en/rest/issues/issues#list-repository-issues>
- REST best practices, conditional requests: <https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api>

GitHub CLI:

- `gh` v2.94.0 release notes (issue JSON fields, GHES versions): <https://github.com/cli/cli/releases/tag/v2.94.0>
- Changelog for the same release: <https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/>
- `gh` v2.48.0 release notes (`--slurp`): <https://github.com/cli/cli/releases/tag/v2.48.0>
- `gh api` pagination source (`findEndCursor`): <https://github.com/cli/cli/blob/trunk/pkg/cmd/api/pagination.go>
- `gh api --help` on gh 2.100.0 (manual: <https://cli.github.com/manual/gh_api>)

Own results, 2026-10-02, against <https://github.com/dbarjs/hero-synergy> and <https://github.com/cli/cli>:

- Schema introspection through `gh api graphql` (`__schema { types { fields { args } } }`), with no extra headers.
- The query above, plus the selection, pagination, dry-run cost and timeline experiments described in each section.
- REST calls: `issues/16`, `issues/16/dependencies/blocked_by`, `issues/9/dependencies/blocking`, `issues/1/sub_issues`, `issues/9/parent`, `issues/16/timeline`, `issues?labels=…`, `rate_limit`.
