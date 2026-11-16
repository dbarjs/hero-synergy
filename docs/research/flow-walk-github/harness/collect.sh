#!/bin/bash
# Copies the walk's logs and scripts into the research folder given as $1, slimming the two big logs:
#   hooks.jsonl          every hook payload, minus the path and id fields that repeat on every line;
#   github-changes.log   from the watcher's full readings, only the lines that changed between readings.
O="$(cd "$(dirname "$0")" && pwd)"
D="$1"
mkdir -p "$D/harness"
cp "$O/launches.log" "$O/registry.log" "$D/"
cp "$O/git-a.log" "$D/snapshots-a.log"
cp "$O/git-b.log" "$D/snapshots-b.log"
cp "$O/events-a.jsonl" "$D/status-events-a.jsonl"
cp "$O/events-b.jsonl" "$D/status-events-b.jsonl"
jq . "$O/tracker-final.json" > "$D/tracker-final.json"
jq -c 'del(.transcript_path, .agent_transcript_path, .scratchpad_dir, .prompt_id, .tool_use_id, .session_crons, .background_tasks, .stop_hook_active, .effort)' "$O/hooks.jsonl" > "$D/hooks.jsonl"
jq -r '.ts as $ts | .snap
  | ("\($ts)\tref \(.refs[])"),
    (.issues[] | "\($ts)\tissue #\(.n) \(.state)\(if .reason then "/" + .reason else "" end) assignees=[\(.assignees | join(","))] labels=[\(.labels | join(","))] parent=\(.parent // "-") sub=[\(.sub | map(tostring) | join(","))] blockedBy=[\(.blockedBy | join(", "))] comments=\(.comments) boxes=\(.boxes) bodyLength=\(.bodyLength) closedBy=[\(.closedBy | map(tostring) | join(","))] :: \(.title)"),
    (.prs[] | "\($ts)\tpull #\(.n) \(.state) draft=\(.draft) \(.head)->\(.base) mergeable=\(.mergeable) mergeState=\(.mergeState) review=\(.review // "-") closes=[\(.closes | map(tostring) | join(","))] commits=\(.commits) comments=\(.comments) assignees=[\(.assignees | join(","))] bodyLength=\(.body | length) :: \(.title)")' "$O/github.jsonl" \
  | awk -F'\t' '{ split($2, w, " "); key = w[1] " " w[2]; if (w[1] == "ref") key = "ref " w[2]; if (seen[key] != $2) { if ($1 != last) { print "===== " $1; last = $1 } print $2; seen[key] = $2 } }' > "$D/github-changes.log"
for f in run.sh type.sh hook.sh watch-local.sh watch-github.sh wait-settled.sh wait-change.sh status.sh summarise.sh final-tracker.sh collect.sh events.jq commands.jq step-totickets.sh step-totickets-cd.sh step-implspec.sh step-implspec-cd.sh step-exit.sh l-tospec-a.sh l-tospec-b.sh l-tospec-c.sh l-tospec-d.sh l-totickets-a.sh l-totickets-c.sh l-implspec-a.sh l-implspec-b.sh l-implspec-c.sh l-implspec-d.sh; do cp "$O/$f" "$D/harness/"; done
cp "$(dirname "$O")/a/repo/.claude/settings.json" "$D/harness/throwaway-claude-settings.json"
cp "$(dirname "$O")/a/repo/CLAUDE.md" "$D/harness/throwaway-CLAUDE.md"
ls -la "$D" "$D/harness" | awk '{print $5, $9}'
