#!/bin/bash
# Polls, every 2 seconds, what the Cockpit can see on this machine, logging only changes:
# the session registry (entries whose cwd is under the walk) and, per clone, git's worktrees,
# branches (local and remote-tracking) and the checkout's status. Read-only.
O="$(cd "$(dirname "$0")" && pwd)"
W="$(dirname "$O")"
while true; do
  ts=$(date -u +%H:%M:%S)
  claude agents --json 2>/dev/null | jq -c --arg w "$W/" '[.[] | select(.cwd | startswith($w)) | del(.startedAt)]' > "$O/.reg.cur"
  if [ -s "$O/.reg.cur" ] && ! cmp -s "$O/.reg.cur" "$O/.reg.prev"; then echo "$ts $(cat "$O/.reg.cur")" >> "$O/registry.log"; cp "$O/.reg.cur" "$O/.reg.prev"; fi
  for c in a b; do
    R="$W/$c/repo"
    [ -d "$R/.git" ] || continue
    {
      echo "## worktrees"; git -C "$R" worktree list 2>&1
      echo "## branches"; git -C "$R" branch -a -v --no-abbrev 2>&1 | cut -c1-150
      echo "## checkout"; git -C "$R" status --short --branch 2>&1
    } > "$O/.git-$c.cur"
    if ! cmp -s "$O/.git-$c.cur" "$O/.git-$c.prev"; then { echo "===== $ts"; cat "$O/.git-$c.cur"; } >> "$O/git-$c.log"; cp "$O/.git-$c.cur" "$O/.git-$c.prev"; fi
  done
  sleep 2
done
