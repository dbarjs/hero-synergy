# What can GitHub's API report about specs, build tickets and their pull requests, and at what cost?

Research for the ticket [#198 What can GitHub's API report about specs, build tickets and their pull requests, and at what cost?][198], a child of the map [#195 Specs and build tickets in the Cockpit][195]. Everything below was checked on 2026-11-16 between 19:15 and 19:45 UTC against github.com with `gh` 2.100.0, logged in as the repo owner, on this repo's own issues and pull requests. Read-only requests only: no mutation, no edit.

Each claim is marked:

- **[ran]**: I ran the query on that date and saw the result.
- **[schema]**: from live introspection of the GraphQL schema (`__schema { types { … } }`, same date).
- **[docs]**: from the linked GitHub page, read as its Markdown source in `github/docs`.
- **[skill]**: from the text of Matt Pocock's skills at tag `v1.3.2`.

The words are the glossary's: a **spec** is the issue `/to-spec` publishes, a **build ticket** is a ticket of a spec, a **decision ticket** is a ticket of a map. An issue labelled `ready-for-agent` with no parent and no children is called a lone issue below.

One pull request merged while I measured: [#207 Read every Blocked by and Blocks form a local tracker holds (#173)][pr207] at 19:30:18 UTC. So its build ticket, [#173 Read every Blocked by and Blocks form a local tracker holds][173], was read both before and after the merge.

## Answer

1. **Nothing in the API marks a spec.** No label, no issue type, no field. A spec is recognised by position: an issue that carries the `ready-for-agent` label and has no parent. If it has sub-issues, it is a spec with build tickets. If it has none, the API cannot tell a spec that has not been split yet from a lone `ready-for-agent` issue; only the body can (the seven headings of the spec template).
2. **The cheapest route that lists every open spec** is one more connection in the list request the scout already sends: `issues(labels: ["ready-for-agent"], states: [OPEN])` with `parent { number }` and `subIssuesSummary`. The request still costs **1 point**. It brings back open specs, a spec with no build tickets yet, and lone issues; it leaves closed specs out.
3. **The scout's fragment reads a spec's build tickets unchanged**, at **4 points per spec** (not 5: see [Cost](#4-cost)). It lacks the pull request, `stateReason`, and the spec's own state.
4. **`closedByPullRequestsReferences` links a build ticket to its pull request**, from the second the pull request is opened (a draft too) until after the merge. Reading it on every build ticket, with the pull request's draft flag, state, checks and review, costs **1 more point per spec**. The link exists only when the pull request's description holds a closing keyword (`Closes #n`) and the pull request targets the default branch. On [#37 Spec: hero-synergy v0.1.0, the Cockpit][37], 6 of 26 build tickets have no linked pull request.
5. **A pushed `worktree-<n>` branch with no pull request is invisible from the issue.** It is found only by its name.
6. **Cost for a repo with 45 maps and 45 specs, 7 of each open:** 29 points per collect today, 57 with specs, 64 with each build ticket's pull request. At one collect a minute that is 3,840 points an hour, 160 short of the line where [#27 What is the scout's budget: refresh cadence, caching and rate limits?][27] pauses automatic refreshes.

## Test data

State at 19:15 UTC, read with one survey query over all 147 issues **[ran]**.

| Issue | What it is | State | Sub-issues closed / total | Labels |
| --- | --- | --- | --- | --- |
| [#37 Spec: hero-synergy v0.1.0, the Cockpit][37] | spec | closed | 26 / 26 | `ready-for-agent` |
| [#163 Read a local tracker's state in every form a real five-month tracker holds][163] | spec | open | 2 / 11, then 3 / 11 after 19:30 | `ready-for-agent` |
| [#155 Launch AFK sessions with permissions bypassed in isolated environments][155] | spec built with no build tickets | closed | 0 / 0 | `ready-for-agent` |
| [#36 Write the upstream-review skill][36] | lone issue: no parent, no children | open | 0 / 0 | `ready-for-agent` |
| [#1 hero-synergy v0.1.0, fully decided][1] | map that led to the spec above | closed | 33 / 33 | `wayfinder:map` |
| [#123 Launch AFK sessions with permissions bypassed in isolated environments][123] | map that led to the ticketless spec | closed | 5 / 5 | `wayfinder:map` |
| [#130 State reading for local trackers, tested against a real five-month tracker][130] | map that led to the open spec | closed | 10 / 10 | `wayfinder:map` |
| [#173 Read every Blocked by and Blocks form a local tracker holds][173] | build ticket with an open pull request, merged at 19:30 | open, then closed | 0 / 0 | `ready-for-agent` |
| [#168 Move the snapshot to schema 2: the new ticket fields and unmapped groups][168] | build ticket closed by a merged pull request | closed | 0 / 0 | `ready-for-agent` |
| [#56 Build the canary that files upstream breaks][56] | build ticket with four merged pull requests and no closing keyword | closed | 0 / 0 | `ready-for-agent` |
| [#164 Create and install the dbarjs-agent App][164] | decision ticket with a pushed `worktree-164` branch and no pull request | open | 0 / 0 | `wayfinder:task` |

The repo held 38 open issues, 41 issues labelled `ready-for-agent` (11 open), 7 maps (2 open), 3 open pull requests and 43 branches whose name starts with `worktree-` **[ran]**.

Two facts about how specs get here **[skill]**:

- `/to-spec` says "Apply the `ready-for-agent` triage label". `/to-tickets` says "If the source was an existing issue, make each ticket its sub-issue" and "Apply the `ready-for-agent` triage label unless instructed otherwise", then "Do NOT close or modify any parent issue".
- Neither skill sets an issue type or writes a link back to the map. The three specs here name their map in their first sentence ("From the map …", "Produced by `/to-spec` from the finished map …"); that is this repo's habit, not the template's.

## 1. Finding specs

### What the API says about a spec

- **Labels.** Only `ready-for-agent`, the same label its build tickets carry **[ran]**.
- **Issue type.** `issueType` is `null` on the spec and on its build tickets. The repo offers three types (`Task`, `Bug`, `Feature`) although a user owns it, so a type could mark a spec, but nothing sets one **[ran]**.
- **Parent and children.** `parent` is `null`; `subIssuesSummary` counts the build tickets **[ran]**. `IssueFilters`, the filter of `repository.issues`, has no field for parent or sub-issues **[schema]**, so "has children" can't be asked of the list; it is read off each node.
- **Body.** All three specs carry the template's seven H2s (`Problem Statement`, `Solution`, `User Stories`, `Implementation Decisions`, `Testing Decisions`, `Out of Scope`, `Further Notes`). The lone issue carries none of them. The two build tickets read carry `Parent`, `What to build`, `Acceptance criteria`, `Blocked by` **[ran]**.
- **Title.** One of the three starts with `Spec:` **[ran]**.

### Route A: the label list (recommended)

```graphql
query SpecsByLabel($owner: String!, $repo: String!, $labels: [String!]!, $states: [IssueState!], $after: String, $dryRun: Boolean = false) {
  repository(owner: $owner, name: $repo) {
    issues(labels: $labels, states: $states, first: 100, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        state
        parent { number }
        subIssuesSummary { total completed percentCompleted }
      }
    }
  }
  rateLimit(dryRun: $dryRun) { cost remaining nodeCount }
}
```

Run with `-f 'labels[]=ready-for-agent' -f 'states[]=OPEN'`.

- **Returns [ran]:** 11 issues. Two have no parent: the open spec (2 of 11 closed) and the lone issue (0 of 0). The other nine are the spec's open build tickets, each with the spec's number in `parent.number`.
- **Cost [ran]:** 1 point, 100 nodes, the same under `rateLimit(dryRun: true)`. `subIssuesSummary` is a plain object, so it adds nothing. Asking `subIssues(first: 1) { totalCount }` instead gives the same counts for 1 point and 200 nodes.
- **A spec with no build tickets yet:** comes back, but looks exactly like a lone issue (no parent, 0 of 0).
- **Closed specs:** left out. With `-f 'states[]=CLOSED'` added the list holds 41 issues, 4 without a parent: the two above plus the two closed specs, still 1 point **[ran]**.
- **Built but still open:** the closed spec stayed open for 39 days with 26 of 26 closed (last build ticket closed 2026-10-08, spec closed by hand 2026-11-16) **[ran]**. This route returns such a spec as open; `percentCompleted: 100` tells it apart.
- **Misses:** a spec that lost the label (the label is an instruction to the session that publishes it, and `/triage` moves labels), and a repo that renamed the label unless the scout passes the string from `docs/agents/triage-labels.md`.
- **Pages:** the list also holds every open build ticket, so a repo with seven open specs of fifteen open tickets each needs two pages (1 point each).

**It fits in the request the scout already sends.** The scout's list request with two more connections, the spec candidates and the open pull requests of [route P2](#route-p2-the-open-pull-requests-list), still cost 1 point (1,400 nodes, 1.2 s) **[ran]**:

```graphql
query MapsAndSpecs($owner: String!, $repo: String!, $mapLabels: [String!]!, $specLabels: [String!]!, $dryRun: Boolean = false) {
  repository(owner: $owner, name: $repo) {
    labels(query: "wayfinder:", first: 100) {
      nodes { name }
    }
    maps: issues(labels: $mapLabels, states: [OPEN], first: 100, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes { number }
    }
    specs: issues(labels: $specLabels, states: [OPEN], first: 100, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        parent { number }
        subIssuesSummary { total completed percentCompleted }
      }
    }
    pullRequests(states: [OPEN], first: 100, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        isDraft
        headRefName
        baseRefName
        reviewDecision
        mergeable
        statusCheckRollup { state }
        closingIssuesReferences(first: 10) { nodes { number } }
      }
    }
  }
  rateLimit(dryRun: $dryRun) { cost nodeCount remaining resetAt }
}
```

Two connections now paginate in one request, and `gh api --paginate` follows only the first `pageInfo` it meets, so second pages need their own requests.

The same list through the CLI, with no cost report: `gh issue list --label ready-for-agent --state open --json number,title,parent,subIssuesSummary,closedByPullRequestsReferences` **[ran]**. Those JSON fields need `gh` 2.94.0 or later ([release notes][gh-2940]).

### Route B: every open issue, by structure

```graphql
query OpenParents($owner: String!, $repo: String!, $after: String, $dryRun: Boolean = false) {
  repository(owner: $owner, name: $repo) {
    issues(states: [OPEN], first: 100, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        parent { number }
        subIssuesSummary { total completed percentCompleted }
        labels(first: 20) { nodes { name } }
      }
    }
  }
  rateLimit(dryRun: $dryRun) { cost remaining nodeCount }
}
```

- **Returns [ran]:** all 38 open issues. Three have sub-issues: the two open maps and the open spec. A parent without `wayfinder:map` is a spec, whatever its labels.
- **Cost [ran]:** 1 point, 2,100 nodes per page of 100 open issues.
- **Misses:** a spec with no build tickets. Five open issues have neither parent nor children here, and nothing but a label separates them.
- **Why not:** its cost follows the repo's open issues, not its specs. A repo with 2,000 open issues pays 20 points to find one spec.

### Route C: the search qualifiers

```graphql
query SearchIssues($q: String!, $type: SearchType = ISSUE, $dryRun: Boolean = false) {
  search(query: $q, type: $type, first: 100) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      __typename
      ... on Issue {
        number
        title
        state
        parent { number }
        subIssuesSummary { total completed percentCompleted }
      }
      ... on PullRequest { number title state isDraft headRefName baseRefName }
    }
  }
  rateLimit(dryRun: $dryRun) { cost remaining nodeCount }
}
```

Every search below cost 1 point and 100 nodes **[ran]**. Each query started with `repo:dbarjs/hero-synergy is:issue`; the repo had 38 open issues, 3 of them with sub-issues, 30 with a parent and 8 with none.

| Qualifiers | `type: ISSUE` | `type: ISSUE_ADVANCED` | Reading |
| --- | --- | --- | --- |
| `is:open has:sub-issue` | 38 | 3 | works under advanced search only |
| `is:open has:sub-issues` | 38 | 38 | plural: ignored |
| `is:open has:parent-issue` | 38 | 30 | works under advanced search only |
| `is:open no:parent-issue` | 8 | not run alone | works |
| `is:open no:sub-issue` and `no:sub-issues` | 35 | not run | works, both spellings |
| `is:open -no:parent-issue`, `is:open -no:sub-issue` | 38 | 38 (`-no:sub-issue`) | negation: ignored |
| `parent-issue:dbarjs/hero-synergy#163` | 11 | not run | the spec's children, open and closed |
| `sub-issue:dbarjs/hero-synergy#173` | 1 | not run | the build ticket's parent |
| `is:open no:parent-issue label:"ready-for-agent"` | 2 | 2 | the same two issues as route A |
| `is:open has:sub-issue -label:"wayfinder:map"` | not run | 1 | the open spec, exactly |
| `has:sub-issue -label:"wayfinder:map"` | not run | 2 | the open spec and the closed one |
| `is:open linked:pr` | 1 | not run | open issues a pull request will close |

- **One request for open specs:** yes, `is:open has:sub-issue -label:"wayfinder:map"` under `ISSUE_ADVANCED`, with no label on the spec needed.
- **A spec with no build tickets yet:** missed by `has:sub-issue`; `no:parent-issue label:…` finds it mixed with lone issues, as route A does.
- **Closed specs:** only when `is:open` is dropped.
- **Why not the default:**
  - A qualifier the search does not know is **ignored, not refused**: `has:sub-issue` under `type: ISSUE` returned all 38 open issues with no error **[ran]**. A wrong type or a change on GitHub's side widens the answer silently.
  - `has:sub-issue`, `has:parent-issue`, `no:parent-issue`, `no:sub-issue` and `sub-issue:` are in neither [Searching issues and pull requests][docs-search] nor [Filtering and searching issues and pull requests][docs-filter]; `parent-issue:` is documented for Projects views only ([About parent issue and sub-issue progress fields][docs-parent-field]) **[docs]**. `linked:pr` and `linked:issue` are documented **[docs]**.
  - `ISSUE_ADVANCED` came with the [2025-03-06 changelog][changelog-advanced] ("For GraphQL, you can use the ISSUE_ADVANCED type") **[docs]**.
  - A search returns at most 1,000 results **[schema]** and reads a search index, whose lag I did not measure.

### Route D: the walk from each map through its cross-references

```graphql
fragment Refs on Issue {
  number
  state
  timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: 100) {
    totalCount
    nodes {
      ... on CrossReferencedEvent {
        source {
          __typename
          ... on Issue {
            number
            state
            parent { number }
            subIssuesSummary { total }
            labels(first: 10) { nodes { name } }
          }
          ... on PullRequest { number }
        }
      }
    }
  }
}

query MapCrossRefs($owner: String!, $repo: String!, $dryRun: Boolean = false) {
  repository(owner: $owner, name: $repo) {
    m1: issue(number: 1) { ...Refs }
    m123: issue(number: 123) { ...Refs }
    m130: issue(number: 130) { ...Refs }
    m195: issue(number: 195) { ...Refs }
  }
  rateLimit(dryRun: $dryRun) { cost nodeCount remaining }
}
```

- **Returns [ran]:** every issue and pull request that mentions the map.
  - The first map: 16 references; 11 from issues that are not its children, one of them its spec.
  - The second: 2 references, one of them its spec, the one with no build tickets.
  - The third: 14 references, 8 from pull requests, 6 from issues: its spec, two of that spec's build tickets and three others.
  - Keeping only sources that carry `ready-for-agent` and have no parent leaves exactly the three specs.
- **Cost:** 1 point and 400 nodes for four maps **[ran]**; 1 point and 4,500 nodes for 45 maps (dry run) **[ran]**. The count is 100 nodes per map, so the `labels` connection under the union's inline fragment is not counted.
- **What only this route gives:** which map a spec came from, and a spec with no build tickets told apart from a lone issue (it mentions a map).
- **Closed specs:** always come back; a cross-reference keeps a closed source.
- **Misses:**
  - A spec that does not mention its map. The template has no such line **[skill]**.
  - A spec with no map. The map's notes say an idea small enough for one session starts at `/grill-with-docs` instead.
  - Every spec, if the walk starts from open maps: all three source maps are closed **[ran]**, because a map is finished before its spec exists. The walk must start from closed maps too, which the scout does not list today (1 point per 100 closed maps to list them).

### The routes side by side

| Route | Open specs in one request | A spec with no build tickets yet | Built and closed specs | Points |
| --- | --- | --- | --- | --- |
| A: label list, no parent | yes, per 100 open `ready-for-agent` issues | found, not told from a lone issue | only with `CLOSED` in `states` | 1 per page; 0 extra inside the scout's list request |
| B: every open issue | yes, per 100 open issues | not told from any parentless issue | only with `CLOSED` in `states` | 1 per 100 open issues in the repo |
| C: `has:sub-issue` search | yes, up to 1,000 results | missed | only without `is:open` | 1 per page |
| D: cross-reference walk | no: one block per map, closed maps included | found, if its body names the map | always | 1 per 45 maps, plus the list of closed maps |

## 2. Reading a spec's build tickets with the scout's fragment

The scout's query for a map, from `mapsQuery` in `packages/core/src/github/query.ts` (unchanged since commit `f37446f`), with the spec's number in place of a map's and `cost nodeCount` added to `rateLimit` for the measurement:

```graphql
query WayfinderMaps($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    m163: issue(number: 163) { ...WayfinderMap }
  }
  rateLimit { cost nodeCount remaining resetAt }
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
```

**It reads a spec's children unchanged [ran].** No field failed, and every field came back in the shape a map's children have. The answers were read by a script, not run through the decoder in `collect.ts`.

| Spec | Children | Time | Response | Cost | Nodes |
| --- | --- | --- | --- | --- | --- |
| [#163 Read a local tracker's state in every form a real five-month tracker holds][163] | 11 | 0.75 s | 101 KB | 4 | 11,200 |
| [#37 Spec: hero-synergy v0.1.0, the Cockpit][37] | 26 | 1.09 s | 186 KB | 4 | 11,200 |

What came back, per build ticket **[ran]**:

- **State:** `OPEN` or `CLOSED`.
- **Triage role:** the `ready-for-agent` label on all 37.
- **Claim:** the assignee. Under the open spec, the three tickets built or in flight had one and the eight untouched ones had none; all 26 under the closed spec had one.
- **Parent:** the spec's number.
- **Blockers:** native edges, closed blockers kept with `state: CLOSED`, up to six on one ticket.
- **Last comment:** present on 19 of 37.
- **Body:** 1.4 to 5 KB, with the acceptance criteria as task-list lines. The API has no field for a body's checked and unchecked boxes **[schema]**, so they are read from `body`.

The spec bodies are 55 KB and 63 KB, about a third to a half of each response.

### What the fragment lacks for a spec

- **The pull request.** `closedByPullRequestsReferences` is not selected. See [section 3](#3-pull-requests).
- **`stateReason`.** `COMPLETED`, `NOT_PLANNED` or `DUPLICATE` **[schema]**. A build ticket closed as not planned was not built. All 29 closed build tickets here are `COMPLETED` **[ran]**.
- **The spec's own facts.** The fragment selects `number title url body` on the parent. A map needs no more: the list has already filtered on its label and state. A spec read by number would also want `state`, `stateReason`, `labels`, `assignees`, `parent` and `subIssuesSummary`; route A's list gives `state`, `parent` and the summary for nothing.
- **A resolution for a ticket closed by a merge.** 12 of the 29 closed build tickets have no comment at all (9 of 26 under the closed spec, 3 of 3 under the open one) **[ran]**. A decision ticket's answer is its last comment; a build ticket's is often its pull request.

### Order

`subIssues` came back in the parent's own order, not by number or creation time: under the open spec, [#170 Record the wild forms in the upstream register and watch the local template][170] was created third and came back ninth, after six tickets with higher numbers **[ran]**. The eleven `SubIssueAddedEvent`s fall within three seconds, and the list order agrees with the order of addition as far as their timestamps can show. This is the first list seen on this repo that is out of creation order; [#9 Can one GraphQL query collect everything the scout needs?][9] had left the question open.

## 3. Pull requests

### What links a build ticket to its pull request

**`Issue.closedByPullRequestsReferences`** (and its mirror, `PullRequest.closingIssuesReferences`) is the link **[schema]**:

```graphql
closedByPullRequestsReferences(
  includeClosedPrs: Boolean = false
  orderByState: Boolean = false
  userLinkedOnly: Boolean = false
  excludeUserLinked: Boolean = false
  first: Int, last: Int, after: String, before: String
): PullRequestConnection
```

The query that read it on eight issues at once (1 point, 320 nodes) **[ran]**:

```graphql
fragment PR on PullRequest {
  number
  state
  isDraft
  merged
  mergedAt
  closedAt
  headRefName
  baseRefName
}

fragment Links on Issue {
  number
  state
  stateReason
  closedAt
  default: closedByPullRequestsReferences(first: 10) { totalCount nodes { ...PR } }
  withClosed: closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { totalCount nodes { ...PR } }
  userLinked: closedByPullRequestsReferences(first: 10, includeClosedPrs: true, userLinkedOnly: true) { totalCount nodes { ...PR } }
  linkedBranches(first: 10) { totalCount nodes { ref { name } } }
}

query ClosedBy($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    i173: issue(number: 173) { ...Links }
    i168: issue(number: 168) { ...Links }
    i132: issue(number: 132) { ...Links }
    i56: issue(number: 56) { ...Links }
    i43: issue(number: 43) { ...Links }
    i164: issue(number: 164) { ...Links }
    i163: issue(number: 163) { ...Links }
    i37: issue(number: 37) { ...Links }
  }
  rateLimit { cost nodeCount remaining }
}
```

What makes the link, and what does not:

- **A closing keyword in the pull request's description** (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`, then `#n`) links the two when the pull request is opened **[docs]** ([Linking a pull request to an issue][docs-linking]). Every link on this repo is of this kind: `userLinkedOnly: true` returned nothing on all eight issues **[ran]**.
- **Only against the default branch.** "If the pull request targets any other branch, then these keywords are ignored, no links are created, and merging the PR has no effect on the issues" **[docs]**. On `microsoft/vscode`, 28 of 29 pull requests whose body holds a closing keyword and whose base is not `main` have an empty `closingIssuesReferences`; all 39 sampled on `main` have a link **[ran]**. The one exception, [microsoft/vscode#343811 Add `files.watcherExcludeGitIgnore` to stop watching gitignored paths][vscode343811], was opened against `main` and retargeted later (a `BaseRefChangedEvent`), and kept its link **[ran]**.
- **A mention without a keyword does not link.** The four pull requests of [#56 Build the canary that files upstream breaks][56] all name it and none links to it: `closedByPullRequestsReferences` is empty with and without closed pull requests **[ran]**.
- **A keyword in a commit message closes the issue but is not this link:** "the pull request that contains the commit will not be listed as a linked pull request" **[docs]**. The two closing commits read here carry `Closes #<n>`, and so do the descriptions of their pull requests **[ran]**, so the case was not seen on its own.
- **A manual link** from the Development sidebar joins up to ten issues to a pull request **[docs]**. None exists on this repo.
- **Upstream writes no keyword.** The `/pr` template has three sections and no `Closes` line, and `/implement` ends with "Commit your work to the current branch" **[skill]**. `Closes #<n>` is this repo's own convention.

**The other signals:**

| Signal | What it reports | Seen here |
| --- | --- | --- |
| `timelineItems(itemTypes: [CROSS_REFERENCED_EVENT])` → `CrossReferencedEvent { source willCloseTarget }` | every issue or pull request that mentions this one; `willCloseTarget` is true while an open pull request will close it | true for the open pull request at 19:21, false for the same event after the merge, false for every mention **[ran]** |
| `CLOSED_EVENT` → `ClosedEvent { closer }`, a `PullRequest`, a `Commit` or `null` **[schema]** | what closed the issue | a `PullRequest` on two issues; a `Commit` on three (the two commit messages read carry the keyword themselves); `null` on three closed by hand **[ran]** |
| `CONNECTED_EVENT`, `DISCONNECTED_EVENT` | a manual link made or removed | none on this repo |
| `REFERENCED_EVENT` → `ReferencedEvent { commit }` | a commit message that names the issue | the merge commit, after the merge **[ran]** |
| `linkedBranches` | branches made for the issue with "Create a branch" or `gh issue develop`; the link gives way to the pull request once one opens **[docs]** ([Creating a branch to work on an issue][docs-branch]) | 0 on all eight issues: a `worktree-<n>` branch pushed with `git push` is not a linked branch **[ran]** |
| search `linked:pr`, `linked:issue` **[docs]** | open issues with a closing pull request; pull requests that close an issue | one issue and one pull request, the pair above **[ran]** |
| REST | the issue object has no closing-pull-request field; `GET …/issues/{n}/timeline` has `cross-referenced` with `source.issue.pull_request` and no will-close flag; `GET …/pulls?head={owner}:{branch}&state=all` finds a pull request by branch | **[ran]**; event types in [Issue event types][docs-events] |
| `gh issue view --json closedByPullRequestsReferences` | the default arguments, so closed, unmerged pull requests are left out | **[ran]** on `cli/cli` |

### When the link exists

| Moment | `closedByPullRequestsReferences` on the build ticket | Evidence |
| --- | --- | --- |
| Not started | empty | the eight untouched tickets of the open spec **[ran]** |
| Branch pushed, no pull request | empty; `linkedBranches` empty; no timeline event, though the commit message names the issue | [#164 Create and install the dbarjs-agent App][164] and `worktree-164` **[ran]** |
| Draft pull request open | the pull request, `state: OPEN`, `isDraft: true` | [cli/cli#15019 `gh run view --log` silently drops the rest of a step after a log line longer than 64 KiB][cli15019] and its draft [cli/cli#15065 Fix workflow log truncation after long lines][cli15065] **[ran]** |
| Pull request open | the pull request, `state: OPEN`; the cross-reference event is stamped one second after the pull request's `createdAt` | [#173 Read every Blocked by and Blocks form a local tracker holds][173] at 19:21 **[ran]** |
| Merged | the same pull request, `state: MERGED`, with the default arguments; the issue closed within two seconds of `mergedAt` with `stateReason: COMPLETED` and no comment | the same ticket at 19:35, and [#168 Move the snapshot to schema 2: the new ticket fields and unmapped groups][168] **[ran]** |
| Closed without merging | nothing with the default arguments; the pull request with `includeClosedPrs: true` | [cli/cli#13906 `gh issue list --search --limit N` (N>100) over-fetches a full extra page][cli13906]: 0 by default, 7 closed ones with the flag **[ran]** |
| Reopened and closed again | one entry per pull request | [#132 A sanitized mirror of the real tracker, with its truth][132]: two merged pull requests **[ran]** |
| Pull request with no keyword, or against another branch | empty, at every moment | above |

Three details that bite:

- **The field's description is wrong about merged pull requests.** The schema says "List of open pull requests referenced from this issue"; with the default arguments it returns merged ones too, and leaves out only those closed without merging **[ran]**.
- **Order.** The list is by number, oldest first. `orderByState: true` puts the open pull request first **[ran]** ([cli/cli#9789 `gh auth login --with-token` hangs][cli9789]: five closed and one open). With `includeClosedPrs: true` and a small `first`, ask for `orderByState: true` or the open one can fall off the page.
- **`updatedAt` does not move on the issue when a pull request links to it.** The ticket's `updatedAt` read 18:58:32 after the link was made at 19:14:44; it moved to 19:30:19 when the merge closed it **[ran]**. The same holds for parents and blockers ([#9 Can one GraphQL query collect everything the scout needs?][9]).

On this repo's two specs **[ran]**:

- **Closed spec, 26 build tickets:** 20 have a linked pull request, all merged. Of the 6 without, four were pushed with no pull request at all, and two had pull requests that named the ticket without a keyword.
- **Open spec, 11 build tickets:** 3 have one (two merged, one open and then merged at 19:30). The other eight are untouched.

A whole-spec run would look different **[skill]**: `/implement-spec` builds every ticket on one integration branch and opens one draft pull request "marked as closing the spec and tickets", made ready at the end. Each build ticket and the spec would then list the same pull request, a draft until the last step. Not run here.

### What a pull request reports

One query read four pull requests in different states for 1 point and 264 nodes **[ran]**:

```graphql
fragment State on PullRequest {
  number
  title
  url
  state
  isDraft
  closed
  merged
  mergedAt
  closedAt
  updatedAt
  headRefName
  baseRefName
  headRefOid
  isCrossRepository
  headRef { name }
  mergeable
  mergeStateStatus
  reviewDecision
  isInMergeQueue
  autoMergeRequest { enabledAt }
  reviewRequests(first: 5) { totalCount }
  latestReviews(first: 5) { totalCount nodes { state author { login } } }
  latestOpinionatedReviews(first: 5) { totalCount nodes { state author { login } } }
  statusCheckRollup {
    state
    contexts(first: 30) {
      totalCount
      checkRunCount
      checkRunCountsByState { state count }
      statusContextCount
      nodes {
        __typename
        ... on CheckRun { name status conclusion isRequired(pullRequestNumber: 207) }
        ... on StatusContext { context state }
      }
    }
  }
  commits(last: 1) { totalCount nodes { commit { abbreviatedOid statusCheckRollup { state } } } }
  closingIssuesReferences(first: 10) { totalCount nodes { number state parent { number } } }
  manual: closingIssuesReferences(first: 10, userLinkedOnly: true) { totalCount }
}

query PrState($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    open207: pullRequest(number: 207) { ...State }
    open194: pullRequest(number: 194) { ...State }
    merged193: pullRequest(number: 193) { ...State }
    closed108: pullRequest(number: 108) { ...State }
  }
  rateLimit { cost nodeCount remaining }
}
```

| Field | Values **[schema]** | Seen **[ran]** |
| --- | --- | --- |
| `state` | `OPEN`, `CLOSED` (closed without merging), `MERGED` | all three |
| `isDraft` | boolean | `false` on every pull request here; `true` on the `cli/cli` drafts |
| `merged`, `mergedAt`, `closedAt` | | `closedAt` set on merged and closed alike |
| `statusCheckRollup { state }` | `EXPECTED`, `ERROR`, `FAILURE`, `PENDING`, `SUCCESS`; the field itself is nullable | `SUCCESS`; `FAILURE` on seven merged pull requests of the closed spec's tickets; `null` on [#194 Release hero-synergy][pr194], where no check ran; still reported after merge and after close |
| `statusCheckRollup { contexts }` | each check run or status by name, with `status`, `conclusion`, `isRequired`; `checkRunCountsByState` counts them without listing | six check runs, three required |
| `reviewDecision` | `CHANGES_REQUESTED`, `APPROVED`, `REVIEW_REQUIRED`, or `null` | `null` on every pull request here: the ruleset asks for no review and none was left. `REVIEW_REQUIRED` on the `cli/cli` samples. `gh pr view --json reviewDecision` prints `""` for `null` |
| `latestReviews`, `reviewRequests` | connections | empty on every pull request here |
| `mergeable` | `MERGEABLE`, `CONFLICTING`, `UNKNOWN` ("still being calculated") | `MERGEABLE` on the open ones and on the one closed without merging; `UNKNOWN` on merged ones |
| `mergeStateStatus` | `CLEAN`, `BLOCKED`, `BEHIND`, `DIRTY`, `DRAFT`, `UNSTABLE`, `HAS_HOOKS`, `UNKNOWN` | `CLEAN` with green required checks; `BLOCKED` on the release pull request with no checks; `UNKNOWN` once merged |
| `headRefName`, `baseRefName` | names, kept "even if the ref has been deleted" | `worktree-173`, `main` |
| `closingIssuesReferences` | the issues it will close or closed | the build ticket, with its `parent { number }`, the spec |
| `autoMergeRequest`, `isInMergeQueue` | | `null`, `false` |

`statusCheckRollup`, `reviewDecision`, `mergeable` and `mergeStateStatus` are plain fields: selecting them on a pull request adds no points. `contexts`, `commits`, `latestReviews` and `reviewRequests` are connections and do (see [Cost](#4-cost)). Reading checks through `commits(last: 1) { nodes { commit { statusCheckRollup } } }` gives the same state as the pull request's own `statusCheckRollup` and costs a connection for it **[ran]**.

The CLI's version: `gh pr view --json` and `gh pr list --json` offer `state`, `isDraft`, `statusCheckRollup`, `reviewDecision`, `mergeable`, `mergeStateStatus`, `headRefName`, `closingIssuesReferences` and more; `gh pr checks <number|branch> --json bucket,name,state` sorts each check into `pass`, `fail`, `pending`, `skipping` or `cancel` and exits 8 while checks are pending **[ran: `--help` on 2.100.0]** ([manual][gh-manual]).

### A pushed `worktree-<n>` branch with no pull request

```graphql
query BranchWithoutPullRequest($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: "refs/heads/worktree-164") {
      name
      target { ... on Commit { abbreviatedOid messageHeadline messageBody committedDate statusCheckRollup { state } } }
      associatedPullRequests(first: 5) { totalCount }
    }
    issue(number: 164) {
      state
      assignees(first: 5) { nodes { login } }
      linkedBranches(first: 5) { totalCount }
      closedByPullRequestsReferences(first: 5, includeClosedPrs: true) { totalCount }
      timelineItems(itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT, REFERENCED_EVENT], first: 50) {
        totalCount
        nodes {
          __typename
          ... on ReferencedEvent { createdAt isDirectReference commit { abbreviatedOid messageHeadline } }
          ... on CrossReferencedEvent { createdAt willCloseTarget source { __typename ... on Issue { number } ... on PullRequest { number } } }
        }
      }
    }
  }
  rateLimit { cost nodeCount remaining }
}
```

What it shows (1 point, 70 nodes) **[ran]**:

- **From the issue: nothing.** No linked branch, no closing pull request, no timeline event for the push, although the branch's commit message names the issue. The only sign of work is the assignee.
- **From the branch, by name:** the ref exists, with its head commit (`e1248bd`, committed 2026-10-09), `statusCheckRollup: null` (no check ran on the push) and `associatedPullRequests.totalCount: 0`. `ref(qualifiedName:)` answers `null` with no error when the branch does not exist. `main`'s `compare(headRef: "worktree-164")` says `DIVERGED`, 1 ahead, 24 behind.

So the link is the branch's name, a convention of this repo (`claude -w <number>` names the branch `worktree-<number>`), not something GitHub records.

**A branch that exists is not work in flight.** Of the 43 `worktree-` branches, 41 have only merged pull requests and were never deleted; one had an open pull request and one had none **[ran]**. The list has to be read with `associatedPullRequests`.

### Routes to the pull requests, and what each costs

#### Route P1: on each build ticket, inside the spec's block

Add to the fragment's sub-issue selection:

```graphql
stateReason
closedByPullRequestsReferences(first: 5, includeClosedPrs: true, orderByState: true) {
  nodes { number url state isDraft headRefName baseRefName reviewDecision mergeable statusCheckRollup { state } }
}
```

- **Returns:** every linked pull request of every build ticket, open or closed, with its state. Both specs in one request: 37 tickets, 23 with a pull request, 1.9 s, 295 KB **[ran]**.
- **Cost:** 5 points per spec instead of 4, and 11,700 nodes instead of 11,200 **[ran]**. `first: 1` costs the same 5 points.
- **Dearer variants (dry run) [ran]:** each check by name through `contexts(first: 30)`, 10 points per spec; the head commit through `commits(last: 1)`, 10 points per spec.
- **Misses:** work with no link: a pushed branch, a pull request with no keyword or against another branch.

#### Route P2: the open pull requests list

```graphql
query OpenPullRequests($owner: String!, $repo: String!, $after: String, $dryRun: Boolean = false) {
  repository(owner: $owner, name: $repo) {
    pullRequests(states: [OPEN], first: 100, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        state
        isDraft
        headRefName
        baseRefName
        reviewDecision
        mergeable
        statusCheckRollup { state }
        closingIssuesReferences(first: 10) { nodes { number } }
      }
    }
  }
  rateLimit(dryRun: $dryRun) { cost nodeCount remaining }
}
```

- **Returns [ran]:** the 3 open pull requests, each with the issues it closes and its branch name, so a pull request with no keyword can still be matched to a ticket by `worktree-<n>`.
- **Cost [ran]:** 1 point, 1,100 nodes, per 100 open pull requests, whatever the number of specs. Inside the scout's list request: nothing extra.
- **Misses:** merged and closed pull requests, so a closed build ticket shows none. A whole-spec pull request closing more than ten issues needs a larger `first` on `closingIssuesReferences`.

#### Route P3: the branches by name

```graphql
query WorktreeBranches($owner: String!, $repo: String!, $prefix: String!, $after: String, $dryRun: Boolean = false) {
  repository(owner: $owner, name: $repo) {
    refs(refPrefix: "refs/heads/", query: $prefix, first: 100, after: $after) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        target {
          oid
          ... on Commit { committedDate statusCheckRollup { state } }
        }
        associatedPullRequests(first: 5) { totalCount nodes { number state isDraft } }
      }
    }
  }
  rateLimit(dryRun: $dryRun) { cost nodeCount remaining }
}
```

Run with `-f prefix=worktree-`.

- **Returns [ran]:** the 43 matching branches with head commit, its date, its checks and every pull request opened from the branch, merged ones included. It is the only route that shows a pushed branch with no pull request.
- **Cost [ran]:** 1 point, 600 nodes, per 100 branches. The count grows with every branch left undeleted after its merge.
- **By one name:** `ref(qualifiedName: "refs/heads/worktree-<n>")` and `pullRequests(headRefName: "worktree-<n>")`, aliased per ticket; eight such lookups cost 1 point and 30 nodes **[ran]**. `pullRequests(headRefName:)` works after the branch is deleted, since the pull request keeps the name.
- **REST twin [ran]:** `GET /repos/{o}/{r}/git/matching-refs/heads/worktree-` lists the names from the separate `core` bucket, with an `ETag`.
- **Misses:** everything in a repo that names its branches another way.

## 4. Cost

GitHub's formula **[docs]** ([Rate limits and query limits for the GraphQL API][docs-limits]): add the requests needed to fulfil each connection, assuming every `first` is reached, divide by 100, round, minimum 1. Plain fields and objects are free. A call may ask for at most 500,000 nodes, and a request that runs longer than 10 seconds is cut off and costs extra points. `rateLimit(dryRun: true)` returned the same cost as the real run every time, and eight dry runs in a row left `remaining` where it was **[ran]**.

### Every route measured

| Request | Cost | Nodes | Time | Response | How |
| --- | --- | --- | --- | --- | --- |
| The scout's list of open maps, as sent today | 1 | 200 | 0.9 s | | ran |
| The list extended with spec candidates and open pull requests | 1 | 1,400 | 1.2 s | | ran |
| Route A alone, a page of 100 | 1 | 100 | | | ran and dry run |
| Route B, a page of 100 open issues | 1 | 2,100 | | | ran |
| Route C, one search | 1 | 100 | | | ran |
| Route D, 4 maps | 1 | 400 | | | ran |
| Route D, 45 maps | 1 | 4,500 | | | dry run |
| The scout's fragment, one spec (11 children) | 4 | 11,200 | 0.75 s | 101 KB | ran |
| The scout's fragment, one spec (26 children) | 4 | 11,200 | 1.09 s | 186 KB | ran |
| The scout's fragment, 5 blocks in one request | 20 | 56,000 | | | dry run |
| The scout's fragment, 45 blocks in one request | refused: 504,000 nodes, `MAX_NODE_LIMIT_EXCEEDED` | | | | dry run |
| Fragment plus route P1, one spec | 5 | 11,700 | | | dry run |
| Fragment plus route P1 and the spec's own facts, one spec | 5 | 11,765 | | | dry run |
| The same, both specs (37 children) | 10 | 23,530 | 1.9 s | 295 KB | ran |
| The same, 5 blocks (two specs and three maps, 92 children) | 25 | 58,825 | 3.3 s | 670 KB | ran |
| The same, 45 blocks in one request | refused: 526,500 nodes | | | | dry run |
| Fragment plus P1 plus each check by name, one spec | 10 | 26,700 | | | dry run |
| Fragment plus P1 plus `commits(last: 1)`, one spec | 10 | 12,200 | | | dry run |
| Route P2, a page of 100 open pull requests | 1 | 1,100 | | | ran and dry run |
| Route P3, a page of 100 branches | 1 | 600 | | | ran |
| A flat page of 100 open `ready-for-agent` issues with every ticket field and P1 | 5 | 11,700 | 1.1 s | 99 KB | ran and dry run |
| The same flat page through `search` | 5 | 11,700 | | | ran and dry run |

Where the per-spec numbers come from: one request for `subIssues`, then one per child for each nested connection. The scout's fragment has four (`labels`, `assignees`, `blockedBy`, `comments`): 401 requests, 4 points. Route P1 adds a fifth: 501, 5 points. A connection under each pull request (`contexts` or `commits`, five pull requests per child) adds 500 more: 1,001, 10 points.

**The fragment costs 4 points per block, not 5.** The register (`docs/upstream.md`) and the resolution of [#27 What is the scout's budget: refresh cadence, caching and rate limits?][27] say 5 points per open map; that was measured on a fragment with five nested connections. The fragment shipped in `query.ts` has four **[ran]**.

**Chunks of five stand.** Five blocks with route P1 ask for 58,825 nodes and took 3.3 s for 670 KB **[ran]**. The node limit alone would allow 42 such blocks; the 10 second cut-off is the nearer wall.

The flat page is the cheapest way to read open build tickets: 5 points per 100, however many specs they belong to. It loses two things the block gives: closed build tickets (a blocker still comes back with its state through `blockedBy`, and the spec's `subIssuesSummary` still counts them), and the spec's own order (the page is in creation order).

### Estimate: 45 maps and 45 specs

With `M` open maps and `S` open specs that have build tickets, and both lists on one page:

| Shape | Points per collect | Requests |
| --- | --- | --- |
| Today: maps only | 1 + 4M | 1 + ⌈M/5⌉ |
| Specs with the scout's fragment | 1 + 4M + 4S | 1 + ⌈M/5⌉ + ⌈S/5⌉ |
| The same, pull requests from route P2 in the list request | 1 + 4M + 4S | the same |
| Specs with route P1 on every build ticket | 1 + 4M + 5S | the same |
| Open build tickets from flat pages instead of blocks | 1 + 4M + 5 per 100 open `ready-for-agent` issues | 1 + ⌈M/5⌉ + pages |

Closed maps and closed specs cost nothing in any of these: every list asks for `OPEN` only. A second page of a list costs 1 point more.

| Repo | Today | Specs, fragment only | Specs with route P1 | Flat pages |
| --- | --- | --- | --- | --- |
| This repo now (2 open maps, 1 open spec) | 9 | 13 | 14 | 14 |
| 45 maps and 45 specs, 7 of each open (the 85% finished of [#27 What is the scout's budget: refresh cadence, caching and rate limits?][27]) | 29 | 57 | 64 | 39, with two pages of open tickets |
| The same, one collect a minute for an hour | 1,740 | 3,420 | 3,840 | 2,340 |
| 45 maps and 45 specs, all open | 181 | 361 | 406 | 181 plus 5 per 100 open tickets |

Against the budget:

- **The 1,000-point pause.** Automatic refreshes pause when fewer than 1,000 of the 5,000 hourly points remain, so 4,000 are usable. The worst hour with route P1 (60 collects of 64 points) uses 3,840 and leaves 160 for every other `gh` GraphQL call on the same login, the sessions' own included. The same hour costs 1,740 today. Refreshes are caused, not timed, so a real hour is far below the worst one; but the margin that was 2,260 points becomes 160.
- **All 90 open.** One collect is 406 points and 19 requests. Ten collects reach the pause.
- **Time.** Requests run one after another. Seven maps and seven specs are one list and four chunk requests; from the timings above (3.3 s for five blocks, 1.9 s for two) that is about 12 s per collect, roughly double today's. Extrapolated, not measured.
- **Size.** A spec's body is the bulk: 55 and 63 KB here. Seven open specs are about 400 KB of body on every collect.

## Differences from what was known

1. **4 points per map, not 5** (above). The budget of [#27 What is the scout's budget: refresh cadence, caching and rate limits?][27] is 20% roomier than recorded for maps.
2. **A spec's map is closed by the time the spec exists.** All three source maps are closed; one spec is open. Nothing joins the two but the spec's prose, and the scout lists open maps only.
3. **A spec can sit open and fully built.** The closed spec was open at 26 of 26 for 39 days.
4. **Closed build tickets often have no comment** (12 of 29). The fragment's `comments(last: 1)` is the resolution of a decision ticket, not of a build ticket.
5. **`subIssues` is in the parent's order**, not creation order (section 2).
6. **`rateLimit.remaining` came from two counters.** During the session, answers carried either `resetAt` 19:46:00Z (about 125 points used) or `resetAt` 19:53:32Z (about 360 used), both with `x-ratelimit-resource: graphql`, from the same login, the same `gh` and the same edge region; each counter went down by the cost of the requests it answered. `GET /rate_limit` reported the first. The pause of [#27 What is the scout's budget: refresh cadence, caching and rate limits?][27] reads whichever counter answers. Unexplained.

## Sources

GitHub documentation, read on 2026-11-16 as source files of [`github/docs`](https://github.com/github/docs) through `gh api`:

- Linking a pull request to an issue (closing keywords, default branch only, ten manual links, commit-message keywords): <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue>
- Creating a branch to work on an issue (linked branches): <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-a-branch-for-an-issue>
- Searching issues and pull requests (`linked:pr`, `linked:issue`): <https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests>
- Filtering and searching issues and pull requests (advanced filters, review and status qualifiers): <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests>
- About parent issue and sub-issue progress fields (`parent-issue:` in Projects): <https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-parent-issue-and-sub-issue-progress-fields>
- Browsing sub-issues (`gh issue view --json parent,subIssues,subIssuesSummary`): <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/browsing-sub-issues>
- Adding sub-issues (100 per parent, eight levels): <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues>
- Rate limits and query limits for the GraphQL API (the cost formula, 500,000 nodes, the 10 second cut-off): <https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api>
- Issue event types (REST `closed`, `connected`, `cross-referenced`, `referenced`): <https://docs.github.com/en/rest/using-the-rest-api/issue-event-types>
- Changelog, API support for issues advanced search (2025-03-06): <https://github.blog/changelog/2025-03-06-github-issues-projects-api-support-for-issues-advanced-search-and-more/>

GitHub's GraphQL schema, by introspection on 2026-11-16: the types `Issue`, `PullRequest`, `Repository`, `Query`, `Ref`, `IssueFilters`, `StatusCheckRollup`, `LinkedBranch`, `CrossReferencedEvent`, `ConnectedEvent`, `ClosedEvent`, `ReferencedEvent`, `SubIssuesSummary`, `RateLimit`, `SearchResultItemConnection`, the unions `Closer` and `ReferencedSubject`, and the enums `IssueTimelineItemsItemType`, `PullRequestState`, `PullRequestReviewDecision`, `StatusState`, `MergeableState`, `MergeStateStatus`, `IssueStateReason` and `SearchType`.

GitHub CLI 2.100.0 (2026-09-03):

- `gh issue list --json`, `gh pr list --json` (the field lists they print), `gh issue develop --help`, `gh pr checks --help`; manual: <https://cli.github.com/manual/>
- `gh` 2.94.0 release notes (the sub-issue and dependency JSON fields): <https://github.com/cli/cli/releases/tag/v2.94.0>

Matt Pocock's skills at tag `v1.3.2`, read through `gh api`:

- `to-spec`: <https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/to-spec/SKILL.md>
- `to-tickets`: <https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/to-tickets/SKILL.md>
- `implement`: <https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/implement/SKILL.md>
- `implement-spec`: <https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/implement-spec/SKILL.md>
- `pr`: <https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/pr/SKILL.md>
- The GitHub tracker template: <https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/setup-matt-pocock-skills/issue-tracker-github.md>

Own results, 2026-11-16, 19:15 to 19:45 UTC:

- Against <https://github.com/dbarjs/hero-synergy>: the queries printed above, each through `gh api graphql -F query=@<file> -f owner=dbarjs -f repo=hero-synergy`; the scout's fragment from `packages/core/src/github/query.ts` at `f37446f`; REST `issues/173`, `issues/173/timeline`, `pulls?head=dbarjs:worktree-173&state=all`, `git/matching-refs/heads/worktree-16`, `rate_limit`.
- Against <https://github.com/cli/cli> (drafts, closed pull requests, `orderByState`) and <https://github.com/microsoft/vscode> (closing keywords on a base other than the default branch): public issues and pull requests found with `search`.
- Earlier numbers and method: [`docs/research/scout-graphql-query.md`](https://github.com/dbarjs/hero-synergy/blob/research/scout-graphql-query/docs/research/scout-graphql-query.md) on the `research/scout-graphql-query` branch, and the "`gh` and the GitHub API" section of [`docs/upstream.md`](https://github.com/dbarjs/hero-synergy/blob/main/docs/upstream.md).

## Not verified

- **Manual links.** No issue here was linked from the Development sidebar, so `userLinkedOnly`, `ConnectedEvent` and `DisconnectedEvent` returned nothing. That `closedByPullRequestsReferences` includes manual links rests on its argument names and the docs.
- **Linked branches.** No branch here was made with "Create a branch" or `gh issue develop`, so `linkedBranches` was always empty. That the branch link gives way to the pull request is from the docs.
- **A whole-spec run.** `/implement-spec` was not run. Its single draft pull request "marked as closing the spec and tickets" is read from the skill text. Whether one description can close a spec and 26 tickets by keyword was not tested; the docs state a limit of ten only for manual links, and the largest keyword link seen is five issues.
- **A closing keyword in a commit message alone**, with none in the pull request's description: the docs say the issue closes and the pull request is not listed. Not seen on its own.
- **`subIssuesSummary.completed`** when a sub-issue is closed as not planned or as a duplicate. Every closed build ticket here is `COMPLETED`.
- **The undocumented search qualifiers** (`has:sub-issue`, `has:parent-issue`, `no:parent-issue`, `no:sub-issue`, `sub-issue:`) behaved as the table shows on this date only. The search index's lag after a change was not measured.
- **`orderByState: true`** beyond "open first": the order of merged against closed-unmerged was not seen.
- **States not seen:** `statusCheckRollup.state` of `PENDING`, `EXPECTED` or `ERROR`; `reviewDecision` of `APPROVED` or `CHANGES_REQUESTED`; `mergeable: CONFLICTING`; `mergeStateStatus` other than `CLEAN`, `BLOCKED` and `UNKNOWN`. `isDraft: true` was seen only on `cli/cli`.
- **A commit that names an issue, pushed on a branch with no pull request:** one sample, which left no `ReferencedEvent`.
- **`updatedAt` and pull request links:** one sample.
- **A link that survives a change of base branch:** one sample, on `microsoft/vscode`.
- **The scout's decoder on a spec's answer.** The fragment's answers were checked field by field with a script; `collect.ts` was not run against them.
- **Pull requests from forks**, and issues closed from another repository.
- **GitHub Enterprise Server:** which version has `closedByPullRequestsReferences`, `subIssuesSummary` and `ISSUE_ADVANCED`.
- **Pagination of route A** past 100 open `ready-for-agent` issues, and **timings at 45 specs**: this repo has 11 such issues and two specs. Costs are certain (computed from the query); times and sizes are extrapolated.
- **The two rate-limit counters**, and absolute `remaining` values in general: the login is shared with other sessions. Every cost above is the `cost` field or a dry run, never a difference of `remaining`.
- **The 2025-03-06 changelog** was read through a fetch tool that summarises; the quoted sentence comes from that summary. Every other doc was read as its Markdown source in `github/docs`.

[1]: https://github.com/dbarjs/hero-synergy/issues/1
[9]: https://github.com/dbarjs/hero-synergy/issues/9
[27]: https://github.com/dbarjs/hero-synergy/issues/27
[36]: https://github.com/dbarjs/hero-synergy/issues/36
[37]: https://github.com/dbarjs/hero-synergy/issues/37
[56]: https://github.com/dbarjs/hero-synergy/issues/56
[123]: https://github.com/dbarjs/hero-synergy/issues/123
[130]: https://github.com/dbarjs/hero-synergy/issues/130
[132]: https://github.com/dbarjs/hero-synergy/issues/132
[155]: https://github.com/dbarjs/hero-synergy/issues/155
[163]: https://github.com/dbarjs/hero-synergy/issues/163
[164]: https://github.com/dbarjs/hero-synergy/issues/164
[168]: https://github.com/dbarjs/hero-synergy/issues/168
[170]: https://github.com/dbarjs/hero-synergy/issues/170
[173]: https://github.com/dbarjs/hero-synergy/issues/173
[195]: https://github.com/dbarjs/hero-synergy/issues/195
[198]: https://github.com/dbarjs/hero-synergy/issues/198
[pr194]: https://github.com/dbarjs/hero-synergy/pull/194
[pr207]: https://github.com/dbarjs/hero-synergy/pull/207
[cli9789]: https://github.com/cli/cli/issues/9789
[cli13906]: https://github.com/cli/cli/issues/13906
[cli15019]: https://github.com/cli/cli/issues/15019
[cli15065]: https://github.com/cli/cli/pull/15065
[vscode343811]: https://github.com/microsoft/vscode/pull/343811
[docs-linking]: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
[docs-branch]: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-a-branch-for-an-issue
[docs-search]: https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests
[docs-filter]: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests
[docs-parent-field]: https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-parent-issue-and-sub-issue-progress-fields
[docs-limits]: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
[docs-events]: https://docs.github.com/en/rest/using-the-rest-api/issue-event-types
[changelog-advanced]: https://github.blog/changelog/2025-03-06-github-issues-projects-api-support-for-issues-advanced-search-and-more/
[gh-2940]: https://github.com/cli/cli/releases/tag/v2.94.0
[gh-manual]: https://cli.github.com/manual/
