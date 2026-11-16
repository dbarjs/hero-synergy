#!/bin/bash
# Ends the sessions in the given tmux windows with /exit and shows what each screen and the registry say next.
# Usage: step-exit.sh <clone>:<window> …
O="$(cd "$(dirname "$0")" && pwd)"
W="$(dirname "$O")"
for pair in "$@"; do "$O/type.sh" "${pair%%:*}" "${pair##*:}" '/exit'; done
sleep 6
for pair in "$@"; do
  w="${pair##*:}"
  echo "------ $w"; tmux capture-pane -t "walk:$w" -p 2>/dev/null | grep -v '^\s*$' | tail -14 | cut -c1-220
done
echo "------ registry"
claude agents --json 2>/dev/null | jq -c --arg w "$W/" '[.[] | select(.cwd | startswith($w)) | {name: .name[0:30], status, waitingFor}]'
