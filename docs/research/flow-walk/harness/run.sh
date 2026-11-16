#!/bin/bash
# Launches claude as a VS Code terminal would: in the throwaway repo, with the parent session's
# variables removed. Every argument goes to claude unchanged; the line is logged first.
O="$(cd "$(dirname "$0")" && pwd)"
cd "$(dirname "$O")/repo" || exit 1
printf '%s launch: claude' "$(date -u +%H:%M:%S)" >> "$O/launches.log"
printf ' %q' "$@" >> "$O/launches.log"
echo >> "$O/launches.log"
exec env -u CLAUDECODE -u CLAUDE_CODE_SSE_PORT -u AI_AGENT -u CLAUDE_CODE_ENTRYPOINT \
  -u CLAUDE_CODE_MESSAGING_SOCKET -u CLAUDE_CODE_MESSAGING_TOKEN -u CLAUDE_CODE_BRIDGE_SESSION_ID \
  -u CLAUDE_CODE_EXECPATH -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_CHILD_SESSION \
  -u CLAUDE_CODE_SESSION_ATTENDED -u CLAUDE_PID -u CLAUDE_EFFORT \
  claude "$@"
