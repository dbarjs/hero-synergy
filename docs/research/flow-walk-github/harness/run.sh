#!/bin/bash
# Launches claude as a VS Code terminal would: in one clone of the throwaway repo, with the parent
# session's variables removed. Usage: run.sh <a|b> <ticket-number-or-> <claude args…>.
# A ticket number sets the Cockpit's env for a tracked session (HERO_SYNERGY_TICKET, HERO_SYNERGY_EVENTS);
# "-" launches a plain terminal with no env. Every claude argument is passed unchanged; the line is logged first.
O="$(cd "$(dirname "$0")" && pwd)"
clone="$1"; ticket="$2"; shift 2
cd "$(dirname "$O")/$clone/repo" || exit 1
{
  printf '%s launch[%s]:' "$(date -u +%H:%M:%S)" "$clone"
  [ "$ticket" != "-" ] && printf ' HERO_SYNERGY_TICKET=%s HERO_SYNERGY_EVENTS=<obs>/events-%s.jsonl' "$ticket" "$clone"
  printf ' claude'
  printf ' %q' "$@"
  echo
} >> "$O/launches.log"
extra=()
if [ "$ticket" != "-" ]; then
  touch "$O/events-$clone.jsonl"
  extra=(HERO_SYNERGY_TICKET="$ticket" HERO_SYNERGY_EVENTS="$O/events-$clone.jsonl")
fi
exec env -u CLAUDECODE -u CLAUDE_CODE_SSE_PORT -u AI_AGENT -u CLAUDE_CODE_ENTRYPOINT \
  -u CLAUDE_CODE_MESSAGING_SOCKET -u CLAUDE_CODE_MESSAGING_TOKEN -u CLAUDE_CODE_BRIDGE_SESSION_ID \
  -u CLAUDE_CODE_EXECPATH -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_CHILD_SESSION \
  -u CLAUDE_CODE_SESSION_ATTENDED -u CLAUDE_PID -u CLAUDE_EFFORT \
  "${extra[@]}" claude "$@"
