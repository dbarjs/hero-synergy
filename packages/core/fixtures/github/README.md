# GitHub collect recordings

`gh api graphql -i` runs for this repo, served by `ProcessRunner.replay` to the tests in `src/github/`. Each file is a `ProcessRecording`; the `args` carry the query text, so a change to the query in `src/github/query.ts` finds no recording until these are recorded again. Record a new one by running `listMapsArgs` or `mapsArgs` through `gh` and storing `{ command, args, stdout, stderr, exitCode }`.

Recorded from real runs on 2026-10-07 with `gh` 2.100.0:

- `list-open-maps`: the list request. Open `wayfinder:map` issues #1 and #64, and the repository's five `wayfinder:` labels.
- `maps-1-64`: both maps with their sub-issues, the reply the snapshot test reads.
- `maps-1-64-2-3-4`, `maps-5-6`: the replies for chunks of five and two. Issues #2 to #6 are tickets, not maps; `issue(number:)` answers for any issue, so they stand in for more maps.
- `maps-not-found`: a chunk naming #9999, which does not exist: `NOT_FOUND` at `["repository","m9999"]`, exit 1, the other two maps answered.
- `list-not-logged-in`: no token, exit 4, nothing on stdout.
- `list-unauthorized`: a bad token, `HTTP/2.0 401`, exit 1.
- `list-network`: a proxy that refuses the connection, no HTTP response, exit 1.

Built by hand from the real ones, because the failure cannot be provoked on demand:

- `list-secondary-limit`: a 403 with `Retry-After: 60` and GitHub's secondary-limit message.
- `list-rate-limited`: a 200 with a GraphQL `RATE_LIMITED` error and `X-Ratelimit-Remaining: 0`.
- `list-server-error`: a 502.
- `list-timeout`: `exitCode: null`, `timedOut: true`, what the runner returns when it kills `gh`.
- `maps-graphql-error`: an `INTERNAL` GraphQL error on one map.
- `list-seven-maps`, `list-with-gone-map`: the real list with other numbers in it.
- `list-task-list-map`, `maps-task-list`: a map whose body lists its children as a task list and which has no native sub-issues.
