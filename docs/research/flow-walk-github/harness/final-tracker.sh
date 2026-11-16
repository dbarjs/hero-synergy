#!/bin/bash
# Saves the tracker as the walk left it: every issue and pull request with its body, comments and timeline.
# One GraphQL request. Usage: final-tracker.sh <owner> <name> > tracker-final.json
Q='query($owner:String!,$name:String!){
  rateLimit{cost remaining}
  repository(owner:$owner,name:$name){
    refs(refPrefix:"refs/heads/",first:50){nodes{name target{oid}}}
    issues(first:50,orderBy:{field:CREATED_AT,direction:ASC}){nodes{
      number title state stateReason createdAt closedAt body
      author{login}
      assignees(first:5){nodes{login}}
      labels(first:10){nodes{name}}
      parent{number}
      subIssues(first:20){nodes{number}}
      subIssuesSummary{total completed percentCompleted}
      blockedBy(first:10){nodes{number state}}
      blocking(first:10){nodes{number state}}
      closedByPullRequestsReferences(first:5,includeClosedPrs:true){nodes{number}}
      comments(first:10){nodes{createdAt author{login} body}}
      timelineItems(first:40){nodes{
        __typename
        ... on AssignedEvent{createdAt actor{login} assignee{... on User{login}}}
        ... on LabeledEvent{createdAt actor{login} label{name}}
        ... on ClosedEvent{createdAt actor{login} stateReason closer{__typename ... on PullRequest{number} ... on Commit{oid}}}
        ... on CrossReferencedEvent{createdAt willCloseTarget source{__typename ... on PullRequest{number} ... on Issue{number}}}
        ... on ConnectedEvent{createdAt subject{__typename ... on PullRequest{number}}}
        ... on ReferencedEvent{createdAt commit{oid}}
        ... on SubIssueAddedEvent{createdAt subIssue{number}}
        ... on ParentIssueAddedEvent{createdAt parent{number}}
        ... on BlockedByAddedEvent{createdAt blockingIssue{number}}
        ... on BlockingAddedEvent{createdAt blockedIssue{number}}
        ... on IssueComment{createdAt}
      }}
    }}
    pullRequests(first:10,orderBy:{field:CREATED_AT,direction:ASC}){nodes{
      number title state isDraft createdAt mergedAt headRefName baseRefName mergeable mergeStateStatus reviewDecision body
      author{login}
      assignees(first:5){nodes{login}}
      labels(first:10){nodes{name}}
      closingIssuesReferences(first:30){nodes{number state}}
      mergeCommit{oid}
      commits(last:1){totalCount nodes{commit{oid statusCheckRollup{state}}}}
      comments(first:10){nodes{createdAt body}}
      timelineItems(first:60){nodes{
        __typename
        ... on AssignedEvent{createdAt actor{login}}
        ... on ReadyForReviewEvent{createdAt actor{login}}
        ... on ConvertToDraftEvent{createdAt actor{login}}
        ... on MergedEvent{createdAt actor{login} mergeRefName}
        ... on ClosedEvent{createdAt}
        ... on HeadRefForcePushedEvent{createdAt}
        ... on PullRequestCommit{commit{oid committedDate messageHeadline}}
        ... on CrossReferencedEvent{createdAt source{__typename ... on Issue{number}}}
      }}
    }}
  }
}'
gh api graphql -f query="$Q" -f owner="$1" -f name="$2"
