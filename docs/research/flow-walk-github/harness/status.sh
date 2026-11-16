#!/bin/bash
# One look at the walk: the newest GitHub reading, each clone's worktrees, the registry and both screens.
O="$(cd "$(dirname "$0")" && pwd)"
W="$(dirname "$O")"
echo "== $(date -u +%H:%M:%S) github (last change $(tail -1 "$O/github.jsonl" | jq -r .ts))"
tail -1 "$O/github.jsonl" | jq -r '.snap | ("refs: " + (.refs | join(", "))), (.issues[] | select(.n >= 26) | "#\(.n) \(.state) assignees=\(.assignees|join(",")) labels=\(.labels|join(",")) boxes=\(.boxes) comments=\(.comments) closedBy=\(.closedBy|map(tostring)|join(","))"), (.prs[] | "PR #\(.n) \(.state) draft=\(.draft) \(.head)->\(.base) mergeable=\(.mergeable)/\(.mergeState) closes=\(.closes|map(tostring)|join(",")) commits=\(.commits) :: \(.title)")'
for c in a b; do
  echo "== worktrees $c"; git -C "$W/$c/repo" worktree list | sed "s#$W/##"
done
echo "== registry"; tail -1 "$O/registry.log" | cut -c1-9 ; tail -1 "$O/registry.log" | cut -c10- | jq -r '.[] | "\(.name[0:40]) \(.status) \(.waitingFor // "")"'
for w in impl-c impl-d; do echo "== screen $w"; tmux capture-pane -t "walk:$w" -p 2>/dev/null | grep -v '^\s*$' | tail -n "${1:-14}" | cut -c1-200; done
