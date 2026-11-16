# The Bash commands, in full, of the session whose id starts with $s that match the regular expression $re.
# $who is "main" for the orchestrator's own calls, "sub" for its subagents', "all" for both.
select(.session_id | startswith($s))
| select(.hook_event_name == "PreToolUse" and .tool_name == "Bash")
| select(($who == "all") or ($who == "main" and (.agent_id == null)) or ($who == "sub" and (.agent_id != null)))
| select(.tool_input.command | test($re))
| "\(.ts[11:19]) [\((.agent_id // "main")[0:8])] \(.cwd | sub(".*scratchpad/walk/"; ""))\n\(.tool_input.command)\n"
