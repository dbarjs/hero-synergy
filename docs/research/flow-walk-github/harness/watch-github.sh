#!/bin/bash
# Polls GitHub every 10 seconds with one GraphQL request, logging only changes: the branches,
# every issue (state, assignees, labels, parent, sub-issues, blockers, comment count, boxes, the
# pull requests set to close it) and every pull request (state, draft, branches, mergeability,
# body, the issues it closes). Read-only. Usage: watch-github.sh <owner> <name>.
O="$(cd "$(dirname "$0")" && pwd)"
owner="$1"; name="$2"
Q='query($owner:String!,$name:String!){
  rateLimit{cost remaining}
  repository(owner:$owner,name:$name){
    refs(refPrefix:"refs/heads/",first:50){nodes{name target{oid}}}
    issues(first:40,orderBy:{field:CREATED_AT,direction:ASC}){nodes{
      number title state stateReason body
      assignees(first:5){nodes{login}}
      labels(first:10){nodes{name}}
      parent{number}
      subIssues(first:20){nodes{number}}
      blockedBy(first:10){nodes{number state}}
      comments{totalCount}
      closedByPullRequestsReferences(first:5,includeClosedPrs:true){nodes{number}}
    }}
    pullRequests(first:10,orderBy:{field:CREATED_AT,direction:ASC}){nodes{
      number title state isDraft headRefName baseRefName mergeable mergeStateStatus reviewDecision body
      closingIssuesReferences(first:30){nodes{number}}
      commits{totalCount}
      comments{totalCount}
      assignees(first:5){nodes{login}}
      labels(first:10){nodes{name}}
    }}
  }
}'
SHAPE='{
  refs: [.data.repository.refs.nodes[] | "\(.name) \(.target.oid[0:7])"],
  issues: [.data.repository.issues.nodes[] | {
    n: .number, title, state, reason: .stateReason,
    assignees: [.assignees.nodes[].login], labels: [.labels.nodes[].name],
    parent: (.parent.number // null), sub: [.subIssues.nodes[].number],
    blockedBy: [.blockedBy.nodes[] | "\(.number) \(.state)"],
    comments: .comments.totalCount,
    boxes: "\([.body | scan("- \\[[xX]\\]")] | length)/\([.body | scan("- \\[[ xX]\\]")] | length)",
    bodyLength: (.body | length),
    closedBy: [.closedByPullRequestsReferences.nodes[].number]
  }],
  prs: [.data.repository.pullRequests.nodes[] | {
    n: .number, title, state, draft: .isDraft, head: .headRefName, base: .baseRefName,
    mergeable, mergeState: .mergeStateStatus, review: .reviewDecision,
    closes: [.closingIssuesReferences.nodes[].number],
    commits: .commits.totalCount, comments: .comments.totalCount,
    assignees: [.assignees.nodes[].login], labels: [.labels.nodes[].name], body
  }]
}'
while true; do
  ts=$(date -u +%H:%M:%S)
  if gh api graphql -f query="$Q" -f owner="$owner" -f name="$name" > "$O/.gh.raw" 2> "$O/.gh.err"; then
    jq -c "$SHAPE" "$O/.gh.raw" > "$O/.gh.cur"
    if [ -s "$O/.gh.cur" ] && ! cmp -s "$O/.gh.cur" "$O/.gh.prev"; then
      echo "{\"ts\":\"$ts\",\"snap\":$(cat "$O/.gh.cur")}" >> "$O/github.jsonl"
      cp "$O/.gh.cur" "$O/.gh.prev"
    fi
    jq -c --arg ts "$ts" '{ts: $ts} + .data.rateLimit' "$O/.gh.raw" > "$O/.gh.rate"
    remaining=$(jq -r '.data.rateLimit.remaining' "$O/.gh.raw")
    # Leave room for every other session on this account: slow right down when the budget runs low.
    if [ "${remaining:-0}" -lt 1200 ]; then sleep 110; fi
  else
    echo "$ts $(tr '\n' ' ' < "$O/.gh.err" | cut -c1-300)" >> "$O/github-errors.log"
  fi
  sleep 10
done
