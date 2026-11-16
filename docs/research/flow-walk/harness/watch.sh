#!/bin/bash
# Polls what the Cockpit can see from outside, logging only changes:
# the session registry (entries under flow-walk), git (worktrees, branches, remote) and the tracker (.scratch status lines).
O="$(cd "$(dirname "$0")" && pwd)"
W="$(dirname "$O")"
R="$W/repo"
while true; do
  ts=$(date -u +%H:%M:%S)
  claude agents --json 2>/dev/null | jq -c '[.[] | select(.cwd|test("flow-walk")) | del(.startedAt)]' > "$O/.reg.cur"
  if ! cmp -s "$O/.reg.cur" "$O/.reg.prev"; then echo "$ts $(cat "$O/.reg.cur")" >> "$O/registry.log"; cp "$O/.reg.cur" "$O/.reg.prev"; fi
  {
    echo "## worktrees"; git -C "$R" worktree list 2>&1
    echo "## branches"; git -C "$R" branch -a -v --no-abbrev 2>&1 | cut -c1-140
    echo "## remote"; git -C "$W/remote.git" branch -v 2>&1 | cut -c1-140
    echo "## main checkout"; git -C "$R" status --short --branch 2>&1
    echo "## tracker"; find "$R/.scratch" -name '*.md' 2>/dev/null | sort | while read -r f; do echo "${f#$R/} :: $(grep -m3 -iE '^\**(status|blocked by)' "$f" | tr '\n' ' ')"; done
  } > "$O/.git.cur"
  if ! cmp -s "$O/.git.cur" "$O/.git.prev"; then { echo "===== $ts"; cat "$O/.git.cur"; } >> "$O/git.log"; cp "$O/.git.cur" "$O/.git.prev"; fi
  sleep 2
done
