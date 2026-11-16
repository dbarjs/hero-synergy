#!/bin/bash
# Summaries read from the walk's logs: per Implement spec run, the subagents by kind and the subagents'
# own writes to the remote and to GitHub; every state a pull request was read in; the first reading of
# each change to an issue or a pull request.
O="$(cd "$(dirname "$0")" && pwd)"
for run in "A 424aaa6e" "B 86b1c48a" "C ffaab4cc" "D a3ed4617"; do
  set -- $run
  echo "== run $1 ($2): Agent calls"
  jq -r --arg s "$2" 'select(.session_id | startswith($s)) | select(.hook_event_name == "PreToolUse" and .tool_name == "Agent") | "\(.tool_input.description | sub(" ?#?[0-9]+.*"; "") | sub(" (of|into|branch|spec).*"; "")) isolation=\(.tool_input.isolation // "none") background=\(.tool_input.run_in_background // "unset") type=\(.tool_input.subagent_type)"' "$O/hooks.jsonl" | sort | uniq -c
  echo "== run $1: subagents' pushes and GitHub writes"
  jq -r --arg s "$2" 'select(.session_id | startswith($s)) | select(.hook_event_name == "PreToolUse" and .tool_name == "Bash" and .agent_id != null) | select(.tool_input.command | test("(git push|gh (issue|pr) (comment|close|edit|create|ready|merge))")) | "\(.ts[11:19]) \(.agent_id[0:8]) \(.tool_input.command | gsub("\n"; " ") | .[0:110])"' "$O/hooks.jsonl"
  echo "== run $1: SubagentStart by type"
  jq -r --arg s "$2" 'select(.session_id | startswith($s)) | select(.hook_event_name == "SubagentStart") | .agent_type' "$O/hooks.jsonl" | sort | uniq -c
done
echo "== pull request readings"
jq -r '.ts as $ts | .snap.prs[] | "\($ts) #\(.n) \(.state) draft=\(.draft) mergeable=\(.mergeable) mergeState=\(.mergeState) review=\(.review) commits=\(.commits) closes=\(.closes | map(tostring) | join(",")) bodyLength=\(.body | length)"' "$O/github.jsonl" | awk '{k=$2; $1=""; if (last[k] != $0) { print t[k]=$0 } last[k]=$0}' FS=' ' OFS=' '
echo "== refs over time"
jq -r '"\(.ts) \(.snap.refs | join(", "))"' "$O/github.jsonl" | awk '{t=$1; $1=""; if ($0 != last) print t $0; last=$0}'
