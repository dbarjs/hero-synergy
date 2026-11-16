# One line per interesting hook event of session $s: lifecycle events, Agent/Skill calls, and Bash calls that touch branches or worktrees.
select(.session_id == $s)
| select(
    .hook_event_name != "PreToolUse"
    or (.tool_name | IN("Agent", "Skill", "EnterWorktree", "ExitWorktree", "AskUserQuestion"))
    or (.tool_name == "Bash" and (.tool_input.command | test("(worktree|checkout|switch|branch|merge|push|reset|rebase|commit|gh )")))
  )
| [ .ts[11:19],
    .hook_event_name,
    (.agent_id // "main"),
    (.agent_type // ""),
    (.tool_name // ""),
    ((.tool_input.description // .tool_input.skill // .tool_input.command // .message // "") | tostring | gsub("\n"; " ⏎ ") | .[0:($w|tonumber)]),
    (if .tool_name == "Agent" then (.tool_input | {subagent_type, isolation, run_in_background, model, name} | tostring) else "" end),
    (.cwd | sub(".*scratchpad/"; ""))
  ]
| join(" | ")
