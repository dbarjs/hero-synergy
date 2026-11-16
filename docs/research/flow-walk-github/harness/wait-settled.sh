#!/bin/bash
# Waits until no session of the given clone reads busy for 3 polls in a row (or the timeout passes),
# then prints that clone's last registry readings and the given tmux window's screen.
# Usage: wait-settled.sh <a|b> <tmux window> [timeout seconds] [screen lines].
O="$(cd "$(dirname "$0")" && pwd)"
W="$(dirname "$O")"
clone="$1"; win="$2"; timeout="${3:-900}"; start=$(date +%s); calm=0
sleep 4
until [ "$calm" -ge 3 ] || [ $(( $(date +%s) - start )) -ge "$timeout" ]; do
  if claude agents --json 2>/dev/null | jq -e --arg w "$W/$clone/" '[.[] | select(.cwd | startswith($w)) | select(.status=="busy")] | length == 0' >/dev/null; then calm=$((calm+1)); else calm=0; fi
  sleep 3
done
echo "waited $(( $(date +%s) - start ))s"
claude agents --json 2>/dev/null | jq -c --arg w "$W/$clone/" '[.[] | select(.cwd | startswith($w)) | del(.startedAt)]' | cut -c1-900
echo "------ screen"
tmux capture-pane -t "walk:$win" -p -S -400 | grep -v '^\s*$' | tail -n "${4:-70}"
