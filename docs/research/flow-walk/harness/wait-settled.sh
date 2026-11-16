#!/bin/bash
# Waits until no flow-walk session in the registry reads busy for 3 polls in a row (or the timeout passes),
# then prints the registry's last lines and the given tmux window's screen.
O="$(cd "$(dirname "$0")" && pwd)"
win="$1"; timeout="${2:-900}"; start=$(date +%s); calm=0
sleep 4
until [ "$calm" -ge 3 ] || [ $(( $(date +%s) - start )) -ge "$timeout" ]; do
  if claude agents --json 2>/dev/null | jq -e '[.[] | select(.cwd|test("flow-walk")) | select(.status=="busy")] | length == 0' >/dev/null; then calm=$((calm+1)); else calm=0; fi
  sleep 3
done
echo "waited $(( $(date +%s) - start ))s"
tail -n 4 "$O/registry.log" | cut -c1-900
echo "------ screen"
tmux capture-pane -t "flowwalk:$win" -p -S -300 | grep -v '^\s*$' | tail -n "${3:-70}"
